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
    getDocs,
    where,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDatabase, ref as dbRef, onValue, set, onDisconnect, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from './firebase-config.js';
import { triggerConfetti } from './effects.js';

const MESSAGES_PER_PAGE = 25;
const BANNED_KEYWORDS = ["바보", "멍청이", "쓰레기","씨발","시발", "씨팔", "시팔", "ㅆㅂ", "18", "좆", "좇", "좃", "존나", "ㅈㄴ","개새끼", "개새", "ㄱㅅㄲ", "씹", "썅", "지랄", "ㅈㄹ", "염병", "옘병", "젠장", "병신", "ㅂㅅ", "ㅄ", "등신", "멍청이", "멍충이", "바보", "또라이", "돌아이", "미친놈", "미친년", "미친새끼", "애자", "찐따", "김치녀", "한남", "한남충", "맘충", "된장녀", "절뚝이", "난쟁이", "짱깨", "쪽바리", "틀딱", "급식충", "연금충", "애미", "애비", "느금마", "느개비", "니애미", "니애비", "패드립", "고아", "창녀", "창놈", "새퀴", "새뀌", "ㅅㄲ", "시-발", "조온나", "10새끼", "10bird"]; // 예시 금지어 목록

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

// --- Chat Functions (수정된 버전) ---

// 이미지 캐시 및 최적화
const imageCache = new Map();
const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            const src = img.dataset.src;
            if (src && !img.src) {
                loadOptimizedImage(img, src);
                imageObserver.unobserve(img);
            }
    }
});
}, {
    rootMargin: '50px 0px',
    threshold: 0.1
});

function loadOptimizedImage(img, src) {
    // 캐시에서 확인
    if (imageCache.has(src)) {
        img.src = imageCache.get(src);
        img.classList.remove('loading');
        img.classList.add('loaded');
        return;
    }

    // 이미지 로딩 시작
    img.classList.add('loading');
    
    const tempImg = new Image();
    tempImg.onload = () => {
        img.src = src;
        img.classList.remove('loading');
        img.classList.add('loaded');
        imageCache.set(src, src);
        console.log('이미지 로드 성공:', src);
    };
    
    tempImg.onerror = () => {
        console.log('이미지 로드 실패, 기본 이미지 사용:', src);
        img.src = 'assets/@default-profile.png';
        img.classList.remove('loading');
        img.classList.add('error');
    };
    
    // 타임아웃 설정 (5초)
    setTimeout(() => {
        if (img.classList.contains('loading')) {
            console.log('이미지 로드 타임아웃:', src);
            img.src = 'assets/@default-profile.png';
            img.classList.remove('loading');
            img.classList.add('error');
        }
    }, 5000);
    
    tempImg.src = src;
}

// 메시지 1개를 렌더링하는 함수 (최적화된 버전)
function renderMessage(msg) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const profileImg = msg.data.photoThumbURL || msg.data.photoURL || 'assets/@default-profile.png';

    const messageElement = document.createElement('div');
    messageElement.classList.add('message-item');
    messageElement.id = msg.id;

    if (currentUser && msg.data.uid === currentUser.uid) {
        messageElement.classList.add('my-message');
    }

    // 레벨별 채팅 스타일 적용
    const userPoints = msg.data.points || 0;
    let levelInfo;
    
    // 레벨 시스템이 로드되지 않은 경우 기본값 사용
    if (!window.levelSystem) {
        levelInfo = { name: "새싹", color: "#22c55e", gradient: "linear-gradient(135deg, #22c55e, #16a34a)", level: "새싹" };
    } else {
        if (currentUser && msg.data.uid === currentUser.uid) {
            const latestPoints = window.currentUserData ? window.currentUserData.points : (currentUser.points || 0);
            levelInfo = window.levelSystem.calculateLevel(latestPoints);
        } else {
            levelInfo = window.levelSystem.calculateLevel(userPoints);
        }
    }
    // 레벨별 클래스 부여 (효과 적용)
    const levelClassMap = {
      "새싹": "level-새싹",
      "초보": "level-초보",
      "일반": "level-일반",
      "숙련": "level-숙련",
      "전문가": "level-전문가",
      "고수": "level-고수",
      "달인": "level-달인",
      "마스터": "level-마스터",
      "그랜드마스터": "level-그랜드마스터",
      "레전드": "level-레전드"
    };
    const levelClass = levelClassMap[levelInfo.level || levelInfo.name] || "level-새싹";
    messageElement.classList.add(levelClass);

    messageElement.innerHTML = `
        <div class="chat-profile-pic-wrap">
            <img class="chat-profile-pic" 
                 data-src="${profileImg}" 
                 src="${profileImg}"
                 alt="프로필" 
                 onerror="this.onerror=null;this.src='assets/@default-profile.png';">
        </div>
        <div class="message-content">
            <div class="message-sender">
                ${msg.data.role === 'admin' 
                    ? `<span class="admin-badge">Admin</span>` 
                    : `<span class="level-badge" style="background: ${levelInfo.gradient || levelInfo.color}">${levelInfo.name}</span>`
                }
                <strong style="font-weight: normal;">${msg.data.displayName}</strong>
            </div>
            <p class="message-text" style="font-weight: normal;">${msg.data.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
        </div>
    `;

    messagesContainer.appendChild(messageElement);
    
    // 이미지 지연 로딩 관찰 시작
    const img = messageElement.querySelector('.chat-profile-pic');
    if (img) {
        imageObserver.observe(img);
    }
}

