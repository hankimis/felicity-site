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
    doc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';
import { triggerConfetti } from './effects.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM Elements ---
const messageForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('chat-messages');
const chartContainer = document.getElementById('chart-container');

let currentUser = null;
let messagesUnsubscribe = null;
let binanceSocket = null;

// --- Authentication Handler ---
onAuthStateChanged(auth, async (user) => {
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
        messagesUnsubscribe = null;
    }
    
    // Clear messages on any auth state change to prevent content flashing
    if (messagesContainer) messagesContainer.innerHTML = '';

    if (user) {
        // User is logged in
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        currentUser = userDoc.exists() 
            ? { uid: user.uid, ...userDoc.data() }
            : { uid: user.uid, displayName: user.displayName || 'Anonymous', level: 1, role: 'user' };
        
        if (!currentUser.photoURL) {
            currentUser.photoURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=random`;
        }
        
        if(messageForm) {
            if(messageInput) {
                messageInput.placeholder = "메시지를 입력하세요...";
                messageInput.disabled = false;
            }
            const submitButton = messageForm.querySelector('button');
            if(submitButton) submitButton.disabled = false;
        }
        loadAndDisplayMessages();

    } else {
        // User is signed out, allow viewing messages but disable input
        currentUser = null;
        
        if(messageForm) {
            if(messageInput) {
                messageInput.placeholder = "로그인 후 채팅에 참여할 수 있습니다.";
                messageInput.disabled = true;
            }
            const submitButton = messageForm.querySelector('button');
            if(submitButton) submitButton.disabled = true;
        }
        loadAndDisplayMessages();
    }
});

// --- Chat Functions ---
function loadAndDisplayMessages() {
    if (!messagesContainer) return;

    const messagesRef = collection(db, "community-chat");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    let isInitialLoad = true;

    messagesUnsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(change => {
            if (change.type === "added") {
                displayMessage(change.doc.id, change.doc.data(), !isInitialLoad);
            }
        });
        
        isInitialLoad = false;
        scrollToBottom();
    });
}

function displayMessage(docId, data, isNew) {
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
    messagesContainer.appendChild(messageElement);

    if (isNew && data.effect === 'confetti') triggerConfetti(messageElement);
}

function scrollToBottom() {
    if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

if (messageForm) {
    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return;

        const messageText = messageInput.value.trim();
        if (messageText) {
            try {
                await addDoc(collection(db, "community-chat"), {
                    text: messageText,
                    timestamp: serverTimestamp(),
                    uid: currentUser.uid,
                    displayName: currentUser.displayName,
                    level: currentUser.level,
                    role: currentUser.role,
                    photoURL: currentUser.photoURL,
                    effect: messageText.includes("영차") ? 'confetti' : null
                });
                messageInput.value = '';
                scrollToBottom();
            } catch (error) {
                console.error("Error sending message: ", error);
            }
        }
    });
}

// --- Lightweight Charts ---
if (chartContainer) {
    const chart = LightweightCharts.createChart(chartContainer, {
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

    const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderDownColor: '#ef5350',
        borderUpColor: '#26a69a',
        wickDownColor: '#ef5350',
        wickUpColor: '#26a69a',
    });
    
    async function fetchHistoricalData(interval) {
        try {
            const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=500`);
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
    
    function setupWebSocket(interval) {
        if (binanceSocket) {
            binanceSocket.close();
        }
        binanceSocket = new WebSocket(`wss://stream.binance.com:9443/ws/btcusdt@kline_${interval}`);
        binanceSocket.onmessage = function (event) {
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
    }

    const intervalButtons = document.getElementById('chart-intervals');
    intervalButtons.addEventListener('click', (e) => {
        if (e.target.matches('.interval-button')) {
            const newInterval = e.target.dataset.interval;
            intervalButtons.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            fetchHistoricalData(newInterval);
            setupWebSocket(newInterval);
        }
    });

    // Initial Load
    fetchHistoricalData('1m');
    setupWebSocket('1m');

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