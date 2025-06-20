/**
 * Mock Data Generator for Crypto Dashboard
 * 실제 API 대신 사용할 시뮬레이션 데이터 생성기
 */
class MockDataGenerator {
    constructor() {
        this.basePrice = {
            BTC: 45000,
            ETH: 3000,
            ADA: 0.5,
            SOL: 100
        };
        
        this.priceHistory = {};
        this.initialize();
    }

    initialize() {
        // 초기 가격 히스토리 생성
        Object.keys(this.basePrice).forEach(symbol => {
            this.priceHistory[symbol] = this.generatePriceHistory(this.basePrice[symbol]);
        });
    }

    // 가격 히스토리 생성
    generatePriceHistory(basePrice, periods = 100) {
        const history = [];
        let currentPrice = basePrice;
        
        for (let i = 0; i < periods; i++) {
            const change = (Math.random() - 0.5) * 0.02; // -1% ~ +1% 변동
            currentPrice = currentPrice * (1 + change);
            
            history.push({
                time: Date.now() - (periods - i) * 60000, // 1분 간격
                price: currentPrice,
                volume: Math.random() * 1000000
            });
        }
        
        return history;
    }

    // 실시간 가격 데이터 시뮬레이션
    generateRealtimePrice(symbol) {
        if (!this.priceHistory[symbol]) {
            this.priceHistory[symbol] = this.generatePriceHistory(this.basePrice[symbol] || 100);
        }

        const lastPrice = this.priceHistory[symbol][this.priceHistory[symbol].length - 1].price;
        const change = (Math.random() - 0.5) * 0.01; // -0.5% ~ +0.5% 변동
        const newPrice = lastPrice * (1 + change);

        const newData = {
            symbol: symbol + 'USDT',
            price: newPrice.toFixed(8),
            priceChange: change,
            priceChangePercent: (change * 100).toFixed(2),
            volume: Math.random() * 1000000,
            count: Math.floor(Math.random() * 1000),
            openTime: Date.now() - 24 * 60 * 60 * 1000,
            closeTime: Date.now(),
            lastPrice: newPrice.toFixed(8),
            bidPrice: (newPrice * 0.999).toFixed(8),
            askPrice: (newPrice * 1.001).toFixed(8)
        };

        // 히스토리에 추가
        this.priceHistory[symbol].push({
            time: Date.now(),
            price: newPrice,
            volume: newData.volume
        });

        // 히스토리 크기 제한
        if (this.priceHistory[symbol].length > 1000) {
            this.priceHistory[symbol] = this.priceHistory[symbol].slice(-1000);
        }

        return newData;
    }

    // 고래 거래 시뮬레이션
    generateWhaleTransactions() {
        const symbols = ['BTC', 'ETH'];
        const transactions = [];

        for (let i = 0; i < 5; i++) {
            const symbol = symbols[Math.floor(Math.random() * symbols.length)];
            const basePrice = this.basePrice[symbol];
            const amount = symbol === 'BTC' ? Math.random() * 100 + 50 : Math.random() * 1000 + 500;
            const type = Math.random() > 0.5 ? 'buy' : 'sell';

            transactions.push({
                id: `whale_${Date.now()}_${i}`,
                symbol: symbol,
                type: type,
                amount: amount,
                value: amount * basePrice,
                price: basePrice * (1 + (Math.random() - 0.5) * 0.02),
                timestamp: Date.now() - Math.random() * 3600000, // 지난 1시간 내
                confirmed: Math.random() > 0.2,
                exchange: ['Binance', 'Coinbase', 'Kraken'][Math.floor(Math.random() * 3)]
            });
        }

        return transactions;
    }

