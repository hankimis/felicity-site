const {onObjectFinalized} = require("firebase-functions/v2/storage");
const {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentDeleted,
} = require("firebase-functions/v2/firestore");
const {https} = require("firebase-functions/v2");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const sharp = require("sharp");
const {Storage} = require("@google-cloud/storage");
const path = require("path");
const os = require("os");
const fs = require("fs");

admin.initializeApp();
const storage = new Storage();
const db = admin.firestore();
// Together 등 외부 AI 관련 키/로직 제거 (요청에 따라 비활성화)
const fetch = global.fetch;

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

// OAuth/AI 비활성화: 시크릿 의존 제거
// NAVER OAuth 재연결용 환경 변수 또는 직접 주입된 값 사용
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || 'hDLqFREW3QvRtC6aGQ1x';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || 'X5rZtCGkmu';

// =============================
// NAVER OAuth 2.0 → Firebase Custom Token (활성화)
// =============================
exports.naverAuth = https.onRequest({ region: "asia-northeast3" }, async (req, res) => {
  try {
    const clientId = NAVER_CLIENT_ID;
    const clientSecret = NAVER_CLIENT_SECRET;
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
if (process.env.ENABLE_OAUTH === '1') {
/* exports.kakaoAuth = https.onRequest({ region: "asia-northeast3" }, async (req, res) => {
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
}); */
}

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

// (Removed) AI Search (Together.ai proxy) to avoid secret prompts during deploy.
/* exports.aiSearch = https.onRequest({ region: "asia-northeast3" }, async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.status(204).send('');
      return;
    }
    const bodyQ = (req.body && req.body.q) ? req.body.q : '';
    const q = (req.query.q || bodyQ || '').toString().slice(0, 2000);
    if (!q) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(400).json({ error: 'missing q' });
      return;
    }
    const apiKey = process.env.TOGETHER_API_KEY || req.get('x-api-key') || req.query.key;
    if (!apiKey) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(500).json({ error: 'TOGETHER_API_KEY not set. Set functions secret or env, or pass x-api-key.' });
      return;
    }
    // Call Together AI
    const payload = {
      messages: [{ role: 'user', content: q }],
      model: 'openai/gpt-oss-20b'
    };
    const r = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const text = await r.text();
    let j;
    try { j = JSON.parse(text); } catch (e) { j = null; }
    if (!r.ok) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(r.status).json({ error: 'Together API error', status: r.status, body: text });
      return;
    }
    const answer = (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) ? j.choices[0].message.content : '';
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ answer });
  } catch (e) {
    console.error('aiSearch error', e);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ error: 'aiSearch failed', message: String(e && e.message || e) });
  }
}); */

// Streaming SSE endpoint
/**
 * Streaming Chat endpoint
 * Accepts: { q?: string, messages?: [{role, content}] }
 */
/* exports.aiSearchStream = https.onRequest({ region: "asia-northeast3" }, async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.status(204).send('');
      return;
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const q = (body.q || req.query.q || '').toString ? (body.q || req.query.q || '').toString().slice(0,2000) : '';
    const messages = Array.isArray(body.messages) && body.messages.length > 0
      ? body.messages
      : (q ? [{ role: 'user', content: q }] : []);
    if (messages.length === 0) {
      res.status(400).json({ error: 'missing q' });
      return;
    }
    const apiKey = process.env.TOGETHER_API_KEY || req.get('x-api-key') || req.query.key;
    const payload = {
      model: 'openai/gpt-oss-20b',
      messages,
      stream: true
    };
    const r = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const t = await r.text();
      res.writeHead(r.status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ error: 'Together API error', status: r.status, body: t }));
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    const reader = r.body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (e) {
    console.error('aiSearchStream error', e);
    try {
      res.write(`data: {"error":"stream failed"}\n\n`);
    } catch (err) {}
    res.end();
  }
}); */

// =============================================
// Paper Trading 초기 예산 서버 기준 설정
// =============================================
const INITIAL_PT_BALANCE = 10000;

// users/{uid} 문서 생성 시 초기 예산 세팅
exports.initPaperTradingOnUserCreate = onDocumentCreated({
  document: "users/{uid}",
  region: "asia-northeast3",
}, async (event) => {
  const snap = event.data;
  if (!snap) return null;
  const data = snap.data() || {};
  const hasBalance = data.paperTrading && typeof data.paperTrading.balanceUSDT === 'number';
  if (hasBalance) return null;
  await snap.ref.set({
    paperTrading: {
      balanceUSDT: INITIAL_PT_BALANCE,
      equityUSDT: INITIAL_PT_BALANCE,
    },
  }, { merge: true });
  return null;
});

// users/{uid} 문서 갱신 시에도 누락되어 있으면 백필
exports.backfillPaperTradingOnUserUpdate = onDocumentUpdated({
  document: "users/{uid}",
  region: "asia-northeast3",
}, async (event) => {
  const after = event.data.after.data() || {};
  const hasBalance = after.paperTrading && typeof after.paperTrading.balanceUSDT === 'number';
  if (hasBalance) return null;
  await event.data.after.ref.set({
    paperTrading: {
      balanceUSDT: INITIAL_PT_BALANCE,
      equityUSDT: INITIAL_PT_BALANCE,
    },
  }, { merge: true });
  return null;
});

// =============================================
// Online Users Cleanup (Server-side)
// 오래된 온라인 사용자 문서 정리 (3분 이상 비활성)
// =============================================
exports.cleanupStaleOnlineUsers = https.onRequest({ region: "asia-northeast3" }, async (req, res) => {
  try {
    const cutoff = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 3 * 60 * 1000));
    const snap = await db.collection('online-users')
      .where('lastSeen', '<', cutoff)
      .get();

    let deleted = 0;
    const batch = db.batch();
    snap.forEach(doc => {
      batch.delete(doc.ref);
      deleted++;
    });
    if (deleted > 0) await batch.commit();

    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('cleanupStaleOnlineUsers error', e);
    res.status(500).json({ ok: false, error: String(e && e.message || e) });
  }
});

// 스케줄 버전(5분마다)
exports.cleanupStaleOnlineUsersScheduled = onSchedule({schedule: 'every 5 minutes', region: 'asia-northeast3'}, async (event) => {
  const cutoff = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 3 * 60 * 1000));
  const snap = await db.collection('online-users').where('lastSeen', '<', cutoff).get();
  const batch = db.batch();
  snap.forEach(doc => batch.delete(doc.ref));
  if (!snap.empty) await batch.commit();
});

