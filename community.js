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

// Firestore와 연동되는 TradingView Save/Load 어댑터
function createFirebaseSaveLoadAdapter(userId) {
    if (!window.db) {
        console.error("Firestore is not initialized (window.db is null).");
        // Firestore가 준비되지 않았을 때 기능을 비활성화하는 mock adapter 반환
        return {
            getAllCharts: () => Promise.resolve([]),
            removeChart: () => Promise.resolve(),
            saveChart: () => Promise.reject("Firestore not available"),
            getChart: () => Promise.reject("Firestore not available")
        };
    }
    
    console.log(`Creating Firebase Save/Load adapter for user: ${userId}`);
    const firestoreRef = window.db.collection('userChartLayouts').doc(userId);

    return {
        // 모든 차트 레이아웃 가져오기 (현재는 단일 레이아웃만 지원)
        getAllCharts: function() {
            console.log(`Getting all charts for user: ${userId}`);
            return firestoreRef.get().then(doc => {
                if (doc.exists && doc.data().name) {
                    console.log(`Found saved chart layout: ${doc.data().name}`);
                    return Promise.resolve([{
                        id: doc.id,
                        name: doc.data().name,
                        timestamp: doc.data().timestamp,
                        content: doc.data().content,
                    }]);
                }
                console.log(`No saved chart layout found for user: ${userId}`);
                return Promise.resolve([]);
            }).catch(error => {
                console.error("Error getting all charts:", error);
                return Promise.resolve([]);
            });
        },

        // 차트 레이아웃 제거
        removeChart: function(chartId) {
            console.log(`Removing chart layout for user: ${userId}`);
            return firestoreRef.delete().then(() => {
                console.log(`Chart layout for user ${userId} removed.`);
            }).catch(error => {
                console.error("Error removing chart:", error);
            });
        },

        // 차트 레이아웃 저장
        saveChart: function(chartData) {
            console.log(`Saving chart layout for user: ${userId}`, chartData);
            const chartToSave = {
                name: chartData.name || `Chart ${new Date().toLocaleDateString()}`,
                content: chartData.content,
                timestamp: Math.floor(Date.now() / 1000),
                symbol: chartData.symbol,
                resolution: chartData.resolution,
                lastModified: new Date().toISOString(),
            };
            return firestoreRef.set(chartToSave).then(() => {
                console.log(`Chart layout for user ${userId} saved successfully.`);
                return Promise.resolve(firestoreRef.id);
            }).catch(error => {
                console.error("Error saving chart:", error);
                return Promise.reject(error);
            });
        },

        // 특정 차트 레이아웃 가져오기
        getChart: function(chartId) {
            console.log(`Getting chart layout for user: ${userId}`);
            return firestoreRef.get().then(doc => {
                if (doc.exists && doc.data().content) {
                    console.log(`Successfully loaded chart layout for user: ${userId}`);
                    return Promise.resolve(doc.data().content);
                }
                console.log(`No chart content found for user: ${userId}`);
                return Promise.reject("Chart not found");
            }).catch(error => {
                console.error("Error getting chart:", error);
                return Promise.reject(error);
            });
        }
    };
}

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
        if (isChartInitialized && tvWidget) {
            console.log('Removing existing TradingView widget before re-initialization.');
            tvWidget.remove();
            tvWidget = null;
            isChartInitialized = false;
        }
        if (!chartContainer) {
            console.error('Chart container not found for TradingView');
            return;
        }
        const isDarkMode = document.documentElement.classList.contains('dark-mode');
        const tvTheme = isDarkMode ? 'dark' : 'light';
        const tvResolution = intervalToTVRes(currentInterval);

        let widgetOptions = {
            container: chartContainer,
            symbol: currentSymbol,
            interval: tvResolution,
            library_path: 'charting_library-master/charting_library/',
            datafeed: createBinanceDatafeed(),
            locale: 'ko',
            theme: tvTheme,
            fullscreen: false,
            autosize: true,
            
            // 기능 활성화/비활성화
            disabled_features: [
                "use_localstorage_for_settings",
                "header_symbol_search", // 심볼 검색은 커스텀 UI 사용
                "header_resolutions",   // 해상도 변경은 커스텀 UI 사용
                "timeframes_toolbar",
                "show_chart_property_page",
                "header_compare"
            ],
            enabled_features: [
                "study_templates", // 지표 템플릿
                "header_indicators", // 지표 추가 버튼 활성화
                "header_chart_type", // 차트 타입 변경
                "header_screenshot", // 스크린샷
                "header_settings", // 설정
                "header_undo_redo",
                "header_drawings_toolbar"
            ],
            
            // 사용자별 차트 저장/불러오기 설정
            client_id: 'onbit.co.kr',
            user_id: 'public_user_id', // 기본값
            charts_storage_url: 'https://onbit.co.kr',
            charts_storage_api_version: '1.1'
        };

        // 로그인 상태일 때만 Save/Load 어댑터 적용
        if (window.currentUser && window.currentUser.uid) {
            console.log(`Initializing chart for logged-in user: ${window.currentUser.uid}`);
            widgetOptions.user_id = window.currentUser.uid;
            widgetOptions.save_load_adapter = createFirebaseSaveLoadAdapter(window.currentUser.uid);
            widgetOptions.load_last_chart = true; // 마지막으로 작업한 차트 불러오기
            widgetOptions.auto_save_chart = true; // 자동 저장 활성화
            widgetOptions.auto_save_delay = 5; // 5초 후 자동 저장
        } else {
             console.log("Initializing chart for guest user.");
        }

        try {
            // ensure coin list ready for searchSymbols
            if (coinData.length === 0) await loadBinanceCoinData();
            
            tvWidget = new TradingView.widget(widgetOptions);
            
            tvWidget.onChartReady(() => {
                console.log('TradingView Chart is ready');
                isChartInitialized = true;
                hideChartLoading();
                
                // 차트가 준비되면 웹소켓 연결
                connectWebSocket();
                
                // 차트 준비 후 자동 저장 설정 확인 및 추가 설정
                if (window.currentUser && window.currentUser.uid) {
                    console.log('Chart ready for logged-in user, auto-save enabled');
                    
                    // 차트에 자동 저장 이벤트 리스너 추가
                    if (tvWidget.chart) {
                        tvWidget.chart().onAutoSaveNeeded = () => {
                            console.log('Auto save needed - TradingView will handle this automatically');
                        };
                    }
                }
            });

        } catch (error) {
            console.error('Failed to initialize TradingView widget:', error);
            hideChartLoading();
        }
    } else {
        console.error('TradingView library not loaded');
        // 이전 LightweightCharts 코드는 모두 제거되었으므로 여기서 종료
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
    console.log('Community page loaded');
    
    // 모달 초기화
    initModals();
    
    // 테마 토글 초기화
    initThemeToggle();
    
    // Firebase 인증 대기 및 설정
    await waitForFirebaseAuth()
        .then(() => {
            console.log('Firebase auth is ready');
            
            // 인증 상태 변경 리스너 설정
            window.auth.onAuthStateChanged(async (user) => {
                console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
                isLoggedIn = !!user;
                window.currentUser = user;
                
                if (user) {
                    console.log('User is signed in:', user.uid);
                    updateUserInterface(user);
                    
                    // 로그인 시 차트 재초기화 (사용자별 레이아웃 불러오기)
                    if (isChartInitialized) {
                        await reinitializeChartForUser();
                    }
                } else {
                    console.log('User is signed out');
                    updateUserInterface(null);
                    
                    // 로그아웃 시 차트 재초기화 (게스트 모드)
                    if (isChartInitialized) {
                        await reinitializeChartForUser();
                    }
                }
                updateUserMessageStyles();
            });
        })
        .catch((error) => {
          console.error('Error setting auth persistence', error);
        });

    // 차트 초기화 (테마 초기화 후에 실행)
    setTimeout(() => {
        console.log('Starting initial chart initialization...');
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
    const formData = new FormData(e.target);
    const email = formData.get('login-email');
    const password = formData.get('login-password');
    
    try {
        const userCredential = await window.auth.signInWithEmailAndPassword(email, password);
        console.log('Login successful:', userCredential.user.uid);
        closeAllModals();
        
        // 로그인 성공 후 차트 재초기화 (사용자별 레이아웃 불러오기)
        await reinitializeChartForUser();
        
    } catch (error) {
        console.error('Login error:', error);
        const errorMessage = document.getElementById('login-error-message');
        if (errorMessage) {
            errorMessage.textContent = error.message;
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
        // 로그아웃 전에 현재 차트 상태 저장
        if (tvWidget && window.currentUser) {
            console.log('Saving chart state before logout...');
            // TradingView는 자동으로 저장하므로 별도 작업 불필요
        }
        
        await window.auth.signOut();
        console.log('Logout successful');
        
        // 로그아웃 후 차트 재초기화 (게스트 모드)
        await reinitializeChartForUser();
        
    } catch (error) {
        console.error('Logout error:', error);
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

async function selectCoin(coin) {
    if (!coin || !coin.symbol) {
        console.error("Invalid coin selected:", coin);
        return;
    }
    currentSymbol = coin.symbol.includes(':') ? coin.symbol : `BINANCE:${coin.symbol}`;
    console.log(`Symbol changed to: ${currentSymbol}`);

    // UI 업데이트
    const selectedCoinText = document.getElementById('selected-coin-text');
    if (selectedCoinText) {
        selectedCoinText.textContent = coin.symbol.replace('BINANCE:', '');
    }
    
    // 모달 닫기
    closeAllModals();

    // 웹소켓 재연결
    if (binanceSocket) {
        binanceSocket.close();
    }
    
    if (isChartInitialized && tvWidget) {
        // TradingView 위젯의 심볼 변경
        tvWidget.chart().setSymbol(currentSymbol, () => {
             console.log(`TradingView symbol successfully changed to ${currentSymbol}`);
        });
    } else {
        // 차트가 초기화되지 않은 경우, 차트를 새로고침
        showChartLoading();
        await initChart();
    }
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
    const binanceApiBase = 'https://api.binance.com/api/v3';

    const datafeed = {
        onReady: (callback) => {
            console.log('[Datafeed] onReady called');
            setTimeout(() => callback({
                supported_resolutions: TV_SUPPORTED_RESOLUTIONS,
                supports_group_request: false,
                supports_marks: false,
                supports_search: true,
                supports_timescale_marks: false,
            }), 0);
        },

        searchSymbols: (userInput, exchange, symbolType, onResultReadyCallback) => {
            console.log('[Datafeed] searchSymbols called');
            const symbols = coinData
                .filter(c => c.type === 'SPOT' || c.type === 'FUTURES')
                .filter(c => c.symbol.toLowerCase().includes(userInput.toLowerCase()) || c.name.toLowerCase().includes(userInput.toLowerCase()))
                .map(c => ({
                    symbol: c.symbol,
                    full_name: `Binance:${c.symbol}`,
                    description: `${c.name}/USDT`,
                    exchange: 'Binance',
                    ticker: `BINANCE:${c.symbol}`,
                    type: 'spot'
                }));
            onResultReadyCallback(symbols.slice(0, 50)); // 최대 50개 결과
        },

        resolveSymbol: (symbolName, onSymbolResolvedCallback, onResolveErrorCallback) => {
            console.log('[Datafeed] resolveSymbol called for:', symbolName);
            const symbol = stripPrefix(symbolName);
            const symbolInfo = {
                name: symbol,
                ticker: `BINANCE:${symbol}`,
                description: `${symbol.replace('USDT', '')}/USDT`,
                session: '24x7',
                timezone: 'Etc/UTC',
                minmov: 1,
                pricescale: 100, // 대부분의 USDT 페어는 소수점 2자리
                has_intraday: true,
                has_no_volume: false,
                supported_resolutions: TV_SUPPORTED_RESOLUTIONS,
                volume_precision: 8,
                data_status: 'streaming',
            };
            
            if (/\.P$/.test(symbol)) { // 선물 계약
                 symbolInfo.pricescale = 1000;
            } else { // 현물
                 // BTC, ETH 등 가격이 높은 코인들은 소수점 2자리, 낮은 코인들은 더 많이
                const coin = coinData.find(c => c.symbol === symbol);
                if (coin && coin.price < 1) {
                    symbolInfo.pricescale = 1000000;
                } else if (coin && coin.price < 50) {
                     symbolInfo.pricescale = 10000;
                }
            }


            setTimeout(() => onSymbolResolvedCallback(symbolInfo), 0);
        },

        getBars: async (symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) => {
            const { from, to, firstDataRequest } = periodParams;
            console.log(`[Datafeed] getBars for ${symbolInfo.name}, Resolution: ${resolution}, From: ${from}, To: ${to}`);
            
            const interval = Object.keys(TV_RESOLUTION_MAP).find(key => TV_RESOLUTION_MAP[key] === resolution);
            if (!interval) {
                onErrorCallback('Invalid resolution');
                return;
            }
            
            const symbol = stripPrefix(symbolInfo.name);
            const limit = 1000; // 바이낸스 API 최대 요청 개수
            const url = `${binanceApiBase}/klines?symbol=${symbol}&interval=${interval}&startTime=${from * 1000}&endTime=${to * 1000}&limit=${limit}`;

            try {
                const response = await fetch(url);
                const data = await response.json();

                if (data.length > 0) {
                    const bars = data.map(el => ({
                        time: el[0], // KST가 아닌 UTC 타임스탬프 (ms)
                        open: parseFloat(el[1]),
                        high: parseFloat(el[2]),
                        low: parseFloat(el[3]),
                        close: parseFloat(el[4]),
                        volume: parseFloat(el[5]),
                    }));
                    onHistoryCallback(bars, { noData: false });
                } else {
                    onHistoryCallback([], { noData: true });
                }
            } catch (error) {
                console.error('[Datafeed] getBars error:', error);
                onErrorCallback(error);
            }
        },
        
        subscribeBars: (symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) => {
             console.log(`[Datafeed] subscribeBars: ${symbolInfo.name} ${resolution}`);
            // WebSocket 연결은 connectWebSocket()에서 중앙 관리하므로 여기서는 아무것도 하지 않음
            // 대신, onRealtimeCallback을 전역으로 저장하여 웹소켓 핸들러에서 사용
            window.tvRealtimeCallback = onRealtimeCallback;
        },

        unsubscribeBars: (subscriberUID) => {
            console.log(`[Datafeed] unsubscribeBars: ${subscriberUID}`);
            window.tvRealtimeCallback = null;
            // 웹소켓 연결 해제는 페이지 전환 또는 심볼 변경 시 중앙 관리
        },
    };

    return datafeed;
}

// Firebase 인증 상태 변경 시 차트 재초기화 함수
async function reinitializeChartForUser() {
    console.log('Reinitializing chart for user state change...');
    
    // 기존 위젯 제거
    if (tvWidget) {
        tvWidget.remove();
        tvWidget = null;
    }
    isChartInitialized = false;
    
    // 잠시 대기 후 새로 초기화
    setTimeout(async () => {
        await initChart();
    }, 500);
}

console.log('Community.js loaded successfully'); 