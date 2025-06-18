// 전역 변수 선언
let chart = null;
let candleSeries = null;
let chartSeries = null; // 좌표 변환용 시리즈 참조
let currentUser = null;
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

const MESSAGES_PER_PAGE = 25;
let isChatFormInitialized = false; // 채팅 폼 초기화 플래그

// 코인 데이터 (실제로는 API에서 가져와야 함)
const coinData = [
    { symbol: 'BTCUSDT', name: 'Bitcoin', type: 'PERPETUAL', platform: 'Binance', price: 107475.70, change: 1.69, icon: '₿', color: '#f7931a' },
    { symbol: 'BTC_USDT', name: 'Bitcoin', type: 'PERPETUAL', platform: 'Gate', price: 107466.90, change: 1.84, icon: '₿', color: '#f7931a' },
    { symbol: 'ETHUSDT', name: 'Ethereum', type: 'PERPETUAL', platform: 'Binance', price: 2641.01, change: 3.57, icon: 'Ξ', color: '#627eea' },
    { symbol: 'ETH_USDT', name: 'Ethereum', type: 'PERPETUAL', platform: 'Gate', price: 2640.65, change: 3.95, icon: 'Ξ', color: '#627eea' },
    { symbol: 'BNBUSDT', name: 'BNB', type: 'SPOT', platform: 'Binance', price: 707.20, change: 2.15, icon: 'B', color: '#f3ba2f' },
    { symbol: 'XRPUSDT', name: 'XRP', type: 'SPOT', platform: 'Binance', price: 2.45, change: -1.23, icon: 'X', color: '#23292f' },
    { symbol: 'DOGEUSDT', name: 'Dogecoin', type: 'FUTURES', platform: 'Binance', price: 0.3821, change: 4.67, icon: 'D', color: '#c2a633' },
    { symbol: 'ADAUSDT', name: 'Cardano', type: 'SPOT', platform: 'Binance', price: 1.0234, change: -0.45, icon: 'A', color: '#0033ad' },
    { symbol: 'SOLUSDT', name: 'Solana', type: 'PERPETUAL', platform: 'Binance', price: 245.67, change: 5.23, icon: 'S', color: '#9945ff' },
    { symbol: 'MATICUSDT', name: 'Polygon', type: 'SPOT', platform: 'Binance', price: 0.4567, change: -2.34, icon: 'M', color: '#8247e5' }
];

