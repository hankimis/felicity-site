// 전역 변수 선언
let chart = null;
let candleSeries = null;
let chartSeries = null; // 좌표 변환용 시리즈 참조
let messagesUnsubscribe = null;
let binanceSocket = null;
let currentSymbol = 'BTCUSDT';
let currentInterval = '1m';
let isChartInitialized = false;
let isLoggedIn = false;
let currentTool = 'cursor'; // 현재 선택된 도구
let isDrawing = false;
let startPoint = null;
let currentDrawing = null;
let drawings = []; // 그려진 요소들을 저장
let drawingHistory = []; // 실행 취소를 위한 히스토리
let lastBrushTime = 0; // 브러쉬 throttling을 위한 변수
let arrowStage = 0; // 0: 대기, 1: 첫 번째 클릭 완료, 2: 그리기 완료
let tempArrow = null; // 임시 화살표 요소
let isDraggingArrow = false; // 화살표 드래그 중인지 확인

// TradingView widget instance and helper (added)
let tvWidget = null; // TradingView Advanced Charts widget instance
const TV_RESOLUTION_MAP = { '1m': '1', '5m': '5', '15m': '15', '1h': '60', '4h': '240', '1d': 'D' };
const TV_SUPPORTED_RESOLUTIONS = ['1', '5', '15', '60', '240', 'D'];
function intervalToTVRes(interval) { return TV_RESOLUTION_MAP[interval] || '1'; }

// Convert Binance symbol to TradingView format (e.g., BTCUSDT -> BINANCE:BTCUSDT)
function stripPrefix(symbol) { return symbol.includes(':') ? symbol.split(':')[1] : symbol; }

// 차트 데이터 관리 변수
let chartData = []; // 모든 차트 데이터 저장
let isLoadingMoreData = false; // 데이터 로딩 중 플래그
let oldestTimestamp = null; // 가장 오래된 데이터의 타임스탬프
let newestTimestamp = null; // 가장 최신 데이터의 타임스탬프

const MESSAGES_PER_PAGE = 50; // 최적화를 위해 한 번에 로드할 메시지 수
let isChatFormInitialized = false; // 채팅 폼 초기화 플래그

let prevDayClose = null;
let last24hData = null;

let coinData = [];

const binanceStreams = {};

async function loadBinanceCoinData() {
  try {
    const resp = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    const data = await resp.json();
    // filter USDT pairs and construct objects
    coinData = data
      .filter(t => t.symbol.endsWith('USDT'))
      .map(t => {
        const base = t.symbol.replace('USDT', '');
        const logoUrl = `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.17.1/32/color/${base.toLowerCase()}.png`;
        return {
          symbol: t.symbol,
          name: base,
          type: 'SPOT',
          platform: 'Binance',
          price: parseFloat(t.lastPrice),
          change: parseFloat(t.priceChangePercent),
          logo: logoUrl
        };
      });
    console.log('Loaded', coinData.length, 'coins');
  } catch(e){
    console.error('Failed to load coin list', e);
  }
}

// auth.js에서 초기화된 Firebase 인스턴스 사용
// const firebaseConfig = { ... };
// const app = firebase.initializeApp(firebaseConfig);
// const auth = firebase.auth();
// const db = firebase.firestore();

// DOM Elements
const messageForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('chat-messages');
const chartContainer = document.getElementById('chart-container');
const chartLoading = document.getElementById('chart-loading');

// 로딩 인디케이터 함수들
function showChartLoading() {
    if (chartLoading) {
        chartLoading.classList.add('show');
    }
}

function hideChartLoading() {
    if (chartLoading) {
        chartLoading.classList.remove('show');
    }
}

// 채팅 관련 함수들

// 메시지 객체로부터 HTML 문자열을 생성하여 반환 (DOM 직접 조작 X)
function renderMessage(msg) {
    const profileImg = msg.data.photoThumbURL || msg.data.photoURL || 'assets/@default-profile.png';
    
    let isMyMessage = false;
    if (window.currentUser && msg.data.uid === window.currentUser.uid) {
        isMyMessage = true;
    } else if (!window.currentUser) {
        const guestNumber = localStorage.getItem('guestNumber');
        if (guestNumber && msg.data.uid === 'guest-' + guestNumber) {
            isMyMessage = true;
        }
    }
    const myMessageClass = isMyMessage ? 'my-message' : '';

    return `
        <div class="message-item ${myMessageClass}" id="${msg.id}" data-uid="${msg.data.uid}">
            <div class="chat-profile-pic-wrap">
                <img class="chat-profile-pic" src="${profileImg}" alt="프로필" loading="lazy" />
            </div>
            <div class="message-content">
                <div class="message-sender">
                    <strong>${msg.data.displayName}</strong>
                </div>
                <div class="message-text">${msg.data.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
            </div>
        </div>
    `;
}