// 기존 loadInitialMessages 함수를 아래 코드로 완전히 교체하세요.
async function loadInitialMessages() {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    isInitialLoad = true;
    messagesContainer.innerHTML = ''; // 컨테이너 비우기
    
    const q = query(collection(db, "community-chat"), orderBy("timestamp", "desc"), limit(50));
    try {
        const snapshot = await getDocs(q);
        // DB에서 가져온 순서(최신->과거)를 뒤집어서(과거->최신)으로 만듭니다.
        const messages = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })).reverse();
        
        // 과거 메시지부터 순서대로 화면에 추가합니다.
        messages.forEach(msg => renderMessage(msg));
        
        // 로드 후 스크롤을 맨 아래로 강제 이동시킵니다. (PC 버전만)
        setTimeout(() => {
            if (window.innerWidth > 768) { // PC 버전만
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
            isInitialLoad = false;
        }, 100);
        
    } catch(e) {
        console.error("초기 메시지 로드 중 오류 발생: ", e);
    }
    }

// 기존 setupNewMessageListener 함수를 아래 코드로 완전히 교체하세요.
function setupNewMessageListener() {
    const q = query(collection(db, "community-chat"), where("timestamp", ">", new Date()));
    
    onSnapshot(q, (snapshot) => {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        // 새 메시지가 오기 전, 스크롤이 맨 아래에 있었는지 확인
        const isScrolledToBottom = messagesContainer.scrollHeight - messagesContainer.clientHeight <= messagesContainer.scrollTop + 20;

        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                renderMessage({ id: change.doc.id, data: change.doc.data() });
    }
        });
        
        // 사용자가 스크롤을 맨 아래에 두고 있었을 경우에만 자동으로 스크롤 (PC 버전만)
        if (isScrolledToBottom && window.innerWidth > 768) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

    }, (error) => {
        console.error("새 메시지 리스너 오류: ", error);
    });
}

// --- Authentication Handler ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // 로그인된 사용자
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        currentUser = userDoc.exists() 
            ? { uid: user.uid, ...userDoc.data() }
            : { uid: user.uid, displayName: user.displayName || 'Anonymous', points: 0, level: "새싹", role: 'user' };
        if (!currentUser.photoURL) {
            currentUser.photoURL = 'assets/@default-profile.png';
        }
        
        // 메시지 입력 활성화
        messageInput.disabled = false;
        const submitButton = messageForm.querySelector('button');
        if(submitButton) submitButton.disabled = false;
        messageInput.placeholder = '메시지를 입력하세요...';
        
        // 일일 로그인 포인트 (하루에 한 번만)
        await checkAndAddDailyLoginPoints();
    } else {
        // 로그인하지 않은 사용자
        currentUser = null;
        
        // 메시지 입력 비활성화
        messageInput.disabled = true;
        const submitButton = messageForm.querySelector('button');
        if(submitButton) submitButton.disabled = true;
        messageInput.placeholder = '메시지를 보내려면 로그인이 필요합니다.';
    }
    
    // 채팅 메시지는 로그인 여부와 관계없이 로드
    loadMessages();
});