// Firebase 초기화 코드
const firebaseConfig = {
    apiKey: "AIzaSyCbvgcol3P4wTUNh88-d9HPZl-2NC9WbqI",
    authDomain: "livechattest-35101.firebaseapp.com",
    projectId: "livechattest-35101",
    storageBucket: "livechattest-35101.firebasestorage.app",
    messagingSenderId: "880700591040",
    appId: "1:880700591040:web:a93e47bf19a9713a245625",
    measurementId: "G-ER1H2CCZW9",
    databaseURL: "https://livechattest-35101-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

// Firebase 초기화
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements
const messageForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('chat-messages');
const chartContainer = document.getElementById('chart-container');

// 채팅 관련 함수들
function renderMessage(msg) {
    if (!messagesContainer) return;

    const profileImg = msg.data.photoThumbURL || msg.data.photoURL || 'assets/@default-profile.png';

    const messageElement = document.createElement('div');
    messageElement.classList.add('message-item');
    messageElement.id = msg.id;
    messageElement.dataset.uid = msg.data.uid;

    let isMyMessage = false;
    if (currentUser && msg.data.uid === currentUser.uid) {
        isMyMessage = true;
    } else if (!currentUser) {
        const guestNumber = localStorage.getItem('guestNumber');
        if (guestNumber && msg.data.uid === 'guest-' + guestNumber) {
            isMyMessage = true;
        }
    }
    if (isMyMessage) {
        messageElement.classList.add('my-message');
    }

    messageElement.innerHTML = `
        <div class="chat-profile-pic-wrap">
            <img class="chat-profile-pic" src="${profileImg}" alt="프로필" loading="lazy" />
        </div>
        <div class="message-content">
            <div class="message-sender">
                <strong>${msg.data.displayName}</strong>
            </div>
            <div class="message-text">${msg.data.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        </div>
    `;

    messagesContainer.appendChild(messageElement);
}

async function loadMessages() {
    try {
        console.log('Loading messages...');
        // 마지막 24시간의 메시지만 로드
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const messagesQuery = db.collection('community-chat')
            .where('timestamp', '>=', twentyFourHoursAgo)
            .orderBy('timestamp', 'asc'); // 클라이언트에서 뒤집을 필요 없도록 오름차순으로 가져옴
        
        const snapshot = await messagesQuery.get();
        const messages = [];
        snapshot.forEach((doc) => {
            messages.push({ id: doc.id, data: doc.data() });
        });
        // messages.reverse(); // 이미 오름차순이므로 reverse 필요 없음
        
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
            messages.forEach(msg => renderMessage(msg));
            setTimeout(() => {
                if (window.innerWidth > 768) {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                } else {
                    // 모바일에서는 최신 메시지가 위로 가도록 스크롤을 맨 위로 설정
                    // CSS에서 flex-direction: column-reverse; 를 사용한다고 가정
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
    const messagesQuery = db.collection('community-chat')
        .where('timestamp', '>', new Date());
    
    messagesUnsubscribe = messagesQuery.onSnapshot((snapshot) => {
        if (!messagesContainer) return;

        const isScrolledToBottom = messagesContainer.scrollHeight - messagesContainer.clientHeight <= messagesContainer.scrollTop + 20;

        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const msg = { id: change.doc.id, data: change.doc.data() };
                // CSS 선택자 안전성을 위해 getElementById 사용
                if (!document.getElementById(msg.id)) {
                    renderMessage(msg);
                }
            }
        });
        
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
    messages.forEach(msgElement => {
        const msgUid = msgElement.dataset.uid;
        if (currentUser && msgUid === currentUser.uid) {
            msgElement.classList.add('my-message');
        } else {
            msgElement.classList.remove('my-message');
        }
    });
}

// 차트 관련 함수들
async function initChart() {
    console.log('Starting chart initialization...');
    
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
            },
            timeScale: {
                borderColor: isDarkMode ? '#404040' : '#cccccc',
                timeVisible: true,
                secondsVisible: false,
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
        candleSeries = chart.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });
        
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
        
        // 차트 이동/줌 이벤트 리스너 추가 (그린 것들이 차트와 함께 움직이도록)
        chart.timeScale().subscribeVisibleTimeRangeChange(() => {
            // 차트가 이동하거나 줌될 때 Canvas를 다시 그리기
            setTimeout(() => redrawCanvas(), 10);
        });
        
        // 차트 드로잉 이벤트 리스너 추가
        setupChartDrawing();
    } catch (error) {
        console.error('Failed to initialize chart:', error);
        isChartInitialized = false;
    }
}

async function loadChartData() {
    try {
        console.log('Loading chart data...');
        const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${currentSymbol}&interval=${currentInterval}&limit=100`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Raw chart data received:', data.length, 'candles');

        const formattedData = data.map(candle => {
            // Binance API는 UTC 시간을 제공하므로, 한국시간으로 변환하여 저장
            const utcTime = candle[0] / 1000;
            const kstTime = utcTime + (9 * 60 * 60); // 한국시간으로 변환
            
            return {
                time: kstTime,
                open: parseFloat(candle[1]),
                high: parseFloat(candle[2]),
                low: parseFloat(candle[3]),
                close: parseFloat(candle[4])
            };
        });

        console.log('Formatted chart data:', formattedData.length, 'candles');

        if (candleSeries && formattedData.length > 0) {
            candleSeries.setData(formattedData);
            chart.timeScale().fitContent();
            console.log('Chart data set successfully');
        }
    } catch (error) {
        console.error('Failed to load chart data:', error);
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
        const formattedChange = priceChange >= 1 ? 
            priceChange.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) :
            priceChange.toFixed(6);
        
        changeElement.textContent = `${changePrefix}${formattedChange}`;
        changePercentElement.textContent = `${changePrefix}${priceChangePercent.toFixed(2)}%`;
        
        // 색상 클래스 업데이트
        changeElement.className = `coin-change ${isPositive ? 'positive' : 'negative'}`;
        changePercentElement.className = `coin-change-percent ${isPositive ? 'positive' : 'negative'}`;
    }
}

function connectWebSocket() {
    if (binanceSocket) {
        binanceSocket.close();
    }

    const wsUrl = `wss://stream.binance.com:9443/ws/${currentSymbol.toLowerCase()}@kline_${currentInterval}`;
    console.log('Connecting to WebSocket:', wsUrl);
    
    binanceSocket = new WebSocket(wsUrl);

    binanceSocket.onopen = () => {
        console.log('WebSocket connected');
    };

    binanceSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.k && candleSeries) {
            // 실시간 가격 정보 업데이트
            const currentPrice = parseFloat(data.k.c);
            const openPrice = parseFloat(data.k.o);
            const priceChange = currentPrice - openPrice;
            const priceChangePercent = (priceChange / openPrice) * 100;
            
            updateCoinPriceDisplay(currentPrice, priceChange, priceChangePercent);
            
            if (data.k.x) { // 캔들이 완성된 경우
                // WebSocket 데이터도 한국시간으로 변환하여 저장
                const utcTime = data.k.t / 1000;
                const kstTime = utcTime + (9 * 60 * 60); // 한국시간으로 변환
                
                const candle = {
                    time: kstTime,
                    open: parseFloat(data.k.o),
                    high: parseFloat(data.k.h),
                    low: parseFloat(data.k.l),
                    close: parseFloat(data.k.c)
                };
                candleSeries.update(candle);
            } else {
                // 현재 진행 중인 캔들 업데이트
                const utcTime = data.k.t / 1000;
                const kstTime = utcTime + (9 * 60 * 60);
                
                const candle = {
                    time: kstTime,
                    open: parseFloat(data.k.o),
                    high: parseFloat(data.k.h),
                    low: parseFloat(data.k.l),
                    close: parseFloat(data.k.c)
                };
                candleSeries.update(candle);
            }
        }
    };

    binanceSocket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    binanceSocket.onclose = () => {
        console.log('WebSocket closed');
        setTimeout(() => connectWebSocket(), 5000);
    };
}

