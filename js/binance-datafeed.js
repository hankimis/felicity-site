// Binance API 데이터피드 for TradingView
class BinanceDatafeed {
    constructor() {
        this.baseUrl = 'https://api.binance.com/api/v3';
        this.wsUrl = 'wss://stream.binance.com:9443/ws';
        this.subscribers = new Map();
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        console.log('🔥 Binance 데이터피드 초기화');
    }

    // TradingView 데이터피드 구성 정보
    onReady(callback) {
        setTimeout(() => {
            callback({
                supports_search: true,
                supports_group_request: false,
                supported_resolutions: ['1', '3', '5', '15', '30', '60', '120', '240', '360', '480', '720', '1D', '3D', '1W', '1M'],
                supports_marks: false,
                supports_timescale_marks: false,
                supports_time: true,
                exchanges: [
                    { value: 'BINANCE', name: 'Binance', desc: 'Binance' }
                ],
                symbols_types: [
                    { name: 'crypto', value: 'crypto' }
                ]
            });
        }, 0);
    }

    // 심볼 검색
    searchSymbols(userInput, exchange, symbolType, onResultReadyCallback) {
        console.log('🔍 심볼 검색:', userInput);
        
        fetch(`${this.baseUrl}/exchangeInfo`)
            .then(response => response.json())
            .then(data => {
                const symbols = data.symbols
                    .filter(symbol => 
                        symbol.status === 'TRADING' && 
                        (userInput === '' || symbol.symbol.includes(userInput.toUpperCase()))
                    )
                    .map(symbol => ({
                        symbol: symbol.symbol,
                        full_name: `BINANCE:${symbol.symbol}`,
                        description: `${symbol.baseAsset}/${symbol.quoteAsset}`,
                        exchange: 'BINANCE',
                        type: 'crypto'
                    }));
                
                onResultReadyCallback(symbols);
            })
            .catch(error => {
                console.error('심볼 검색 오류:', error);
                onResultReadyCallback([]);
            });
    }

    // 심볼 정보 조회
    resolveSymbol(symbolName, onSymbolResolvedCallback, onResolveErrorCallback) {
        console.log('🔍 심볼 정보 조회:', symbolName);
        
        const symbol = symbolName.replace('BINANCE:', '');
        
        fetch(`${this.baseUrl}/exchangeInfo?symbol=${symbol}`)
            .then(response => response.json())
            .then(data => {
                if (data.symbols && data.symbols.length > 0) {
                    const symbolInfo = data.symbols[0];
                    
                    const symbolData = {
                        name: symbol,
                        full_name: `BINANCE:${symbol}`,
                        description: `${symbolInfo.baseAsset}/${symbolInfo.quoteAsset}`,
                        type: 'crypto',
                        session: '24x7',
                        exchange: 'BINANCE',
                        listed_exchange: 'BINANCE',
                        timezone: 'Asia/Seoul',
                        format: 'price',
                        pricescale: this.getPriceScale(symbolInfo.filters),
                        minmov: 1,
                        has_intraday: true,
                        has_daily: true,
                        has_weekly_and_monthly: true,
                        supported_resolutions: ['1', '3', '5', '15', '30', '60', '120', '240', '360', '480', '720', '1D', '3D', '1W', '1M'],
                        volume_precision: 8,
                        data_status: 'streaming'
                    };
                    
                    onSymbolResolvedCallback(symbolData);
                } else {
                    onResolveErrorCallback('심볼을 찾을 수 없습니다');
                }
            })
            .catch(error => {
                console.error('심볼 정보 조회 오류:', error);
                onResolveErrorCallback('심볼 정보 조회 실패');
            });
    }

    // 가격 스케일 계산
    getPriceScale(filters) {
        const priceFilter = filters.find(f => f.filterType === 'PRICE_FILTER');
        if (priceFilter && priceFilter.tickSize) {
            const tickSize = parseFloat(priceFilter.tickSize);
            return Math.round(1 / tickSize);
        }
        return 100;
    }

