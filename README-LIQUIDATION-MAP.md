# 실시간 바이낸스 청산 지도 (Liquidation Map) 시스템

## 개요

이 시스템은 바이낸스의 실시간 데이터를 수집하여 BTC/USDT 페어의 청산 지도를 예측하고 시각화하는 완전한 솔루션입니다.

## 주요 기능

### 🔄 실시간 데이터 수집
- 바이낸스 웹소켓을 통한 24시간 실시간 데이터 수집
- 거래 데이터, 오더북, 미결제 약정, 자금조달률, 롱숏 비율 수집
- IndexedDB (브라우저) 및 SQLite (서버) 데이터베이스 저장

### 🧠 예측 모델
- 오더북 데이터 기반 포지션 추정
- 거래량 분포 분석
- 미결제 약정 및 롱숏 비율 반영
- 레버리지별 (10x, 25x, 50x, 100x) 청산 위험 예측

### 📊 시각화
- Coinglass 스타일의 청산 지도 차트
- 실시간 업데이트 (30초마다)
- 레버리지별 색상 구분
- 누적 청산 금액 라인 차트

## 설치 및 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. 서버 사이드 데이터 수집기 실행 (선택사항)

24시간 데이터 수집을 위해 서버에서 데이터 수집기를 실행할 수 있습니다:

```bash
npm run collector
```

또는 직접 실행:

```bash
node data-collector.js
```

### 3. 웹 서버 실행

```bash
npm start
```

## 사용법

### 브라우저에서 사용

```html
<!DOCTYPE html>
<html>
<head>
    <title>실시간 청산 지도</title>
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
</head>
<body>
    <div id="liquidationmap-chart-container"></div>
    
    <script type="module">
        import { LiquidationMapBTCUSDT } from './js/analysis/liquidationmap-btcusdt.js';
        
        // 청산 지도 초기화
        const liquidationMap = new LiquidationMapBTCUSDT({
            containerId: 'liquidationmap-chart-container',
            refreshMs: 30000 // 30초마다 업데이트
        });
        
        // 연결 상태 확인
        setInterval(() => {
            const status = liquidationMap.getConnectionStatus();
            console.log('연결 상태:', status);
        }, 10000);
    </script>
</body>
</html>
```

### JavaScript 모듈로 사용

```javascript
import { LiquidationMapBTCUSDT } from './js/analysis/liquidationmap-btcusdt.js';
import { BinanceWebSocket } from './js/analysis/binance-websocket.js';
import { DataStorage } from './js/analysis/data-storage.js';
import { LiquidationPredictor } from './js/analysis/liquidation-predictor.js';

// 개별 컴포넌트 사용
const websocket = new BinanceWebSocket();
const dataStorage = new DataStorage();
const predictor = new LiquidationPredictor(dataStorage);

// 웹소켓 이벤트 리스너
websocket.on('trade', async (tradeData) => {
    await dataStorage.saveTrade(tradeData);
    console.log('거래 데이터 저장됨:', tradeData);
});

// 청산 예측
const prediction = await predictor.predictLiquidations(50000); // BTC 가격
console.log('청산 예측 결과:', prediction);
```

## 파일 구조

```
js/analysis/
├── liquidationmap-btcusdt.js    # 메인 청산 지도 클래스
├── binance-websocket.js         # 바이낸스 웹소켓 클라이언트
├── data-storage.js              # IndexedDB 데이터 저장 관리
└── liquidation-predictor.js     # 청산 예측 모델

data-collector.js                # 서버 사이드 데이터 수집기
```

## 데이터베이스 스키마

### IndexedDB (브라우저)
- `trades`: 거래 데이터
- `orderbook`: 오더북 데이터
- `openInterest`: 미결제 약정
- `fundingRate`: 자금조달률
- `longShortRatio`: 롱숏 비율
- `liquidationPredictions`: 청산 예측 결과

### SQLite (서버)
- `trades`: 거래 데이터
- `orderbook`: 오더북 데이터
- `open_interest`: 미결제 약정
- `funding_rate`: 자금조달률
- `long_short_ratio`: 롱숏 비율
- `liquidation_predictions`: 청산 예측 결과