// 이벤트 리스너 설정
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing...');
    
    // 모달 기능 초기화
    initModals();
    
    // 테마 토글 기능 초기화
    initThemeToggle();
    
    // 인증 상태 변경 리스너
    auth.onAuthStateChanged((user) => {
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
                await loadChartData();
                connectWebSocket();
            }
        });
    });

    // 코인 검색 모달 이벤트 리스너
    setupCoinSearchModal();

    // 차트 도구 기능 초기화
    initChartTools();
    
    // 차트 설정 모달 기능 초기화
    initChartSettingsModal();
    
    // 초기 가격 정보 설정 (BTCUSDT 기본값)
    initializeDefaultCoinPrice();

    // 키보드 단축키 설정
    setupKeyboardShortcuts();
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
    const modals = document.querySelectorAll('.auth-modal');
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
    if (chart) {
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
        await auth.signInWithEmailAndPassword(email, password);
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
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
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
        await auth.signOut();
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
    coinSelector.addEventListener('click', () => {
        coinSearchModal.classList.add('show');
        renderCoinList();
        coinSearchInput.focus();
    });
    
    // 모달 닫기
    coinSearchClose.addEventListener('click', () => {
        coinSearchModal.classList.remove('show');
    });
    
    // 모달 배경 클릭시 닫기
    coinSearchModal.addEventListener('click', (e) => {
        if (e.target === coinSearchModal) {
            coinSearchModal.classList.remove('show');
        }
    });
    
    // ESC 키로 모달 닫기
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && coinSearchModal.classList.contains('show')) {
            coinSearchModal.classList.remove('show');
        }
    });
    
    // 검색 입력
    coinSearchInput.addEventListener('input', (e) => {
        renderCoinList(e.target.value);
    });
    
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
            <div class="coin-search-item-icon" style="background-color: ${coin.color}">
                ${coin.icon}
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
    
    // UI 업데이트
    const selectedCoinText = document.getElementById('selected-coin-text');
    const coinIcon = document.querySelector('.coin-selector .coin-icon');
    
    selectedCoinText.textContent = coin.symbol;
    coinIcon.textContent = coin.icon;
    coinIcon.style.backgroundColor = coin.color;
    
    // 가격 정보 업데이트 (coinData에서 가져온 초기값 사용)
    const priceChange = coin.price * (coin.change / 100);
    updateCoinPriceDisplay(coin.price, priceChange, coin.change);
    
    // 모달 닫기
    document.getElementById('coin-search-modal').classList.remove('show');
    
    // 차트 업데이트 (차트가 초기화되어 있다면)
    if (isChartInitialized && chart && candleSeries) {
        loadChartData();
        connectWebSocket();
    }
    
    console.log(`선택된 코인: ${coin.symbol}`);
}

// 차트 도구 기능 초기화
function initChartTools() {
    const toolButtons = document.querySelectorAll('.chart-tool-button');
    
    toolButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            
            // 모든 버튼에서 active 클래스 제거
            toolButtons.forEach(btn => btn.classList.remove('active'));
            
            // 클릭된 버튼에 active 클래스 추가
            button.classList.add('active');
            
            // 현재 도구 설정
            const toolId = button.id.replace('-tool', '');
            currentTool = toolId;
            
            console.log('Selected tool:', currentTool);
            
            // 도구별 기능 실행
            handleToolSelection(toolId);
        });
    });
    
    // 차트 드로잉 설정
    setupChartDrawing();
}

// 도구 선택 처리
function handleToolSelection(toolId) {
    switch(toolId) {
        case 'cursor':
            setCursorMode();
            break;
        case 'crosshair':
            setCrosshairMode();
            break;
        case 'trendline':
            setDrawingMode('trendline');
            break;
        case 'horizontal':
        case 'horizontal-line':
            setDrawingMode('horizontal');
            break;
        case 'vertical':
        case 'vertical-line':
            setDrawingMode('vertical');
            break;
        case 'rectangle':
            setDrawingMode('rectangle');
            break;
        case 'fibonacci':
            setDrawingMode('fibonacci');
            break;
        case 'text':
            setDrawingMode('text');
            break;
        case 'arrow':
            setDrawingMode('arrow');
            break;
        case 'brush':
            setDrawingMode('brush');
            break;
        case 'eraser':
            clearAllDrawings();
            break;
        case 'settings':
            openChartSettings();
            break;
        case 'snapshot':
            takeChartSnapshot();
            break;
        default:
            console.log('Unknown tool:', toolId);
    }
}