// =============================================
// Community Chat: Message Posting with Abuse Prevention
// - Rate limit per user
// - Length limit
// - Duplicate prevention (last text)
// - Simple bad words filter
// =============================================
const REGION = 'asia-northeast3';
const MESSAGE_MAX_LEN = 500;
const POST_COOLDOWN_MS = 1500;
// 동일 메시지 방지 기간 (이 시간 이내에 같은 내용이면 중복으로 간주)
const DUPLICATE_WINDOW_MS = 5000;
const BAD_WORDS = ['spam']; // 실제 서비스에서는 외부 리스트/설정 사용 권장

function hasBadWord(text) {
  const lower = text.toLowerCase();
  return BAD_WORDS.some(w => lower.includes(w));
}

exports.postCommunityMessage = https.onCall({ region: REGION, enforceAppCheck: false, cors: true }, async (request) => {
  if (!request.auth) {
    throw new https.HttpsError('unauthenticated', 'Authentication required');
  }
  const uid = request.auth.uid;
  const text = (request.data && request.data.text || '').toString();
  const displayName = (request.data && request.data.displayName || '').toString();
  const photoURL = (request.data && request.data.photoURL || '').toString() || null;

  if (!text.trim()) {
    throw new https.HttpsError('invalid-argument', 'Empty message');
  }
  if (text.length > MESSAGE_MAX_LEN) {
    throw new https.HttpsError('invalid-argument', 'Message too long');
  }
  if (hasBadWord(text)) {
    throw new https.HttpsError('failed-precondition', 'Message contains prohibited content');
  }

  const now = Date.now();
  const userMetaRef = db.collection('users').doc(uid).collection('meta').doc('chat');
  const userMetaSnap = await userMetaRef.get();
  const lastPostAt = userMetaSnap.exists ? (userMetaSnap.data().lastPostAt || 0) : 0;
  const lastText = userMetaSnap.exists ? (userMetaSnap.data().lastText || '') : '';

  if (now - lastPostAt < POST_COOLDOWN_MS) {
    throw new https.HttpsError('resource-exhausted', 'Too fast. Please slow down.');
  }
  if (lastText && lastText === text.trim() && (now - lastPostAt) < DUPLICATE_WINDOW_MS) {
    throw new https.HttpsError('already-exists', 'Duplicate message');
  }

  const payload = {
    text: text.trim(),
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    uid,
    displayName: displayName || '사용자',
    photoURL: photoURL || null,
  };

  await db.collection('community-chat').add(payload);
  await userMetaRef.set({ lastPostAt: now, lastText: text.trim() }, { merge: true });

  return { ok: true };
});

// =============================================
// Channels: Post message to specific channel
// - Path: channels/{channelId}/messages
// - Same abuse prevention as community chat
// =============================================
function normalizeChannelId(raw) {
  if (!raw) return '';
  const s = String(raw).toLowerCase().trim();
  // allow a-z, 0-9, dash, underscore; 1..64
  if (!/^[a-z0-9_-]{1,64}$/.test(s)) return '';
  return s;
}