    // 청산 데이터 시뮬레이션
    generateLiquidationData() {
        const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT'];
        const liquidations = [];

        symbols.forEach(symbol => {
            const longLiq = Math.random() * 10000000; // 0-10M
            const shortLiq = Math.random() * 10000000;

            liquidations.push({
                symbol: symbol,
                side: 'LONG',
                quantity: longLiq.toFixed(2),
                price: this.basePrice[symbol.replace('USDT', '')] * (1 + (Math.random() - 0.5) * 0.1),
                timestamp: Date.now() - Math.random() * 86400000 // 지난 24시간 내
            });

            liquidations.push({
                symbol: symbol,
                side: 'SHORT',
                quantity: shortLiq.toFixed(2),
                price: this.basePrice[symbol.replace('USDT', '')] * (1 + (Math.random() - 0.5) * 0.1),
                timestamp: Date.now() - Math.random() * 86400000
            });
        });

        return liquidations;
    }

    // 롱숏 비율 시뮬레이션
    generateLongShortRatio(symbol) {
        const longRatio = 30 + Math.random() * 40; // 30-70%
        const shortRatio = 100 - longRatio;

        return {
            symbol: symbol,
            longAccount: longRatio.toFixed(2),
            longPosition: longRatio.toFixed(2),
            shortAccount: shortRatio.toFixed(2),
            shortPosition: shortRatio.toFixed(2),
            timestamp: Date.now()
        };
    }

    // 실시간 거래 시뮬레이션
    generateRealtimeTrades(symbol) {
        const trades = [];
        const basePrice = this.basePrice[symbol.replace('USDT', '')] || 100;

        for (let i = 0; i < 20; i++) {
            const isBuyer = Math.random() > 0.5;
            const price = basePrice * (1 + (Math.random() - 0.5) * 0.001);
            const quantity = Math.random() * 10;

            trades.push({
                id: Date.now() + i,
                price: price.toFixed(8),
                qty: quantity.toFixed(6),
                quoteQty: (price * quantity).toFixed(2),
                time: Date.now() - i * 1000,
                isBuyerMaker: isBuyer,
                isBestMatch: true
            });
        }

        return trades.reverse(); // 최신 순으로 정렬
    }

    // 오더북 시뮬레이션
    generateOrderbook(symbol) {
        const basePrice = this.basePrice[symbol.replace('USDT', '')] || 100;
        const bids = [];
        const asks = [];

        // Bids (매수 주문)
        for (let i = 0; i < 20; i++) {
            const price = basePrice * (1 - (i + 1) * 0.0001);
            const quantity = Math.random() * 10;
            bids.push([price.toFixed(8), quantity.toFixed(6)]);
        }

        // Asks (매도 주문)
        for (let i = 0; i < 20; i++) {
            const price = basePrice * (1 + (i + 1) * 0.0001);
            const quantity = Math.random() * 10;
            asks.push([price.toFixed(8), quantity.toFixed(6)]);
        }

        return {
            lastUpdateId: Date.now(),
            bids: bids,
            asks: asks
        };
    }

    // 공포탐욕지수 시뮬레이션
    generateFearGreedIndex() {
        const value = Math.floor(Math.random() * 100);
        let classification = '';

        if (value <= 25) classification = 'Extreme Fear';
        else if (value <= 45) classification = 'Fear';
        else if (value <= 55) classification = 'Neutral';
        else if (value <= 75) classification = 'Greed';
        else classification = 'Extreme Greed';

        return {
            value: value,
            value_classification: classification,
            timestamp: Date.now(),
            time_until_update: '23:59:59'
        };
    }

    // 기술지표 시뮬레이션
    generateTechnicalIndicators(symbol) {
        return {
            symbol: symbol,
            rsi: (20 + Math.random() * 60).toFixed(2), // 20-80
            macd: ((Math.random() - 0.5) * 100).toFixed(4),
            macdSignal: ((Math.random() - 0.5) * 100).toFixed(4),
            macdHistogram: ((Math.random() - 0.5) * 50).toFixed(4),
            bb_upper: this.basePrice[symbol.replace('USDT', '')] * 1.02,
            bb_middle: this.basePrice[symbol.replace('USDT', '')],
            bb_lower: this.basePrice[symbol.replace('USDT', '')] * 0.98,
            stoch_k: (Math.random() * 100).toFixed(2),
            stoch_d: (Math.random() * 100).toFixed(2),
            timestamp: Date.now()
        };
    }

