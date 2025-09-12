(function(){
  const $ = (id) => document.getElementById(id);
  const CG_DEMO_API_KEY = 'CG-mimMBvFoj6H2ZWgrWMdbNDdB';

  // 숫자 포맷터
  function formatUSD(n){
    if (!isFinite(n)) return '--';
    if (n >= 1e12) return '$' + (n/1e12).toFixed(2) + 'T';
    if (n >= 1e9) return '$' + (n/1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n/1e6).toFixed(2) + 'M';
    return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  function setChange(el, pct){
    if (!el) return;
    const v = Number(pct);
    if (!isFinite(v)) { el.textContent='--'; el.classList.remove('down'); return; }
    el.textContent = (v>=0? '↑ ':'↓ ') + Math.abs(v).toFixed(2) + '%';
    el.classList.toggle('down', v < 0);
  }

  // 스파크라인 간단 렌더러
  // CSS 변수에서 Primary Color 읽기
  function getPrimaryColor(){
    try {
      if (getPrimaryColor.__cache) return getPrimaryColor.__cache;
      const v = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
      getPrimaryColor.__cache = v || '#2962ff';
      return getPrimaryColor.__cache;
    } catch(_) { return '#2962ff'; }
  }

  function toRGBA(color, alpha){
    try {
      const c = color.trim();
      if (/^#([0-9a-f]{6})$/i.test(c)){
        const r = parseInt(c.slice(1,3),16);
        const g = parseInt(c.slice(3,5),16);
        const b = parseInt(c.slice(5,7),16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
      const m = c.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
      if (m) return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})`;
      return c;
    } catch(_) { return color; }
  }

  function setupCanvasDpi(canvas){
    try{
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      const cssW = Math.max(10, canvas.clientWidth || canvas.width);
      const cssH = Math.max(10, canvas.clientHeight || canvas.height);
      if (canvas.__cssW === cssW && canvas.__cssH === cssH && canvas.__dpr === dpr) return;
      canvas.__cssW = cssW; canvas.__cssH = cssH; canvas.__dpr = dpr;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }catch(_){/* noop */}
  }

  function spark(canvas, arr){
    try{
      if (!canvas || !Array.isArray(arr) || arr.length < 2) return;
      setupCanvasDpi(canvas);
      const ctx = canvas.getContext('2d');
      const w = canvas.__cssW || canvas.clientWidth || canvas.width;
      const h = canvas.__cssH || canvas.clientHeight || canvas.height;
      ctx.clearRect(0,0,w,h);
      const xs = arr.map(x=>Number(x)).filter(isFinite);
      if (xs.length<2) return;
      let min = Math.min(...xs), max = Math.max(...xs);
      if (Math.abs(max - min) < 1e-9) { max = min + 1; }
      const pad = 10;
      // 색상: 브랜드 블루로 통일 (라인+영역)
      const pc = '#2563eb';
      const fill = toRGBA(pc, 0.15);
      // 배경
      ctx.fillStyle = fill;
      const path = new Path2D();
      xs.forEach((v,i)=>{
        const x = pad + (w-2*pad) * (i/(xs.length-1));
        const y = h - pad - (h-2*pad) * (v-min) / Math.max(1e-9, (max-min));
        if (i===0) path.moveTo(x,y); else path.lineTo(x,y);
      });
      path.lineTo(w-pad, h-pad);
      path.lineTo(pad, h-pad);
      path.closePath();
      ctx.fill(path);
      // 라인
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = pc;
      ctx.beginPath();
      xs.forEach((v,i)=>{
        const x = pad + (w-2*pad) * (i/(xs.length-1));
        const y = h - pad - (h-2*pad) * (v-min) / Math.max(1e-9, (max-min));
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.stroke();
    }catch(_){/* noop */}
  }

  async function fetchJSON(url, init){
    const res = await fetch(url, init);
    if (!res.ok) throw new Error('HTTP '+res.status);
    return res.json();
  }

  // CoinGecko 데모 키 포함 호출
  async function cgFetch(url){
    // 로컬 프록시 경유로 CORS/429 완화
    // Vercel 서버리스 함수 경로로 프록시(로컬/프로덕션 공통)
    const proxied = url.replace('https://api.coingecko.com/api/v3', '/api/coingecko');
    return fetchJSON(proxied, { headers: { 'x-cg-demo-api-key': CG_DEMO_API_KEY } });
  }

  // 1) 전체 시가총액 (CoinGecko Global)
  async function updateMarketCap(){
    try{
      const data = await cgFetch('https://api.coingecko.com/api/v3/global');
      const mc = Number(data?.data?.total_market_cap?.usd);
      const changePct = Number(data?.data?.market_cap_change_percentage_24h_usd);
      $('mi-mc-value').textContent = formatUSD(mc);
      setChange($('mi-mc-change'), changePct);
    }catch(_){/* ignore */}
    // 스파크라인: 최근 1일(24h) 시총 히스토리
    try{
      // CoinGecko는 글로벌 시총 차트 전용 엔드포인트가 없어 대체: BTC+ETH 근사 합성
      const [btc, eth] = await Promise.all([
        cgFetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1'),
        cgFetch('https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=1')
      ]);
      const pickSeries = (obj)=>{
        let s = Array.isArray(obj?.market_caps) && obj.market_caps.length>0 ? obj.market_caps
              : (Array.isArray(obj?.prices) ? obj.prices : []);
        return s.map(p=>Number(p[1]||0)).filter(isFinite);
      };
      const btcMc = pickSeries(btc);
      const ethMc = pickSeries(eth);
      const len = Math.min(btcMc.length, ethMc.length);
      const series = len>1 ? new Array(len).fill(0).map((_,i)=> btcMc[i]+ethMc[i]) : [];
      spark($('mi-mc-spark'), series);
    }catch(_){/* endpoint 미제공 시 무시 */}
  }

  // 2) 상위 20 코인 지수 (시총가중, CoinGecko markets)
  async function updateTop20Index(){
    try{
      const list = await cgFetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=true&price_change_percentage=24h');
      if (!Array.isArray(list) || list.length === 0) return;
      // 시총가중 지수: sum(price * weight), weight = mc/sum(mc), 기준 100 = 첫 항목 기준
      const totalMc = list.reduce((s,x)=>s+Number(x.market_cap||0),0);
      const indexVal = list.reduce((s,x)=>{
        const w = totalMc>0 ? (Number(x.market_cap||0)/totalMc) : 0;
        return s + w * Number(x.current_price||0);
      }, 0);
      $('mi-top20-value').textContent = '$' + indexVal.toFixed(2);
      // 24h 지수 변화: 시총가중 평균 24h 변화율 적용
      const avgPct = list.reduce((s,x)=>{
        const w = totalMc>0 ? (Number(x.market_cap||0)/totalMc) : 0;
        return s + w * Number(x.price_change_percentage_24h_in_currency||0);
      }, 0);
      setChange($('mi-top20-change'), avgPct);
      // 스파크: 전체 스파크라인을 평균(동일 길이 가정)으로 합성
      try{
        const seriesCount = list[0]?.sparkline_in_7d?.price?.length || 0;
        if (seriesCount > 0){
          const acc = new Array(seriesCount).fill(0);
          list.forEach(item => {
            const s = item?.sparkline_in_7d?.price || [];
            for (let i=0;i<seriesCount;i++) acc[i] += Number(s[i]||0);
          });
          const avg = acc.map(v=> v / list.length);
          spark($('mi-top20-spark'), avg);
        }
      }catch(_){/* ignore */}
    }catch(_){/* ignore */}
  }

  // 3) 공포/탐욕 지수 (Alternative.me)
  async function updateFNG(){
    try{
      const data = await fetchJSON('https://api.alternative.me/fng/?limit=2&format=json');
      const cur = data?.data?.[0];
      const prev = data?.data?.[1];
      const v = Number(cur?.value);
      const label = String(cur?.value_classification || 'Neutral');
      const kor = mapFngKorean(label);
      $('mi-fng-score').textContent = isFinite(v) ? String(v) : '--';
      $('mi-fng-label').textContent = label;
      const delta = (isFinite(Number(prev?.value)) && isFinite(v)) ? (v - Number(prev.value)) : 0;
      setDelta($('mi-fng-delta'), delta);
      const korEl = $('mi-fng-kor'); if (korEl) korEl.textContent = kor;
      drawGauge($('mi-fng-gauge'), v);
    }catch(_){/* ignore */}
  }

  function setDelta(el, delta){
    if (!el) return;
    const v = Number(delta||0);
    const up = v >= 0;
    el.textContent = (up? '↑':'↓') + Math.abs(v).toFixed(0);
    el.style.color = up ? '#10b981' : '#ef4444';
  }

  function mapFngKorean(en){
    switch(String(en||'').toLowerCase()){
      case 'extreme fear': return '극단적 공포';
      case 'fear': return '공포';
      case 'neutral': return '중립';
      case 'greed': return '탐욕';
      case 'extreme greed': return '극단적 탐욕';
      default: return '중립';
    }
  }

  function drawGauge(canvas, score){
    try{
      if (!canvas) return; const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height; ctx.clearRect(0,0,w,h);
      const cx = w/2, cy = h*0.95, r = Math.min(w,h*1.2)/1.8;
      const lw = 12; // 축소에 맞춘 두께
      ctx.lineWidth = lw; ctx.lineCap = 'round';
      // 5개 세그먼트(0~100)
      const segs = [
        { r0:0, r1:20, color:'#ef4444' },
        { r0:20, r1:40, color:'#f59e0b' },
        { r0:40, r1:60, color:'#eab308' },
        { r0:60, r1:80, color:'#86efac' },
        { r0:80, r1:100, color:'#22c55e' }
      ];
      const gap = 0.02; // 세그먼트 사이 미세 간격
      segs.forEach(s=>{
        const a1 = Math.PI + (s.r0/100)*(Math.PI);
        const a2 = Math.PI + (s.r1/100)*(Math.PI);
        ctx.beginPath(); ctx.strokeStyle = s.color; ctx.arc(cx, cy, r, a1+gap, a2-gap); ctx.stroke();
      });
      // 포인터(검은 원)
      const pct = Math.max(0, Math.min(100, Number(score)||0))/100;
      const ang = Math.PI + pct * Math.PI;
      const px = cx + r * Math.cos(ang);
      const py = cy + r * Math.sin(ang);
      ctx.beginPath(); ctx.fillStyle = '#111827'; ctx.arc(px, py, lw*0.45, 0, Math.PI*2); ctx.fill();
    }catch(_){/* noop */}
  }

  async function init(){
    // DOM 존재 확인 후 업데이트
    if (!document.getElementById('mi-marketcap')) return;
    updateMarketCap();
    updateTop20Index();
    updateFNG();
    // 주기 갱신
    setInterval(updateMarketCap, 60*1000);
    setInterval(updateTop20Index, 60*1000);
    setInterval(updateFNG, 60*1000*5);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();


