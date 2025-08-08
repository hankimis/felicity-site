const {onObjectFinalized} = require("firebase-functions/v2/storage");
const {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentDeleted,
} = require("firebase-functions/v2/firestore");
const {https} = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");
const sharp = require("sharp");
const {Storage} = require("@google-cloud/storage");
const path = require("path");
const os = require("os");
const fs = require("fs");

admin.initializeApp();
const storage = new Storage();
const db = admin.firestore();

// =============================
// OAuth helper utilities
// =============================
const OAUTH_COOKIE_NAME = "onbit_oauth_state";

function createState() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function setStateCookie(res, state, host) {
  const isSecure = true;
  const cookie = `${OAUTH_COOKIE_NAME}=${state}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax;${
    isSecure ? " Secure;" : ""
  }`;
  res.setHeader("Set-Cookie", cookie);
}

function readStateCookie(req) {
  const cookieHeader = req.get("cookie") || req.headers.cookie || "";
  const parts = cookieHeader.split(/;\s*/);
  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === OAUTH_COOKIE_NAME) return value;
  }
  return null;
}

async function upsertFirebaseUser({ uid, email, displayName, photoURL, provider }) {
  try {
    await admin.auth().getUser(uid);
    await admin.auth().updateUser(uid, {
      email: email || undefined,
      displayName: displayName || undefined,
      photoURL: photoURL || undefined,
    });
  } catch (e) {
    await admin.auth().createUser({
      uid,
      email: email || undefined,
      displayName: displayName || undefined,
      photoURL: photoURL || undefined,
    });
  }

  // 기본 클레임 세팅 (필요 시 확장 가능)
  await admin.auth().setCustomUserClaims(uid, { provider });
}

function sendAuthResultPage(res, customToken) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>로그인 처리</title></head><body>
<script>
  (function(){
    var token = ${JSON.stringify(customToken)};
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ source: 'onbit-auth', token: token }, '*');
        window.close();
      } else {
        location.href = '/login/?token=' + encodeURIComponent(token);
      }
    } catch (e) {
      location.href = '/login/?token=' + encodeURIComponent(token);
    }
  })();
<\/script>
로그인 처리 중...
</body></html>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

// Define Secrets (set via: firebase functions:secrets:set NAME)
const NAVER_CLIENT_ID = defineSecret("NAVER_CLIENT_ID");
const NAVER_CLIENT_SECRET = defineSecret("NAVER_CLIENT_SECRET");
const KAKAO_REST_KEY = defineSecret("KAKAO_REST_KEY");
const KAKAO_CLIENT_SECRET = defineSecret("KAKAO_CLIENT_SECRET");

// =============================
// NAVER OAuth 2.0 → Firebase Custom Token
// =============================
exports.naverAuth = https.onRequest({ region: "asia-northeast3", secrets: [NAVER_CLIENT_ID, NAVER_CLIENT_SECRET] }, async (req, res) => {
  try {
    const clientId = NAVER_CLIENT_ID.value();
    const clientSecret = NAVER_CLIENT_SECRET.value();
    if (!clientId || !clientSecret) {
      res.status(500).json({ error: "NAVER env not configured" });
      return;
    }

    const baseUrl = `https://${req.get("host")}${req.path}`;
    const redirectUri = baseUrl; // self-callback

    if (!req.query.code) {
      // Start flow
      const state = createState();
      setStateCookie(res, state, req.get("host"));
      const authUrl = new URL("https://nid.naver.com/oauth2.0/authorize");
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("state", state);
      // 요청 범위 (이메일 포함)
      authUrl.searchParams.set("scope", "profile email");
      res.redirect(302, authUrl.toString());
      return;
    }

    // Callback phase
    const returnedState = req.query.state;
    const cookieState = readStateCookie(req);
    if (!cookieState || cookieState !== returnedState) {
      res.status(400).send("Invalid state");
      return;
    }

    const code = req.query.code;
    const tokenResp = await fetch("https://nid.naver.com/oauth2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code: String(code),
        state: String(returnedState),
        redirect_uri: redirectUri,
      }),
    });
    const tokenJson = await tokenResp.json();
    if (!tokenJson.access_token) {
      res.status(400).json({ error: "NAVER token exchange failed", details: tokenJson });
      return;
    }

    const meResp = await fetch("https://openapi.naver.com/v1/nid/me", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const meJson = await meResp.json();
    const profile = meJson && meJson.response ? meJson.response : {};
    const uid = `naver:${profile.id}`;
    const email = profile.email || undefined;
    const displayName = profile.name || profile.nickname || "네이버 사용자";
    const photoURL = profile.profile_image || undefined;

    await upsertFirebaseUser({ uid, email, displayName, photoURL, provider: "naver" });
    const customToken = await admin.auth().createCustomToken(uid, { provider: "naver" });
    sendAuthResultPage(res, customToken);
  } catch (e) {
    console.error("NAVER OAuth error", e);
    res.status(500).send("NAVER OAuth failed");
  }
});

