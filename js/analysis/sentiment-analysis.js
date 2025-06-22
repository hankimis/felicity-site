/**
 * Sentiment Analysis Module
 * 공포탐욕지수 및 시장 감정을 분석하는 모듈
 */
export class SentimentAnalysis {
    constructor() {
        this.fearGreedIndex = {
            value: 50,
            label: '중립',
            lastUpdate: Date.now(),
            factors: {
                volatility: 50,
                volume: 50,
                social: 50,
                dominance: 50,
                trends: 50
            }
        };
        this.canvas = null;
        this.ctx = null;
        this.isTracking = false;
        
        this.init();
    }

    init() {
        console.log('🧠 Sentiment Analysis initializing...');
        this.setupCanvas();
        this.loadInitialData();
    }

    setupCanvas() {
        this.canvas = document.getElementById('fear-greed-canvas');
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
        }
    }

    async start() {
        if (this.isTracking) return;
        
        this.isTracking = true;
        console.log('🧠 Starting sentiment analysis...');
        
        // 초기 데이터 로드
        await this.loadInitialData();
        
        // 실시간 추적 시작
        this.startRealTimeTracking();
    }

    stop() {
        this.isTracking = false;
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
        }
        console.log('🧠 Sentiment analysis stopped');
    }

    async loadInitialData() {
        try {
            // 공포탐욕지수 API 호출 (Alternative.me API)
            await this.fetchFearGreedIndex();
            this.updateDisplay();
        } catch (error) {
            console.error('Error loading sentiment data:', error);
            this.generateSampleData();
        }
    }

    async fetchFearGreedIndex() {
        try {
            // Alternative.me 공포탐욕지수 API
            const response = await fetch('https://api.alternative.me/fng/?limit=1');
            const data = await response.json();
            
            if (data && data.data && data.data.length > 0) {
                const fngData = data.data[0];
                this.fearGreedIndex.value = parseInt(fngData.value);
                this.fearGreedIndex.label = fngData.value_classification;
                this.fearGreedIndex.lastUpdate = parseInt(fngData.timestamp) * 1000;
                
                // 구성 요소 시뮬레이션 (실제 API에서는 제공되지 않음)
                this.generateFactors();
            } else {
                throw new Error('Invalid fear & greed data');
            }
        } catch (error) {
            console.error('Error fetching fear & greed index:', error);
            // API 실패 시 시뮬레이션 데이터 사용
            this.generateSampleData();
        }
    }

    generateFactors() {
        const baseValue = this.fearGreedIndex.value;
        const variation = 15; // ±15 범위에서 변동
        
        this.fearGreedIndex.factors = {
            volatility: Math.max(0, Math.min(100, baseValue + (Math.random() - 0.5) * variation)),
            volume: Math.max(0, Math.min(100, baseValue + (Math.random() - 0.5) * variation)),
            social: Math.max(0, Math.min(100, baseValue + (Math.random() - 0.5) * variation)),
            dominance: Math.max(0, Math.min(100, baseValue + (Math.random() - 0.5) * variation)),
            trends: Math.max(0, Math.min(100, baseValue + (Math.random() - 0.5) * variation))
        };
    }

    generateSampleData() {
        const value = 30 + Math.random() * 40; // 30-70 범위
        
        this.fearGreedIndex = {
            value: Math.round(value),
            label: this.getIndexLabel(value),
            lastUpdate: Date.now(),
            factors: {
                volatility: Math.round(value + (Math.random() - 0.5) * 20),
                volume: Math.round(value + (Math.random() - 0.5) * 15),
                social: Math.round(value + (Math.random() - 0.5) * 25),
                dominance: Math.round(value + (Math.random() - 0.5) * 10),
                trends: Math.round(value + (Math.random() - 0.5) * 18)
            }
        };

        // 범위 조정
        Object.keys(this.fearGreedIndex.factors).forEach(key => {
            this.fearGreedIndex.factors[key] = Math.max(0, Math.min(100, this.fearGreedIndex.factors[key]));
        });
    }

    getIndexLabel(value) {
        if (value <= 25) return '극단적 공포';
        if (value <= 45) return '공포';
        if (value <= 55) return '중립';
        if (value <= 75) return '탐욕';
        return '극단적 탐욕';
    }

    startRealTimeTracking() {
        this.trackingInterval = setInterval(async () => {
            if (this.isTracking) {
                await this.updateSentimentData();
            }
        }, 300000); // 5분마다 업데이트
    }

    async updateSentimentData() {
        try {
            await this.fetchFearGreedIndex();
            this.updateDisplay();
        } catch (error) {
            console.error('Error updating sentiment data:', error);
        }
    }

    updateDisplay(data) {
        if (!data) return;

        const valueEl = document.getElementById('sentiment-value');
        const labelEl = document.getElementById('sentiment-label');

        if (valueEl) {
            valueEl.textContent = data.value;
        }
        if (labelEl) {
            labelEl.textContent = data.value_classification;
        }

        this.updateGauge(data.value);
    }

    initGauge() {
        const canvas = document.getElementById('sentiment-gauge');
        if (!canvas) {
            console.error('Sentiment gauge canvas not found!');
            return;
        }
        const ctx = canvas.getContext('2d');
        
        // This is a simplified gauge implementation using Chart.js doughnut chart
        this.gauge = new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [50, 50], // Initial value
                    backgroundColor: ['rgba(220, 53, 69, 0.8)', 'rgba(0, 0, 0, 0.1)'],
                    borderWidth: 0,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '80%',
                plugins: {
                    tooltip: { enabled: false },
                    legend: { display: false }
                }
            }
        });
        ctx.canvas.chart = this.gauge; // layout-manager에서 접근할 수 있도록 인스턴스 저장
    }

    updateGauge(value) {
        if (!this.gauge) return;
        const needleColor = value > 75 ? '#28a745' : value > 45 ? '#ffc107' : '#dc3545';
        this.gauge.data.datasets[0].data = [value, 100 - value];
        this.gauge.data.datasets[0].backgroundColor = [needleColor, 'rgba(0,0,0,0.1)'];
        this.gauge.update();
    }

    async refresh() {
        console.log('🧠 Refreshing sentiment analysis...');
        await this.loadInitialData();
        
        if (window.analysisDashboard) {
            window.analysisDashboard.showToast('감정분석 데이터가 업데이트되었습니다', 'success');
        }
    }

    // 외부에서 접근 가능한 메서드들
    getFearGreedIndex() {
        return this.fearGreedIndex;
    }

    getCurrentSentiment() {
        return {
            value: this.fearGreedIndex.value,
            label: this.fearGreedIndex.label,
            lastUpdate: this.fearGreedIndex.lastUpdate
        };
    }

    getFactors() {
        return this.fearGreedIndex.factors;
    }

    // 감정 상태에 따른 권장사항
    getRecommendation() {
        const value = this.fearGreedIndex.value;
        
        if (value <= 25) {
            return {
                signal: 'BUY',
                message: '극단적 공포 상태입니다. 매수 기회일 수 있습니다.',
                color: '#dc2626'
            };
        } else if (value <= 45) {
            return {
                signal: 'CAUTION_BUY',
                message: '공포 상태입니다. 신중한 매수를 고려해보세요.',
                color: '#ea580c'
            };
        } else if (value <= 55) {
            return {
                signal: 'HOLD',
                message: '중립 상태입니다. 현재 포지션을 유지하세요.',
                color: '#ca8a04'
            };
        } else if (value <= 75) {
            return {
                signal: 'CAUTION_SELL',
                message: '탐욕 상태입니다. 일부 매도를 고려해보세요.',
                color: '#16a34a'
            };
        } else {
            return {
                signal: 'SELL',
                message: '극단적 탐욕 상태입니다. 매도를 고려해보세요.',
                color: '#059669'
            };
        }
    }

    getSentiment() {
        return {
            value: this.fearGreedIndex.value,
            label: this.fearGreedIndex.label
        };
    }
} 