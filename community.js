window.onload = function() {

    // --- Anonymous User ID ---
    let anonymousId = sessionStorage.getItem('anonymousCommunityId');
    if (!anonymousId) {
        anonymousId = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        sessionStorage.setItem('anonymousCommunityId', anonymousId);
    }
    const anonymousUsername = `익명 ${anonymousId}`;

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

    // --- Local Chat Implementation ---
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const chatMessages = document.getElementById('chat-messages');

    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const messageText = messageInput.value.trim();
            if (messageText) {
                appendMessage(messageText, anonymousUsername);
                messageInput.value = '';
            }
        });
    }

    function appendMessage(text, sender) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'sent');
        
        messageElement.innerHTML = `
            <div class="message-sender">${sender}</div>
            <div class="message-text">${text}</div>
        `;

        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}; 