import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    serverTimestamp, 
    query, 
    orderBy, 
    onSnapshot,
    getDoc,
    doc,
    limit,
    startAfter,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDatabase, ref as dbRef, onValue, set, onDisconnect, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from './firebase-config.js';
import { triggerConfetti } from './effects.js';

const MESSAGES_PER_PAGE = 25;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

// --- DOM Elements ---
const messageForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('chat-messages');
const chartContainer = document.getElementById('chart-container');

let currentUser = null;
let messagesUnsubscribe = null;
let binanceSocket = null;
let lastVisibleMessageDoc = null;
let isLoadingMore = false;
let noMoreMessages = false;
let isInitialLoad = true;
let presenceRef = null;
let chart, candlestickSeries;
let currentCoin = 'BTCUSDT';
let currentInterval = '1m';

// --- Authentication Handler ---
onAuthStateChanged(auth, async (user) => {
    // presence 관리
    if (presenceRef) {
        remove(presenceRef);
        presenceRef = null;
    }
    if (user && user.providerData.length === 0) {
        await auth.signOut();
        return;
    }
    if (user) {
        // User is logged in
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        currentUser = userDoc.exists() 
            ? { uid: user.uid, ...userDoc.data() }
            : { uid: user.uid, displayName: user.displayName || 'Anonymous', level: 1, role: 'user' };
        if (!currentUser.photoURL) {
            currentUser.photoURL = 'assets/@default-profile.png';
        }
        // presence 등록
        presenceRef = dbRef(rtdb, `chat-presence/${user.uid}`);
        set(presenceRef, true);
        onDisconnect(presenceRef).remove();
        if(messageForm) {
            if(messageInput) {
                messageInput.placeholder = "메시지를 입력하세요...";
                messageInput.disabled = false;
            }
            const submitButton = messageForm.querySelector('button');
            if(submitButton) submitButton.disabled = false;
        }
        loadInitialMessages();
    } else {
        currentUser = null;
        if(messageForm) {
            if(messageInput) {
                messageInput.placeholder = "로그인 후 채팅에 참여할 수 있습니다.";
                messageInput.disabled = true;
            }
            const submitButton = messageForm.querySelector('button');
            if(submitButton) submitButton.disabled = true;
        }
        // Always show chat messages, just disable input for non-logged-in users
        loadInitialMessages();
    }
});

// --- Chat Functions ---
function getChatQuery() {
    const isMobile = window.innerWidth <= 768;
    const messagesRef = collection(db, "community-chat");
    if (isMobile) {
        return query(messagesRef, orderBy("timestamp", "desc"), limit(MESSAGES_PER_PAGE));
    } else {
        // PC: 전체 메시지 불러오기 (limit 제거)
        return query(messagesRef, orderBy("timestamp", "asc"));
    }
}

function loadInitialMessages() {
    if (!messagesContainer) return;
    
    // 상태 초기화
    if (messagesUnsubscribe) messagesUnsubscribe();
    messagesContainer.innerHTML = '';
    lastVisibleMessageDoc = null;
    noMoreMessages = false;
    isInitialLoad = true;

    const q = getChatQuery();

    messagesUnsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(change => {
            if (change.type === "added") {
                displayMessage(change.doc.id, change.doc.data(), !isInitialLoad);
                
                // 실시간으로 추가된 새 메시지일 경우 스크롤
                if (!isInitialLoad) {
                    scrollToLatest();
                }
            }
        });
        
        // 초기 로드가 끝나면 한 번만 스크롤
        if (isInitialLoad) {
            scrollToLatest();
            isInitialLoad = false; // 초기 로드 완료 플래그 설정
        }

        if (!snapshot.empty) {
            lastVisibleMessageDoc = snapshot.docs[snapshot.docs.length - 1];
        }
        setupScrollListener();
    }, error => {
        console.error("Error fetching initial messages: ", error);
    });
}

async function loadMoreMessages() {
    if (isLoadingMore || noMoreMessages || !lastVisibleMessageDoc) return;
    isLoadingMore = true;
    const loader = showLoader();
    const isMobile = window.innerWidth <= 768;
    const messagesRef = collection(db, "community-chat");
    const q = isMobile
        ? query(messagesRef, orderBy("timestamp", "desc"), startAfter(lastVisibleMessageDoc), limit(MESSAGES_PER_PAGE))
        : query(messagesRef, orderBy("timestamp", "asc"), startAfter(lastVisibleMessageDoc), limit(MESSAGES_PER_PAGE));
    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            noMoreMessages = true;
            if (loader) loader.remove();
            return;
        }
        lastVisibleMessageDoc = snapshot.docs[snapshot.docs.length - 1];
        snapshot.forEach(doc => {
            displayMessage(doc.id, doc.data(), false);
        });
    } catch (error) {
        console.error("Error fetching more messages: ", error);
    } finally {
        if (loader) loader.remove();
        isLoadingMore = false;
    }
}

