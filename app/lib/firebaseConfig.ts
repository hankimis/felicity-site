// app/lib/firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// 🔹 Firebase 설정 (Firebase 콘솔에서 제공한 정보 입력)
const firebaseConfig = {
  apiKey: "AIzaSyAYZR2Wn8QSfU8Y-3oUQX7-kWiLiMcaqH4",
  authDomain: "felicity-admin.firebaseapp.com",
  projectId: "felicity-admin",
  storageBucket: "felicity-admin.appspot.com",
  messagingSenderId: "60170961082",
  appId: "1:60170961082:web:6b6c1cff931cdd60e9cc283",
  measurementId: "G-HGM5Q9718G",
};

// 🔹 Firebase 앱 초기화
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// 🔹 Firebase Analytics 초기화 (선택 사항)
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;