function censorMessage(text) {
    let censoredText = text;
    BANNED_KEYWORDS.forEach(keyword => {
        const regex = new RegExp(keyword, "gi");
        censoredText = censoredText.replace(regex, " *** ");
    });
    return censoredText;
}

// 메시지 전송
    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
    
    if (!currentUser) {
        alert('메시지를 보내려면 로그인이 필요합니다.');
        return;
    }
    
    const message = messageInput.value.trim();
    if (!message) return;

            try {
        await addDoc(collection(db, 'community-chat'), {
            text: message,
                    uid: currentUser.uid,
                    displayName: currentUser.displayName,
            photoURL: currentUser.photoURL || 'assets/@default-profile.png',
            points: currentUser.points || 0,
            role: currentUser.role || 'user',
            timestamp: serverTimestamp()
        });
        
                messageInput.value = '';
    } catch (error) {
        console.error('메시지 전송 실패:', error);
        alert('메시지 전송에 실패했습니다.');
    }
});

// 메시지 로드 (로그인 여부와 관계없이)
async function loadMessages() {
    try {
        const messagesQuery = query(
            collection(db, 'community-chat'),
            orderBy('timestamp', 'desc'),
            limit(50)
        );
        
        const snapshot = await getDocs(messagesQuery);
        const messages = [];
        
        snapshot.forEach((doc) => {
            messages.push({ id: doc.id, data: doc.data() });
        });
        
        // 시간순으로 정렬 (오래된 것부터)
        messages.reverse();
        
        messagesContainer.innerHTML = '';
        messages.forEach(msg => renderMessage(msg));
        
        // PC 버전에서 스크롤을 맨 아래로 이동
                    setTimeout(() => {
            if (window.innerWidth > 768) { // PC 버전만
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }, 100);
        
        // 실시간 리스너 설정
        setupRealtimeListener();
        
    } catch (error) {
        console.error('메시지 로드 실패:', error);
        messagesContainer.innerHTML = '<div class="chat-notice">메시지를 불러올 수 없습니다.</div>';
    }
}

// 실시간 메시지 리스너
function setupRealtimeListener() {
    const messagesQuery = query(
        collection(db, 'community-chat'),
        where('timestamp', '>', new Date())
    );
    
    onSnapshot(messagesQuery, (snapshot) => {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        // 새 메시지가 오기 전, 스크롤이 맨 아래에 있었는지 확인
        const isScrolledToBottom = messagesContainer.scrollHeight - messagesContainer.clientHeight <= messagesContainer.scrollTop + 20;

        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const msg = { id: change.doc.id, data: change.doc.data() };
                // 새 메시지만 추가 (기존 메시지 중복 방지)
                if (!document.querySelector(`#${msg.id}`)) {
                    renderMessage(msg);
                }
            }
        });
        
        // 사용자가 스크롤을 맨 아래에 두고 있었을 경우에만 자동으로 스크롤 (PC 버전만)
        if (isScrolledToBottom && window.innerWidth > 768) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }, (error) => {
        console.error('실시간 메시지 리스너 오류:', error);
    });
}

// 이미지 로딩 CSS 추가
const imageLoadingStyles = `
<style>
.chat-profile-pic {
    transition: opacity 0.3s ease;
}

.chat-profile-pic.loading {
    opacity: 0.5;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: loading-shimmer 1.5s infinite;
}

.chat-profile-pic.loaded {
    opacity: 1;
}

.chat-profile-pic.error {
    opacity: 0.7;
    filter: grayscale(100%);
            }

@keyframes loading-shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}

:root.dark-mode .chat-profile-pic.loading {
    background: linear-gradient(90deg, #2a2a2a 25%, #3a3a3a 50%, #2a2a2a 75%);
    background-size: 200% 100%;
}
</style>
`;

