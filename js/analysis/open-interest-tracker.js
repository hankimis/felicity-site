/**
 * Open Interest Tracker - CryptoQuant Style
 * 실제 바이낸스 API 데이터로 미결제 약정 + 가격 이중축 차트
 * 데이터 정확성 개선 + 기간 선택 기능 버전
 */

export class OpenInterestTracker {
    constructor(settings = {}) {
        this.settings = {
            defaultSymbol: 'BTCUSDT',
            period: '1h', // 1시간봉
            limit: 168, // 7일 = 168시간
            updateInterval: 60000, // 1분마다 업데이트
            ...settings
        };
        
        this.currentSymbol = this.settings.defaultSymbol;
        this.currentTimeframe = 'all'; // 기본 기간
        this.data = {
            timestamps: [],
            openInterestValues: [], // USD 기준 미결제 약정
            prices: [] // USD 가격
        };
        
        this.chart = null;
        this.updateTimer = null;
        this.isTracking = false;
        
        // DOM 요소
        this.chartCanvas = document.getElementById('open-interest-chart');
        this.timeframeButtons = document.querySelectorAll('.timeframe-btn');
        
        this.init();
    }

    async init() {
        try {
            await this.loadHistoricalData();
            this.setupChart();
            this.updateChart();
            this.setupEventListeners();
            
            // 데이터 검증 로그
            this.logDataValidation();
        } catch (error) {
            console.error('Open Interest Tracker 초기화 실패:', error);
        }
    }