// =============================
// KAKAO OAuth 2.0 → Firebase Custom Token
// =============================
exports.kakaoAuth = https.onRequest({ region: "asia-northeast3", secrets: [KAKAO_REST_KEY, KAKAO_CLIENT_SECRET] }, async (req, res) => {
  try {
    const clientId = KAKAO_REST_KEY.value(); // Kakao REST API 키
    const clientSecret = KAKAO_CLIENT_SECRET.value() || ""; // 선택
    if (!clientId) {
      res.status(500).json({ error: "KAKAO env not configured" });
      return;
    }

    const baseUrl = `https://${req.get("host")}${req.path}`;
    const redirectUri = baseUrl; // self-callback

    if (!req.query.code) {
      // Start flow
      const state = createState();
      setStateCookie(res, state, req.get("host"));
      const authUrl = new URL("https://kauth.kakao.com/oauth/authorize");
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("scope", "profile_nickname account_email");
      res.redirect(302, authUrl.toString());
      return;
    }

    // Callback phase
    const returnedState = req.query.state;
    const cookieState = readStateCookie(req);
    if (!cookieState || cookieState !== returnedState) {
      res.status(400).send("Invalid state");
      return;
    }

    const code = req.query.code;
    const tokenResp = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code: String(code),
        redirect_uri: redirectUri,
      }),
    });
    const tokenJson = await tokenResp.json();
    if (!tokenJson.access_token) {
      res.status(400).json({ error: "KAKAO token exchange failed", details: tokenJson });
      return;
    }

    const meResp = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const meJson = await meResp.json();
    const kakaoAccount = (meJson && meJson.kakao_account) || {};
    const profile = kakaoAccount.profile || {};
    const uid = `kakao:${meJson.id}`;
    const email = kakaoAccount.email || undefined;
    const displayName = profile.nickname || "카카오 사용자";
    const photoURL = profile.profile_image_url || profile.thumbnail_image_url || undefined;

    await upsertFirebaseUser({ uid, email, displayName, photoURL, provider: "kakao" });
    const customToken = await admin.auth().createCustomToken(uid, { provider: "kakao" });
    sendAuthResultPage(res, customToken);
  } catch (e) {
    console.error("KAKAO OAuth error", e);
    res.status(500).send("KAKAO OAuth failed");
  }
});