async function loadMessages() {
    try {
        console.log('Loading messages...');
        if (!window.db) throw new Error('Firestore (window.db) not initialized');
        const messagesQuery = window.db.collection('community-chat')
            .orderBy('timestamp', 'desc')
            .limit(MESSAGES_PER_PAGE);
        
        const snapshot = await messagesQuery.get();
        const messages = [];
        snapshot.forEach((doc) => {
            messages.push({ id: doc.id, data: doc.data() });
        });
        messages.reverse(); // 시간순으로 표시하기 위해 배열을 뒤집음
        
        if (messagesContainer) {
            // 모든 메시지의 HTML을 한 번에 생성하여 innerHTML로 설정
            const messagesHTML = messages.map(msg => renderMessage(msg)).join('');
            messagesContainer.innerHTML = messagesHTML;
            
            setTimeout(() => {
                if (window.innerWidth > 768) {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                } else {
                    messagesContainer.scrollTop = 0;
                }
            }, 100);
        }
        
        setupRealtimeListener();
        console.log(`${messages.length} messages loaded successfully`);
    } catch (error) {
        console.error('메시지 로드 실패:', error);
        if (messagesContainer) {
            messagesContainer.innerHTML = '<div class="chat-notice">메시지를 불러올 수 없습니다.</div>';
        }
    }
}

function setupRealtimeListener() {
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
    }
    // 실시간 리스너는 현재 시간 이후의 새 메시지만 가져오도록 설정
    if (!window.db) return; // Firestore not ready
    const messagesQuery = window.db.collection('community-chat')
        .where('timestamp', '>', new Date());
    
    messagesUnsubscribe = messagesQuery.onSnapshot((snapshot) => {
        if (!messagesContainer) return;

        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const msg = { id: change.doc.id, data: change.doc.data() };
                if (!document.getElementById(msg.id)) {
                    // 새 메시지를 HTML로 렌더링하여 추가
                    const messageHTML = renderMessage(msg);
                    messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
                }
            }
        });
        
        // 새 메시지 수신 시 스크롤 조정
        const isScrolledToBottom = messagesContainer.scrollHeight - messagesContainer.clientHeight <= messagesContainer.scrollTop + 100;
        if (isScrolledToBottom && window.innerWidth > 768) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }, (error) => {
        console.error('실시간 메시지 리스너 오류:', error);
    });
}

// 사용자가 로그인되면 기존 메시지의 스타일을 업데이트하는 함수
function updateUserMessageStyles() {
    if (!messagesContainer) return;

    const messages = messagesContainer.querySelectorAll('.message-item');
    const guestNumber = localStorage.getItem('guestNumber');

    messages.forEach(msgElement => {
        const msgUid = msgElement.dataset.uid;
        let isMyMessage = false;

        if (window.currentUser && msgUid === window.currentUser.uid) {
            isMyMessage = true;
        } else if (!window.currentUser && guestNumber && msgUid === 'guest-' + guestNumber) {
            isMyMessage = true;
        }

        if (isMyMessage) {
            msgElement.classList.add('my-message');
        } else {
            msgElement.classList.remove('my-message');
        }
    });
}