// 커서 모드 설정
function setCursorMode() {
    if (chart) {
        // 기본 커서 모드로 설정
        console.log('Cursor mode activated');
        const chartContainer = document.getElementById('chart-container');
        if (chartContainer) {
            chartContainer.style.cursor = 'default';
        }
    }
}

// 십자선 모드 설정
function setCrosshairMode() {
    if (chart) {
        // 십자선 모드 설정
        console.log('Crosshair mode activated');
    }
}

// 그리기 모드 설정
function setDrawingMode(mode) {
    console.log('Drawing mode activated:', mode);
    
    // 이전 화살표 상태 리셋
    if (currentTool === 'arrow' && arrowStage === 1) {
        const chartContainer = document.getElementById('chart-container');
        if (tempArrow && chartContainer.contains(tempArrow)) {
            chartContainer.removeChild(tempArrow);
        }
        arrowStage = 0;
        tempArrow = null;
        startPoint = null;
    }
    
    currentTool = mode;
    
    // 차트 커서 스타일 변경
    const chartContainer = document.getElementById('chart-container');
    if (chartContainer) {
        if (mode === 'arrow') {
            chartContainer.style.cursor = 'pointer';
        } else {
            chartContainer.style.cursor = 'crosshair';
        }
    }
}

// 모든 그리기 지우기
function clearAllDrawings() {
    console.log('Clearing all drawings');
    drawings.forEach(drawing => {
        if (drawing.element && drawing.element.parentNode) {
            drawing.element.parentNode.removeChild(drawing.element);
        }
    });
    drawings = [];
    
    // Canvas도 지우기
    const drawingCanvas = document.getElementById('drawing-canvas');
    if (drawingCanvas) {
        const ctx = drawingCanvas.getContext('2d');
        ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    }
}

// 차트 설정 열기
function openChartSettings() {
    console.log('Opening chart settings');
    const modal = document.getElementById('chart-settings-modal');
    if (modal) {
        modal.classList.add('show');
    }
}

// 차트 설정 모달 기능 초기화
function initChartSettingsModal() {
    // 차트 스타일 버튼들
    const styleButtons = document.querySelectorAll('.chart-style-btn');
    styleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            styleButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
    
    // 설정 적용 버튼
    const applyButton = document.getElementById('apply-settings');
    if (applyButton) {
        applyButton.addEventListener('click', () => {
            applyChartSettings();
            closeAllModals();
        });
    }
    
    // 모달 닫기 버튼들
    const closeButtons = document.querySelectorAll('#chart-settings-modal .close-btn, #chart-settings-modal [data-action="close-modal"]');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            closeAllModals();
        });
    });
    
    // 모달 배경 클릭으로 닫기
    const modal = document.getElementById('chart-settings-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeAllModals();
            }
        });
    }
}

// 차트 설정 적용
function applyChartSettings() {
    if (!candleSeries) return;
    
    const upColor = document.getElementById('up-color').value;
    const downColor = document.getElementById('down-color').value;
    const showGrid = document.getElementById('show-grid').checked;
    
    // 캔들스틱 색상 변경
    candleSeries.applyOptions({
        upColor: upColor,
        downColor: downColor,
        wickUpColor: upColor,
        wickDownColor: downColor
    });
    
    // 그리드 표시 설정
    if (chart) {
        chart.applyOptions({
            grid: {
                vertLines: {
                    visible: showGrid
                },
                horzLines: {
                    visible: showGrid
                }
            }
        });
    }
    
    console.log('Chart settings applied');
}

// 차트 스냅샷 촬영 (전체 창)
function takeChartSnapshot() {
    console.log('Taking chart snapshot');
    
    if (typeof html2canvas === 'undefined') {
        alert('스크린샷을 촬영하려면 브라우저의 스크린샷 기능을 사용하세요.\n\nWindows: Win + Shift + S\nMac: Cmd + Shift + 4\nChrome: Ctrl/Cmd + Shift + I → Sources → ⋮ → Capture screenshot');
        return;
    }
    
    try {
        const mainContainer = document.querySelector('.main-container');
        if (mainContainer) {
            // 로딩 표시
            const loadingDiv = document.createElement('div');
            loadingDiv.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 20px;
                border-radius: 8px;
                z-index: 9999;
                font-size: 14px;
            `;
            loadingDiv.textContent = '스크린샷 생성 중...';
            document.body.appendChild(loadingDiv);
            
            html2canvas(mainContainer, {
                allowTaint: true,
                useCORS: true,
                scale: 1,
                backgroundColor: null,
                width: mainContainer.offsetWidth,
                height: mainContainer.offsetHeight
            }).then(canvas => {
                // 로딩 제거
                document.body.removeChild(loadingDiv);
                
                // 다운로드 링크 생성
                const link = document.createElement('a');
                link.download = `trading-chart-${currentSymbol}-${new Date().getTime()}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                
                console.log('Screenshot saved successfully');
            }).catch(error => {
                document.body.removeChild(loadingDiv);
                console.error('Failed to take screenshot:', error);
                alert('스크린샷 생성에 실패했습니다. 브라우저의 스크린샷 기능을 사용해주세요.');
            });
        }
    } catch (error) {
        console.error('Failed to take snapshot:', error);
        alert('스크린샷 기능을 사용할 수 없습니다.');
    }
}

