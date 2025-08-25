// onbit-miner.js
// ONBIT 코인 채굴 모듈: 실현 수익 누적 기준 1,000 USDT마다 0.1 ONBIT 적립

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from '../firebase-config.js';

function getOrInitApp() {
    return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

class OnbitMiner {
    constructor() {
        this.app = getOrInitApp();
        this.db = getFirestore(this.app);
        this.user = null;
        this.uiEl = null; // DOM element to show ONBIT balance
        this.current = 0;
        this.externalControlled = false; // 외부(UI) 제어 여부
    }

    setUser(user) {
        this.user = user || null;
        if (!this.user) {
            this.updateUI(0);
            return;
        }
        // 초기 로드
        this.refreshBalance().catch(() => {});
    }

    async refreshBalance() {
        if (!this.user) return 0;
        const ref = doc(this.db, 'users', this.user.uid);
        const snap = await getDoc(ref);
        const data = snap.exists() ? snap.data() : {};
        const mining = data.mining || {};
        const onbit = Number(mining.onbit || 0);
        this.current = onbit;
        this.updateUI(onbit);
        try { window.dispatchEvent(new CustomEvent('onbit:balance', { detail: { balance: onbit } })); } catch(_) {}
        return onbit;
    }

    subscribeUI(elementOrSelector) {
        if (typeof elementOrSelector === 'string') {
            this.uiEl = document.querySelector(elementOrSelector);
        } else {
            this.uiEl = elementOrSelector;
        }
        // 즉시 동기화
        if (this.user && !this.externalControlled) this.refreshBalance().catch(() => {});
    }

    updateUI(value) {
        if (!this.uiEl || this.externalControlled) return; // 외부가 제어 중이면 건너뜀
        try {
            const v = Number(value || 0);
            // 소수 3자리 표기 (0.001 단위)
            this.uiEl.textContent = `${v.toFixed(3)} ONBIT`;
            // primary color 적용
            this.uiEl.style.color = 'var(--primary-color)';
        } catch (_) {}
    }

    setExternalControlled(flag) {
        this.externalControlled = !!flag;
    }

    /**
     * 실현 수익(USDT) 기준 채굴 보상
     * - 수익: 1 USDT 당 0.01 ONBIT 적립
     * - 손실: 1 USDT 당 0.001 ONBIT 적립
     */
    async awardForProfit(profitUSDT) {
        if (!this.user) return { awarded: 0, progress: 0 };
        const p = Number(profitUSDT || 0);
        if (!isFinite(p) || p === 0) return { awarded: 0, progress: 0 };
        const ref = doc(this.db, 'users', this.user.uid);
        const result = await runTransaction(this.db, async (tx) => {
            const snap = await tx.get(ref);
            const data = snap.exists() ? snap.data() : {};
            const mining = data.mining || {};
            const prevOnbit = Number(mining.onbit || 0);
            const rate = p > 0 ? 0.01 : 0.001; // 수익/손실 차등
            const award = Number((Math.abs(p) * rate).toFixed(4));
            const next = {
                mining: {
                    onbit: Number((prevOnbit + award).toFixed(4))
                }
            };
            tx.set(ref, next, { merge: true });
            return { award, progress: 0, balance: next.mining.onbit };
        });
        // UI 업데이트
        if (result && typeof result.balance === 'number') {
            this.current = result.balance;
            this.updateUI(result.balance);
            try { window.dispatchEvent(new CustomEvent('onbit:balance', { detail: result })); } catch(_) {}
        } else {
            // 폴백 리프레시
            this.refreshBalance().catch(() => {});
        }
        // 이벤트 발생 (옵셔널)
        try {
            window.dispatchEvent(new CustomEvent('onbit:mined', { detail: result }));
        } catch (_) {}
        return result;
    }
}

// 전역 단일 인스턴스 노출
window.onbitMiner = new OnbitMiner();