// 스타일을 head에 추가
if (!document.querySelector('#chat-image-loading-styles')) {
    const styleElement = document.createElement('div');
    styleElement.id = 'chat-image-loading-styles';
    styleElement.innerHTML = imageLoadingStyles;
    document.head.appendChild(styleElement);
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
                timezone: 'Asia/Seoul',
            },
            localization: {
                timeFormatter: (time) => {
                    const date = new Date(time * 1000);
                    return date.toLocaleString('ko-KR', {
                        timeZone: 'Asia/Seoul',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    });
                },
                dateFormatter: (time) => {
                    const date = new Date(time * 1000);
                    return date.toLocaleDateString('ko-KR', {
                        timeZone: 'Asia/Seoul',
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                    });
                }
            }
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
    document.documentElement.addEventListener('themeChanged', (e) => {
        const isDarkMode = document.documentElement.classList.contains('dark-mode');
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
        coinSelector.addEventListener('change', (e => {
            handleCoinChange(e.target.value);
        }));
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
        const candlestickData = data.map(d => {
            const utcTime = d[0] / 1000;
            const koreanTime = utcTime + (9 * 60 * 60);
            
            return {
                time: koreanTime,
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
            };
        });
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
        
        const utcTime = kline.t / 1000;
        const koreanTime = utcTime + (9 * 60 * 60);
        
        candlestickSeries.update({
            time: koreanTime,
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
    if (!countEl) {
        console.log('chat-users-count 요소를 찾을 수 없습니다.');
        return;
    }
    
    console.log('실시간 참여인원 설정 시작');
    
    // 사용자가 로그인한 경우에만 presence 설정
    if (currentUser) {
        const userPresenceRef = dbRef(rtdb, `chat-presence/${currentUser.uid}`);
        
        // 사용자 온라인 상태 설정
        set(userPresenceRef, {
            displayName: currentUser.displayName,
            timestamp: Date.now()
        });
        
        // 연결 해제 시 자동으로 제거
        onDisconnect(userPresenceRef).remove();
    }
    
    // 전체 접속자 수 모니터링
    const allPresenceRef = dbRef(rtdb, 'chat-presence');
    onValue(allPresenceRef, (snap) => {
        const val = snap.val();
        const count = val ? Object.keys(val).length : 0;
        countEl.textContent = count;
        console.log('현재 접속자 수:', count);
    }, (error) => {
        console.error('실시간 참여인원 오류:', error);
        countEl.textContent = '0';
    });
}

// 페이지 로드 시와 사용자 인증 상태 변경 시 실행
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(setupChatPresenceCount, 1000); // 1초 후 실행
});

// 사용자 상태 변경 시에도 다시 설정
onAuthStateChanged(auth, (user) => {
    setTimeout(setupChatPresenceCount, 500); // 인증 상태 변경 후 0.5초 후 실행
}); 

// 일일 로그인 포인트 체크 및 추가
async function checkAndAddDailyLoginPoints() {
    if (!currentUser || !window.levelSystem) return;
    
    try {
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD 형식
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const lastLoginDate = userData.lastLoginDate;
            
            // 오늘 처음 로그인인 경우에만 포인트 지급
            if (lastLoginDate !== today) {
                await updateDoc(userRef, {
                    lastLoginDate: today
                });
                
                // 일일 로그인 포인트 추가
                await window.levelSystem.addPoints(currentUser.uid, 'daily_login');
                
                // 사용자에게 알림
                showDailyLoginNotification();
            }
        } else {
            // 새 사용자인 경우 오늘 날짜로 설정
            await updateDoc(userRef, {
                lastLoginDate: today
            });
        }
    } catch (error) {
        console.error('일일 로그인 포인트 체크 오류:', error);
    }
}

// 일일 로그인 알림 표시
function showDailyLoginNotification() {
    // 기존 알림이 있으면 제거
    const existingNotification = document.querySelector('.daily-login-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // 알림 생성
    const notification = document.createElement('div');
    notification.className = 'daily-login-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">🎁</div>
            <div class="notification-text">
                <h4>일일 로그인 보너스!</h4>
                <p>+2 포인트를 획득했습니다</p>
            </div>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // 5초 후 자동 제거
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
} 