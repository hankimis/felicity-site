// Analysis Dashboard Simulation Data Generator
class AnalysisSimulation {
    
    // Generate whale transaction
    static generateWhaleTransaction(type = 'random') {
        const cryptoType = type === 'random' ? 
            (Math.random() > 0.6 ? 'bitcoin' : 'ethereum') : type;
        
        let amount, usdValue;
        
        if (cryptoType === 'bitcoin') {
            // Realistic BTC whale amounts
            const rand = Math.random();
            if (rand < 0.6) {
                amount = Math.random() * 100 + 50; // 50-150 BTC
            } else if (rand < 0.85) {
                amount = Math.random() * 200 + 150; // 150-350 BTC
            } else if (rand < 0.95) {
                amount = Math.random() * 500 + 350; // 350-850 BTC
            } else {
                amount = Math.random() * 1000 + 850; // 850-1850 BTC
            }
            usdValue = amount * AnalysisConfig.symbols.prices.BTCUSDT;
        } else {
            // Realistic ETH whale amounts
            const rand = Math.random();
            if (rand < 0.6) {
                amount = Math.random() * 2000 + 1000; // 1000-3000 ETH
            } else if (rand < 0.85) {
                amount = Math.random() * 3000 + 3000; // 3000-6000 ETH
            } else if (rand < 0.95) {
                amount = Math.random() * 5000 + 6000; // 6000-11000 ETH
            } else {
                amount = Math.random() * 10000 + 11000; // 11000-21000 ETH
            }
            usdValue = amount * AnalysisConfig.symbols.prices.ETHUSDT;
        }
        
        return {
            id: this.generateId(),
            hash: cryptoType === 'bitcoin' ? 
                AnalysisUtils.generateRandomHash() : 
                '0x' + AnalysisUtils.generateRandomHash(),
            amount: amount,
            type: cryptoType,
            timestamp: Date.now(),
            fromAddress: AnalysisUtils.generateRandomAddress(),
            toAddress: AnalysisUtils.generateRandomAddress(),
            usdValue: usdValue,
            fee: Math.random() * 0.005 + 0.001,
            size: Math.floor(Math.random() * 300) + 200,
            confirmed: Math.random() > 0.3,
            blockHeight: Math.random() > 0.3 ? 
                Math.floor(Math.random() * 1000) + 875000 : null
        };
    }
    
    // Generate realistic trade
    static generateRealtimeTrade(symbol = 'BTCUSDT') {
        const basePrice = AnalysisConfig.symbols.prices[symbol] || 50000;
        const price = basePrice * (1 + (Math.random() - 0.5) * AnalysisConfig.simulation.priceVariation);
        const quantity = Math.random() * 10 + 0.1;
        const isBuy = Math.random() > 0.5;
        
        return {
            time: AnalysisUtils.formatTime(Date.now()),
            price: price.toFixed(symbol === 'ADAUSDT' ? 4 : 2),
            quantity: quantity.toFixed(4),
            type: isBuy ? 'buy' : 'sell',
            side: isBuy ? 'BUY' : 'SELL',
            amount: price * quantity,
            timestamp: Date.now(),
            symbol: symbol,
            exchange: this.getRandomExchange()
        };
    }
    
    // Generate orderbook data
    static generateOrderbook(symbol = 'BTCUSDT', depth = 20) {
        const basePrice = AnalysisConfig.symbols.prices[symbol] || 50000;
        const asks = [];
        const bids = [];
        
        // Generate asks (sell orders) - above current price
        for (let i = 0; i < depth; i++) {
            const price = basePrice * (1 + (i + 1) * 0.001);
            const quantity = Math.random() * 5 + 0.1;
            asks.push({
                price: price.toFixed(2),
                quantity: quantity.toFixed(4),
                total: (price * quantity).toFixed(2)
            });
        }
        
        // Generate bids (buy orders) - below current price
        for (let i = 0; i < depth; i++) {
            const price = basePrice * (1 - (i + 1) * 0.001);
            const quantity = Math.random() * 5 + 0.1;
            bids.push({
                price: price.toFixed(2),
                quantity: quantity.toFixed(4),
                total: (price * quantity).toFixed(2)
            });
        }
        
        return { asks, bids };
    }
    
