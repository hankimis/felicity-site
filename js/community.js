function initializePage() {
    const theme = localStorage.getItem('theme') || 'light';
    const chartContainer = document.getElementById('chart-container');
    const loadingIndicator = document.getElementById('chart-loading');
    
    if (!chartContainer) {
        console.error('Chart container not found!');
        return;
    }

    function getChartProperties(theme) {
        const isDark = theme === 'dark';
        return {
            width: chartContainer.clientWidth,
            height: chartContainer.clientHeight,
            layout: {
                background: { color: isDark ? '#1a1a1a' : '#ffffff' },
                textColor: isDark ? '#e9ecef' : '#1a1a1a',
            },
            grid: {
                vertLines: { color: isDark ? '#404040' : '#e9ecef' },
                horzLines: { color: isDark ? '#404040' : '#e9ecef' },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
            rightPriceScale: {
                borderColor: isDark ? '#404040' : '#e9ecef',
            },
            timeScale: {
                borderColor: isDark ? '#404040' : '#e9ecef',
                rightOffset: 12,
                timeVisible: true,
                secondsVisible: false,
            },
        };
    }

    let chart = LightweightCharts.createChart(chartContainer, getChartProperties(theme));
    let candleSeries = chart.addCandlestickSeries({
      upColor: '#ef4444',
      downColor: '#3182f6',
      borderDownColor: '#3182f6',
      borderUpColor: '#ef4444',
      wickDownColor: '#3182f6',
      wickUpColor: '#ef4444',
    });

    function showLoading() {
        if(loadingIndicator) loadingIndicator.classList.add('show');
    }
    function hideLoading() {
        if(loadingIndicator) loadingIndicator.classList.remove('show');
    }

    async function loadChartData(symbol, interval) {
        showLoading();
        try {
            const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=1000`);
            const data = await response.json();
            const chartData = data.map(item => ({
                time: item[0] / 1000,
                open: parseFloat(item[1]),
                high: parseFloat(item[2]),
                low: parseFloat(item[3]),
                close: parseFloat(item[4])
            }));
            candleSeries.setData(chartData);
        } catch (error) {
            console.error('Error loading chart data:', error);
        } finally {
            hideLoading();
        }
    }

    // Resize chart on window resize
    new ResizeObserver(entries => {
        if (entries.length === 0 || entries[0].target !== chartContainer) { return; }
        const { width, height } = entries[0].contentRect;
        chart.applyOptions({ width, height });
    }).observe(chartContainer);

    // Initial load
    loadChartData('BTCUSDT', '1h');
    
    // Theme change handling
    const themeObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            if (mutation.attributeName === 'class') {
                const newTheme = document.documentElement.classList.contains('dark-mode') ? 'dark' : 'light';
                chart.applyOptions(getChartProperties(newTheme));
            }
        });
    });
    themeObserver.observe(document.documentElement, { attributes: true });

    // Chat functionality
    const messagesRef = window.db.ref('chat_messages');
    const chatMessages = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const usersCount = document.getElementById('chat-users-count-number');
    const connectedUsersRef = window.db.ref('connected_users');

    // User connection status
    const myConnectionRef = connectedUsersRef.push();
    window.db.ref('.info/connected').on('value', snap => {
        if (snap.val() === true) {
            myConnectionRef.onDisconnect().remove();
            myConnectionRef.set(true);
        }
    });

    connectedUsersRef.on('value', snap => {
        if(usersCount) usersCount.textContent = snap.numChildren();
    });

    chatForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (messageInput.value && window.currentUser) {
            messagesRef.push({
                userId: window.currentUser.uid,
                displayName: window.currentUser.displayName || 'Anonymous',
                text: messageInput.value,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
            messageInput.value = '';
        } else if (!window.currentUser) {
            alert('Please log in to chat.');
        }
    });

    messagesRef.limitToLast(100).on('child_added', function (snapshot) {
        const message = snapshot.val();
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message');
        if (message.userId === window.currentUser?.uid) {
            messageElement.classList.add('my-message');
        }
        
        const timestamp = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'});
        
        messageElement.innerHTML = `
            <div class="message-sender">${message.displayName}</div>
            <div class="message-content">${message.text}</div>
            <div class="message-timestamp">${timestamp}</div>
        `;
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
} 