function setupScrollListener() {
    if (!messagesContainer) return;
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return; // PC에서는 무한스크롤 X
    messagesContainer.onscroll = () => {
        const isAtTop = (messagesContainer.scrollTop + messagesContainer.clientHeight >= messagesContainer.scrollHeight - 10);
        if (isAtTop) {
            loadMoreMessages();
        }
    };
}

function showLoader() {
    if (!messagesContainer) return;
    const loaderElement = document.createElement('div');
    loaderElement.classList.add('chat-loader');
    loaderElement.textContent = '이전 메시지 로딩 중...';
    // For mobile (flex-reverse), prepend puts it at the "bottom" which appears at the top
    messagesContainer.prepend(loaderElement);
    return loaderElement;
}

function displayMessage(docId, data, isNewMessage = false) {
    if (!messagesContainer || document.getElementById(docId)) return;

    const messageElement = document.createElement('div');
    messageElement.id = docId;
    messageElement.classList.add('message-item');
    if (data.uid === currentUser?.uid) messageElement.classList.add('my-message');
    
    const levelBadge = data.role === 'admin'
        ? `<span class="admin-badge">[Admin]</span>`
        : `<span class="level-badge">[Lv.${data.level}]</span>`;

    messageElement.innerHTML = `
        <!-- <img src="${data.photoURL}" alt="${data.displayName}" class="profile-pic"> -->
        <div class="message-content">
            <div class="message-sender">
                ${levelBadge}
                <strong>${data.displayName}</strong>
            </div>
            <p class="message-text">${data.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
        </div>
    `;

    const isMobile = window.innerWidth <= 768;

    // 모바일에서 실시간 새 메시지는 맨 위에 추가(prepend)
    if (isMobile && !isInitialLoad) {
        messagesContainer.prepend(messageElement);
    } else {
        // PC 전체 및 모바일 초기 로드는 맨 아래에 추가(append)
        messagesContainer.appendChild(messageElement);
    }

    // '가즈아' 키워드 감지 시 showRocketOverlay() 호출
    if (isNewMessage && data.text && typeof data.text === 'string' && data.text.includes('가즈아')) {
        showRocketOverlay();
    }
}

// PC/모바일 자동 스크롤 함수
function scrollToLatest() {
    const isMobile = window.innerWidth <= 768;
    if (messagesContainer) {
        if (isMobile) {
            messagesContainer.scrollTop = 0; // flex-reverse: 0이 맨 위(최신)
        } else {
            messagesContainer.scrollTop = messagesContainer.scrollHeight; // 맨 아래(최신)
        }
    }
}

if (messageForm) {
    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return;
        const messageText = messageInput.value.trim();
        if (messageText) {
            try {
                const docRef = await addDoc(collection(db, "community-chat"), {
                    text: messageText,
                    timestamp: serverTimestamp(),
                    uid: currentUser.uid,
                    displayName: currentUser.displayName,
                    level: currentUser.level,
                    role: currentUser.role,
                    photoURL: currentUser.photoURL,
                    effect: null // 항상 null로 저장
                });
                messageInput.value = '';
                
                // 영차 효과: 내가 보낸 메시지 + 영차 포함 + 전송 직후에만
                if (messageText.includes('영차')) {
                    setTimeout(() => {
                        const el = document.getElementById(docRef.id);
                        if (el) triggerConfetti(el);
                    }, 100); // DOM 렌더링 대기
                }
            } catch (error) {
                console.error("Error sending message: ", error);
            }
        }
    });
}

// --- Lightweight Charts ---
document.addEventListener('DOMContentLoaded', () => {
    initializeChart();
});