    // Generate technical indicator values
    static generateTechnicalIndicators() {
        const indicators = {};
        
        AnalysisConfig.indicators.forEach(indicator => {
            switch(indicator.key) {
                case 'rsi':
                    indicators[indicator.key] = {
                        value: Math.random() * 100,
                        signal: this.getRSISignal(indicators[indicator.key]?.value || 50)
                    };
                    break;
                case 'macd':
                    indicators[indicator.key] = {
                        value: (Math.random() - 0.5) * 1000,
                        signal: Math.random() > 0.5 ? 'bullish' : 'bearish'
                    };
                    break;
                case 'stoch-rsi':
                    indicators[indicator.key] = {
                        value: Math.random() * 100,
                        signal: this.getStochSignal(indicators[indicator.key]?.value || 50)
                    };
                    break;
                default:
                    indicators[indicator.key] = {
                        value: (Math.random() - 0.5) * 100,
                        signal: ['bullish', 'bearish', 'neutral'][Math.floor(Math.random() * 3)]
                    };
            }
        });
        
        return indicators;
    }
    
    // Generate sentiment data
    static generateSentimentData() {
        const value = Math.floor(Math.random() * 100);
        let label = '';
        
        if (value <= 25) label = '극단적 공포';
        else if (value <= 45) label = '공포';
        else if (value <= 55) label = '중립';
        else if (value <= 75) label = '탐욕';
        else label = '극단적 탐욕';
        
        return { value, label };
    }
    
    // Generate heatmap data
    static generateHeatmapData() {
        return AnalysisConfig.heatmapCoins.map(coin => ({
            symbol: coin.symbol,
            name: coin.name,
            change: (Math.random() - 0.5) * 20, // -10% to +10%
            volume: Math.random() * 1000000 + 100000, // 100K to 1.1M
            price: Math.random() * 100 + 10,
            marketCap: Math.random() * 100000000000 + 1000000000 // 1B to 101B
        }));
    }
    
    // Generate long/short ratio data
    static generateLongShortRatio() {
        const longRatio = Math.random() * 60 + 20; // 20% to 80%
        const shortRatio = 100 - longRatio;
        
        let status = 'neutral';
        if (longRatio > 60) status = 'long-dominant';
        else if (longRatio < 40) status = 'short-dominant';
        
        return {
            long: longRatio,
            short: shortRatio,
            ratio: longRatio / shortRatio,
            status: status
        };
    }
    
    // Helper methods
    static generateId() {
        return 'sim_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    static getRandomExchange() {
        const exchanges = ['BINANCE', 'BYBIT', 'OKX', 'BITGET', 'MEXC', 'COINBASE'];
        return exchanges[Math.floor(Math.random() * exchanges.length)];
    }
    
    static getRSISignal(value) {
        if (value > 70) return 'overbought';
        if (value < 30) return 'oversold';
        return 'neutral';
    }
    
    static getStochSignal(value) {
        if (value > 80) return 'overbought';
        if (value < 20) return 'oversold';
        return 'neutral';
    }
    
    // Batch generation methods
    static generateMultipleWhaleTransactions(count = 10) {
        const transactions = [];
        for (let i = 0; i < count; i++) {
            const transaction = this.generateWhaleTransaction();
            transaction.timestamp = Date.now() - (i * Math.random() * 3600000); // Spread over time
            transactions.push(transaction);
        }
        return transactions.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    static generateMultipleRealtimeTrades(count = 20, symbol = 'BTCUSDT') {
        const trades = [];
        for (let i = 0; i < count; i++) {
            const trade = this.generateRealtimeTrade(symbol);
            trade.timestamp = Date.now() - (i * Math.random() * 60000); // Spread over 1 hour
            trades.push(trade);
        }
        return trades.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    // Continuous simulation
    static startContinuousSimulation(callback, interval = 2000) {
        return setInterval(() => {
            const data = {
                whale: Math.random() < AnalysisConfig.simulation.whaleFrequency ? 
                    this.generateWhaleTransaction() : null,
                trade: Math.random() < AnalysisConfig.simulation.tradeFrequency ? 
                    this.generateRealtimeTrade() : null,
                indicators: Math.random() < 0.1 ? // 10% chance
                    this.generateTechnicalIndicators() : null,
                sentiment: Math.random() < 0.05 ? // 5% chance
                    this.generateSentimentData() : null,
                longshort: Math.random() < 0.2 ? // 20% chance
                    this.generateLongShortRatio() : null
            };
            
            if (callback) callback(data);
        }, interval);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalysisSimulation;
} else {
    window.AnalysisSimulation = AnalysisSimulation;
} 