// 키보드 단축키 설정
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+Z 또는 Cmd+Z로 실행 취소
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            undoLastDrawing();
        }
    });
}

// 실행 취소 기능
function undoLastDrawing() {
    if (drawings.length === 0) return;
    
    const lastDrawing = drawings.pop();
    
    // DOM 요소가 있는 경우 제거
    if (lastDrawing.element && lastDrawing.element.parentNode) {
        lastDrawing.element.parentNode.removeChild(lastDrawing.element);
    }
    
    // Canvas 그리기인 경우 전체 Canvas를 다시 그리기
    if (lastDrawing.type === 'canvas-brush' || lastDrawing.type === 'canvas-arrow') {
        redrawCanvas();
    }
    
    console.log('Undid last drawing. Remaining drawings:', drawings.length);
}

// 채팅 폼 설정
function setupChatForm() {
    if (messageForm && !isChatFormInitialized) {
        messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!messageInput.value.trim()) return;

            try {
                const messageData = {
                    text: messageInput.value.trim(),
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    uid: currentUser ? currentUser.uid : 'guest-' + (localStorage.getItem('guestNumber') || Math.floor(Math.random() * 10000)),
                    displayName: currentUser ? (currentUser.displayName || currentUser.email) : '게스트' + (localStorage.getItem('guestNumber') || Math.floor(Math.random() * 10000)),
                    photoURL: currentUser ? currentUser.photoURL : null
                };

                await db.collection('community-chat').add(messageData);
                messageInput.value = '';
            } catch (error) {
                console.error('메시지 전송 실패:', error);
                alert('메시지 전송에 실패했습니다.');
            }
        });
        isChatFormInitialized = true;
    }
}

