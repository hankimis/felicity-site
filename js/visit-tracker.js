// visit-tracker.js
// 실제 방문 수 집계를 Firestore에 기록하고 요약 통계를 조회하는 모듈

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, updateDoc, getDoc, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from '../firebase-config.js';

function getOrInitApp() {
    return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

function getDateKeyLocal() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}${m}${d}`; // YYYYMMDD
}

export async function trackVisit() {
    try {
        const app = getOrInitApp();
        const db = getFirestore(app);
        const dateKey = getDateKeyLocal();

        // summary 문서 보장
        const summaryRef = doc(db, 'metrics', 'summary');
        await setDoc(summaryRef, { createdAt: serverTimestamp() }, { merge: true });
        await updateDoc(summaryRef, {
            totalVisits: increment(1),
            updatedAt: serverTimestamp()
        });

        // 일별 문서 증가
        const dailyRef = doc(db, 'metrics', `daily-${dateKey}`);
        await setDoc(dailyRef, { dateKey, createdAt: serverTimestamp() }, { merge: true });
        await updateDoc(dailyRef, {
            visits: increment(1),
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        // 조용히 실패 (방문 집계가 사용자 흐름을 막지 않도록)
        console.warn('visit tracking failed:', error);
    }
}

export async function getVisitStats() {
    const app = getOrInitApp();
    const db = getFirestore(app);
    const dateKey = getDateKeyLocal();

    const summarySnap = await getDoc(doc(db, 'metrics', 'summary'));
    const dailySnap = await getDoc(doc(db, 'metrics', `daily-${dateKey}`));

    return {
        totalVisits: summarySnap.exists() ? (summarySnap.data().totalVisits || 0) : 0,
        todayVisits: dailySnap.exists() ? (dailySnap.data().visits || 0) : 0,
        dateKey
    };
}

// 자동 추적: 페이지 로드 후 1회
document.addEventListener('DOMContentLoaded', () => {
    // 동일 페이지에서 중복 로딩 방지
    if (window.__visitTracked) return;
    window.__visitTracked = true;
    trackVisit();
});