// 차트 관련 함수들
async function initChart() {
    console.log('Starting chart initialization...');
    
    // --- TradingView Advanced Charts integration ---
    if (window.TradingView && window.TradingView.widget) {
        if (isChartInitialized) {
            console.log('TradingView chart already initialized');
            return;
        }
        if (!chartContainer) {
            console.error('Chart container not found for TradingView');
            return;
        }
        const isDarkMode = document.documentElement.classList.contains('dark-mode');
        const tvTheme = isDarkMode ? 'dark' : 'light';
        const tvResolution = intervalToTVRes(currentInterval);
        try {
            // ensure coin list ready for searchSymbols
            if (coinData.length === 0) await loadBinanceCoinData();
            tvWidget = new TradingView.widget({
                container: chartContainer,
                symbol: currentSymbol,
                interval: tvResolution,
                autosize: true,
                library_path: 'charting_library-master/charting_library/',
                datafeed: createBinanceDatafeed(),
                locale: 'ko',
                theme: tvTheme,
                disabled_features: ['use_localstorage_for_settings'],
            });
            isChartInitialized = true;
            console.log('TradingView widget created');
            connectWebSocket();
        } catch (err) {
            console.error('Failed to create TradingView widget:', err);
        }
        return; // skip LightweightCharts init below
    }
    // --- End TradingView integration ---

    if (isChartInitialized) {
        console.log('Chart already initialized');
        return;
    }
    
    if (!chartContainer) {
        console.error('Chart container not found');
        return;
    }

    if (!window.LightweightCharts) {
        console.error('LightweightCharts library not loaded');
        return;
    }

    try {
        // 차트 컨테이너 크기 확인
        const containerWidth = chartContainer.clientWidth;
        const containerHeight = chartContainer.clientHeight;
        console.log('Chart container dimensions:', { width: containerWidth, height: containerHeight });

        if (containerWidth <= 0 || containerHeight <= 0) {
            console.error('Invalid chart container dimensions');
            return;
        }

        // 다크모드 확인
        const isDarkMode = document.documentElement.classList.contains('dark-mode');
        console.log('Dark mode detected:', isDarkMode);
        
        // 차트 생성
        console.log('Creating chart...');
        chart = LightweightCharts.createChart(chartContainer, {
            width: containerWidth,
            height: containerHeight,
            layout: {
                backgroundColor: isDarkMode ? '#2d2d2d' : '#ffffff',
                textColor: isDarkMode ? '#e9ecef' : '#333',
            },
            grid: {
                vertLines: {
                    color: isDarkMode ? '#404040' : '#e1e1e1',
                },
                horzLines: {
                    color: isDarkMode ? '#404040' : '#e1e1e1',
                },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
            rightPriceScale: {
                borderColor: isDarkMode ? '#404040' : '#cccccc',
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.1,
                },
            },
            timeScale: {
                borderColor: isDarkMode ? '#404040' : '#cccccc',
                timeVisible: true,
                secondsVisible: false,
                rightOffset: 12,
                barSpacing: 3,
                minBarSpacing: 1,
                fixLeftEdge: true,
                lockVisibleTimeRangeOnResize: true,
                rightBarStaysOnScroll: true,
                borderVisible: false,
                visible: true,
                tickMarkFormatter: (time) => {
                    const date = new Date(time * 1000);
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    return `${hours}:${minutes}`;
                },
            },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: true,
            },
            handleScale: {
                axisPressedMouseMove: true,
                mouseWheel: true,
                pinch: true,
            },
            localization: {
                // 한국어 로케일 설정
                locale: 'ko-KR',
                // 커서 시간 포맷터 - 이미 KST로 저장된 데이터이므로 변환하지 않음
                timeFormatter: (time) => {
                    // time은 이미 KST로 변환되어 저장된 timestamp
                    const date = new Date(time * 1000);
                    
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    return `${year}-${month}-${day} ${hours}:${minutes}`;
                },
                // 날짜 포맷 설정
                dateFormat: 'yyyy-MM-dd',
            },
        });

        console.log('Chart created successfully:', chart);

        // 캔들스틱 시리즈 생성
        console.log('Adding candlestick series...');
        if (typeof chart.addCandlestickSeries === 'function') {
            candleSeries = chart.addCandlestickSeries({
                upColor: '#26a69a',
                downColor: '#ef5350',
                borderVisible: false,
                wickUpColor: '#26a69a',
                wickDownColor: '#ef5350',
            });
        } else if (typeof chart.addBarSeries === 'function') {
            // Fallback for older/light versions without candlesticks
            console.warn('addCandlestickSeries not found. Falling back to addBarSeries.');
            candleSeries = chart.addBarSeries({
                upColor: '#26a69a',
                downColor: '#ef5350',
                thinBars: false,
            });
        } else {
            throw new Error('Neither addCandlestickSeries nor addBarSeries is available on chart object.');
        }
        
        // 좌표 변환용 시리즈 참조 설정
        chartSeries = candleSeries;

        console.log('Candlestick series created successfully:', candleSeries);

        // 리사이즈 처리
        const resizeObserver = new ResizeObserver(entries => {
            if (entries[0] && chart) {
                const { width, height } = entries[0].contentRect;
                chart.applyOptions({ width, height });
            }
        });
        resizeObserver.observe(chartContainer);

        // 차트 스크롤 이벤트 처리 (더 많은 과거 데이터 로드)
        chart.timeScale().subscribeVisibleTimeRangeChange(() => {
            const visibleRange = chart.timeScale().getVisibleRange();
            if (visibleRange && !isLoadingMoreData) {
                // 왼쪽 끝에 가까워지면 더 많은 과거 데이터 로드
                const timeFrom = visibleRange.from;
                const oldestVisible = oldestTimestamp;
                
                if (oldestVisible && timeFrom && timeFrom < oldestVisible + 100) {
                    console.log('Loading more historical data...');
                    loadMoreHistoricalData();
                }
            }
        });

        // 초기 데이터 로드
        await loadChartData();
        
        // WebSocket 연결
        connectWebSocket();

        isChartInitialized = true;
        console.log('Chart initialization completed successfully');
        
        // 차트 초기화 완료 후 현재 테마 강제 적용
        const currentIsDark = document.documentElement.classList.contains('dark-mode');
        if (currentIsDark) {
            console.log('Force applying dark theme after chart initialization');
            setTimeout(() => updateChartTheme(true), 100);
        }
    } catch (error) {
        console.error('Failed to initialize chart:', error);
        isChartInitialized = false;
    }
}

async function loadChartData() {
    try {
        showChartLoading();
        console.log('Loading chart data...');
        
        // 24시간 변화량 데이터 가져오기
        const tickerResponse = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${currentSymbol}`);
        if (!tickerResponse.ok) {
            throw new Error(`HTTP error! status: ${tickerResponse.status}`);
        }
        last24hData = await tickerResponse.json();
        console.log('24h ticker data:', last24hData);

        // 현재 차트 데이터 로드
        const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${currentSymbol}&interval=${currentInterval}&limit=200`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Raw chart data received:', data.length, 'candles');

        const formattedData = data.map(candle => {
            const utcTime = candle[0] / 1000;
            const kstTime = utcTime + (9 * 60 * 60);
            
            return {
                time: kstTime,
                open: parseFloat(candle[1]),
                high: parseFloat(candle[2]),
                low: parseFloat(candle[3]),
                close: parseFloat(candle[4])
            };
        });

        console.log('Formatted chart data:', formattedData.length, 'candles');

        chartData = formattedData;
        if (formattedData.length > 0) {
            oldestTimestamp = formattedData[0].time;
            newestTimestamp = formattedData[formattedData.length - 1].time;
            
            // 24시간 변화량으로 가격 표시 업데이트
            if (last24hData) {
                const currentPrice = parseFloat(last24hData.lastPrice);
                const priceChange = parseFloat(last24hData.priceChange);
                const priceChangePercent = parseFloat(last24hData.priceChangePercent);
                updateCoinPriceDisplay(currentPrice, priceChange, priceChangePercent);
            }
        }

        if (candleSeries && formattedData.length > 0) {
            candleSeries.setData(formattedData);
            chart.timeScale().fitContent();
            console.log('Chart data set successfully');
        }
    } catch (error) {
        console.error('Failed to load chart data:', error);
    } finally {
        hideChartLoading();
    }
}