// 차트 드로잉 설정
function setupChartDrawing() {
    const chartContainer = document.getElementById('chart-container');
    if (!chartContainer) return;

    // Canvas 생성 (그리기용)
    let drawingCanvas = document.getElementById('drawing-canvas');
    if (!drawingCanvas) {
        drawingCanvas = document.createElement('canvas');
        drawingCanvas.id = 'drawing-canvas';
        drawingCanvas.style.position = 'absolute';
        drawingCanvas.style.top = '0';
        drawingCanvas.style.left = '0';
        drawingCanvas.style.width = '100%';
        drawingCanvas.style.height = '100%';
        drawingCanvas.style.pointerEvents = 'none';
        drawingCanvas.style.zIndex = '5';
        chartContainer.appendChild(drawingCanvas);
        
        // Canvas 크기 설정
        const rect = chartContainer.getBoundingClientRect();
        drawingCanvas.width = rect.width;
        drawingCanvas.height = rect.height;
    }
    
    const ctx = drawingCanvas.getContext('2d');
    
    // 브러쉬 관련 변수
    let brushPath = [];
    let lastPoint = null;

    chartContainer.addEventListener('mousedown', (e) => {
        if (currentTool === 'cursor' || currentTool === 'crosshair') return;
        
        const rect = chartContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // 화살표 도구 특별 처리
        if (currentTool === 'arrow') {
            handleArrowMouseDown(e, x, y);
            return;
        }
        
        startPoint = { x, y };
        isDrawing = true;
        
        // 브러쉬 도구의 경우 Canvas로 처리
        if (currentTool === 'brush') {
            brushPath = [{ x, y }];
            lastPoint = { x, y };
            
            // Canvas에 브러쉬 설정
            ctx.strokeStyle = '#ff6b6b';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalCompositeOperation = 'source-over';
            
            ctx.beginPath();
            ctx.moveTo(x, y);
        } else {
            // 다른 도구들은 기존 방식 유지
            currentDrawing = createDrawingElement(currentTool, x, y);
            chartContainer.appendChild(currentDrawing);
        }
    });

    chartContainer.addEventListener('mousemove', (e) => {
        const rect = chartContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // 화살표 도구 특별 처리
        if (currentTool === 'arrow') {
            handleArrowMouseMove(e, x, y);
            return;
        }
        
        if (!isDrawing || !startPoint) return;
        
        if (currentTool === 'brush') {
            // Canvas로 브러쉬 그리기
            if (lastPoint) {
                // 부드러운 곡선을 위한 quadratic curve 사용
                const midX = (lastPoint.x + x) / 2;
                const midY = (lastPoint.y + y) / 2;
                
                ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, midX, midY);
                ctx.stroke();
                
                brushPath.push({ x, y });
                lastPoint = { x, y };
            }
        } else if (currentDrawing) {
            updateDrawingElement(currentDrawing, currentTool, startPoint, { x, y });
        }
    });

    chartContainer.addEventListener('mouseup', (e) => {
        // 화살표 도구 특별 처리
        if (currentTool === 'arrow') {
            handleArrowMouseUp(e);
            return;
        }
        
        if (!isDrawing) return;
        
        isDrawing = false;
        
        const rect = chartContainer.getBoundingClientRect();
        const endPoint = { 
            x: e.clientX - rect.left, 
            y: e.clientY - rect.top 
        };
        
        if (currentTool === 'brush') {
            // 브러쉬 완료 처리
            if (brushPath.length > 1) {
                // 브러쉬 스트로크를 차트 좌표로 변환해서 저장
                const convertedPath = brushPath.map(point => pixelToChartCoordinate(point.x, point.y));
                drawings.push({
                    type: 'canvas-brush',
                    tool: 'brush',
                    chartPath: convertedPath, // 차트 좌표로 저장
                    path: [...brushPath], // 픽셀 좌표도 임시로 보관
                    startPoint: startPoint,
                    endPoint: endPoint,
                    style: {
                        color: '#ff6b6b',
                        lineWidth: 3
                    }
                });
                console.log('Brush stroke completed:', drawings.length);
            }
            brushPath = [];
            lastPoint = null;
        } else if (currentDrawing) {
            // 텍스트 도구의 경우 프롬프트로 텍스트 입력받기
            if (currentTool === 'text') {
                const text = prompt('입력할 텍스트를 적어주세요:');
                if (text) {
                    currentDrawing.textContent = text;
                    currentDrawing.style.color = '#3182ce';
                    currentDrawing.style.fontWeight = 'bold';
                    currentDrawing.style.fontSize = '14px';
                    currentDrawing.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                    currentDrawing.style.padding = '4px 8px';
                    currentDrawing.style.borderRadius = '4px';
                } else {
                    // 텍스트가 입력되지 않으면 요소 제거
                    chartContainer.removeChild(currentDrawing);
                    currentDrawing = null;
                    startPoint = null;
                    return;
                }
            }
            
            // 드로잉 완료, 저장
            drawings.push({
                element: currentDrawing,
                tool: currentTool,
                startPoint: startPoint,
                endPoint: endPoint
            });
            
            console.log('Drawing completed:', currentTool, drawings.length);
        }
        
        startPoint = null;
        currentDrawing = null;
    });

    // 더블클릭으로 화살표 편집 모드 종료
    chartContainer.addEventListener('dblclick', (e) => {
        if (currentTool === 'arrow' && arrowStage === 1) {
            finishArrow();
        }
    });
    
    // Canvas 크기 조정 감지
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            const rect = entry.contentRect;
            drawingCanvas.width = rect.width;
            drawingCanvas.height = rect.height;
            redrawCanvas(); // Canvas 내용 다시 그리기
        }
    });
    resizeObserver.observe(chartContainer);
}

// 픽셀 좌표를 차트 좌표로 변환
function pixelToChartCoordinate(x, y) {
    if (!chart || !chartSeries) return { time: null, price: null };
    
    try {
        const timeScale = chart.timeScale();
        // 메인 시리즈의 가격 스케일 사용
        const priceScale = chartSeries.priceScale();
        
        const time = timeScale.coordinateToTime(x);
        const price = priceScale.coordinateToPrice(y);
        
        return { time: time, price: price };
    } catch (error) {
        console.error('Error converting pixel to chart coordinate:', error);
        return { time: null, price: null };
    }
}

// 차트 좌표를 픽셀 좌표로 변환
function chartToPixelCoordinate(time, price) {
    if (!chart || !chartSeries) return { x: 0, y: 0 };
    
    try {
        const timeScale = chart.timeScale();
        // 메인 시리즈의 가격 스케일 사용
        const priceScale = chartSeries.priceScale();
        
        // 시간이 유효한지 확인
        if (time === null || time === undefined) {
            return { x: 0, y: 0 };
        }
        
        const x = timeScale.timeToCoordinate(time);
        const y = priceScale.priceToCoordinate(price);
        
        return { x: x || 0, y: y || 0 };
    } catch (error) {
        console.error('Error converting chart to pixel coordinate:', error);
        return { x: 0, y: 0 };
    }
}