    // 히스토리 데이터 가져오기
    getBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) {
        const { from, to, firstDataRequest } = periodParams;
        const symbol = symbolInfo.name;
        
        console.log('📊 히스토리 데이터 요청:', { symbol, resolution, from, to });
        
        const interval = this.convertResolution(resolution);
        const startTime = from * 1000;
        const endTime = to * 1000;
        
        const url = `${this.baseUrl}/klines?symbol=${symbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=1000`;
        
        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (Array.isArray(data)) {
                    const bars = data.map(kline => ({
                        time: parseInt(kline[0]),
                        open: parseFloat(kline[1]),
                        high: parseFloat(kline[2]),
                        low: parseFloat(kline[3]),
                        close: parseFloat(kline[4]),
                        volume: parseFloat(kline[5])
                    }));
                    
                    // 시간 순서 정렬
                    bars.sort((a, b) => a.time - b.time);
                    
                    console.log(`✅ ${bars.length}개 바 데이터 로드 완료`);
                    onHistoryCallback(bars, { noData: bars.length === 0 });
                } else {
                    console.error('잘못된 데이터 형식:', data);
                    onErrorCallback('데이터 형식 오류');
                }
            })
            .catch(error => {
                console.error('히스토리 데이터 오류:', error);
                onErrorCallback('히스토리 데이터 로드 실패');
            });
    }

    // 해상도 변환
    convertResolution(resolution) {
        const resolutionMap = {
            '1': '1m',
            '3': '3m',
            '5': '5m',
            '15': '15m',
            '30': '30m',
            '60': '1h',
            '120': '2h',
            '240': '4h',
            '360': '6h',
            '480': '8h',
            '720': '12h',
            '1D': '1d',
            '3D': '3d',
            '1W': '1w',
            '1M': '1M'
        };
        
        return resolutionMap[resolution] || '1h';
    }

    // 실시간 데이터 구독
    subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) {
        console.log('🔔 실시간 데이터 구독:', symbolInfo.name, resolution);
        
        const symbol = symbolInfo.name.toLowerCase();
        const interval = this.convertResolution(resolution);
        const channelString = `${symbol}@kline_${interval}`;
        
        this.subscribers.set(subscriberUID, {
            symbolInfo,
            resolution,
            onRealtimeCallback,
            channelString
        });
        
        console.log(`📡 구독 정보 저장: ${subscriberUID} -> ${channelString}`);
        
        this.connectWebSocket();
        this.subscribeToChannel(channelString);
        
        // 구독 상태 확인
        setTimeout(() => {
            console.log(`🔍 구독 상태 확인: ${this.subscribers.size}개 구독자, WebSocket 상태: ${this.ws ? this.ws.readyState : 'null'}`);
        }, 1000);
    }

    // 실시간 데이터 구독 해제
    unsubscribeBars(subscriberUID) {
        console.log('🔕 실시간 데이터 구독 해제:', subscriberUID);
        
        const subscriber = this.subscribers.get(subscriberUID);
        if (subscriber) {
            this.unsubscribeFromChannel(subscriber.channelString);
            this.subscribers.delete(subscriberUID);
        }
    }

    // WebSocket 연결
    connectWebSocket() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('🔌 WebSocket 이미 연결됨');
            return;
        }
        
        console.log('🔌 WebSocket 연결 시도');
        
        this.ws = new WebSocket(this.wsUrl);
        
        this.ws.onopen = () => {
            console.log('✅ WebSocket 연결 성공');
            this.reconnectAttempts = 0;
            
            // 연결 후 기존 구독 채널들 재구독
            this.subscribers.forEach(subscriber => {
                this.subscribeToChannel(subscriber.channelString);
            });
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            } catch (error) {
                console.error('WebSocket 메시지 파싱 오류:', error);
            }
        };
        
        this.ws.onclose = () => {
            console.log('🔌 WebSocket 연결 종료');
            this.reconnectWebSocket();
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket 오류:', error);
        };
    }

    // WebSocket 재연결
    reconnectWebSocket() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 WebSocket 재연결 시도 ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
            
            setTimeout(() => {
                this.connectWebSocket();
                // 기존 구독 채널 재구독
                this.subscribers.forEach(subscriber => {
                    this.subscribeToChannel(subscriber.channelString);
                });
            }, 3000 * this.reconnectAttempts);
        }
    }

    // 채널 구독
    subscribeToChannel(channelString) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const subscribeMsg = {
                method: 'SUBSCRIBE',
                params: [channelString],
                id: Date.now()
            };
            
            this.ws.send(JSON.stringify(subscribeMsg));
            console.log('📡 채널 구독:', channelString);
        }
    }

    // 채널 구독 해제
    unsubscribeFromChannel(channelString) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const unsubscribeMsg = {
                method: 'UNSUBSCRIBE',
                params: [channelString],
                id: Date.now()
            };
            
            this.ws.send(JSON.stringify(unsubscribeMsg));
            console.log('📡 채널 구독 해제:', channelString);
        }
    }

    // WebSocket 메시지 처리
    handleWebSocketMessage(data) {
        if (data.e === 'kline') {
            const kline = data.k;
            const symbol = kline.s;
            const interval = kline.i;
            const channelString = `${symbol.toLowerCase()}@kline_${interval}`;
            
            console.log(`📊 실시간 데이터 수신: ${symbol} ${interval} - ${kline.c}`);
            
            // 해당 채널을 구독하는 모든 구독자에게 데이터 전송
            this.subscribers.forEach(subscriber => {
                if (subscriber.channelString === channelString) {
                    const bar = {
                        time: parseInt(kline.t),
                        open: parseFloat(kline.o),
                        high: parseFloat(kline.h),
                        low: parseFloat(kline.l),
                        close: parseFloat(kline.c),
                        volume: parseFloat(kline.v)
                    };
                    
                    try {
                        subscriber.onRealtimeCallback(bar);
                        console.log(`✅ 실시간 데이터 전송 완료: ${symbol} ${interval}`);
                    } catch (error) {
                        console.error(`❌ 실시간 데이터 전송 실패: ${symbol} ${interval}`, error);
                    }
                }
            });
        }
    }

    // 서버 시간 가져오기
    getServerTime(callback) {
        fetch(`${this.baseUrl}/time`)
            .then(response => response.json())
            .then(data => {
                callback(Math.floor(data.serverTime / 1000));
            })
            .catch(error => {
                console.error('서버 시간 조회 오류:', error);
                callback(Math.floor(Date.now() / 1000));
            });
    }
}

// 전역으로 내보내기
window.BinanceDatafeed = BinanceDatafeed; 