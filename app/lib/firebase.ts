import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAZYR2Wn8QSfu8Y-3oUQX7-kWiLiMcaqH4",
  authDomain: "felicity-admin.firebaseapp.com",
  projectId: "felicity-admin",
  storageBucket: "felicity-admin.appspot.com", // ✅ 수정된 부분
  messagingSenderId: "60170961082",
  appId: "1:60170961082:web:6b6c1ff931cdd60e9cc283",
  measurementId: "G-HGM59Q718G"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