// 과거 데이터 로드 함수 (스크롤 시 호출)
async function loadMoreHistoricalData() {
    if (isLoadingMoreData || !oldestTimestamp) {
        return;
    }

    isLoadingMoreData = true;
    showChartLoading();
    console.log('Loading more historical data from timestamp:', oldestTimestamp);

    try {
        // 과거 데이터 요청 (endTime을 oldestTimestamp로 설정)
        const endTime = Math.floor(oldestTimestamp - (9 * 60 * 60)) * 1000; // UTC로 변환
        const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${currentSymbol}&interval=${currentInterval}&limit=200&endTime=${endTime}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Historical data received:', data.length, 'candles');

        if (data.length === 0) {
            console.log('No more historical data available');
            return;
        }

        const formattedData = data.map(candle => {
            const utcTime = candle[0] / 1000;
            const kstTime = utcTime + (9 * 60 * 60);
            
            return {
                time: kstTime,
                open: parseFloat(candle[1]),
                high: parseFloat(candle[2]),
                low: parseFloat(candle[3]),
                close: parseFloat(candle[4])
            };
        });

        // 중복 데이터 제거 및 정렬
        const newData = formattedData.filter(newCandle => 
            !chartData.some(existingCandle => existingCandle.time === newCandle.time)
        );

        if (newData.length > 0) {
            // 기존 데이터와 새 데이터 합치기
            const combinedData = [...newData, ...chartData].sort((a, b) => a.time - b.time);
            
            // 데이터가 너무 많아지면 오래된 데이터 제거 (최대 1000개 유지)
            if (combinedData.length > 1000) {
                combinedData.splice(0, combinedData.length - 1000);
            }
            
            chartData = combinedData;
            oldestTimestamp = chartData[0].time;
            
            // 차트 업데이트
            if (candleSeries) {
                candleSeries.setData(chartData);
                console.log('Historical data added successfully. Total candles:', chartData.length);
            }
        }
    } catch (error) {
        console.error('Failed to load historical data:', error);
    } finally {
        isLoadingMoreData = false;
        hideChartLoading();
    }
}

// 가격 표시 업데이트 함수
function updateCoinPriceDisplay(currentPrice, priceChange, priceChangePercent) {
    const priceElement = document.getElementById('coin-current-price');
    const changeElement = document.getElementById('coin-price-change');
    const changePercentElement = document.getElementById('coin-price-change-percent');
    
    if (priceElement) {
        // 가격을 적절한 소수점으로 포맷
        const formattedPrice = currentPrice >= 1 ? 
            currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) :
            currentPrice.toFixed(6);
        priceElement.textContent = formattedPrice;
    }
    
    if (changeElement && changePercentElement) {
        const isPositive = priceChange >= 0;
        const changePrefix = isPositive ? '+' : '';
        
        // 변화량 포맷
        const formattedChange = Math.abs(priceChange) >= 1 ? 
            Math.abs(priceChange).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) :
            Math.abs(priceChange).toFixed(6);
        
        changeElement.textContent = `${changePrefix}${formattedChange}`;
        changePercentElement.textContent = `${changePrefix}${Math.abs(priceChangePercent).toFixed(2)}%`;
        
        // 색상 클래스 업데이트
        changeElement.className = `coin-change ${isPositive ? 'positive' : 'negative'}`;
        changeElement.style.color = isPositive ? 'rgb(38, 166, 154)' : 'rgb(239, 68, 68)';
        
        changePercentElement.className = `coin-change-percent ${isPositive ? 'positive' : 'negative'}`;
        changePercentElement.style.color = isPositive ? 'rgb(38, 166, 154)' : 'rgb(239, 68, 68)';
    }
}

function connectWebSocket() {
    if (binanceSocket) {
        binanceSocket.close();
    }

    // Binance ticker WebSocket URL (only ticker for price updates)
    const wsUrl = `wss://stream.binance.com:9443/ws/${currentSymbol.toLowerCase()}@ticker`;
    console.log('Connecting to WebSocket:', wsUrl);
    
    binanceSocket = new WebSocket(wsUrl);

    binanceSocket.onopen = () => {
        console.log('WebSocket connected');
    };

    binanceSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        // 24시간 ticker 데이터 처리
        if (data.e === '24hrTicker') {
            const currentPrice = parseFloat(data.c);
            const priceChange = parseFloat(data.p);
            const priceChangePercent = parseFloat(data.P);
            
            updateCoinPriceDisplay(currentPrice, priceChange, priceChangePercent);
        }
    };

    binanceSocket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    binanceSocket.onclose = () => {
        console.log('WebSocket connection closed');
    };
}

