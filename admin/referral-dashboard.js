// LBank 레퍼럴 대시보드 JS
// 프록시 서버를 통한 LBank API 연동

// DOM 요소 참조
const apiForm = document.getElementById('lbank-api-form');
const apiKeyInput = document.getElementById('lbank-api-key');
const secretKeyInput = document.getElementById('lbank-secret-key');
const statusEl = document.getElementById('api-key-status');
const revenueEl = document.getElementById('referral-revenue');
const usersEl = document.getElementById('referral-users');
const volumeEl = document.getElementById('referral-volume');
const tableBody = document.getElementById('referral-table-body');

let apiKey = '';
let secretKey = '';

// 연결 상태 UI 업데이트
function setStatus(connected, msg) {
  statusEl.textContent = connected ? '연결됨' : '미연결';
  statusEl.style.color = connected ? '#10b981' : '#ef4444';
  if (msg) statusEl.title = msg;
}

// 프록시 서버를 통한 LBank API 요청
async function lbankApiRequest(endpoint, params = {}) {
  try {
    const response = await fetch('http://localhost:3001/api/lbank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: apiKey,
        secretKey: secretKey,
        endpoint: endpoint,
        params: params
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API 요청 오류:', error);
    throw error;
  }
}

// 폼 제출 시 API 연결
apiForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  apiKey = apiKeyInput.value.trim();
  secretKey = secretKeyInput.value.trim();
  
  if (!apiKey || !secretKey) {
    alert('API Key와 Secret Key를 모두 입력해주세요.');
    return;
  }

  setStatus(false, '연결 시도 중...');
  revenueEl.textContent = usersEl.textContent = volumeEl.textContent = '-';
  tableBody.innerHTML = '';

  try {
    // 1. 먼저 프록시 서버 연결 테스트
    const testResponse = await fetch('http://localhost:3001/api/test');
    if (!testResponse.ok) {
      throw new Error('프록시 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
    }

    // 2. LBank API 연결 테스트 (잔고 조회)
    const balanceRes = await lbankApiRequest('/v2/account/getBalance');
    console.log('잔고 조회 결과:', balanceRes);

    if (balanceRes && balanceRes.result) {
      setStatus(true, 'API 연결 성공');
      await loadReferralDashboard();
    } else {
      setStatus(false, 'API 연결 실패');
      alert('API 연결 실패: ' + (balanceRes && balanceRes.error_msg ? balanceRes.error_msg : '알 수 없는 오류'));
    }
  } catch (err) {
    setStatus(false, 'API 연결 실패');
    alert('API 연결 실패: ' + err.message);
    console.error('연결 오류:', err);
  }
});

// 대시보드 데이터 로드
async function loadReferralDashboard() {
  try {
    // 1. 계정 정보 조회
    const accountRes = await lbankApiRequest('/v2/account/getBalance');
    console.log('계정 정보:', accountRes);

    // 2. 거래 내역 조회 (최근 30일)
    const tradesRes = await lbankApiRequest('/v2/orders/getOrders', {
      symbol: 'btc_usdt',
      size: 100,
      current_page: 1
    });
    console.log('거래 내역:', tradesRes);

    // 3. 통계 계산 (실제 데이터 구조에 맞게 수정 필요)
    let totalRevenue = 0;
    let totalUsers = 0;
    let totalVolume = 0;

    // 계정 잔고에서 USDT 잔고 확인
    if (accountRes && accountRes.result) {
      const usdtBalance = accountRes.result.find(balance => balance.asset === 'usdt');
      if (usdtBalance) {
        totalRevenue = parseFloat(usdtBalance.free) || 0;
      }
    }

    // 거래 내역에서 거래량 계산
    if (tradesRes && tradesRes.result) {
      totalVolume = tradesRes.result.reduce((sum, trade) => {
        return sum + (parseFloat(trade.amount) || 0);
      }, 0);
    }

    // 통계 표시
    revenueEl.textContent = totalRevenue.toLocaleString() + ' USDT';
    usersEl.textContent = totalUsers + '명';
    volumeEl.textContent = totalVolume.toLocaleString() + ' USDT';

    // 4. 상세 테이블 렌더링 (거래 내역)
    tableBody.innerHTML = '';
    if (tradesRes && tradesRes.result && tradesRes.result.length > 0) {
      tradesRes.result.forEach(trade => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${trade.order_id || '-'}</td>
          <td>${trade.create_time ? new Date(parseInt(trade.create_time)).toLocaleDateString() : '-'}</td>
          <td>${trade.amount ? parseFloat(trade.amount).toLocaleString() + ' ' + trade.symbol : '-'}</td>
          <td>${trade.fee ? parseFloat(trade.fee).toLocaleString() + ' USDT' : '-'}</td>
          <td><span class="status-badge ${trade.status === 'filled' ? 'active' : 'inactive'}">${trade.status === 'filled' ? '완료' : '진행중'}</span></td>
        `;
        tableBody.appendChild(tr);
      });
    } else {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="5">거래 내역이 없습니다.</td>';
      tableBody.appendChild(tr);
    }

  } catch (error) {
    console.error('대시보드 데이터 로드 오류:', error);
    alert('데이터 로드 실패: ' + error.message);
  }
}

// 페이지 진입 시 연결 상태 초기화
setStatus(false, 'API Key 입력 후 연결하세요.');

// 프록시 서버 상태 확인
async function checkProxyServer() {
  try {
    const response = await fetch('http://localhost:3001/api/test');
    if (response.ok) {
      console.log('프록시 서버 연결 성공');
    } else {
      console.warn('프록시 서버 연결 실패');
    }
  } catch (error) {
    console.warn('프록시 서버가 실행되지 않았습니다. node lbank-proxy.js를 실행해주세요.');
  }
}

// 페이지 로드 시 프록시 서버 상태 확인
document.addEventListener('DOMContentLoaded', checkProxyServer); 