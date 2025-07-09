// 🔥 마켓 데이터 관리자 (Market Data Manager)
class MarketDataManager {
    constructor() {
        this.currentSymbol = 'BTCUSDT';
        this.marketData = {};
        this.updateInterval = null;
        this.isUpdating = false;
        
        console.log('🔥 마켓 데이터 관리자 초기화');
    }

    // 🔥 데이터 업데이트 시작
    startUpdating(symbol = 'BTCUSDT') {
        this.currentSymbol = symbol;
        this.updateMarketData();
        
        // 10초마다 업데이트
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        this.updateInterval = setInterval(() => {
            this.updateMarketData();
        }, 10000);
        
        console.log(`✅ 마켓 데이터 업데이트 시작: ${symbol}`);
    }

    // 🔥 데이터 업데이트 중지
    stopUpdating() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        this.isUpdating = false;
        console.log('⏹️ 마켓 데이터 업데이트 중지');
    }

    // 🔥 마켓 데이터 가져오기
    async updateMarketData() {
        if (this.isUpdating) return;
        
        this.isUpdating = true;
        
        try {
            // 병렬로 여러 API 호출
            const [tickerData, statsData] = await Promise.all([
                this.fetchTickerData(),
                this.fetchStatsData()
            ]);

            this.marketData = {
                symbol: this.currentSymbol,
                price: parseFloat(tickerData.price),
                change: parseFloat(tickerData.priceChangePercent),
                markPrice: parseFloat(tickerData.price), // 현물에서는 가격과 동일
                indexPrice: parseFloat(tickerData.price), // 현물에서는 가격과 동일
                high24h: parseFloat(tickerData.highPrice),
                low24h: parseFloat(tickerData.lowPrice),
                volume24h: this.formatVolume(parseFloat(tickerData.volume)),
                volumeBTC: this.formatVolume(parseFloat(tickerData.quoteVolume)),
                positions: this.formatVolume(parseFloat(tickerData.count)), // 거래 횟수를 포지션으로 표시
                lastUpdate: new Date()
            };

            this.updateUI();
            
        } catch (error) {
            console.error('❌ 마켓 데이터 업데이트 실패:', error);
        } finally {
            this.isUpdating = false;
        }
    }

    // 🔥 티커 데이터 가져오기
    async fetchTickerData() {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${this.currentSymbol}`);
        if (!response.ok) {
            throw new Error('티커 데이터 가져오기 실패');
        }
        return await response.json();
    }

    // 🔥 통계 데이터 가져오기
    async fetchStatsData() {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${this.currentSymbol}`);
        if (!response.ok) {
            throw new Error('통계 데이터 가져오기 실패');
        }
        return await response.json();
    }

    // 🔥 볼륨 포맷팅
    formatVolume(volume) {
        if (volume >= 1000000000) {
            return (volume / 1000000000).toFixed(2) + 'B';
        } else if (volume >= 1000000) {
            return (volume / 1000000).toFixed(2) + 'M';
        } else if (volume >= 1000) {
            return (volume / 1000).toFixed(2) + 'K';
        } else {
            return volume.toFixed(2);
        }
    }

    // 🔥 가격 포맷팅
    formatPrice(price) {
        if (price >= 1000) {
            return price.toLocaleString('en-US', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
            });
        } else if (price >= 1) {
            return price.toFixed(2);
        } else {
            return price.toFixed(6);
        }
    }

    // 🔥 변동률 포맷팅
    formatChange(change) {
        const sign = change >= 0 ? '+' : '';
        return `${sign}${change.toFixed(2)}%`;
    }

    // 🔥 UI 업데이트
    updateUI() {
        const data = this.marketData;
        
        // 심볼 이름 업데이트
        const symbolName = document.querySelector('.symbol-name');
        if (symbolName) {
            symbolName.textContent = data.symbol.replace('USDT', '');
        }

        // 현재 가격 업데이트
        const currentPrice = document.querySelector('.current-price');
        if (currentPrice) {
            currentPrice.textContent = this.formatPrice(data.price);
        }

        // 변동률 업데이트
        const priceChange = document.querySelector('.price-change');
        if (priceChange) {
            priceChange.textContent = this.formatChange(data.change);
            priceChange.className = `price-change ${data.change >= 0 ? 'positive' : 'negative'}`;
        }

        // 마켓 데이터 업데이트
        this.updateMarketDataUI(data);
        
        console.log(`📊 UI 업데이트 완료: ${data.symbol}`);
    }

    // 🔥 마켓 데이터 UI 업데이트
    updateMarketDataUI(data) {
        const marketItems = document.querySelectorAll('.market-item');
        
        marketItems.forEach(item => {
            const label = item.querySelector('.market-label');
            const value = item.querySelector('.market-value');
            
            if (!label || !value) return;
            
            const labelText = label.textContent.trim();
            
            switch (labelText) {
                case 'Mark Price':
                    value.textContent = this.formatPrice(data.markPrice);
                    break;
                case 'Index Price':
                    value.textContent = this.formatPrice(data.indexPrice);
                    break;
                case '24h High':
                    value.textContent = this.formatPrice(data.high24h);
                    break;
                case '24h Low':
                    value.textContent = this.formatPrice(data.low24h);
                    break;
                case '24h Volume':
                    if (value.textContent.includes('BTC')) {
                        value.textContent = `${data.volumeBTC} (BTC)`;
                    } else {
                        value.textContent = data.volume24h;
                    }
                    break;
                case 'Positions':
                    value.textContent = `${data.positions} (BTC)`;
                    break;
            }
        });
    }

    // 🔥 심볼 변경
    changeSymbol(newSymbol) {
        if (newSymbol === this.currentSymbol) return;
        
        this.currentSymbol = newSymbol;
        this.startUpdating(newSymbol);
        
        console.log(`🔄 심볼 변경: ${newSymbol}`);
    }

    // 🔥 현재 마켓 데이터 반환
    getCurrentData() {
        return this.marketData;
    }

    // 🔥 특정 심볼의 데이터 가져오기
    async getSymbolData(symbol) {
        try {
            const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
            if (!response.ok) {
                throw new Error('심볼 데이터 가져오기 실패');
            }
            
            const data = await response.json();
            return {
                symbol: symbol,
                price: parseFloat(data.price),
                change: parseFloat(data.priceChangePercent),
                volume: parseFloat(data.volume),
                high: parseFloat(data.highPrice),
                low: parseFloat(data.lowPrice)
            };
        } catch (error) {
            console.error(`❌ ${symbol} 데이터 가져오기 실패:`, error);
            return null;
        }
    }

    // 🔥 인기 코인 목록 가져오기
    async getTopCoins(limit = 10) {
        try {
            const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
            if (!response.ok) {
                throw new Error('인기 코인 목록 가져오기 실패');
            }
            
            const data = await response.json();
            return data
                .filter(coin => coin.symbol.endsWith('USDT'))
                .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
                .slice(0, limit)
                .map(coin => ({
                    symbol: coin.symbol,
                    name: coin.symbol.replace('USDT', ''),
                    price: parseFloat(coin.lastPrice),
                    change: parseFloat(coin.priceChangePercent),
                    volume: parseFloat(coin.quoteVolume)
                }));
        } catch (error) {
            console.error('❌ 인기 코인 목록 가져오기 실패:', error);
            return [];
        }
    }

    // 🔥 실시간 가격 스트림 시작 (WebSocket)
    startPriceStream() {
        if (this.priceStream) {
            this.priceStream.close();
        }
        
        const streamUrl = `wss://stream.binance.com:9443/ws/${this.currentSymbol.toLowerCase()}@ticker`;
        this.priceStream = new WebSocket(streamUrl);
        
        this.priceStream.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                // 실시간 가격 업데이트
                const currentPrice = document.querySelector('.current-price');
                if (currentPrice) {
                    currentPrice.textContent = this.formatPrice(parseFloat(data.c));
                }
                
                // 실시간 변동률 업데이트
                const priceChange = document.querySelector('.price-change');
                if (priceChange) {
                    const change = parseFloat(data.P);
                    priceChange.textContent = this.formatChange(change);
                    priceChange.className = `price-change ${change >= 0 ? 'positive' : 'negative'}`;
                }
                
            } catch (error) {
                console.error('❌ 실시간 가격 데이터 처리 실패:', error);
            }
        };
        
        this.priceStream.onopen = () => {
            console.log(`🔗 실시간 가격 스트림 연결: ${this.currentSymbol}`);
        };
        
        this.priceStream.onerror = (error) => {
            console.error('❌ 실시간 가격 스트림 오류:', error);
        };
        
        this.priceStream.onclose = () => {
            console.log('🔌 실시간 가격 스트림 연결 종료');
        };
    }

    // 🔥 실시간 가격 스트림 중지
    stopPriceStream() {
        if (this.priceStream) {
            this.priceStream.close();
            this.priceStream = null;
        }
    }

    // 🔥 데이터 관리자 제거
    destroy() {
        this.stopUpdating();
        this.stopPriceStream();
        
        console.log('🗑️ 마켓 데이터 관리자 제거됨');
    }
}

// 🔥 전역으로 내보내기
window.MarketDataManager = MarketDataManager; 