    // 마켓 히트맵 데이터 시뮬레이션
    generateHeatmapData() {
        const coins = [
            'Bitcoin', 'Ethereum', 'Cardano', 'Solana', 'Polkadot', 'Chainlink',
            'Litecoin', 'Bitcoin Cash', 'Stellar', 'Dogecoin', 'Polygon', 'Avalanche',
            'Cosmos', 'Algorand', 'VeChain', 'Tezos', 'NEAR Protocol', 'Flow'
        ];

        return coins.map(coin => ({
            name: coin,
            symbol: coin.toUpperCase().replace(/\s/g, ''),
            price: Math.random() * 1000,
            change24h: (Math.random() - 0.5) * 20, // -10% ~ +10%
            marketCap: Math.random() * 100000000000, // 0-100B
            volume24h: Math.random() * 10000000000 // 0-10B
        }));
    }

    // 통합 API 시뮬레이터
    async simulateAPI(endpoint, params = {}) {
        // API 호출 지연 시뮬레이션
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

        try {
            switch (endpoint) {
                case 'ticker/24hr':
                    return this.generateRealtimePrice(params.symbol || 'BTC');
                
                case 'whale-transactions':
                    return this.generateWhaleTransactions();
                
                case 'liquidations':
                    return this.generateLiquidationData();
                
                case 'longshort-ratio':
                    return this.generateLongShortRatio(params.symbol || 'BTCUSDT');
                
                case 'recent-trades':
                    return this.generateRealtimeTrades(params.symbol || 'BTCUSDT');
                
                case 'orderbook':
                    return this.generateOrderbook(params.symbol || 'BTCUSDT');
                
                case 'fear-greed':
                    return this.generateFearGreedIndex();
                
                case 'technical-indicators':
                    return this.generateTechnicalIndicators(params.symbol || 'BTCUSDT');
                
                case 'heatmap':
                    return this.generateHeatmapData();
                
                default:
                    throw new Error(`Unknown endpoint: ${endpoint}`);
            }
        } catch (error) {
            console.error('Mock API Error:', error);
            throw error;
        }
    }

    // 실시간 데이터 스트림 시뮬레이션
    startRealtimeStream(callback, interval = 1000) {
        const streamInterval = setInterval(() => {
            const symbols = ['BTC', 'ETH', 'ADA', 'SOL'];
            const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
            const data = this.generateRealtimePrice(randomSymbol);
            callback(data);
        }, interval);

        return () => clearInterval(streamInterval);
    }
}

// 전역 인스턴스 생성
window.mockDataGenerator = new MockDataGenerator();

// 실제 API 호출을 모킹하는 헬퍼 함수
window.fetchCryptoData = async function(url, options = {}) {
    console.log('🔄 Fetching mock data for:', url);
    
    // URL에서 엔드포인트 추출
    let endpoint = '';
    let params = {};
    
    if (url.includes('ticker/24hr')) {
        endpoint = 'ticker/24hr';
        if (url.includes('symbol=')) {
            params.symbol = url.split('symbol=')[1].split('&')[0];
        }
    } else if (url.includes('liquidation')) {
        endpoint = 'liquidations';
    } else if (url.includes('longshort')) {
        endpoint = 'longshort-ratio';
    } else if (url.includes('trades')) {
        endpoint = 'recent-trades';
    } else if (url.includes('depth')) {
        endpoint = 'orderbook';
    }
    
    return window.mockDataGenerator.simulateAPI(endpoint, params);
};

console.log('✅ Mock Data Generator initialized');
console.log('💡 Use window.mockDataGenerator.simulateAPI() or window.fetchCryptoData() for testing'); 