// Analysis Dashboard Configuration
const AnalysisConfig = {
    // API Endpoints
    api: {
        binance: {
            rest: 'https://api.binance.com/api/v3',
            websocket: 'wss://stream.binance.com:9443/ws'
        },
        mempool: {
            rest: 'https://mempool.space/api',
            websocket: 'wss://mempool.space/api/v1/ws'
        }
    },
    
    // Whale Detection Thresholds
    whale: {
        btc: {
            threshold: 50, // BTC
            usdThreshold: 5000000 // $5M
        },
        eth: {
            threshold: 1000, // ETH
            usdThreshold: 3400000 // $3.4M
        },
        updateInterval: 1000 // 1 second
    },
    
    // Trading Symbols
    symbols: {
        default: 'BTCUSDT',
        available: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'],
        prices: {
            BTCUSDT: 104000,
            ETHUSDT: 3400,
            ADAUSDT: 2.5,
            SOLUSDT: 200,
            BNBUSDT: 650,
            XRPUSDT: 2.1
        }
    },
    
    // Update Intervals (milliseconds)
    intervals: {
        realtime: 500,
        indicators: 5000,
        sentiment: 30000,
        orderbook: 1000,
        heatmap: 60000
    },
    
    // UI Settings
    ui: {
        maxWhaleTransactions: 200,
        maxRealtimeTrades: 100,
        maxOrderbookDepth: 20,
        animationDuration: 300
    },
    
    // Simulation Settings
    simulation: {
        enabled: true,
        whaleFrequency: 0.4, // 40% chance per interval
        tradeFrequency: 0.8, // 80% chance per interval
        priceVariation: 0.02 // 2% price variation
    },
    
    // Notification Settings
    notifications: {
        enabled: true,
        sound: true,
        duration: 3000,
        whaleThreshold: 10000000 // $10M for notifications
    },
    
    // Exchange Names Mapping
    exchanges: {
        '0x28c6c06298d514db089934071355e5743bf21d60': 'Binance',
        '0x21a31ee1afc51d94c2efccaa2092ad1028285549': 'Binance',
        '0x564286362092d8e7936f0549571a803b203aaced': 'Binance',
        '0x6262998ced04146fa42253a5c0af90ca02dfd2a3': 'Coinbase',
        '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43': 'Coinbase',
        '0x77696bb39917c91a0c3908d577d5e322095425ca': 'Coinbase'
    },
    
    // Color Schemes
    colors: {
        bullish: '#10b981',
        bearish: '#ef4444',
        neutral: '#6b7280',
        accent: '#f59e0b',
        secondary: '#3b82f6'
    },
    
    // Timeframes
    timeframes: ['5m', '15m', '1h', '4h', '1d', '1w'],
    
    // Technical Indicators
    indicators: [
        { key: 'rsi', name: 'RSI (14)', description: '상대강도지수' },
        { key: 'stochRsi', name: 'Stoch RSI', description: 'RSI 기반 스토캐스틱' },
        { key: 'macd', name: 'MACD', description: '이동평균수렴발산' },
        { key: 'ao', name: 'Awesome Osc.', description: '어썸 오실레이터' },
        { key: 'williamsR', name: 'Williams %R', description: '윌리엄스 %R' },
        { key: 'cci', name: 'CCI', description: '상품채널지수' },
        { key: 'sma', name: 'Moving Average', description: '이동평균' },
        { key: 'ichimoku', name: 'Ichimoku Cloud', description: '일목균형표' },
        { key: 'bb', name: 'Bollinger Bands', description: '볼린저 밴드' },
        { key: 'stoch', name: 'Stochastic', description: '스토캐스틱' },
        { key: 'mom', name: 'Momentum', description: '모멘텀' },
        { key: 'vo', name: 'Volume Oscillator', description: '거래량 오실레이터' },
        { key: 'psar', name: 'Parabolic SAR', description: '파라볼릭 SAR' },
        { key: 'adx', name: 'ADX', description: '평균방향성지수' },
        { key: 'obv', name: 'On-Balance Volume', description: 'OBV' },
        { key: 'mfi', name: 'Money Flow Index', description: '자금흐름지수' },
        { key: 'roc', name: 'Rate of Change', description: '가격변동률' },
        { key: 'keltner', name: 'Keltner Channel', description: '켈트너 채널' },
        { key: 'donchian', name: 'Donchian Channel', description: '돈치안 채널' },
        { key: 'aroon', name: 'Aroon', description: '아룬 지표' },
        { key: 'ultimate', name: 'Ultimate Osc.', description: '얼티미트 오실레이터' },
        { key: 'cmf', name: 'Chaikin Money Flow', description: '차이킨 자금 흐름' },
        { key: 'atr', name: 'ATR', description: '평균 변동폭' }
    ],
    
    // Heatmap Cryptocurrencies
    heatmapCoins: [
        { symbol: 'BTC', name: 'Bitcoin' },
        { symbol: 'ETH', name: 'Ethereum' },
        { symbol: 'ADA', name: 'Cardano' },
        { symbol: 'SOL', name: 'Solana' },
        { symbol: 'DOT', name: 'Polkadot' },
        { symbol: 'AVAX', name: 'Avalanche' },
        { symbol: 'LINK', name: 'Chainlink' },
        { symbol: 'UNI', name: 'Uniswap' },
        { symbol: 'MATIC', name: 'Polygon' },
        { symbol: 'ATOM', name: 'Cosmos' },
        { symbol: 'NEAR', name: 'NEAR Protocol' },
        { symbol: 'ALGO', name: 'Algorand' }
    ]
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalysisConfig;
} else {
    window.AnalysisConfig = AnalysisConfig;
} 