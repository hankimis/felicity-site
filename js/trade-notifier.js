// 🔔 Trade Notifier: fills/close/liquidation notifications + sound
(function () {
  const DEFAULT_SOUND_URL = '/assets/sounds/fill.mp3'; // 옵션: 동일 거래소 사운드 파일을 여기에 두면 자동 사용

  class TradeNotifier {
    constructor() {
      this.container = null;
      this.audioBuffer = null;
      this.audioCtx = null;
      this.prepared = false;
      this.soundUrl = DEFAULT_SOUND_URL;
      this.unlocked = false;
      this.muted = JSON.parse(localStorage.getItem('tn_muted')||'false');
      this.volume = Number(localStorage.getItem('tn_volume')||'0.12');
      this._lastAt = 0; // throttle
      this.init();
    }

    init() {
      // Toast container 생성
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        Object.assign(this.container.style, {
          position: 'fixed', right: '16px', top: '72px', zIndex: 2000,
          display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '360px',
          pointerEvents: 'none'
        });
        document.body.appendChild(this.container);
      }
      // 사운드 준비 (가능하면 파일, 실패 시 WebAudio 비프)
      this.prepareSound();
      this.bindAudioUnlock();
    }

    async prepareSound() {
      if (this.prepared) return;
      try {
        const res = await fetch(this.soundUrl, { cache: 'no-store' });
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          this.audioBuffer = await ctx.decodeAudioData(arrayBuf);
          this.audioCtx = ctx;
          this.prepared = true;
          if (this.audioCtx.state === 'suspended') {
            try { await this.audioCtx.resume(); } catch(_) {}
          }
          return;
        }
      } catch (_) {}
      // 사운드 파일이 없으면 기본 액센트음을 사용
      this.soundUrl = null;
      // Fallback 준비
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.prepared = true;
      if (this.audioCtx.state === 'suspended') {
        try { await this.audioCtx.resume(); } catch(_) {}
      }
    }

    bindAudioUnlock() {
      const unlock = async () => {
        if (!this.audioCtx) return;
        if (this.unlocked) return;
        try {
          await this.audioCtx.resume();
          // 매우 짧은 무음 톤으로 오디오 정책 해제
          const g = this.audioCtx.createGain();
          g.gain.value = 0.0001;
          const o = this.audioCtx.createOscillator();
          o.frequency.value = 440;
          o.connect(g).connect(this.audioCtx.destination);
          o.start();
          o.stop(this.audioCtx.currentTime + 0.02);
          this.unlocked = true;
        } catch (_) {}
      };
      const once = () => {
        document.removeEventListener('pointerdown', once, true);
        document.removeEventListener('keydown', once, true);
        unlock();
      };
      document.addEventListener('pointerdown', once, true);
      document.addEventListener('keydown', once, true);
    }

    playSound() {
      if (this.muted) return;
      const nowTs = Date.now();
      if (nowTs - this._lastAt < 200) return; // 200ms throttle
      this._lastAt = nowTs;
      try {
        if (!this.prepared) return;
        if (this.audioBuffer && this.audioCtx) {
          const src = this.audioCtx.createBufferSource();
          src.buffer = this.audioBuffer;
          const g = this.audioCtx.createGain();
          g.gain.value = this.volume;
          src.connect(g).connect(this.audioCtx.destination);
          src.start(0);
          return;
        }
        // fallback: 거래소 스타일 '띠리링' 3톤 시퀀스 + 부드러운 감쇠
        const ctx = this.audioCtx;
        if (!ctx) return;
        const now = ctx.currentTime;
        const master = ctx.createGain();
        master.gain.value = this.volume; // 전체 볼륨
        master.connect(ctx.destination);

        const tone = (f, start, dur, type = 'sine', g = 1.0) => {
          const o = ctx.createOscillator();
          const gn = ctx.createGain();
          o.type = type;
          o.frequency.setValueAtTime(f, start);
          gn.gain.setValueAtTime(0.0001, start);
          gn.gain.linearRampToValueAtTime(0.9 * g, start + 0.01);
          gn.gain.exponentialRampToValueAtTime(0.0001, start + dur);
          o.connect(gn).connect(master);
          o.start(start);
          o.stop(start + dur + 0.01);
        };
        // C6(1046.5Hz) → E6(1318.5Hz) → G6(1568Hz)
        tone(1046.5, now, 0.06, 'sine', 1.0);
        tone(1318.5, now + 0.07, 0.07, 'sine', 0.9);
        tone(1568.0, now + 0.16, 0.08, 'sine', 0.8);
        // 약한 하모닉을 더해 풍성하게
        tone(2093.0, now + 0.07, 0.05, 'triangle', 0.3);
        tone(3136.0, now + 0.16, 0.05, 'triangle', 0.25);
      } catch (_) { /* ignore */ }
    }

    setMuted(flag){ this.muted = !!flag; localStorage.setItem('tn_muted', JSON.stringify(this.muted)); }
    setVolume(v){ const vol = Math.max(0, Math.min(1, Number(v)||0)); this.volume = vol; localStorage.setItem('tn_volume', String(vol)); }

    notify({ title, subtitle, type = 'success', price, amount, mode, leverage }) {
      // 카드 생성
      const card = document.createElement('div');
      card.className = 'toast';
      const borderColor = type === 'error' ? '#ef4444' : type === 'warn' ? '#f59e0b' : '#10b981';
      Object.assign(card.style, {
        background: 'var(--card-bg, rgba(17,24,39,.96))',
        color: 'var(--text-color, #e5e7eb)',
        border: `1px solid ${borderColor}`,
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: '10px',
        boxShadow: '0 10px 24px rgba(0,0,0,.35)',
        padding: '12px 14px',
        pointerEvents: 'auto',
        transform: 'translateX(8px)',
        opacity: '0',
        transition: 'opacity .18s ease, transform .18s ease'
      });
      card.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; font-weight:700;">
          <div>${title || 'Order Filled'}</div>
          <button style="background:transparent;border:none;color:inherit;opacity:.7;cursor:pointer;">✕</button>
        </div>
        <div style="margin-top:6px; font-size:13px; opacity:.9;">
          ${subtitle || ''}
        </div>
        <div style="margin-top:8px; display:flex; gap:12px; font-size:12px; opacity:.9;">
          ${price!=null?`<div>Price: <b>${this.format(price)}</b></div>`:''}
          ${amount!=null?`<div>Amount: <b>${Number(amount).toFixed(4)}</b></div>`:''}
          ${mode?`<div>${mode==='cross'?'Cross':'Isolated'}</div>`:''}
          ${leverage?`<div>${leverage}x</div>`:''}
        </div>
      `;
      const closeBtn = card.querySelector('button');
      closeBtn.onclick = () => this.dismiss(card);
      this.container.appendChild(card);
      requestAnimationFrame(() => {
        card.style.opacity = '1';
        card.style.transform = 'translateX(0)';
      });
      this.playSound();
      setTimeout(() => this.dismiss(card), 3200);
    }

    dismiss(card) {
      if (!card || !card.parentElement) return;
      card.style.opacity = '0';
      card.style.transform = 'translateX(8px)';
      setTimeout(() => card.remove(), 200);
    }

    format(n) {
      if (n == null || isNaN(n)) return '-';
      return Number(n).toLocaleString('en-US', { maximumFractionDigits: 4 });
    }
  }

  window.TradeNotifier = new TradeNotifier();
})();


