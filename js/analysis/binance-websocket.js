// js/analysis/binance-websocket.js
// 바이낸스 웹소켓 실시간 데이터 수집기

export class BinanceWebSocket {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000;
        this.isConnected = false;
        this.dataCallbacks = new Map();
        this.lastTradePrice = null;
        this.orderBook = { bids: [], asks: [] };
        this.openInterest = null;
        this.fundingRate = null;
        this.longShortRatio = null;
    }

    // 웹소켓 연결
    connect() {
        try {
            // 여러 스트림을 하나의 웹소켓으로 연결
            const streams = [
                'btcusdt@trade',           // 실시간 거래
                'btcusdt@depth20@100ms',   // 오더북 (20레벨)
                'btcusdt@openInterest',    // 미결제 약정
                'btcusdt@fundingRate',     // 자금조달률
                'btcusdt@longShortRatio'   // 롱숏 비율
            ];
            
            const wsUrl = `wss://stream.binance.com:9443/ws/${streams.join('/')}`;
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('바이낸스 웹소켓 연결됨');
                this.isConnected = true;
                this.reconnectAttempts = 0;
            };

            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            };

            this.ws.onclose = () => {
                console.log('바이낸스 웹소켓 연결 끊어짐');
                this.isConnected = false;
                this.handleReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('바이낸스 웹소켓 오류:', error);
            };

        } catch (error) {
            console.error('웹소켓 연결 실패:', error);
            this.handleReconnect();
        }
    }

    // 메시지 처리
    handleMessage(data) {
        if (data.stream) {
            const stream = data.stream;
            const dataObj = data.data;

            switch (stream) {
                case 'btcusdt@trade':
                    this.handleTrade(dataObj);
                    break;
                case 'btcusdt@depth20@100ms':
                    this.handleOrderBook(dataObj);
                    break;
                case 'btcusdt@openInterest':
                    this.handleOpenInterest(dataObj);
                    break;
                case 'btcusdt@fundingRate':
                    this.handleFundingRate(dataObj);
                    break;
                case 'btcusdt@longShortRatio':
                    this.handleLongShortRatio(dataObj);
                    break;
            }
        }
    }

    // 거래 데이터 처리
    handleTrade(tradeData) {
        this.lastTradePrice = parseFloat(tradeData.p);
        const trade = {
            price: this.lastTradePrice,
            quantity: parseFloat(tradeData.q),
            time: tradeData.T,
            isBuyerMaker: tradeData.m,
            timestamp: Date.now()
        };

        this.emit('trade', trade);
    }

    // 오더북 데이터 처리
    handleOrderBook(orderBookData) {
        this.orderBook = {
            bids: orderBookData.bids.map(bid => ({
                price: parseFloat(bid[0]),
                quantity: parseFloat(bid[1])
            })),
            asks: orderBookData.asks.map(ask => ({
                price: parseFloat(ask[0]),
                quantity: parseFloat(ask[1])
            })),
            timestamp: Date.now()
        };

        this.emit('orderbook', this.orderBook);
    }

    // 미결제 약정 처리
    handleOpenInterest(oiData) {
        this.openInterest = {
            symbol: oiData.s,
            openInterest: parseFloat(oiData.o),
            openInterestValue: parseFloat(oiData.c),
            timestamp: Date.now()
        };

        this.emit('openInterest', this.openInterest);
    }

    // 자금조달률 처리
    handleFundingRate(frData) {
        this.fundingRate = {
            symbol: frData.s,
            fundingRate: parseFloat(frData.r),
            fundingTime: frData.T,
            timestamp: Date.now()
        };

        this.emit('fundingRate', this.fundingRate);
    }

    // 롱숏 비율 처리
    handleLongShortRatio(lsData) {
        this.longShortRatio = {
            symbol: lsData.s,
            longAccount: parseFloat(lsData.longAccount),
            shortAccount: parseFloat(lsData.shortAccount),
            longShortRatio: parseFloat(lsData.longShortRatio),
            timestamp: Date.now()
        };

        this.emit('longShortRatio', this.longShortRatio);
    }

    // 재연결 처리
    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`재연결 시도 ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
            
            setTimeout(() => {
                this.connect();
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            console.error('최대 재연결 시도 횟수 초과');
        }
    }

    // 이벤트 리스너 등록
    on(event, callback) {
        if (!this.dataCallbacks.has(event)) {
            this.dataCallbacks.set(event, []);
        }
        this.dataCallbacks.get(event).push(callback);
    }

    // 이벤트 발생
    emit(event, data) {
        const callbacks = this.dataCallbacks.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`이벤트 콜백 오류 (${event}):`, error);
                }
            });
        }
    }

    // 연결 해제
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }

    // 현재 상태 반환
    getStatus() {
        return {
            isConnected: this.isConnected,
            lastTradePrice: this.lastTradePrice,
            orderBookDepth: this.orderBook.bids.length + this.orderBook.asks.length,
            openInterest: this.openInterest,
            fundingRate: this.fundingRate,
            longShortRatio: this.longShortRatio
        };
    }
} 