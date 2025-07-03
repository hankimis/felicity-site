# Felicity Crypto API Server

CoinGecko API 요청을 최적화하고 429 에러를 방지하기 위한 백엔드 캐싱 서버입니다.

## 🚀 주요 기능

- **API 요청 최적화**: CoinGecko API 호출을 30초 간격으로 제한
- **스마트 캐싱**: 5분간 데이터 캐시로 빠른 응답
- **에러 처리**: API 실패 시 캐시된 데이터 자동 제공
- **실시간 모니터링**: 캐시 상태 및 서버 헬스 체크

## 📦 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 서버 실행
```bash
# 프로덕션 모드
npm start

# 개발 모드 (nodemon 사용)
npm run dev
```

서버는 기본적으로 **포트 3001**에서 실행됩니다.

## 🔗 API 엔드포인트

### 메인 데이터 API
```
GET http://localhost:3001/api/crypto-data
```

**응답 예시:**
```json
{
  "success": true,
  "data": [
    {
      "id": "bitcoin",
      "rank": 1,
      "name": "Bitcoin",
      "symbol": "BTC",
      "price": 106217,
      "change1h": 0.10,
      "change24h": -0.84,
      "volume": 25830000000,
      "marketCap": 2100000000000,
      "fundingRate": 0.05,
      "openInterest": 168000000000,
      "sparkline": [...]
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z",
  "cached": true
}
```

### 헬스 체크
```
GET http://localhost:3001/api/health
```

### 캐시 상태 확인
```
GET http://localhost:3001/api/cache-status
```

## ⚙️ 최적화 설정

- **캐시 지속시간**: 5분 (300초)
- **API 호출 간격**: 최소 30초
- **자동 업데이트**: 5분마다
- **데이터 소스**: CoinGecko API (페이지 1-2, 총 500개 코인)

## 🔧 환경 설정

환경변수로 포트 변경 가능:
```bash
PORT=3002 npm start
```

## 📊 성능 향상

### Before (직접 API 호출)
- ❌ 클라이언트마다 개별 API 요청
- ❌ 429 에러 빈발
- ❌ 느린 로딩 속도
- ❌ API 제한에 자주 걸림

### After (백엔드 캐싱)
- ✅ 단일 서버에서 API 관리
- ✅ 429 에러 방지
- ✅ 빠른 응답 속도 (캐시)
- ✅ 안정적인 서비스 제공

## 🚨 주의사항

1. **서버 실행 필수**: 프론트엔드 사용 전 반드시 서버를 먼저 실행하세요
2. **포트 확인**: 기본 포트 3001이 사용 중인 경우 다른 포트로 변경
3. **인터넷 연결**: CoinGecko API 접근을 위한 인터넷 연결 필요

## 📝 로그 예시

```
암호화폐 API 서버가 포트 3001에서 실행 중입니다
서버 초기화 중...
CoinGecko API 호출 중...
500개 코인 데이터 업데이트 완료
초기 데이터 로드 완료
정기 데이터 업데이트 시작...
```

## 🛠️ 문제 해결

### 서버 연결 실패
- 서버가 실행 중인지 확인
- 포트 3001이 열려있는지 확인
- 방화벽 설정 확인

### API 데이터 없음
- 인터넷 연결 상태 확인
- CoinGecko API 상태 확인
- 서버 로그에서 에러 메시지 확인 