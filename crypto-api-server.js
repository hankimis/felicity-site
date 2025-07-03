const express = require('express');
const cors = require('cors');
const NodeCache = require('node-cache');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS 설정
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://localhost:8000'
  ],
  credentials: true
}));

app.use(express.json());

// 캐시 설정 (5분 캐시)
const cache = new NodeCache({ stdTTL: 300 });

// 레이트 리미팅을 위한 변수
let lastApiCall = 0;
const API_RATE_LIMIT = 30000; // 30초 간격

// CoinGecko API 호출 함수
async function fetchCoinGeckoData() {
  const now = Date.now();
  
  // 레이트 리미팅 체크
  if (now - lastApiCall < API_RATE_LIMIT) {
    const cachedData = cache.get('crypto-data');
    if (cachedData) {
      console.log('레이트 리미팅으로 인해 캐시된 데이터 반환');
      return cachedData;
    }
  }
  
  try {
    console.log('CoinGecko API 호출 중...');
    lastApiCall = now;
    
    // 한 번에 더 많은 데이터를 가져오기 (페이지 수 줄이기)
    const promises = [];
    for (let page = 1; page <= 2; page++) {
      promises.push(
        fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}&sparkline=true&price_change_percentage=1h%2C24h%2C7d`)
          .then(res => {
            if (!res.ok) {
              throw new Error(`API 응답 오류: ${res.status}`);
            }
            return res.json();
          })
      );
    }
    
    const results = await Promise.allSettled(promises);
    let allData = [];
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allData.push(...result.value);
      }
    }
    
    if (allData.length === 0) {
      throw new Error('모든 API 요청이 실패했습니다');
    }
    
    // 데이터 처리 및 정리
    const processedData = allData.map((coin, index) => ({
      id: coin.id,
      rank: coin.market_cap_rank || index + 1,
      name: cleanText(coin.name),
      symbol: cleanText(coin.symbol).toUpperCase(),
      image: coin.image,
      price: coin.current_price,
      change1h: coin.price_change_percentage_1h_in_currency || 0,
      change24h: coin.price_change_percentage_24h || 0,
      change7d: coin.price_change_percentage_7d_in_currency || 0,
      volume: coin.total_volume,
      marketCap: coin.market_cap,
      sparkline: coin.sparkline_in_7d ? coin.sparkline_in_7d.price : [],
      lastUpdated: new Date().toISOString()
    }));
    
    // 시가총액 순으로 정렬
    processedData.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
    
    // 순위 재정렬
    processedData.forEach((coin, index) => {
      coin.rank = index + 1;
    });
    
    // 캐시에 저장
    cache.set('crypto-data', processedData);
    console.log(`${processedData.length}개 코인 데이터 업데이트 완료`);
    
    return processedData;
    
  } catch (error) {
    console.error('CoinGecko API 오류:', error.message);
    
    // 캐시된 데이터가 있으면 반환
    const cachedData = cache.get('crypto-data');
    if (cachedData) {
      console.log('API 오류로 인해 캐시된 데이터 반환');
      return cachedData;
    }
    
    throw error;
  }
}

// 텍스트 정리 함수
function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/['">\s]+/g, ' ')
    .trim();
}

// 추가 데이터 계산 함수들
function calculateFundingRate(coin) {
  const volatility = Math.abs(coin.change24h || 0);
  const volumeRatio = Math.min((coin.volume || 0) / (coin.marketCap || 1), 1);
  
  let funding = (Math.sin(coin.rank || 1) * 0.05) + (volatility * 0.01);
  funding *= (1 + volumeRatio * 0.5);
  
  return Math.max(-0.1, Math.min(0.1, funding));
}

function calculateOpenInterest(coin) {
  const baseRatio = 0.08;
  const volumeBoost = Math.min((coin.volume || 0) / (coin.marketCap || 1), 0.5) * 0.1;
  const rankBoost = Math.max(0, (100 - (coin.rank || 100)) / 1000);
  
  return (coin.marketCap || 0) * (baseRatio + volumeBoost + rankBoost);
}

function calculateOIChange(coin, period) {
  const priceChange = period === '1h' ? 
    (coin.change1h || 0) : 
    (coin.change24h || 0) / 4;
  
  const correlation = -0.3 + (Math.random() * 0.6);
  return priceChange * correlation;
}

function calculateLiquidation(coin, period) {
  const volatility = Math.abs(coin.change24h || 0);
  const volume = coin.volume || 0;
  
  const liquidationRatio = Math.min(volatility * 0.02, 0.1);
  const baseLiquidation = volume * liquidationRatio;
  
  return period === '24h' ? baseLiquidation : baseLiquidation / 24;
}

// API 엔드포인트
app.get('/api/crypto-data', async (req, res) => {
  try {
    let data = await fetchCoinGeckoData();
    
    // 추가 데이터 계산
    data = data.map(coin => ({
      ...coin,
      fundingRate: calculateFundingRate(coin),
      openInterest: calculateOpenInterest(coin),
      oiChange1h: calculateOIChange(coin, '1h'),
      oiChange4h: calculateOIChange(coin, '4h'),
      liquidation1h: calculateLiquidation(coin, '1h'),
      liquidation24h: calculateLiquidation(coin, '24h')
    }));
    
    res.json({
      success: true,
      data: data,
      timestamp: new Date().toISOString(),
      cached: cache.has('crypto-data')
    });
    
  } catch (error) {
    console.error('API 엔드포인트 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 헬스 체크 엔드포인트
app.get('/api/health', (req, res) => {
  const cacheStats = cache.getStats();
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    cache: {
      keys: cacheStats.keys,
      hits: cacheStats.hits,
      misses: cacheStats.misses
    },
    lastApiCall: new Date(lastApiCall).toISOString()
  });
});

// 캐시 상태 엔드포인트
app.get('/api/cache-status', (req, res) => {
  const cachedData = cache.get('crypto-data');
  res.json({
    hasCachedData: !!cachedData,
    dataCount: cachedData ? cachedData.length : 0,
    cacheStats: cache.getStats(),
    ttl: cache.getTtl('crypto-data')
  });
});

// 서버 시작 시 초기 데이터 로드
async function initializeServer() {
  try {
    console.log('서버 초기화 중...');
    await fetchCoinGeckoData();
    console.log('초기 데이터 로드 완료');
  } catch (error) {
    console.error('초기 데이터 로드 실패:', error.message);
  }
}

// 주기적으로 데이터 업데이트 (5분마다)
setInterval(async () => {
  try {
    console.log('정기 데이터 업데이트 시작...');
    await fetchCoinGeckoData();
  } catch (error) {
    console.error('정기 업데이트 실패:', error.message);
  }
}, 5 * 60 * 1000);

app.listen(PORT, async () => {
  console.log(`암호화폐 API 서버가 포트 ${PORT}에서 실행 중입니다`);
  await initializeServer();
});

module.exports = app; 