// 기존 프로필 썸네일 생성 함수
exports.generateProfileThumbnail = onObjectFinalized(async (event) => {
  const object = event.data;
  const filePath = object.name;
  const contentType = object.contentType;
  if (!contentType.startsWith("image/")) return null;

  const fileDir = path.dirname(filePath);
  const fileName = path.basename(filePath);
  const tempFilePath = path.join(os.tmpdir(), fileName);

  // 썸네일 파일명/경로
  const thumbFileName = "profile_40x40.webp";
  const thumbFilePath = path.join(os.tmpdir(), thumbFileName);

  // 1. 원본 다운로드
  await storage.bucket(object.bucket)
      .file(filePath)
      .download({destination: tempFilePath});

  // 2. 썸네일 생성 (40x40, webp)
  await sharp(tempFilePath)
      .resize(40, 40)
      .webp({quality: 80})
      .toFile(thumbFilePath);

  // 3. 업로드 (원본과 같은 폴더에 저장)
  const thumbUploadPath = `${fileDir}/profile_40x40.webp`;
  await storage.bucket(object.bucket).upload(
      thumbFilePath,
      {
        destination: thumbUploadPath,
        contentType: "image/webp",
      },
  );

  // 4. (선택) Firestore에 썸네일 URL 저장
  // const uid = ...; // 파일 경로에서 추출
  // await admin.firestore().doc(`users/${uid}`).update({
  //   profileThumbURL: `https://firebasestorage.googleapis.com/v0/b/${object.bucket}/o/${encodeURIComponent(thumbUploadPath)}?alt=media`
  // });

  // 5. 임시파일 삭제
  fs.unlinkSync(tempFilePath);
  fs.unlinkSync(thumbFilePath);

  return null;
});

// 차트 레이아웃 생성 시 검증 및 초기화
exports.validateChartLayout = onDocumentCreated({
  document: "userChartLayouts/{userId}",
  region: "asia-northeast3",
}, async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    console.log("No data associated with the event");
    return;
  }

  const chartData = snapshot.data();
  const userId = event.params.userId;

  console.log(`Validating chart layout for user: ${userId}`);

  try {
    // 차트 데이터 검증
    if (!chartData.content) {
      console.error(
          `Invalid chart layout: missing content for user ${userId}`);
      await snapshot.ref.delete();
      return;
    }

    // 차트 크기 제한 (5MB)
    const contentSize = JSON.stringify(chartData.content).length;
    if (contentSize > 5 * 1024 * 1024) {
      console.error(
          `Chart layout too large: ${contentSize} bytes for user ${userId}`);
      await snapshot.ref.delete();
      return;
    }

    // 메타데이터 업데이트
    await snapshot.ref.update({
      validated: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      contentSize: contentSize,
    });

    console.log(`Chart layout validated for user: ${userId}`);
  } catch (error) {
    console.error(`Error validating chart layout for user ${userId}:`, error);
  }
});

