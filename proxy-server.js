const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();

// CORS 설정 (환경변수 지원)
const ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:8000';
app.use(cors({ origin: ORIGIN, credentials: true }));

// 공통 캐시 헤더 도우미
function setImageCacheHeaders(res) {
  res.setHeader('Cache-Control', 'public, max-age=604800, immutable'); // 7d
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);
}

// 아이콘 프록시 (다중 소스 폴백)
app.get('/api/icon/:symbol', async (req, res) => {
  try {
    const raw = String(req.params.symbol || '').toLowerCase();
    if (!raw || raw.length > 20) {
      return res.status(400).json({ error: 'invalid symbol' });
    }

    const candidates = [
      `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/${raw}.png`,
      `https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@master/32/color/${raw}.png`,
      `https://cryptoicon-api.vercel.app/api/icon/${raw}`,
      `https://coinicons-api.vercel.app/${raw}.png`
    ];

    for (const url of candidates) {
      try {
        const resp = await fetch(url, { redirect: 'follow' });
        if (!resp.ok) continue;
        const ct = resp.headers.get('content-type') || '';
        if (!ct.includes('image')) continue;

        setImageCacheHeaders(res);
        res.setHeader('Content-Type', ct);
        resp.body.pipe(res);
        return;
      } catch (e) {
        // try next
      }
    }

    // 최종 SVG 플레이스홀더
    const letter = raw.charAt(0).toUpperCase() || '?';
    const colors = ['#6366f1','#0ea5e9','#22c55e','#eab308','#f97316','#ef4444','#a855f7','#14b8a6'];
    const idx = letter.charCodeAt(0) % colors.length;
    const bg = colors[idx];
    const svg = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="15" fill="${bg}"/><text x="16" y="21" text-anchor="middle" fill="#fff" font-size="14" font-family="Arial, sans-serif" font-weight="bold">${letter}</text></svg>`;
    setImageCacheHeaders(res);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (err) {
    res.status(500).json({ error: 'icon proxy failed' });
  }
});

// Binance API 프록시
app.use('/api/binance', createProxyMiddleware({
    target: 'https://api.binance.com',
    changeOrigin: true,
    pathRewrite: {
        '^/api/binance': '/api/v3'
    },
    onProxyRes: function (proxyRes, req, res) {
        proxyRes.headers['Access-Control-Allow-Origin'] = ORIGIN;
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    }
}));

// Binance WebSocket 프록시
app.use('/ws/binance', createProxyMiddleware({
    target: 'wss://stream.binance.com:9443',
    changeOrigin: true,
    ws: true,
    pathRewrite: {
        '^/ws/binance': ''
    }
}));

// CoinGecko API 프록시 (데모 키 포함)
const CG_DEMO_API_KEY = 'CG-mimMBvFoj6H2ZWgrWMdbNDdB';
app.use('/api/coingecko', createProxyMiddleware({
    target: 'https://api.coingecko.com/api/v3',
    changeOrigin: true,
    pathRewrite: { '^/api/coingecko': '' },
    onProxyReq: function (proxyReq, req, res) {
        try { proxyReq.setHeader('x-cg-demo-api-key', CG_DEMO_API_KEY); } catch(_) {}
    },
    onProxyRes: function (proxyRes, req, res) {
        proxyRes.headers['Access-Control-Allow-Origin'] = ORIGIN;
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
        proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    }
}));

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`프록시 서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`Binance API: http://localhost:${PORT}/api/binance`);
    console.log(`CoinGecko API: http://localhost:${PORT}/api/coingecko`);
    console.log(`Binance WebSocket: ws://localhost:${PORT}/ws/binance`);
}); 