const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// LBank API 프록시
app.post('/api/lbank', async (req, res) => {
    try {
        const { apiKey, secretKey, endpoint, params = {} } = req.body;
        
        if (!apiKey || !secretKey || !endpoint) {
            return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
        }

        // LBank API 요청 준비
        const timestamp = Date.now();
        const baseUrl = 'https://api.lbank.info';
        
        // 파라미터 정렬 및 쿼리스트링 생성
        const allParams = {
            ...params,
            api_key: apiKey,
            timestamp: timestamp
        };
        
        const sortedParams = Object.keys(allParams)
            .sort()
            .map(key => `${key}=${encodeURIComponent(allParams[key])}`)
            .join('&');

        // HmacSHA256 서명 생성
        const signature = crypto
            .createHmac('sha256', secretKey)
            .update(sortedParams)
            .digest('hex');

        // 최종 URL 생성
        const url = `${baseUrl}${endpoint}?${sortedParams}&sign=${signature}`;

        console.log('LBank API 요청:', url);

        // API 요청
        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        res.json(response.data);

    } catch (error) {
        console.error('LBank API 프록시 오류:', error.message);
        
        if (error.response) {
            // API 응답 오류
            res.status(error.response.status).json({
                error: 'LBank API 오류',
                details: error.response.data,
                status: error.response.status
            });
        } else if (error.request) {
            // 네트워크 오류
            res.status(500).json({
                error: '네트워크 오류',
                details: error.message
            });
        } else {
            // 기타 오류
            res.status(500).json({
                error: '서버 오류',
                details: error.message
            });
        }
    }
});

// 테스트용 엔드포인트
app.get('/api/test', (req, res) => {
    res.json({ message: 'LBank 프록시 서버가 정상 작동 중입니다.' });
});

app.listen(PORT, () => {
    console.log(`LBank 프록시 서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`테스트: http://localhost:${PORT}/api/test`);
});

module.exports = app; 