// Canvas 다시 그리기 함수 (차트 좌표 기반)
function redrawCanvas() {
    const drawingCanvas = document.getElementById('drawing-canvas');
    if (!drawingCanvas) return;
    
    const ctx = drawingCanvas.getContext('2d');
    ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    
    // 저장된 그리기들 다시 그리기
    drawings.forEach(drawing => {
        if (drawing.type === 'canvas-brush' && drawing.chartPath) {
            // 브러쉬 스트로크 그리기 (차트 좌표를 픽셀 좌표로 변환)
            const pixelPath = drawing.chartPath.map(point => {
                if (!point || point.time === null || point.time === undefined) {
                    return null;
                }
                return chartToPixelCoordinate(point.time, point.price);
            }).filter(point => point && point.x !== null && point.y !== null && !isNaN(point.x) && !isNaN(point.y));
            
            if (pixelPath.length > 1) {
                ctx.strokeStyle = drawing.style.color;
                ctx.lineWidth = drawing.style.lineWidth;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.globalCompositeOperation = 'source-over';
                
                ctx.beginPath();
                ctx.moveTo(pixelPath[0].x, pixelPath[0].y);
                
                for (let i = 1; i < pixelPath.length; i++) {
                    if (i === pixelPath.length - 1) {
                        ctx.lineTo(pixelPath[i].x, pixelPath[i].y);
                    } else {
                        const midX = (pixelPath[i].x + pixelPath[i + 1].x) / 2;
                        const midY = (pixelPath[i].y + pixelPath[i + 1].y) / 2;
                        ctx.quadraticCurveTo(pixelPath[i].x, pixelPath[i].y, midX, midY);
                    }
                }
                ctx.stroke();
            }
        } else if (drawing.type === 'canvas-arrow' && drawing.chartStartPoint && drawing.chartEndPoint) {
            // 화살표 그리기 (차트 좌표를 픽셀 좌표로 변환)
            if (drawing.chartStartPoint.time && drawing.chartEndPoint.time) {
                const startPixel = chartToPixelCoordinate(drawing.chartStartPoint.time, drawing.chartStartPoint.price);
                const endPixel = chartToPixelCoordinate(drawing.chartEndPoint.time, drawing.chartEndPoint.price);
                
                if (startPixel.x !== null && startPixel.y !== null && endPixel.x !== null && endPixel.y !== null &&
                    !isNaN(startPixel.x) && !isNaN(startPixel.y) && !isNaN(endPixel.x) && !isNaN(endPixel.y)) {
                    drawArrowOnCanvas(
                        ctx,
                        startPixel.x,
                        startPixel.y,
                        endPixel.x,
                        endPixel.y,
                        drawing.style.color,
                        drawing.style.lineWidth,
                        false
                    );
                }
            }
        }
    });
}

// 드로잉 요소 생성
function createDrawingElement(tool, x, y) {
    const element = document.createElement('div');
    element.style.position = 'absolute';
    element.style.pointerEvents = 'none';
    element.style.zIndex = '5';
    
    switch (tool) {
        case 'trendline':
            element.style.borderTop = '2px solid #3182ce';
            element.style.transformOrigin = '0 0';
            break;
        case 'horizontal':
        case 'horizontal-line':
            element.style.borderTop = '2px solid #3182ce';
            element.style.width = '100%';
            element.style.left = '0';
            element.style.top = y + 'px';
            break;
        case 'vertical':
        case 'vertical-line':
            element.style.borderLeft = '2px solid #3182ce';
            element.style.height = '100%';
            element.style.top = '0';
            element.style.left = x + 'px';
            break;
        case 'rectangle':
            element.style.border = '2px solid #3182ce';
            element.style.backgroundColor = 'rgba(49, 130, 206, 0.1)';
            break;
        case 'fibonacci':
            element.style.border = '1px solid #ffa500';
            element.style.backgroundColor = 'rgba(255, 165, 0, 0.1)';
            break;
        case 'text':
            element.style.border = '1px dashed #3182ce';
            element.style.minWidth = '50px';
            element.style.minHeight = '20px';
            element.style.display = 'flex';
            element.style.alignItems = 'center';
            element.style.justifyContent = 'center';
            break;
    }
    
    return element;
}

// 드로잉 요소 업데이트
function updateDrawingElement(element, tool, start, end) {
    switch (tool) {
        case 'trendline':
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            
            element.style.left = start.x + 'px';
            element.style.top = start.y + 'px';
            element.style.width = length + 'px';
            element.style.height = '2px';
            element.style.transform = `rotate(${angle}deg)`;
            break;
        case 'rectangle':
            const left = Math.min(start.x, end.x);
            const top = Math.min(start.y, end.y);
            const width = Math.abs(end.x - start.x);
            const height = Math.abs(end.y - start.y);
            
            element.style.left = left + 'px';
            element.style.top = top + 'px';
            element.style.width = width + 'px';
            element.style.height = height + 'px';
            break;
        case 'fibonacci':
            // 피보나치 되돌림 레벨 (23.6%, 38.2%, 50%, 61.8%, 78.6%)
            const fibLeft = Math.min(start.x, end.x);
            const fibTop = Math.min(start.y, end.y);
            const fibWidth = Math.abs(end.x - start.x);
            const fibHeight = Math.abs(end.y - start.y);
            
            element.style.left = fibLeft + 'px';
            element.style.top = fibTop + 'px';
            element.style.width = fibWidth + 'px';
            element.style.height = fibHeight + 'px';
            
            // 피보나치 레벨 선들 추가 (간단한 구현)
            element.innerHTML = '';
            const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
            levels.forEach(level => {
                const line = document.createElement('div');
                line.style.position = 'absolute';
                line.style.left = '0';
                line.style.right = '0';
                line.style.top = (level * fibHeight) + 'px';
                line.style.borderTop = '1px solid #ffa500';
                line.style.fontSize = '10px';
                line.style.color = '#ffa500';
                if (level > 0 && level < 1) {
                    line.textContent = (level * 100).toFixed(1) + '%';
                }
                element.appendChild(line);
            });
            break;
        case 'text':
            element.style.left = start.x + 'px';
            element.style.top = start.y + 'px';
            break;
    }
}

