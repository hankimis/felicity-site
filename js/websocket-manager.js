// WebSocket 관련 전역 변수
let websocket = null;
let activeSubscriptions = new Map();

// WebSocket 연결 관리
function connectWebSocket() {
    if (websocket !== null) {
        if (websocket.readyState === WebSocket.OPEN) return;
        websocket.close();
    }

    websocket = new WebSocket('wss://stream.binance.com:9443/ws');

    websocket.onopen = () => {
        console.log('WebSocket 연결됨');
        // 기존 구독 복구
        for (let [symbol, subscriptionInfo] of activeSubscriptions) {
            subscribeToSymbol(symbol, subscriptionInfo.resolution, subscriptionInfo.callback);
        }
    };

    websocket.onclose = () => {
        console.log('WebSocket 연결 끊김, 재연결 시도...');
        setTimeout(connectWebSocket, 5000);
    };

    websocket.onerror = (error) => {
        console.error('WebSocket 오류:', error);
    };

    websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.e === 'kline') {
            const subscription = activeSubscriptions.get(data.s);
            if (subscription) {
                const bar = {
                    time: data.k.t,
                    open: parseFloat(data.k.o),
                    high: parseFloat(data.k.h),
                    low: parseFloat(data.k.l),
                    close: parseFloat(data.k.c),
                    volume: parseFloat(data.k.v)
                };
                subscription.callback(bar);
            }
        }
    };
}

// 심볼 구독 함수
function subscribeToSymbol(symbol, resolution, callback) {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
        connectWebSocket();
    }

    const intervalMap = {
        '1': '1m', '3': '3m', '5': '5m', '15': '15m', '30': '30m',
        '60': '1h', '120': '2h', '240': '4h', '360': '6h', '480': '8h', '720': '12h',
        'D': '1d', 'W': '1w', 'M': '1M'
    };
    
    const interval = intervalMap[resolution] || '1h';
    const subscriptionMessage = {
        method: 'SUBSCRIBE',
        params: [`${symbol.toLowerCase()}@kline_${interval}`],
        id: Date.now()
    };

    activeSubscriptions.set(symbol, { resolution, callback });
    if (websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify(subscriptionMessage));
    }
}

// 심볼 구독 해제 함수
function unsubscribeFromSymbol(symbol) {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) return;

    const subscription = activeSubscriptions.get(symbol);
    if (!subscription) return;

    const intervalMap = {
        '1': '1m', '3': '3m', '5': '5m', '15': '15m', '30': '30m',
        '60': '1h', '120': '2h', '240': '4h', '360': '6h', '480': '8h', '720': '12h',
        'D': '1d', 'W': '1w', 'M': '1M'
    };
    
    const interval = intervalMap[subscription.resolution] || '1h';
    const unsubscribeMessage = {
        method: 'UNSUBSCRIBE',
        params: [`${symbol.toLowerCase()}@kline_${interval}`],
        id: Date.now()
    };

    websocket.send(JSON.stringify(unsubscribeMessage));
    activeSubscriptions.delete(symbol);
}

// 페이지 로드 시 WebSocket 연결 초기화
document.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();
});

// 페이지 언로드 시 WebSocket 정리
window.addEventListener('beforeunload', () => {
    if (websocket) {
        websocket.close();
    }
});

// 외부로 내보내기
window.WebSocketManager = {
    subscribeToSymbol,
    unsubscribeFromSymbol
}; 