// 차트 레이아웃 업데이트 시 검증
exports.updateChartLayout = onDocumentUpdated({
  document: "userChartLayouts/{userId}",
  region: "asia-northeast3",
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const userId = event.params.userId;

  console.log(`Chart layout updated for user: ${userId}`);

  try {
    // 변경사항 검증
    if (!after.content) {
      console.error(
          `Invalid chart layout update: missing content for user ${userId}`);
      await event.data.after.ref.update({
        content: before.content,
        lastModified: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    // 차트 크기 제한 (5MB)
    const contentSize = JSON.stringify(after.content).length;
    if (contentSize > 5 * 1024 * 1024) {
      console.error(
          `Chart layout update too large: ${contentSize} bytes for user ${userId}`);
      await event.data.after.ref.update({
        content: before.content,
        lastModified: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    // 메타데이터 업데이트
    await event.data.after.ref.update({
      lastModified: admin.firestore.FieldValue.serverTimestamp(),
      contentSize: contentSize,
      version: (after.version || 0) + 1,
    });

    console.log(`Chart layout update validated for user: ${userId}`);
  } catch (error) {
    console.error(`Error updating chart layout for user ${userId}:`, error);
  }
});

// 차트 레이아웃 삭제 시 정리
exports.cleanupChartLayout = onDocumentDeleted({
  document: "userChartLayouts/{userId}",
  region: "asia-northeast3",
}, async (event) => {
  const userId = event.params.userId;
  console.log(`Chart layout deleted for user: ${userId}`);

  try {
    // 삭제 로그 기록 (선택사항)
    await db.collection("chartLayoutLogs").add({
      userId: userId,
      action: "deleted",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(
        `Chart layout cleanup completed for user: ${userId}`);
  } catch (error) {
    console.error(
        `Error during chart layout cleanup for user ${userId}:`, error);
  }
});

// 차트 레이아웃 백업 HTTP 함수
exports.backupChartLayout = https.onCall({
  region: "asia-northeast3",
  maxInstances: 10,
}, async (request) => {
  // 인증 확인
  if (!request.auth) {
    throw new https.HttpsError("unauthenticated", "User must be authenticated");
  }

  const userId = request.auth.uid;

  try {
    // 사용자별 차트 레이아웃 조회
    const chartDoc = await db.collection("userChartLayouts")
        .doc(userId).get();

    if (!chartDoc.exists) {
      throw new https.HttpsError("not-found", "Chart layout not found");
    }

    const chartData = chartDoc.data();

    // 백업 생성
    const backupData = {
      ...chartData,
      backupTimestamp: admin.firestore.FieldValue.serverTimestamp(),
      originalId: chartDoc.id,
    };

    await db.collection("chartLayoutBackups").add(backupData);

    return {
      success: true,
      backupId: chartDoc.id,
      message: "Chart layout backed up successfully",
    };
  } catch (error) {
    console.error(
        `Error backing up chart layout for user ${userId}:`, error);
    throw new https.HttpsError("internal", "Failed to backup chart layout");
  }
});

// 차트 레이아웃 복원 HTTP 함수
exports.restoreChartLayout = https.onCall({
  region: "asia-northeast3",
  maxInstances: 10,
}, async (request) => {
  // 인증 확인
  if (!request.auth) {
    throw new https.HttpsError("unauthenticated", "User must be authenticated");
  }

  const userId = request.auth.uid;
  const {backupId} = request.data;

  try {
    // 백업 데이터 조회
    const backupDoc = await db.collection("chartLayoutBackups")
        .doc(backupId).get();

    if (!backupDoc.exists) {
      throw new https.HttpsError("not-found", "Backup not found");
    }

    const backupData = backupDoc.data();

    // 원본 사용자 확인
    if (backupData.userId !== userId) {
      throw new https.HttpsError(
          "permission-denied", "Access denied to this backup");
    }

    // 차트 레이아웃 복원
    const restoreData = {
      name: backupData.name,
      content: backupData.content,
      symbol: backupData.symbol,
      resolution: backupData.resolution,
      timestamp: backupData.timestamp,
      lastModified: admin.firestore.FieldValue.serverTimestamp(),
      restoredFrom: backupId,
    };

    await db.collection("userChartLayouts").doc(userId).set(restoreData);

    return {
      success: true,
      message: "Chart layout restored successfully",
    };
  } catch (error) {
    console.error(
        `Error restoring chart layout for user ${userId}:`, error);
    throw new https.HttpsError("internal", "Failed to restore chart layout");
  }
});

// 차트 레이아웃 통계 HTTP 함수
exports.getChartLayoutStats = https.onCall({
  region: "asia-northeast3",
  maxInstances: 10,
}, async (request) => {
  // 인증 확인
  if (!request.auth) {
    throw new https.HttpsError("unauthenticated", "User must be authenticated");
  }

  const userId = request.auth.uid;

  try {
    // 사용자별 차트 레이아웃 통계
    const chartDoc = await db.collection("userChartLayouts")
        .doc(userId).get();

    if (!chartDoc.exists) {
      return {
        hasLayout: false,
        stats: null,
      };
    }

    const chartData = chartDoc.data();
    const contentSize = JSON.stringify(chartData.content).length;

    return {
      hasLayout: true,
      stats: {
        name: chartData.name,
        symbol: chartData.symbol,
        resolution: chartData.resolution,
        contentSize: contentSize,
        createdAt: chartData.createdAt,
        lastModified: chartData.lastModified,
        version: chartData.version || 1,
      },
    };
  } catch (error) {
    console.error(
        `Error getting chart layout stats for user ${userId}:`, error);
    throw new https.HttpsError("internal", "Failed to get chart layout stats");
  }
});
