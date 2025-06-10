window.onload = function() {

    // --- Firebase & Anonymous User Setup ---
    
    const firebaseConfig = {
        apiKey: "AIzaSyCbvgcol3P4wTUNh88-d9HPZl-2NC9WbqI",
        authDomain: "livechattest-35101.firebaseapp.com",
        databaseURL: "https://livechattest-35101-default-rtdb.asia-southeast1.firebasedatabase.app/",
        projectId: "livechattest-35101",
        storageBucket: "livechattest-35101.appspot.com",
        messagingSenderId: "880700591040",
        appId: "1:880700591040:web:a93e47bf19a9713a245625",
        measurementId: "G-ER1H2CCZW9"
    };

    // Initialize Firebase
    if (firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
    }
    const auth = firebase.auth();
    const db = firebase.database();
    const messagesRef = db.ref('community-chat');

    let currentUser = null;
    let anonymousUsername = '';

    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            // Generate a username based on the unique UID
            const uidLastPart = user.uid.substring(user.uid.length - 3);
            anonymousUsername = `익명 ${uidLastPart}`;
        } else {
            // Sign in anonymously if no user
            auth.signInAnonymously().catch((error) => {
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

        async function fetchInitialData() {
            try {
                const response = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=500');
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
                console.error('Failed to fetch initial chart data:', error);
            }
        }

        fetchInitialData().then(() => {
            const socket = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_1m');
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

    // --- Realtime Chat Implementation ---
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const chatMessages = document.getElementById('chat-messages');

    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const messageText = messageInput.value.trim();
            if (messageText && currentUser) {
                const newMessageRef = messagesRef.push();
                newMessageRef.set({
                    uid: currentUser.uid,
                    name: anonymousUsername,
                    text: messageText,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                });
                messageInput.value = '';
            }
        });
    }

    function appendMessage(message) {
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

    // Listen for new messages
    messagesRef.limitToLast(100).on('child_added', (snapshot) => {
        appendMessage(snapshot.val());
    });
}; 