    setupEventListeners() {
        // 기간 선택 버튼 이벤트
        this.timeframeButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const period = e.target.dataset.period;
                if (period && period !== this.currentTimeframe) {
                    await this.changeTimeframe(period);
                }
            });
        });
    }

    async changeTimeframe(timeframe) {
        // 기존 active 클래스 제거
        this.timeframeButtons.forEach(btn => btn.classList.remove('active'));
        
        // 새 버튼에 active 클래스 추가 및 로딩 상태
        const clickedBtn = document.querySelector(`[data-period="${timeframe}"]`);
        if (clickedBtn) {
            clickedBtn.classList.add('active', 'loading');
        }

        this.currentTimeframe = timeframe;
        
        // 기간별 설정 계산
        const config = this.getTimeframeConfig(timeframe);
        this.settings.period = config.interval;
        this.settings.limit = config.limit;

        console.log(`기간 변경: ${timeframe} - 인터벌: ${config.interval}, 제한: ${config.limit}`);

        try {
            await this.loadHistoricalData();
            this.updateChart();
        } catch (error) {
            console.error('기간 변경 실패:', error);
        } finally {
            // 로딩 상태 제거
            if (clickedBtn) {
                clickedBtn.classList.remove('loading');
            }
        }
    }

    getTimeframeConfig(timeframe) {
        const now = new Date();
        
        switch (timeframe) {
            case '1d':
                return {
                    interval: '15m', // 15분봉
                    limit: 96 // 24시간 = 96개 15분봉
                };
            case '1w':
                return {
                    interval: '1h', // 1시간봉
                    limit: 168 // 7일 = 168시간
                };
            case '1m':
                return {
                    interval: '4h', // 4시간봉
                    limit: 180 // 30일 = 180개 4시간봉
                };
            case '1y':
                return {
                    interval: '1d', // 1일봉
                    limit: 365 // 1년 = 365일
                };
            case 'ytd':
                const startOfYear = new Date(now.getFullYear(), 0, 1);
                const daysSinceStartOfYear = Math.ceil((now - startOfYear) / (1000 * 60 * 60 * 24));
                return {
                    interval: '1d', // 1일봉
                    limit: Math.min(daysSinceStartOfYear, 365)
                };
            case 'all':
            default:
                return {
                    interval: '1d', // 1일봉
                    limit: 500 // 최대 500일
                };
        }
    }

    logDataValidation() {
        if (this.data.timestamps.length > 0) {
            const latest = this.data.timestamps.length - 1;
            console.log('=== Open Interest 데이터 검증 ===');
            console.log(`심볼: ${this.currentSymbol}`);
            console.log(`기간: ${this.currentTimeframe}`);
            console.log(`인터벌: ${this.settings.period}`);
            console.log(`데이터 포인트: ${this.data.timestamps.length}개`);
            console.log(`최신 시간: ${this.data.timestamps[latest].toLocaleString('ko-KR')}`);
            console.log(`최신 미결제약정: $${(this.data.openInterestValues[latest] / 1e9).toFixed(2)}B`);
            console.log(`최신 가격: $${this.data.prices[latest]?.toLocaleString()}`);
            console.log('=====================================');
        }
    }

    async loadHistoricalData() {
        try {
            console.log(`${this.currentSymbol} 데이터 로딩 시작... (${this.currentTimeframe})`);
            
            // 1. 미결제 약정 히스토리 데이터 가져오기
            const oiUrl = `https://fapi.binance.com/futures/data/openInterestHist?symbol=${this.currentSymbol}&period=${this.settings.period}&limit=${this.settings.limit}`;
            console.log('OI API 호출:', oiUrl);
            
            const oiResponse = await fetch(oiUrl);
            if (!oiResponse.ok) {
                throw new Error(`OI API 오류: ${oiResponse.status} ${oiResponse.statusText}`);
            }
            const oiData = await oiResponse.json();
            console.log(`OI 데이터 수신: ${oiData.length}개`);

            if (!oiData || oiData.length === 0) {
                throw new Error('미결제 약정 데이터가 없습니다');
            }

            // 2. 실시간 미결제 약정과 가격 비교용 데이터
            const currentOiUrl = `https://fapi.binance.com/fapi/v1/openInterest?symbol=${this.currentSymbol}`;
            const currentPriceUrl = `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${this.currentSymbol}`;
            
            const [currentOiResponse, currentPriceResponse] = await Promise.all([
                fetch(currentOiUrl),
                fetch(currentPriceUrl)
            ]);

            const currentOi = await currentOiResponse.json();
            const currentPrice = await currentPriceResponse.json();

            console.log('실시간 미결제약정:', currentOi);
            console.log('실시간 가격:', currentPrice);

            // 3. 가격 데이터 시간 범위 맞추기
            const firstOiTime = oiData[0].timestamp;
            const lastOiTime = oiData[oiData.length - 1].timestamp;
            
            const priceUrl = `https://fapi.binance.com/fapi/v1/klines?symbol=${this.currentSymbol}&interval=${this.settings.period}&startTime=${firstOiTime}&endTime=${lastOiTime}&limit=${this.settings.limit}`;
            console.log('Price API 호출:', priceUrl);
            
            const priceResponse = await fetch(priceUrl);
            if (!priceResponse.ok) {
                throw new Error(`Price API 오류: ${priceResponse.status} ${priceResponse.statusText}`);
            }
            const priceData = await priceResponse.json();
            console.log(`Price 데이터 수신: ${priceData.length}개`);

            // 4. 데이터 매핑 - 시간 기준으로 정확히 매칭
            this.data.timestamps = [];
            this.data.openInterestValues = [];
            this.data.prices = [];

            // OI 데이터를 시간 기준 맵으로 변환
            const oiMap = new Map();
            oiData.forEach(item => {
                oiMap.set(item.timestamp, {
                    value: parseFloat(item.sumOpenInterestValue),
                    amount: parseFloat(item.sumOpenInterest)
                });
            });

            // Price 데이터를 시간 기준 맵으로 변환
            const priceMap = new Map();
            priceData.forEach(candle => {
                const timestamp = parseInt(candle[0]);
                const closePrice = parseFloat(candle[4]);
                priceMap.set(timestamp, closePrice);
            });

            // 공통 시간대만 사용
            const commonTimestamps = [...oiMap.keys()].filter(ts => priceMap.has(ts));
            commonTimestamps.sort((a, b) => a - b);

            console.log(`공통 시간대: ${commonTimestamps.length}개`);

            commonTimestamps.forEach(timestamp => {
                this.data.timestamps.push(new Date(timestamp));
                this.data.openInterestValues.push(oiMap.get(timestamp).value);
                this.data.prices.push(priceMap.get(timestamp));
            });

            // 5. 데이터 검증
            if (this.data.timestamps.length === 0) {
                throw new Error('매칭되는 데이터가 없습니다');
            }

            // 6. 최신 실시간 데이터와 비교
            const latestHistoricalOi = this.data.openInterestValues[this.data.openInterestValues.length - 1];
            const latestHistoricalPrice = this.data.prices[this.data.prices.length - 1];
            const currentOiValue = parseFloat(currentOi.openInterest) * parseFloat(currentPrice.price);

            console.log('=== 데이터 일관성 검증 ===');
            console.log(`히스토리 최신 OI Value: $${(latestHistoricalOi / 1e9).toFixed(2)}B`);
            console.log(`실시간 OI Value: $${(currentOiValue / 1e9).toFixed(2)}B`);
            console.log(`히스토리 최신 가격: $${latestHistoricalPrice.toLocaleString()}`);
            console.log(`실시간 가격: $${parseFloat(currentPrice.price).toLocaleString()}`);
            console.log('========================');

            console.log(`${this.currentSymbol} 데이터 로드 완료: ${this.data.timestamps.length}개 포인트`);

        } catch (error) {
            console.error('데이터 로드 실패:', error);
            // 실패시 빈 배열로 초기화
            this.data.timestamps = [];
            this.data.openInterestValues = [];
            this.data.prices = [];
        }
    }

    setupChart() {
        if (!this.chartCanvas || !this.data.timestamps.length) return;

        // 테마 감지
        const isDark = !document.body.classList.contains('light-mode');
        const bgColor = isDark ? '#181824' : '#ffffff';
        const oiColor = '#6366f1'; // 파란색 (미결제 약정)
        const priceColor = isDark ? '#ffffff' : '#1f2937'; // 흰색/검정 (가격)
        const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
        const fontColor = isDark ? '#e5e7eb' : '#374151';

        // 기존 차트 파괴
        if (this.chart) {
            this.chart.destroy();
        }

        this.chart = new Chart(this.chartCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: '미결제 약정 (Open Interest)',
                        data: [],
                        borderColor: oiColor,
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        borderWidth: 2.5,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        fill: false,
                        yAxisID: 'y',
                        tension: 0.1,
                    },
                    {
                        label: '가격(USD)',
                        data: [],
                        borderColor: priceColor,
                        backgroundColor: 'transparent',
                        borderWidth: 1.5,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        fill: false,
                        yAxisID: 'y1',
                        tension: 0.1,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'start',
                        labels: {
                            color: fontColor,
                            font: {
                                size: 12,
                                family: 'Pretendard, -apple-system, sans-serif'
                            },
                            usePointStyle: true,
                            pointStyle: 'line',
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                        titleColor: fontColor,
                        bodyColor: fontColor,
                        borderColor: isDark ? '#4b5563' : '#d1d5db',
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                            title: function(context) {
                                const date = new Date(context[0].label);
                                return date.toLocaleString('ko-KR', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    timeZone: 'UTC'
                                }) + ' UTC';
                            },
                            label: function(context) {
                                const value = context.parsed.y;
                                if (context.dataset.label.includes('Open Interest')) {
                                    return `미결제 약정: $${(value / 1e9).toFixed(2)}B`;
                                } else {
                                    return `가격: $${value.toLocaleString()}`;
                                }
                            }
                        }
                    }
                },
                layout: {
                    padding: {
                        left: 0,
                        right: 0,
                        top: 10,
                        bottom: 0
                    }
                },
                scales: {
                    x: {
                        display: true,
                        grid: {
                            color: gridColor,
                            lineWidth: 1
                        },
                        ticks: {
                            color: fontColor,
                            font: {
                                size: 11
                            },
                            maxTicksLimit: this.getXAxisTickCount(),
                            callback: (value, index, values) => {
                                if (this.data.timestamps && this.data.timestamps[index]) {
                                    return this.getTimeframeFormat(this.data.timestamps[index]);
                                }
                                return '';
                            }
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: false
                        },
                        grid: {
                            color: gridColor,
                            lineWidth: 1
                        },
                        ticks: {
                            color: oiColor,
                            font: {
                                size: 11,
                                weight: 'bold'
                            },
                            callback: function(value) {
                                if (value >= 1e9) {
                                    return (value / 1e9).toFixed(1) + 'B';
                                } else if (value >= 1e6) {
                                    return (value / 1e6).toFixed(1) + 'M';
                                }
                                return value.toLocaleString();
                            }
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: false
                        },
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: priceColor,
                            font: {
                                size: 11,
                                weight: 'bold'
                            },
                            callback: function(value) {
                                if (value >= 1000) {
                                    return '$' + (value / 1000).toFixed(0) + 'K';
                                }
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });

        // 차트 배경색 설정
        this.chartCanvas.style.backgroundColor = bgColor;

        // 테마 변경 감지 리스너 추가 (중복 방지)
        if (!window.__oi_theme_listener_added) {
            window.__oi_theme_listener_added = true;
            const observer = new MutationObserver(() => {
                if (this.chart) {
                    setTimeout(() => {
                        this.setupChart();
                        this.updateChart();
                    }, 100);
                }
            });
            observer.observe(document.body, {
                attributes: true,
                attributeFilter: ['class']
            });
        }
    }

    getXAxisTickCount() {
        switch (this.currentTimeframe) {
            case '1d': return 8;
            case '1w': return 7;
            case '1m': return 6;
            case '1y': return 12;
            case 'ytd': return 8;
            case 'all': return 10;
            default: return 8;
        }
    }

    getTimeframeFormat(date) {
        switch (this.currentTimeframe) {
            case '1d':
                return date.toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
            case '1w':
                return date.toLocaleDateString('ko-KR', {
                    month: 'short',
                    day: 'numeric'
                });
            case '1m':
                return date.toLocaleDateString('ko-KR', {
                    month: 'short',
                    day: 'numeric'
                });
            case '1y':
            case 'ytd':
                return date.toLocaleDateString('ko-KR', {
                    month: 'short'
                });
            case 'all':
            default:
                return date.toLocaleDateString('ko-KR', {
                    year: '2-digit',
                    month: 'short'
                });
        }
    }

    updateChart() {
        if (!this.chart || !this.data.timestamps.length) return;

        // 레이블과 데이터 업데이트
        this.chart.data.labels = this.data.timestamps;
        this.chart.data.datasets[0].data = this.data.openInterestValues;
        this.chart.data.datasets[1].data = this.data.prices;

        this.chart.update('none'); // 애니메이션 없이 업데이트
    }

    async fetchLatestData() {
        try {
            // 최신 1개 데이터만 가져오기
            const oiUrl = `https://fapi.binance.com/futures/data/openInterestHist?symbol=${this.currentSymbol}&period=${this.settings.period}&limit=1`;
            const priceUrl = `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${this.currentSymbol}`;

            const [oiResponse, priceResponse] = await Promise.all([
                fetch(oiUrl),
                fetch(priceUrl)
            ]);

            const oiData = await oiResponse.json();
            const priceData = await priceResponse.json();

            if (oiData && oiData.length > 0) {
                const latestOi = oiData[0];
                const latestPrice = parseFloat(priceData.price);
                const latestTime = new Date(latestOi.timestamp);

                // 새로운 데이터인지 확인
                const lastTime = this.data.timestamps[this.data.timestamps.length - 1];
                if (!lastTime || latestTime.getTime() > lastTime.getTime()) {
                    // 새 데이터 추가
                    this.data.timestamps.push(latestTime);
                    this.data.openInterestValues.push(parseFloat(latestOi.sumOpenInterestValue));
                    this.data.prices.push(latestPrice);

                    // 오래된 데이터 제거 (최대 limit개 유지)
                    if (this.data.timestamps.length > this.settings.limit) {
                        this.data.timestamps.shift();
                        this.data.openInterestValues.shift();
                        this.data.prices.shift();
                    }

                    this.updateChart();
                    
                    console.log(`새 데이터 업데이트: ${latestTime.toLocaleString('ko-KR')} - OI: $${(parseFloat(latestOi.sumOpenInterestValue) / 1e9).toFixed(2)}B, Price: $${latestPrice.toLocaleString()}`);
                }
            }
        } catch (error) {
            console.error('최신 데이터 업데이트 실패:', error);
        }
    }

    async start() {
        if (this.isTracking) return;
        
        this.isTracking = true;
        console.log('Open Interest 추적 시작');
        
        // 즉시 한 번 업데이트
        await this.fetchLatestData();
        
        // 정기 업데이트 시작
        this.updateTimer = setInterval(() => {
            this.fetchLatestData();
        }, this.settings.updateInterval);
    }

    stop() {
        if (!this.isTracking) return;
        
        this.isTracking = false;
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
        console.log('Open Interest 추적 중지');
    }

    async updateSymbol(newSymbol) {
        if (newSymbol === this.currentSymbol) return;
        
        this.stop();
        this.currentSymbol = newSymbol;
        
        console.log(`심볼 변경: ${newSymbol}`);
        await this.loadHistoricalData();
        this.updateChart();
        
        if (this.isTracking) {
            this.start();
        }
    }

    destroy() {
        this.stop();
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }

    // 테마 변경 처리
    onThemeChange() {
        this.setupChart();
        this.updateChart();
    }
}

// 전역 객체로 내보내기
window.OpenInterestTracker = OpenInterestTracker; 