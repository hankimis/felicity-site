/**
 * 실시간 롱/숏 비율 게이지
 * - 바이낸스 USDT 무기한 선물 WebSocket(aggTrade) 기반
 * - 60초 롤링 윈도우에서 매수/매도 체결량 합산 후 비율 산출
 * - 캔버스 반원 게이지로 시각화
 */

(function () {
  const canvas = document.getElementById('ls-gauge-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const labelEl = document.getElementById('ls-gauge-label');
  const percentEl = document.getElementById('ls-gauge-percent');
  const metaEl = document.getElementById('ls-gauge-meta');
  const menuBtn = null;
  const menu = null;

  const symbol = 'btcusdt';
  const streamUrl = `wss://fstream.binance.com/ws/${symbol}@aggTrade`;

  // 롤링 윈도우 기본값과 집계 버킷(초 단위)
  let windowMs = 60 * 1000;
  let windowLabel = '1분';
  const BUCKET_MS = 1000; // 1초 버킷
  const MAX_KEEP_SEC = 86400; // 최대 1일 보관
  const buckets = new Map(); // key: epochSec, value: { long: number, short: number }

  let socket;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 10;

  function connect() {
    try {
      socket = new WebSocket(streamUrl);
      socket.onopen = () => {
        reconnectAttempts = 0;
      };
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        // aggTrade fields: p(price), q(quantity), m(isBuyerMaker)
        const price = parseFloat(data.p);
        const qty = parseFloat(data.q);
        const isBuyerMaker = !!data.m; // true면 매도자가 우위 → 체결은 매수측이 적극적이지 않음
        // 중앙 해석: isBuyerMaker=false => aggressive buyer → 롱 성향 체결
        const now = Date.now();
        const sec = Math.floor(now / 1000);
        const notional = qty * price;
        const b = buckets.get(sec) || { long: 0, short: 0 };
        if (isBuyerMaker === false) b.long += notional; else b.short += notional;
        buckets.set(sec, b);
        pruneOld(sec);
      };
      socket.onerror = () => {
      };
      socket.onclose = () => {
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts += 1;
          const backoff = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 15000);
          setTimeout(connect, backoff);
        }
      };
    } catch (e) {
    }
  }

  function pruneOld(currentSec) {
    const cutoff = currentSec - MAX_KEEP_SEC;
    // 오래된 버킷 삭제
    for (const key of buckets.keys()) {
      if (key < cutoff) buckets.delete(key);
    }
  }

  function computeLongShort() {
    const nowSec = Math.floor(Date.now() / 1000);
    pruneOld(nowSec);

    let longVolume = 0; // aggressive buyer notional
    let shortVolume = 0; // aggressive seller notional

    const windowSec = Math.max(1, Math.ceil(windowMs / BUCKET_MS));
    const startSec = nowSec - windowSec + 1;
    for (let s = startSec; s <= nowSec; s += 1) {
      const b = buckets.get(s);
      if (!b) continue;
      longVolume += b.long;
      shortVolume += b.short;
    }

    const total = longVolume + shortVolume;
    const longRatio = total > 0 ? longVolume / total : 0.5;
    return { longRatio, longVolume, shortVolume, total };
  }

  // 디바이스 픽셀 비율 대응 + 반응형 리사이즈
  let dpr = Math.max(window.devicePixelRatio || 1, 1);
  function resizeCanvas() {
    // 캔버스의 실제 CSS 크기를 그대로 사용 (고정 크기 180x120 또는 스타일 지정값)
    const cs = getComputedStyle(canvas);
    const width = Math.max(1, parseFloat(cs.width) || (canvas.width / dpr) || 180);
    const height = Math.max(1, parseFloat(cs.height) || (canvas.height / dpr) || 120);
    dpr = Math.max(window.devicePixelRatio || 1, 1);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
  }

  // 게이지 렌더링
  function drawGauge(longRatio) {
    // 고해상도 스케일 적용
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const cx = w / 2;
    const cy = h * 0.92;
    const radius = Math.min(w * 0.45, h * 0.85);

    ctx.clearRect(0, 0, w, h);

    // 테마 색상
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const bgArc = isDark ? '#374151' : '#e5e7eb';
    const pointerColor = isDark ? '#e5e7eb' : '#111827';
    const textMuted = isDark ? '#9ca3af' : '#9ca3af';
    const textHighlight = '#2962ff';

    // 배경 반원
    ctx.lineWidth = 11; // 게이지 바 살짝 얇게
    ctx.lineCap = 'round';
    const start = Math.PI; // 180도
    const end = 2 * Math.PI; // 360도
    // 그라데이션: red -> purple -> blue
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0.0, '#ef4444');
    grad.addColorStop(0.5, '#8b5cf6');
    grad.addColorStop(1.0, '#2563eb');

    ctx.strokeStyle = bgArc;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, end);
    ctx.stroke();

    // 진행 반원
    const progressEnd = start + (end - start) * longRatio;
    ctx.strokeStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, progressEnd);
    ctx.stroke();

    // 내부 섹션 라벨은 요구사항에 따라 표시하지 않음

    // 포인터
    const pointerLen = radius * 0.78;
    const angle = progressEnd;
    const px = cx + pointerLen * Math.cos(angle);
    const py = cy + pointerLen * Math.sin(angle);
    ctx.strokeStyle = pointerColor;
    ctx.fillStyle = pointerColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(px, py);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
    ctx.fill();
  }

  function updateText(longRatio, total) {
    const percent = Math.round(longRatio * 100);
    let label;
    if (percent >= 80) label = '강한 매수';
    else if (percent >= 60) label = '매수';
    else if (percent > 40) label = '중립';
    else if (percent > 20) label = '매도';
    else label = '강한 매도';

    if (labelEl) {
      labelEl.textContent = label;
      labelEl.style.color = '#111827';
      labelEl.style.fontWeight = '800';
    }
    if (percentEl) {
      percentEl.textContent = `${percent}%`;
      // 롱 우위는 파랑, 숏 우위는 빨강
      percentEl.style.color = percent >= 50 ? '#2563eb' : '#ef4444';
      percentEl.style.fontWeight = '700';
    }
    // 메타 정보는 표시하지 않음
    if (metaEl) metaEl.textContent = '';
  }

  // 목표 비율 업데이트(데이터 계산)와 부드러운 애니메이션 분리
  let targetRatio = 0.5;
  let displayRatio = 0.5;
  let latestTotal = 0;

  setInterval(() => {
    const { longRatio, total } = computeLongShort();
    targetRatio = longRatio;
    latestTotal = total;
  }, 250);

  function animate() {
    // 지수 이동 평균 방식으로 부드럽게 수렴
    const smoothing = 0.08; // 값이 작을수록 더 부드럽게
    displayRatio += (targetRatio - displayRatio) * smoothing;
    drawGauge(displayRatio);
    updateText(displayRatio, latestTotal);
    requestAnimationFrame(animate);
  }

  // 테마가 바뀌면 재렌더 (간단히 클리어 후 다시 그림)
  const themeObserver = new MutationObserver(() => {
    drawGauge(displayRatio);
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // 초기 사이즈 세팅 및 리스너 등록
  resizeCanvas();
  window.addEventListener('resize', () => {
    resizeCanvas();
  });

  connect();
  animate();

  // 드롭다운 동작
  if (menuBtn && menu) {
    const map = new Map([
      ['1분', 60000],
      ['5분', 300000],
      ['15분', 900000],
      ['1시간', 3600000],
      ['4시간', 14400000],
      ['1일', 86400000],
    ]);

    const closeMenu = () => {
      menu.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
    };
    const openMenu = () => {
      menu.classList.add('open');
      menuBtn.setAttribute('aria-expanded', 'true');
    };

    menuBtn.addEventListener('click', () => {
      if (menu.classList.contains('open')) closeMenu();
      else openMenu();
    });

    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && e.target !== menuBtn) closeMenu();
    });

    menu.querySelectorAll('li').forEach((li) => {
      li.addEventListener('click', () => {
        const ms = Number(li.getAttribute('data-ms'));
        if (Number.isFinite(ms)) {
          windowMs = ms;
          windowLabel = li.textContent.trim();
          menuBtn.textContent = windowLabel;
          if (metaEl) metaEl.textContent = `BTCUSDT · ${windowLabel} 롤링 · 표본 ${Intl.NumberFormat('en-US', { notation: 'compact' }).format(latestTotal)}$`;
          closeMenu();
        }
      });
    });
  }
})();