// =========================
// Firebase Auth readiness helper
// =========================

function waitForFirebaseAuth(maxAttempts = 50, intervalMs = 100) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const timer = setInterval(() => {
            if (window.auth && window.db) {
                clearInterval(timer);
                resolve(window.auth);
            } else if (++attempts >= maxAttempts) {
                clearInterval(timer);
                reject(new Error('Firebase auth not initialized in time'));
            }
        }, intervalMs);
    });
}

// 이벤트 리스너 설정
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing...');
    
    // Ensure Firebase auth is ready before proceeding
    try {
        await waitForFirebaseAuth();
        console.log('Firebase auth available in community.js');
        // Expose alias so legacy code using global "auth" works.
        if (!('auth' in window) && window.auth) {
            window.auth = window.auth; // already set, ensure property exists
        }
        // Best-effort global alias (may fail if read-only)
        try {
            if (typeof auth === 'undefined') {
                // eslint-disable-next-line no-global-assign
                auth = window.auth;
            }
        } catch (e) { console.warn('Skipping auth alias (read-only)', e.message); }
        // Best-effort global alias (may fail if read-only)
        try {
            if (typeof db === 'undefined' && window.db) {
                // eslint-disable-next-line no-global-assign
                db = window.db;
            }
        } catch (e) { console.warn('Skipping db alias (read-only)', e.message); }
    } catch (err) {
        console.error('Community page: Firebase auth not ready:', err);
    }
    
    // 모달 기능 초기화
    initModals();
    
    // 테마 토글 기능 초기화
    initThemeToggle();
    
    // 인증 세션 지속성 설정 (페이지 로드 초기에 실행)
    if (window.auth) {
      window.auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
        .then(() => {
          console.log('Firebase auth persistence set to session.');
          // 인증 상태 변경 리스너 연결
          window.auth.onAuthStateChanged((user) => {
              currentUser = user;
              if (user) {
                  console.log('User is signed in:', user.displayName);
                  updateUserInterface(user);
              } else {
                  console.log('User is signed out');
                  updateUserInterface(null);
              }
              updateUserMessageStyles();
          });
        })
        .catch((error) => {
          console.error('Error setting auth persistence', error);
        });
    } else {
        console.warn('window.auth is still undefined; skipping persistence setup.');
    }

    // 차트 초기화 (테마 초기화 후에 실행)
    setTimeout(() => {
        console.log('Starting chart initialization...');
        initChart().then(() => {
            // 차트 초기화 완료 후 현재 테마 적용
            const isDarkMode = document.documentElement.classList.contains('dark-mode');
            console.log('Chart initialized, checking theme. isDarkMode:', isDarkMode);
            if (isDarkMode) {
                console.log('Applying dark theme to chart...');
                updateChartTheme(true);
            }
        });
    }, 1000); // 1초 후에 차트 초기화

    // 페이지 로드 시 즉시 메시지 로딩 시작
    loadMessages();

    // 메시지 전송 이벤트 리스너 설정
    setupChatForm();

    // 시간 간격 선택 이벤트
    document.querySelectorAll('.interval-button').forEach(button => {
        button.addEventListener('click', async (e) => {
            document.querySelectorAll('.interval-button').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            currentInterval = e.target.dataset.interval;
            console.log('Interval changed to:', currentInterval);
            if (isChartInitialized) {
                if (tvWidget && typeof tvWidget.activeChart === 'function') {
                    const newRes = intervalToTVRes(currentInterval);
                    tvWidget.activeChart().setResolution(newRes);
                } else {
                    // Fallback for LightweightCharts
                    await loadChartData();
                }
                connectWebSocket();
            }
        });
    });

    // 코인 검색 모달 이벤트 리스너
    await loadBinanceCoinData();
    setupCoinSearchModal();

    // 초기 가격 정보 설정 (BTCUSDT 기본값)
    initializeDefaultCoinPrice();
});

// 기본 코인(BTCUSDT) 가격 정보 초기화
function initializeDefaultCoinPrice() {
    // coinData에서 BTCUSDT 찾기
    const btcCoin = coinData.find(coin => coin.symbol === 'BTCUSDT');
    if (btcCoin) {
        const priceChange = btcCoin.price * (btcCoin.change / 100);
        updateCoinPriceDisplay(btcCoin.price, priceChange, btcCoin.change);
    }
}

