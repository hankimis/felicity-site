import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Firebase & Anonymous User Setup ---
const firebaseConfig = {
    apiKey: "AIzaSyCbvgcol3P4wTUNh88-d9HPZl-2NC9WbqI",
    authDomain: "livechattest-35101.firebaseapp.com",
    projectId: "livechattest-35101",
    storageBucket: "livechattest-35101.firebasestorage.app",
    messagingSenderId: "880700591040",
    appId: "1:880700591040:web:a93e47bf19a9713a245625",
    measurementId: "G-ER1H2CCZW9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const messagesCol = collection(db, 'community-chat');
let currentUser = null;

// --- Elements ---
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const chatMessages = document.getElementById('chat-messages');

// --- Functions ---
function appendMessage(message) {
    if (!chatMessages) return;
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    if (currentUser && message.uid === currentUser.uid) {
        messageElement.classList.add('sent');
    } else {
        messageElement.classList.add('received');
    }
    
    messageElement.innerHTML = `
        <div class="message-sender">${message.name}</div>
        <div class="message-text">${message.text}</div>
    `;

    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setupChat(user) {
    currentUser = user;
    const uidLastPart = user.uid.substring(user.uid.length - 3);
    const anonymousUsername = `익명 ${uidLastPart}`;

    if (chatMessages) {
        chatMessages.innerHTML = '';
    }

    const q = query(messagesCol, orderBy('timestamp'), limit(100));
    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                appendMessage(change.doc.data());
            }
        });
    });

    if (chatForm) {
        chatForm.onsubmit = async (e) => {
            e.preventDefault();
            const messageText = messageInput.value.trim();
            if (messageText && currentUser) {
                try {
                    await addDoc(messagesCol, {
                        uid: currentUser.uid,
                        name: anonymousUsername,
                        text: messageText,
                        timestamp: serverTimestamp()
                    });
                    messageInput.value = '';
                } catch (error) {
                    console.error("Error sending message: ", error);
                }
            }
        };
    }
}

// --- Main Auth Logic ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        setupChat(user); 
    } else {
        signInAnonymously(auth).catch((error) => {
            console.error("Anonymous sign-in failed:", error);
        });
    }
});

// --- Lightweight Charts Implementation ---
const chartContainer = document.getElementById('chart-container');

function getChartOptions() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#f1f3f5';
    const textColor = isDarkMode ? '#f0f0f0' : '#212529';
    const borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.2)' : '#e0e6ed';

    return {
        layout: {
            backgroundColor: 'transparent',
            textColor: textColor,
        },
        grid: {
            vertLines: { color: gridColor },
            horzLines: { color: gridColor },
        },
        timeScale: {
            borderColor: borderColor,
        },
    };
}

if (chartContainer) {
    const chart = LightweightCharts.createChart(chartContainer, {
        width: chartContainer.clientWidth,
        height: chartContainer.clientHeight,
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
        ...getChartOptions(),
    });

    const candleSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderDownColor: '#ef5350',
        borderUpColor: '#26a69a',
        wickDownColor: '#ef5350',
        wickUpColor: '#26a69a',
    });

    let currentInterval = '1m';
    let socket = null;

    async function loadChartData(interval) {
        try {
            const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=500`);
            const data = await response.json();
            
            const formattedData = data.map(d => ({
                time: d[0] / 1000,
                open: parseFloat(d[1]),
                high: parseFloat(d[2]),
                low: parseFloat(d[3]),
                close: parseFloat(d[4]),
            }));
            
            candleSeries.setData(formattedData);
            
        } catch (error) {
            console.error(`Failed to fetch chart data for interval ${interval}:`, error);
        }
    }

    function setupWebSocket(interval) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.close();
        }

        socket = new WebSocket(`wss://stream.binance.com:9443/ws/btcusdt@kline_${interval}`);
        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            const kline = message.k;
            candleSeries.update({
                time: kline.t / 1000,
                open: parseFloat(kline.o),
                high: parseFloat(kline.h),
                low: parseFloat(kline.l),
                close: parseFloat(kline.c),
            });
        };
    }

    const intervalContainer = document.getElementById('chart-intervals');
    if(intervalContainer) {
        intervalContainer.addEventListener('click', (e) => {
            if (e.target.matches('.interval-button')) {
                const newInterval = e.target.dataset.interval;
                if (newInterval === currentInterval) return;

                const currentActive = intervalContainer.querySelector('.active');
                if (currentActive) {
                    currentActive.classList.remove('active');
                }
                e.target.classList.add('active');

                currentInterval = newInterval;
                loadChartData(currentInterval).then(() => {
                    setupWebSocket(currentInterval);
                });
            }
        });
    }

    // Initial load
    loadChartData(currentInterval).then(() => {
        setupWebSocket(currentInterval);
    });
    
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                chart.applyOptions(getChartOptions());
            }
        });
    });
    observer.observe(document.body, { attributes: true });

    new ResizeObserver(entries => {
        if (entries.length === 0 || entries[0].target !== chartContainer) { return; }
        const newRect = entries[0].contentRect;
        chart.applyOptions({ width: newRect.width, height: newRect.height });
    }).observe(chartContainer);
} 