// 화살표 도구 마우스 다운 처리 (Canvas 기반으로 개선)
function handleArrowMouseDown(e, x, y) {
    const chartContainer = document.getElementById('chart-container');
    
    if (arrowStage === 0) {
        // 첫 번째 클릭: 시작점 설정
        arrowStage = 1;
        startPoint = { x, y };
        
        // Canvas에 임시 화살표 그리기 시작
        const drawingCanvas = document.getElementById('drawing-canvas');
        if (drawingCanvas) {
            const ctx = drawingCanvas.getContext('2d');
            ctx.strokeStyle = '#3182ce';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
        }
        
        console.log('Arrow start point set:', startPoint);
    } else if (arrowStage === 1) {
        // 두 번째 클릭: 화살표 완성
        finishArrow(x, y);
    }
}

// 화살표 도구 마우스 이동 처리 (Canvas 기반)
function handleArrowMouseMove(e, x, y) {
    if (arrowStage === 1 && startPoint) {
        const drawingCanvas = document.getElementById('drawing-canvas');
        if (!drawingCanvas) return;
        
        const ctx = drawingCanvas.getContext('2d');
        
        // Canvas 지우고 다시 그리기 (임시 미리보기)
        redrawCanvas();
        
        // 임시 화살표 그리기
        drawArrowOnCanvas(ctx, startPoint.x, startPoint.y, x, y, '#3182ce', 2, true);
    }
}

// 화살표 도구 마우스 업 처리
function handleArrowMouseUp(e) {
    // 마우스 업으로는 아무것도 하지 않음 (클릭으로만 제어)
}

// 화살표 완성 (Canvas 기반)
function finishArrow(endX, endY) {
    if (startPoint) {
        // 화살표를 차트 좌표로 변환해서 저장
        const chartStartPoint = pixelToChartCoordinate(startPoint.x, startPoint.y);
        const chartEndPoint = pixelToChartCoordinate(endX, endY);
        
        drawings.push({
            type: 'canvas-arrow',
            tool: 'arrow',
            chartStartPoint: chartStartPoint, // 차트 좌표로 저장
            chartEndPoint: chartEndPoint, // 차트 좌표로 저장
            startPoint: startPoint, // 픽셀 좌표도 임시로 보관
            endPoint: { x: endX, y: endY }, // 픽셀 좌표도 임시로 보관
            style: {
                color: '#3182ce',
                lineWidth: 2
            }
        });
        
        // Canvas에 최종 화살표 그리기
        const drawingCanvas = document.getElementById('drawing-canvas');
        if (drawingCanvas) {
            const ctx = drawingCanvas.getContext('2d');
            redrawCanvas(); // 전체 다시 그리기
        }
        
        console.log('Arrow completed:', drawings.length);
    }
    
    // 상태 리셋
    arrowStage = 0;
    startPoint = null;
}

// Canvas에 화살표 그리기 함수
function drawArrowOnCanvas(ctx, startX, startY, endX, endY, color = '#3182ce', lineWidth = 2, isTemporary = false) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    
    // 화살표 방향과 길이 계산
    const angle = Math.atan2(endY - startY, endX - startX);
    const headLength = 12;
    const headAngle = Math.PI / 6; // 30도
    
    // 화살표 머리 끝에서 선까지의 거리를 고려해서 선 길이 조정
    const adjustedEndX = endX - headLength * 0.7 * Math.cos(angle);
    const adjustedEndY = endY - headLength * 0.7 * Math.sin(angle);
    
    // 화살표 선 그리기 (시작점에서 조정된 끝점까지)
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(adjustedEndX, adjustedEndY);
    ctx.stroke();
    
    // 끝점에만 깔끔한 삼각형 화살표 머리 그리기
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
        endX - headLength * Math.cos(angle - headAngle),
        endY - headLength * Math.sin(angle - headAngle)
    );
    ctx.lineTo(
        endX - headLength * Math.cos(angle + headAngle),
        endY - headLength * Math.sin(angle + headAngle)
    );
    ctx.closePath();
    ctx.fill();
}

console.log('Community.js loaded successfully'); 