// 모달 기능 초기화
function initModals() {
    console.log('Initializing modals...');
    
    // 로그인 버튼
    const loginButtons = document.querySelectorAll('[data-action="open-login"]');
    console.log('Found login buttons:', loginButtons.length);
    loginButtons.forEach((btn, index) => {
        console.log(`Adding event listener to login button ${index + 1}`);
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Login button clicked!');
            openModal('login-modal');
        });
    });

    // 회원가입 버튼
    const signupButtons = document.querySelectorAll('[data-action="open-signup"]');
    console.log('Found signup buttons:', signupButtons.length);
    signupButtons.forEach((btn, index) => {
        console.log(`Adding event listener to signup button ${index + 1}`);
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Signup button clicked!');
            openModal('signup-modal');
        });
    });

    // 모달 닫기 버튼
    const closeButtons = document.querySelectorAll('[data-action="close-modal"]');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            closeAllModals();
        });
    });

    // 모달 배경 클릭시 닫기
    const modals = document.querySelectorAll('.auth-modal, .modal');
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeAllModals();
            }
        });
    });

    // 로그인 폼 제출
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // 회원가입 폼 제출
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }

    // 로그아웃 버튼
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // 로그인/회원가입 전환
    const showSignupBtn = document.getElementById('show-signup');
    const showLoginBtn = document.getElementById('show-login');
    
    if (showSignupBtn) {
        showSignupBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeAllModals();
            openModal('signup-modal');
        });
    }
    
    if (showLoginBtn) {
        showLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeAllModals();
            openModal('login-modal');
        });
    }
}

// 테마 토글 기능 초기화
function initThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            toggleTheme();
        });
    }

    // 저장된 테마 적용
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark-mode');
        updateThemeIcon(true);
        // 차트가 이미 초기화되어 있다면 테마 적용
        if (chart) {
            updateChartTheme(true);
        }
    }
}

// 모달 열기
function openModal(modalId) {
    console.log('Opening modal:', modalId);
    const modal = document.getElementById(modalId);
    if (modal) {
        console.log('Modal found, adding show class');
        modal.classList.add('show');
        console.log('Modal classes after opening:', modal.className);
    } else {
        console.error('Modal not found:', modalId);
    }
}

// 모든 모달 닫기
function closeAllModals() {
    const modals = document.querySelectorAll('.auth-modal, .modal');
    modals.forEach(modal => {
        modal.classList.remove('show');
    });
    
    // 차트 설정 모달도 닫기
    const chartSettingsModal = document.getElementById('chart-settings-modal');
    if (chartSettingsModal) {
        chartSettingsModal.classList.remove('show');
    }
    
    // 코인 선택 모달도 닫기
    const coinModal = document.getElementById('coin-select-modal');
    if (coinModal) {
        coinModal.classList.remove('show');
    }

    // Restore scrolling
    document.body.style.overflow = '';
}

// 테마 토글
function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
    updateChartTheme(isDark);
}

// 차트 테마 업데이트
function updateChartTheme(isDark) {
    console.log('Updating chart theme, isDark:', isDark);
    if (tvWidget) {
        if (typeof tvWidget.changeTheme === 'function') {
            try { tvWidget.changeTheme(isDark ? 'dark' : 'light'); return; } catch(e){}
        } else if (typeof tvWidget.setTheme === 'function') {
            try { tvWidget.setTheme(isDark ? 'dark' : 'light'); return; } catch(e){}
        }
    }
    if (chart && typeof chart.applyOptions === 'function') {
        console.log('Applying chart theme options...');
        chart.applyOptions({
            layout: {
                backgroundColor: isDark ? '#2d2d2d' : '#ffffff',
                textColor: isDark ? '#e9ecef' : '#333',
            },
            grid: {
                vertLines: {
                    color: isDark ? '#404040' : '#e1e1e1',
                },
                horzLines: {
                    color: isDark ? '#404040' : '#e1e1e1',
                },
            },
            rightPriceScale: {
                borderColor: isDark ? '#404040' : '#cccccc',
            },
            timeScale: {
                borderColor: isDark ? '#404040' : '#cccccc',
            },
        });
    }
}

// 테마 아이콘 업데이트
function updateThemeIcon(isDark) {
    const themeIcon = document.querySelector('#theme-toggle i');
    if (themeIcon) {
        themeIcon.className = isDark ? 'fas fa-moon' : 'fas fa-sun';
    }
}

// 사용자 인터페이스 업데이트
function updateUserInterface(user) {
    const authButtons = document.querySelector('.auth-buttons');
    const userInfo = document.getElementById('user-profile');
    const userDisplayName = document.getElementById('user-display-name');

    if (user) {
        // 로그인 상태
        if (authButtons) authButtons.style.display = 'none';
        if (userInfo) userInfo.style.display = 'flex';
        if (userDisplayName) userDisplayName.textContent = user.displayName || user.email;
    } else {
        // 로그아웃 상태
        if (authButtons) authButtons.style.display = 'flex';
        if (userInfo) userInfo.style.display = 'none';
    }
}

// 로그인 처리
async function handleLogin(e) {
    e.preventDefault();
    const email = e.target.querySelector('[name="login-email"]').value;
    const password = e.target.querySelector('[name="login-password"]').value;
    const errorMessage = document.getElementById('login-error-message');

    try {
        await window.auth.signInWithEmailAndPassword(email, password);
        closeAllModals();
        if (errorMessage) errorMessage.textContent = '';
    } catch (error) {
        console.error('로그인 실패:', error);
        if (errorMessage) {
            errorMessage.textContent = '로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.';
        }
    }
}