function initializeChart() {
    const chartContainer = document.getElementById('chart-container');
    if (!chartContainer) {
        setTimeout(initializeChart, 500);
        return;
    }
    if (!chart) {
        chart = LightweightCharts.createChart(chartContainer, {
            layout: {
                background: { color: 'transparent' },
                textColor: '#ADB5BD',
            },
            grid: {
                vertLines: { color: 'rgba(255, 255, 255, 0.1)' },
                horzLines: { color: 'rgba(255, 255, 255, 0.1)' },
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
            },
        });
        candlestickSeries = chart.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderDownColor: '#ef5350',
            borderUpColor: '#26a69a',
            wickDownColor: '#ef5350',
            wickUpColor: '#26a69a',
        });
    }
    updateChartTitle(currentCoin);
    fetchHistoricalData(currentCoin, currentInterval);
    setupWebSocket(currentCoin, currentInterval);
    setupChartEventListeners();
    const handleResize = () => chart.applyOptions({ width: chartContainer.clientWidth });
    window.addEventListener('resize', handleResize);
    document.body.addEventListener('themeChanged', (e) => {
        const isDarkMode = e.detail.isDarkMode;
        chart.applyOptions({
            layout: {
                textColor: isDarkMode ? '#ADB5BD' : '#333',
            },
            grid: {
                vertLines: { color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' },
                horzLines: { color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' },
            },
        });
    });
}

function setupChartEventListeners() {
    const desktopIntervalButtons = document.getElementById('chart-intervals-desktop');
    const mobileIntervalSelect = document.getElementById('chart-interval-select-mobile');
    const coinSelector = document.getElementById('coin-selector');
    if (desktopIntervalButtons) {
        desktopIntervalButtons.addEventListener('click', (e) => {
            if (e.target.matches('.interval-button')) {
                handleIntervalChange(e.target.dataset.interval);
            }
        });
    }
    if (mobileIntervalSelect) {
        mobileIntervalSelect.addEventListener('change', (e) => {
            handleIntervalChange(e.target.value);
        });
    }
    if (coinSelector) {
        coinSelector.addEventListener('change', (e) => {
            handleCoinChange(e.target.value);
        });
    }
}

function handleIntervalChange(newInterval) {
    currentInterval = newInterval;
    updateActiveIntervalButton(newInterval);
    fetchHistoricalData(currentCoin, currentInterval);
    setupWebSocket(currentCoin, currentInterval);
}
function handleCoinChange(newCoin) {
    currentCoin = newCoin;
    updateChartTitle(currentCoin);
    fetchHistoricalData(currentCoin, currentInterval);
    setupWebSocket(currentCoin, currentInterval);
}
function updateActiveIntervalButton(newInterval) {
    const desktopIntervalButtons = document.getElementById('chart-intervals-desktop');
    if (desktopIntervalButtons) {
        const currentActive = desktopIntervalButtons.querySelector('.active');
        if (currentActive) currentActive.classList.remove('active');
        const newActiveButton = desktopIntervalButtons.querySelector(`[data-interval="${newInterval}"]`);
        if (newActiveButton) newActiveButton.classList.add('active');
    }
    const mobileIntervalSelect = document.getElementById('chart-interval-select-mobile');
    if (mobileIntervalSelect) {
        mobileIntervalSelect.value = newInterval;
    }
}
async function fetchHistoricalData(symbol, interval) {
    try {
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=500`;
        const response = await fetch(url);
        const data = await response.json();
        const candlestickData = data.map(d => ({
            time: d[0] / 1000,
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
        }));
        candlestickSeries.setData(candlestickData);
    } catch (error) {
        console.error('Failed to fetch historical chart data:', error);
    }
}
function setupWebSocket(symbol, interval) {
    if (window.binanceSocket) {
        window.binanceSocket.close();
    }
    const wsSymbol = symbol.toLowerCase();
    const wsUrl = `wss://stream.binance.com:9443/ws/${wsSymbol}@kline_${interval}`;
    window.binanceSocket = new WebSocket(wsUrl);
    window.binanceSocket.onmessage = function (event) {
        const message = JSON.parse(event.data);
        const kline = message.k;
        candlestickSeries.update({
            time: kline.t / 1000,
            open: parseFloat(kline.o),
            high: parseFloat(kline.h),
            low: parseFloat(kline.l),
            close: parseFloat(kline.c),
        });
    };
    window.binanceSocket.onerror = function(error) {
        console.error('WebSocket error:', error);
    };
}
function updateChartTitle(symbol) {
    const chartTitle = document.getElementById('chart-title');
    if (chartTitle) {
        const coinName = symbol.replace('USDT', '/USDT');
        chartTitle.textContent = `${coinName} 실시간 차트`;
    }
}

// 로켓 애니메이션 오버레이 함수
function showRocketOverlay() {
    const overlay = document.getElementById('rocket-overlay');
    if (!overlay) return;
    overlay.innerHTML = '<img src="/Rocket-Animation-Video-Generat-unscreen.gif" style="width:60vw; max-width:600px; min-width:200px; position:absolute; left:50%; transform:translateX(-50%); bottom:8vh; pointer-events:none;" />';
    overlay.style.display = 'block';
    setTimeout(() => {
        overlay.style.display = 'none';
        overlay.innerHTML = '';
    }, 2500);
}

// --- 실시간 접속자 수 집계 ---
function setupChatPresenceCount() {
    const countEl = document.getElementById('chat-users-count');
    if (!countEl) return;
    const allPresenceRef = dbRef(rtdb, 'chat-presence');
    onValue(allPresenceRef, (snap) => {
        const val = snap.val();
        const count = val ? Object.keys(val).length : 0;
        countEl.textContent = count;
    });
}
document.addEventListener('DOMContentLoaded', setupChatPresenceCount); 