const {onObjectFinalized} = require("firebase-functions/v2/storage");
const admin = require("firebase-admin");
const sharp = require("sharp");
const {Storage} = require("@google-cloud/storage");
const path = require("path");
const os = require("os");
const fs = require("fs");

admin.initializeApp();
const storage = new Storage();

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