## 예측 모델 설명

### 1. 오더북 기반 포지션 추정
- 매수/매도 주문의 가격과 수량을 분석
- 레버리지별 분포 확률 적용 (10x: 40%, 25x: 30%, 50x: 20%, 100x: 10%)

### 2. 거래량 분포 분석
- 거래량이 높은 가격 구간에 포지션 집중도 증가
- 변동성 기반 청산 위험 조정

### 3. 시장 데이터 반영
- 미결제 약정 규모에 따른 전체 스케일 조정
- 롱숏 비율에 따른 청산 위험 조정

### 4. 누적 청산 금액 계산
- 중앙 가격을 기준으로 롱/숏 포지션 누적
- 각 가격 구간별 총 청산 가능 금액 계산

## API 참조

### LiquidationMapBTCUSDT

#### 생성자 옵션
- `containerId`: 차트 컨테이너 ID (기본값: 'liquidationmap-chart-container')
- `refreshMs`: 자동 새로고침 간격 (기본값: 30000ms)

#### 메서드
- `getConnectionStatus()`: 웹소켓 연결 상태 반환
- `getDataStatistics()`: 데이터베이스 통계 조회
- `getPredictionData()`: 최신 예측 데이터 반환
- `destroy()`: 리소스 정리

### BinanceWebSocket

#### 이벤트
- `trade`: 실시간 거래 데이터
- `orderbook`: 오더북 업데이트
- `openInterest`: 미결제 약정 데이터
- `fundingRate`: 자금조달률
- `longShortRatio`: 롱숏 비율

#### 메서드
- `connect()`: 웹소켓 연결
- `disconnect()`: 연결 해제
- `getStatus()`: 연결 상태 반환

### DataStorage

#### 메서드
- `saveTrade(tradeData)`: 거래 데이터 저장
- `saveOrderBook(orderBookData)`: 오더북 데이터 저장
- `getRecentTrades(limit)`: 최근 거래 데이터 조회
- `calculateStatistics()`: 통계 데이터 계산
- `clearAllData()`: 모든 데이터 삭제

### LiquidationPredictor

#### 메서드
- `predictLiquidations(currentPrice)`: 청산 예측 수행
- `validatePrediction(prediction)`: 예측 결과 검증

## 성능 최적화

### 데이터 관리
- 최대 10,000개 데이터 포인트 저장
- 오래된 데이터 자동 정리
- IndexedDB 인덱싱으로 빠른 조회

### 메모리 관리
- 웹소켓 연결 자동 재연결
- 에러 처리 및 로깅
- 리소스 정리 메서드 제공

## 모니터링

### 서버 사이드
```bash
# 데이터 수집 통계 확인
npm run collector

# 로그 출력 예시
=== 데이터 수집 통계 ===
거래 데이터: 1,234,567
오더북 데이터: 45,678
미결제 약정: 1,234
자금조달률: 567
롱숏 비율: 890
마지막 업데이트: 2024-01-15T10:30:00.000Z
========================
```

### 브라우저 사이드
```javascript
// 연결 상태 모니터링
setInterval(() => {
    const status = liquidationMap.getConnectionStatus();
    console.log('웹소켓 연결:', status.isConnected);
    console.log('최신 가격:', status.lastTradePrice);
}, 10000);

// 데이터 통계 확인
const stats = await liquidationMap.getDataStatistics();
console.log('데이터 통계:', stats);
```

## 문제 해결

### 웹소켓 연결 실패
- 네트워크 연결 확인
- 바이낸스 API 상태 확인
- 자동 재연결 기능 확인

### 데이터베이스 오류
- 브라우저 IndexedDB 지원 확인
- 저장 공간 부족 확인
- 데이터 정리 실행

### 예측 모델 오류
- 충분한 데이터 수집 확인
- 가격 데이터 유효성 확인
- 예측 결과 검증 로그 확인

## 라이선스

ISC License

## 기여

버그 리포트 및 기능 요청은 GitHub Issues를 통해 제출해주세요. 