// 회원가입 처리
async function handleSignup(e) {
    e.preventDefault();
    const name = e.target.querySelector('[name="signup-name"]').value;
    const email = e.target.querySelector('[name="signup-email"]').value;
    const password = e.target.querySelector('[name="signup-password"]').value;
    const confirmPassword = e.target.querySelector('[name="signup-confirm-password"]').value;
    const errorMessage = document.getElementById('signup-error-message');

    if (password !== confirmPassword) {
        if (errorMessage) errorMessage.textContent = '비밀번호가 일치하지 않습니다.';
        return;
    }

    try {
        const userCredential = await window.auth.createUserWithEmailAndPassword(email, password);
        await userCredential.user.updateProfile({
            displayName: name
        });
        closeAllModals();
        if (errorMessage) errorMessage.textContent = '';
    } catch (error) {
        console.error('회원가입 실패:', error);
        if (errorMessage) {
            errorMessage.textContent = '회원가입에 실패했습니다. 다시 시도해주세요.';
        }
    }
}

// 로그아웃 처리
async function handleLogout() {
    try {
        await window.auth.signOut();
    } catch (error) {
        console.error('로그아웃 실패:', error);
    }
}

function setupCoinSearchModal() {
    const coinSelector = document.getElementById('coin-selector');
    const coinSearchModal = document.getElementById('coin-search-modal');
    const coinSearchClose = document.getElementById('coin-search-close');
    const coinSearchInput = document.getElementById('coin-search-input');
    const coinSearchTabs = document.querySelectorAll('.coin-search-tab');
    
    // 코인 선택 버튼 클릭
    if (coinSelector) {
        coinSelector.addEventListener('click', () => {
            if (coinSearchModal) coinSearchModal.classList.add('show');
            renderCoinList();
            if (coinSearchInput) coinSearchInput.focus();
        });
    }
    
    // 모달 닫기
    if (coinSearchClose) {
        coinSearchClose.addEventListener('click', () => {
            if (coinSearchModal) coinSearchModal.classList.remove('show');
        });
    }
    
    // 모달 배경 클릭시 닫기
    if (coinSearchModal) {
        coinSearchModal.addEventListener('click', (e) => {
            if (e.target === coinSearchModal) {
                coinSearchModal.classList.remove('show');
            }
        });
    }
    
    // ESC 키로 모달 닫기
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && coinSearchModal && coinSearchModal.classList.contains('show')) {
            coinSearchModal.classList.remove('show');
        }
    });
    
    // 검색 입력
    if (coinSearchInput) {
        coinSearchInput.addEventListener('input', (e) => {
            renderCoinList(e.target.value);
        });
    }
    
    // 탭 클릭
    coinSearchTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            coinSearchTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderCoinList(coinSearchInput.value, tab.dataset.tab);
        });
    });
}

function renderCoinList(searchTerm = '', activeTab = 'all') {
    const coinSearchList = document.getElementById('coin-search-list');
    
    let filteredCoins = coinData;
    
    // 탭 필터링
    if (activeTab !== 'all') {
        filteredCoins = filteredCoins.filter(coin => 
            coin.type.toLowerCase() === activeTab.toLowerCase()
        );
    }
    
    // 검색어 필터링
    if (searchTerm) {
        filteredCoins = filteredCoins.filter(coin =>
            coin.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
            coin.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }
    
    coinSearchList.innerHTML = '';
    
    filteredCoins.forEach(coin => {
        const coinItem = document.createElement('div');
        coinItem.className = 'coin-search-item';
        coinItem.innerHTML = `
            <div class="coin-search-item-icon">
                <img src="${coin.logo}" alt="${coin.symbol} logo" width="20" height="20"/>
            </div>
            <div class="coin-search-item-info">
                <div class="coin-search-item-symbol">${coin.symbol}</div>
                <div class="coin-search-item-name">${coin.type} • ${coin.platform}</div>
            </div>
            <div class="coin-search-item-price">
                <div class="coin-search-item-price-value">${coin.price.toLocaleString()}</div>
                <div class="coin-search-item-price-change ${coin.change >= 0 ? 'positive' : 'negative'}">
                    ${coin.change >= 0 ? '+' : ''}${coin.change.toFixed(2)}%
                </div>
            </div>
        `;
        
        coinItem.addEventListener('click', () => {
            selectCoin(coin);
        });
        
        coinSearchList.appendChild(coinItem);
    });
}

function selectCoin(coin) {
    currentSymbol = coin.symbol;
    
    // 차트 데이터 초기화
    chartData = [];
    oldestTimestamp = null;
    newestTimestamp = null;
    isLoadingMoreData = false;
    
    // UI 업데이트
    const selectedCoinText = document.getElementById('selected-coin-text');
    const coinIcon = document.querySelector('.coin-selector .coin-icon');
    
    selectedCoinText.textContent = coin.symbol;
    coinIcon.textContent = coin.symbol;
    coinIcon.style.backgroundColor = coin.color;
    
    // 가격 정보 업데이트 (coinData에서 가져온 초기값 사용)
    const priceChange = coin.price * (coin.change / 100);
    updateCoinPriceDisplay(coin.price, priceChange, coin.change);
    
    // 모달 닫기
    document.getElementById('coin-search-modal').classList.remove('show');
    
    // 차트 업데이트 (차트가 초기화되어 있다면)
    if (isChartInitialized) {
        if (tvWidget && typeof tvWidget.activeChart === 'function') {
            tvWidget.activeChart().setSymbol(currentSymbol, intervalToTVRes(currentInterval));
        } else if (chart && candleSeries) {
            loadChartData();
        }
        connectWebSocket();
    }
    
    console.log(`선택된 코인: ${coin.symbol}`);
}

// 채팅 폼 설정
function setupChatForm() {
    if (messageForm && !isChatFormInitialized) {
        messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!messageInput.value.trim()) return;

            try {
                // 게스트 번호 처리 - 한 번만 생성하고 저장
                let guestNumber = localStorage.getItem('guestNumber');
                if (!guestNumber) {
                    guestNumber = Math.floor(Math.random() * 10000).toString();
                    localStorage.setItem('guestNumber', guestNumber);
                }

                const messageData = {
                    text: messageInput.value.trim(),
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    uid: window.currentUser ? window.currentUser.uid : 'guest-' + guestNumber,
                    displayName: window.currentUser ? (window.currentUser.displayName || window.currentUser.email) : '게스트' + guestNumber,
                    photoURL: window.currentUser ? window.currentUser.photoURL : null
                };

                if (window.db) await window.db.collection('community-chat').add(messageData);
                messageInput.value = '';
            } catch (error) {
                console.error('메시지 전송 실패:', error);
                alert('메시지 전송에 실패했습니다.');
            }
        });
        isChatFormInitialized = true;
    }
}

