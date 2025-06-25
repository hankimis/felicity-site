const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// CORS 설정
app.use(cors({
    origin: 'http://localhost:8000',
    credentials: true
}));

// Binance API 프록시
app.use('/api/binance', createProxyMiddleware({
    target: 'https://api.binance.com',
    changeOrigin: true,
    pathRewrite: {
        '^/api/binance': '/api/v3'
    },
    onProxyRes: function (proxyRes, req, res) {
        proxyRes.headers['Access-Control-Allow-Origin'] = 'http://localhost:8000';
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

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`프록시 서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`Binance API: http://localhost:${PORT}/api/binance`);
    console.log(`Binance WebSocket: ws://localhost:${PORT}/ws/binance`);
}); 