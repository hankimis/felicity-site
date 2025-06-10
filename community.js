import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Wait for the DOM to be fully loaded before running any script
document.addEventListener('DOMContentLoaded', () => {
    console.log('Community.js loaded and DOM ready');

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

    let app, auth, db, messagesCol, currentUser = null;

    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        messagesCol = collection(db, 'community-chat');
        console.log('Firebase initialized successfully');
    } catch (error) {
        console.error('Firebase initialization failed:', error);
        return;
    }

    // --- Elements ---
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const chatMessages = document.getElementById('chat-messages');

    // Check if essential elements exist
    if (!chatForm) {
        console.error('Chat form element not found');
        return;
    }
    if (!messageInput) {
        console.error('Message input element not found');
        return;
    }
    if (!chatMessages) {
        console.error('Chat messages container not found');
        return;
    }

    console.log('All chat elements found successfully');

    // --- Chat Functions ---
    function appendMessage(message) {
        if (!chatMessages || !message) {
            console.error('appendMessage: chatMessages 또는 message가 없음', { chatMessages, message });
            return;
        }

        console.log('Appending message:', message);

        const messageElement = document.createElement('div');
        messageElement.classList.add('message');

        if (currentUser && message.uid === currentUser.uid) {
            messageElement.classList.add('sent');
        } else {
            messageElement.classList.add('received');
        }

        // Sanitize message content to prevent XSS
        const sanitizedText = message.text ? message.text.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
        const sanitizedName = message.name ? message.name.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '익명';

        messageElement.innerHTML = `
            <div class="message-sender">${sanitizedName}</div>
            <div class="message-text">${sanitizedText}</div>
        `;

        // CSS 문제 해결을 위한 강제 스타일 적용
        messageElement.style.display = 'flex';
        messageElement.style.flexDirection = 'column';
        messageElement.style.marginBottom = '16px';
        messageElement.style.maxWidth = '70%';
        messageElement.style.visibility = 'visible';
        messageElement.style.opacity = '1';

        // 메시지 방향별 스타일
        if (currentUser && message.uid === currentUser.uid) {
            messageElement.style.alignSelf = 'flex-end';
            const textDiv = messageElement.querySelector('.message-text');
            if (textDiv) {
                textDiv.style.backgroundColor = '#3b82f6';
                textDiv.style.color = 'white';
                textDiv.style.padding = '10px 14px';
                textDiv.style.borderRadius = '14px';
                textDiv.style.borderTopRightRadius = '4px';
            }
            const senderDiv = messageElement.querySelector('.message-sender');
            if (senderDiv) {
                senderDiv.style.textAlign = 'right';
                senderDiv.style.fontSize = '0.85em';
                senderDiv.style.marginBottom = '6px';
                senderDiv.style.color = '#6b7280';
            }
        } else {
            messageElement.style.alignSelf = 'flex-start';
            const textDiv = messageElement.querySelector('.message-text');
            if (textDiv) {
                textDiv.style.backgroundColor = '#f3f4f6';
                textDiv.style.color = '#1f2937';
                textDiv.style.padding = '10px 14px';
                textDiv.style.borderRadius = '14px';
                textDiv.style.borderTopLeftRadius = '4px';
            }
            const senderDiv = messageElement.querySelector('.message-sender');
            if (senderDiv) {
                senderDiv.style.fontSize = '0.85em';
                senderDiv.style.marginBottom = '6px';
                senderDiv.style.color = '#6b7280';
            }
        }

        chatMessages.appendChild(messageElement);
        console.log('Message element added to DOM. Total messages in container:', chatMessages.children.length);

        // 새 메시지에만 confetti 효과 적용
        if (message.effect === 'confetti' && typeof confetti === 'function' && !message.hasFiredEffect) {
            // setTimeout으로 렌더링 후 효과를 실행하여 깨짐 현상 방지
            setTimeout(() => triggerDopamineBlast(messageElement), 50);
            message.hasFiredEffect = true; // 효과가 실행되었음을 표시 (중복 방지)
        }

        // 메시지가 추가될 때마다 맨 아래로 스크롤
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function triggerDopamineBlast(element) {
        if (!element || typeof confetti !== 'function') return;

        const rect = element.getBoundingClientRect();
        // 화면에 보이지 않는 요소에 대해서는 효과를 실행하지 않음
        if (rect.top > window.innerHeight || rect.bottom < 0) return;

        const origin = {
            x: (rect.left + rect.right) / 2 / window.innerWidth,
            y: (rect.top + rect.bottom) / 2 / window.innerHeight
        };

        function fire(particleRatio, opts) {
            confetti(Object.assign({}, {
                origin: origin,
                particleCount: Math.floor(200 * particleRatio),
                spread: 90,
                gravity: 0.7,
                scalar: 1.1,
                ticks: 150,
                colors: ['#26a69a', '#ef5350', '#ffc107', '#ffffff', '#2196f3']
            }, opts));
        }

        // 여러 겹의 화려한 폭발 효과
        fire(0.25, { spread: 30, startVelocity: 60 });
        fire(0.2, { spread: 60, startVelocity: 45 });
        fire(0.35, { spread: 120, decay: 0.91, scalar: 0.8 });
        fire(0.1, { spread: 130, startVelocity: 30, decay: 0.92, scalar: 1.2 });
        fire(0.1, { spread: 150, startVelocity: 50 });
    }

    function setupChat(user) {
        console.log('Setting up chat for user:', user.uid);
        currentUser = user;
        const uidLastPart = user.uid.substring(user.uid.length - 3);
        const anonymousUsername = `익명 ${uidLastPart}`;

        if (!chatMessages) {
            console.error('setupChat: chatMessages 요소를 찾을 수 없습니다');
            return;
        }
        
        chatMessages.innerHTML = '<div style="text-align: center; color: var(--text-color-secondary); padding: 20px;">채팅 기록을 불러오는 중...</div>';

        const q = query(messagesCol, orderBy('timestamp'));
        console.log('Setting up Firestore listener...');
        
        let isFirstLoad = true;
        onSnapshot(q, (snapshot) => {
            if (isFirstLoad) {
                chatMessages.innerHTML = ''; // 로딩 메시지 제거
                isFirstLoad = false;
            }

            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const messageData = change.doc.data();
                    appendMessage(messageData);
                }
            });
        }, (error) => {
            console.error("Firestore real-time listener failed:", error);
            if (chatMessages) {
                chatMessages.innerHTML = `
                    <div style="text-align: center; color: #ef5350; padding: 20px; background-color: var(--bg-secondary-color); border-radius: 8px; margin: 10px;">
                        <strong>채팅 연결 실패</strong><br>
                        <small>잠시 후 다시 시도해주세요.</small>
                    </div>
                `;
            }
            if (error.code === 'failed-precondition') {
                alert("Firestore 인덱스가 필요합니다. Firebase Console에서 'community-chat' 컬렉션의 'timestamp' 필드에 대한 복합 인덱스를 생성해주세요.");
            } else if (error.code === 'permission-denied') {
                alert("데이터베이스 접근 권한이 없습니다. Firestore 보안 규칙을 확인해주세요.");
            } else {
                alert("실시간 채팅 연결에 실패했습니다: " + error.message);
            }
        });

        if (chatForm) {
            chatForm.onsubmit = async (e) => {
                e.preventDefault();
                const messageText = messageInput.value.trim();
                
                if (!messageText) {
                    console.log('Empty message, not sending');
                    return;
                }
                
                if (!currentUser) {
                    console.error('No current user, cannot send message');
                    alert('사용자 인증이 필요합니다. 페이지를 새로고침해주세요.');
                    return;
                }
                
                console.log('Sending message:', messageText);
                
                try {
                    const messageData = {
                        uid: currentUser.uid,
                        name: anonymousUsername,
                        text: messageText,
                        timestamp: serverTimestamp()
                    };

                    if (messageText === '영차') {
                        messageData.effect = 'confetti';
                    }

                    await addDoc(messagesCol, messageData);
                    console.log('Message sent successfully');
                    messageInput.value = '';
                } catch (error) {
                    console.error("Error sending message: ", error);
                    alert('메시지 전송에 실패했습니다: ' + error.message);
                }
            };
        }
    }

    // --- Main Auth Logic ---
    console.log('Setting up auth state listener...');
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log('User authenticated:', user.uid);
            setupChat(user);
        } else {
            console.log('No user, signing in anonymously...');
            signInAnonymously(auth).catch((error) => {
                console.error("Anonymous sign-in failed:", error);
                alert('사용자 인증에 실패했습니다: ' + error.message);
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
                
                const candleData = data.map(d => ({
                    time: d[0] / 1000,
                    open: parseFloat(d[1]),
                    high: parseFloat(d[2]),
                    low: parseFloat(d[3]),
                    close: parseFloat(d[4]),
                }));
                
                candleSeries.setData(candleData);
                
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
}); 