function createBinanceDatafeed() {
    const cfg = {
        supported_resolutions: TV_SUPPORTED_RESOLUTIONS,
        exchanges: [{ value: 'BINANCE', name: 'Binance', desc: 'Binance' }],
    };
    const intervalMap = { '1': '1m', '5': '5m', '15': '15m', '60': '1h', '240': '4h', 'D': '1d' };

    return {
        onReady: (cb) => setTimeout(() => cb(cfg), 0),
        searchSymbols: (userInput, exchange, symbolType, onResult) => {
            const term = userInput.toLowerCase();
            const results = coinData
                .filter(c => c.symbol.toLowerCase().includes(term) || c.name.toLowerCase().includes(term))
                .slice(0, 50)
                .map(c => ({
                    symbol: c.symbol,
                    full_name: c.symbol,
                    description: c.name,
                    exchange: 'BINANCE',
                    ticker: c.symbol,
                    type: 'crypto',
                }));
            onResult(results);
        },
        resolveSymbol: (symbolName, onResolve, onError) => {
            const base = stripPrefix(symbolName.toUpperCase());
            const symbol = base;
            const priceScale = symbol.endsWith('USDT') ? 100 : 100000000; // rough guess
            setTimeout(() => {
                onResolve({
                    name: symbol,
                    full_name: symbol,
                    ticker: symbol,
                    description: symbol,
                    type: 'crypto',
                    session: '24x7',
                    exchange: 'BINANCE',
                    listed_exchange: 'BINANCE',
                    timezone: 'Etc/UTC',
                    minmov: 1,
                    pricescale: priceScale,
                    has_intraday: true,
                    has_daily: true,
                    has_weekly_and_monthly: true,
                    supported_resolutions: cfg.supported_resolutions,
                    volume_precision: 8,
                    data_status: 'streaming',
                });
            }, 0);
        },
        getBars: async (symbolInfo, resolution, periodParams, onResult, onError) => {
            try {
                const interval = intervalMap[resolution] || '1m';
                const symbol = stripPrefix(symbolInfo.name);
                const params = new URLSearchParams({
                    symbol,
                    interval,
                    limit: '1000',
                });
                // For back pagination, use periodParams.to as endTime (TradingView sends seconds)
                if (!periodParams.firstDataRequest) {
                    params.append('endTime', String(periodParams.to * 1000));
                }
                const url = `https://api.binance.com/api/v3/klines?${params.toString()}`;
                const resp = await fetch(url);
                const data = await resp.json();
                const bars = data.map(c => ({
                    time: c[0],
                    open: parseFloat(c[1]),
                    high: parseFloat(c[2]),
                    low: parseFloat(c[3]),
                    close: parseFloat(c[4]),
                    volume: parseFloat(c[5]),
                }));
                const meta = { noData: bars.length === 0 };
                onResult(bars, meta);
            } catch(err) {
                console.error('getBars error', err);
                onError(err);
            }
        },
        subscribeBars: (symbolInfo, resolution, updateCb, uid) => {
            const interval = intervalMap[resolution] || '1m';
            const symbol = stripPrefix(symbolInfo.name).toLowerCase();
            const wsUrl = `wss://stream.binance.com:9443/ws/${symbol}@kline_${interval}`;
            const socket = new WebSocket(wsUrl);
            socket.onmessage = (e) => {
                const data = JSON.parse(e.data);
                if (data.e !== 'kline') return;
                const k = data.k;
                const bar = {
                    time: k.t,
                    open: parseFloat(k.o),
                    high: parseFloat(k.h),
                    low: parseFloat(k.l),
                    close: parseFloat(k.c),
                    volume: parseFloat(k.v)
                };
                updateCb(bar);
            };
            binanceStreams[uid] = socket;
        },
        unsubscribeBars: (uid) => {
            if (binanceStreams[uid]) {
                try { binanceStreams[uid].close(); } catch(e){}
                delete binanceStreams[uid];
            }
        },
    };
}

console.log('Community.js loaded successfully'); 