exports.postChannelMessage = https.onCall({ region: REGION, enforceAppCheck: false, cors: true }, async (request) => {
  if (!request.auth) {
    throw new https.HttpsError('unauthenticated', 'Authentication required');
  }
  const uid = request.auth.uid;
  const channelId = normalizeChannelId(request.data && request.data.channelId);
  if (!channelId) {
    throw new https.HttpsError('invalid-argument', 'Invalid channelId');
  }
  const text = (request.data && request.data.text || '').toString();
  const displayName = (request.data && request.data.displayName || '').toString();
  const photoURL = (request.data && request.data.photoURL || '').toString() || null;

  if (!text.trim()) {
    throw new https.HttpsError('invalid-argument', 'Empty message');
  }
  if (text.length > MESSAGE_MAX_LEN) {
    throw new https.HttpsError('invalid-argument', 'Message too long');
  }
  if (hasBadWord(text)) {
    throw new https.HttpsError('failed-precondition', 'Message contains prohibited content');
  }

  const now = Date.now();
  const userMetaRef = db.collection('users').doc(uid).collection('meta').doc(`chat_${channelId}`);
  const userMetaSnap = await userMetaRef.get();
  const lastPostAt = userMetaSnap.exists ? (userMetaSnap.data().lastPostAt || 0) : 0;
  const lastText = userMetaSnap.exists ? (userMetaSnap.data().lastText || '') : '';

  if (now - lastPostAt < POST_COOLDOWN_MS) {
    throw new https.HttpsError('resource-exhausted', 'Too fast. Please slow down.');
  }
  if (lastText && lastText === text.trim() && (now - lastPostAt) < DUPLICATE_WINDOW_MS) {
    throw new https.HttpsError('already-exists', 'Duplicate message');
  }

  const payload = {
    text: text.trim(),
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    uid,
    displayName: displayName || '사용자',
    photoURL: photoURL || null,
  };

  await db.collection('channels').doc(channelId).collection('messages').add(payload);
  await userMetaRef.set({ lastPostAt: now, lastText: text.trim() }, { merge: true });

  return { ok: true };
});

// =============================================
// Admin-only System Announcement / Breaking News
// =============================================
async function isAdmin(uid) {
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    return !!(userDoc.exists && userDoc.data().isAdmin === true);
  } catch (_) {
    return false;
  }
}

exports.postSystemAnnouncement = https.onCall({ region: REGION, enforceAppCheck: false }, async (request) => {
  if (!request.auth) {
    throw new https.HttpsError('unauthenticated', 'Authentication required');
  }
  const uid = request.auth.uid;
  if (!(await isAdmin(uid))) {
    throw new https.HttpsError('permission-denied', 'Admin only');
  }

  const text = (request.data && request.data.text || '').toString();
  const breaking = !!(request.data && request.data.breaking === true);
  const newsLink = (request.data && request.data.newsLink || '').toString();
  if (!text.trim()) throw new https.HttpsError('invalid-argument', 'Empty text');
  if (text.length > MESSAGE_MAX_LEN) throw new https.HttpsError('invalid-argument', 'Text too long');

  const data = {
    text: text.trim(),
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    uid: breaking ? 'system-breaking-news' : 'system-alert',
    displayName: breaking ? '속보' : '시스템 공지',
    isSystemAlert: true,
    isBreakingNews: breaking,
  };
  if (breaking && newsLink && /^https?:\/\//i.test(newsLink)) {
    data.newsLink = newsLink;
  }
  await db.collection('community-chat').add(data);
  return { ok: true };
});

// =============================================
// Admin: Delete User (Auth + Firestore)
// =============================================
exports.adminDeleteUser = https.onCall({ region: REGION, enforceAppCheck: false }, async (request) => {
  if (!request.auth) {
    throw new https.HttpsError('unauthenticated', 'Authentication required');
  }
  const requester = request.auth.uid;
  const targetUid = (request.data && request.data.uid) ? String(request.data.uid) : '';
  if (!targetUid) {
    throw new https.HttpsError('invalid-argument', 'uid is required');
  }
  // Only admins allowed
  if (!(await isAdmin(requester))) {
    throw new https.HttpsError('permission-denied', 'Admin only');
  }
  if (targetUid === requester) {
    throw new https.HttpsError('failed-precondition', 'Cannot delete yourself');
  }
  try {
    // Delete Firestore user document
    await db.collection('users').doc(targetUid).delete().catch(() => {});
    // Optionally clean related collections
    await db.collection('online-users').doc(targetUid).delete().catch(() => {});
    // Delete Auth user
    await admin.auth().deleteUser(targetUid);
    return { ok: true };
  } catch (e) {
    console.error('adminDeleteUser error', e);
    throw new https.HttpsError('internal', 'Failed to delete user');
  }
});

// =============================================
// TTL Cleanup for community-chat (older than 60 days)
// =============================================
exports.cleanupOldCommunityMessages = onSchedule({schedule: 'every 24 hours', region: 'asia-northeast3'}, async () => {
  const cutoffDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days
  const snap = await db.collection('community-chat').where('timestamp', '<', cutoffDate).get();
  const batch = db.batch();
  snap.forEach(doc => batch.delete(doc.ref));
  if (!snap.empty) await batch.commit();
});
