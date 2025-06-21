class LiquidationMap {
    constructor() {
        this.symbol = 'BTCUSDT';
        this.timeframe = '1d';
        this.chart = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadData();
    }

    setupEventListeners() {
        document.getElementById('liquidation-map-symbol').addEventListener('change', (e) => {
            this.symbol = e.target.value;
            this.loadData();
        });
        document.getElementById('liquidation-map-timeframe').addEventListener('change', (e) => {
            this.timeframe = e.target.value;
            this.loadData();
        });
    }

    async loadData() {
        const loader = document.getElementById('liquidation-map-loader');
        const containerEl = document.getElementById('liquidation-map-container');
        
        if (loader) loader.style.display = 'flex';
        if (containerEl) containerEl.style.display = 'none';

        try {
            const liquidations = await this.fetchLiquidations();
            
            // Fetch current price separately to ensure it's up-to-date
            const tickerResponse = await axios.get('https://fapi.binance.com/fapi/v1/ticker/price', {
                params: { symbol: this.symbol }
            });
            const currentPrice = parseFloat(tickerResponse.data.price);


            if (!liquidations || liquidations.length === 0) {
                console.warn(`No liquidation data for ${this.symbol}`);
                // Handle no data case if necessary
                this.clearChart(currentPrice); // Clear chart but show current price
                return;
            }
            
            const processedData = this.processData(liquidations, currentPrice);
            this.renderChart(processedData, currentPrice);

        } catch (error) {
            console.error('Error loading liquidation map data:', error);
            if (error.response) {
                console.error('API Response Error:', error.response.data);
            }
        } finally {
            if (loader) loader.style.display = 'none';
            if (containerEl) containerEl.style.display = 'block';
        }
    }

    clearChart(currentPrice) {
        const ctx = document.getElementById('liquidation-map-chart').getContext('2d');
        if (this.chart) {
            this.chart.destroy();
        }
        // Render an empty chart with only the current price annotation
        this.renderChart({ liqByPrice: {}, sortedPrices: [], cumulativeData: {long: [], short: []} }, currentPrice);
    }

    async fetchLiquidations() {
        const now = await this.getBinanceServerTime();
        let startTime;
        switch (this.timeframe) {
            case '1h':
                startTime = now - 3600 * 1000;
                break;
            case '4h':
                startTime = now - 4 * 3600 * 1000;
                break;
            case '12h':
                startTime = now - 12 * 3600 * 1000;
                break;
            case '1d':
                startTime = now - 24 * 3600 * 1000;
                break;
            default:
                startTime = now - 3600 * 1000;
        }

        const params = {
            symbol: this.symbol,
            startTime: startTime,
            limit: 1000
        };

        const response = await axios.get('https://fapi.binance.com/fapi/v1/allForceOrders', { params });
        return response.data;
    }

    async getBinanceServerTime() {
        try {
            const response = await axios.get('https://fapi.binance.com/fapi/v1/time');
            return response.data.serverTime;
        } catch (error) {
            console.error('Error fetching Binance server time:', error);
            return Date.now(); // Fallback to local time
        }
    }

    processData(data, currentPrice) {
        const priceToString = (p) => p.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        const resolution = this.getResolution(currentPrice);
        
        const liqByPrice = data.reduce((acc, liq) => {
            const price = parseFloat(liq.price);
            const qty = parseFloat(liq.origQty);
            const value = price * qty;
            const priceLevel = Math.round(price / resolution) * resolution;
            
            if (!acc[priceLevel]) {
                acc[priceLevel] = { long: 0, short: 0, total: 0 };
            }
            
            if (liq.side === 'SELL') { // Long liquidation
                acc[priceLevel].long += value;
            } else { // Short liquidation
                acc[priceLevel].short += value;
            }
            acc[priceLevel].total += value;
            
            return acc;
        }, {});

        const sortedPrices = Object.keys(liqByPrice).map(Number).sort((a, b) => a - b);
        
        let cumulativeLong = 0;
        let cumulativeShort = 0;
        const cumulativeData = { long: [], short: [] };

        const allLiqs = [];
        sortedPrices.forEach(price => {
            const { long, short } = liqByPrice[price];
            allLiqs.push({ price, long, short });
        });

        allLiqs.sort((a,b) => b.price - a.price).forEach(d => {
            cumulativeShort += d.short;
            cumulativeData.short.unshift({x: d.price, y: cumulativeShort});
        });
        
        allLiqs.sort((a,b) => a.price - b.price).forEach(d => {
            cumulativeLong += d.long;
            cumulativeData.long.push({x: d.price, y: cumulativeLong});
        });

        return { liqByPrice, sortedPrices, cumulativeData };
    }

    getResolution(price) {
        if (price > 50000) return 100;
        if (price > 10000) return 50;
        if (price > 2000) return 10;
        if (price > 500) return 5;
        if (price > 100) return 1;
        if (price > 10) return 0.5;
        if (price > 1) return 0.1;
        return 0.01;
    }

    renderChart(data, currentPrice) {
        const { liqByPrice, sortedPrices, cumulativeData } = data;
        const ctx = document.getElementById('liquidation-map-chart').getContext('2d');

        if (this.chart) {
            this.chart.destroy();
        }

        // 테마에 맞는 동적 색상 설정
        const style = getComputedStyle(document.body);
        const textColor = style.getPropertyValue('--text-color-secondary') || 'rgba(255, 255, 255, 0.7)';
        const gridColor = style.getPropertyValue('--border-color') || 'rgba(255, 255, 255, 0.1)';
        const tooltipBgColor = style.getPropertyValue('--bg-secondary-color') || 'rgba(30, 41, 59, 0.9)';
        const tooltipColor = style.getPropertyValue('--text-color') || '#f1f5f9';

        const barColors = sortedPrices.map(p => {
            const value = liqByPrice[p].total;
            if (value > 1000000) return 'rgba(239, 68, 68, 0.8)'; // > 1M, Red
            if (value > 500000) return 'rgba(245, 158, 11, 0.8)'; // > 500k, Amber
            if (value > 100000) return 'rgba(234, 179, 8, 0.8)'; // > 100k, Yellow
            return 'rgba(34, 197, 94, 0.7)'; // Green
        });
        
        const longFillGradient = ctx.createLinearGradient(0, 0, 0, 400);
        longFillGradient.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
        longFillGradient.addColorStop(1, 'rgba(239, 68, 68, 0)');

        const shortFillGradient = ctx.createLinearGradient(0, 0, 0, 400);
        shortFillGradient.addColorStop(0, 'rgba(34, 197, 94, 0.4)');
        shortFillGradient.addColorStop(1, 'rgba(34, 197, 94, 0)');


        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedPrices,
                datasets: [
                    {
                        label: '청산량',
                        data: sortedPrices.map(p => liqByPrice[p].total),
                        backgroundColor: barColors,
                        yAxisID: 'y',
                        order: 2,
                    },
                    {
                        label: '누적 롱청산',
                        data: cumulativeData.long,
                        type: 'line',
                        borderColor: 'rgba(239, 68, 68, 0.8)',
                        backgroundColor: longFillGradient,
                        fill: true,
                        yAxisID: 'y1',
                        order: 1,
                        tension: 0.2,
                        pointRadius: 0,
                    },
                    {
                        label: '누적 숏청산',
                        data: cumulativeData.short,
                        type: 'line',
                        borderColor: 'rgba(34, 197, 94, 0.8)',
                        backgroundColor: shortFillGradient,
                        fill: true,
                        yAxisID: 'y1',
                        order: 1,
                        tension: 0.2,
                        pointRadius: 0,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear',
                        ticks: {
                           color: textColor,
                           callback: (value) => value.toLocaleString(),
                        },
                         grid: {
                            color: gridColor
                        }
                    },
                    y: {
                        position: 'left',
                        title: { display: true, text: '레버리지', color: textColor },
                        ticks: { 
                            color: textColor,
                            callback: (value) => `${value / 1e6}M` 
                        },
                        grid: {
                            color: gridColor
                        }
                    },
                    y1: {
                        position: 'right',
                        title: { display: true, text: '청산합', color: textColor },
                        ticks: { 
                            color: textColor,
                            callback: (value) => `${value / 1e6}M` 
                        },
                        grid: {
                            drawOnChartArea: false,
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false // We will create a custom HTML legend
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: tooltipBgColor,
                        titleColor: tooltipColor,
                        bodyColor: textColor,
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 12 },
                        padding: 12,
                        cornerRadius: 6,
                        displayColors: true,
                        callbacks: {
                            title: (tooltipItems) => `가격: ${tooltipItems[0].label}`,
                            label: (context) => {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += (context.parsed.y / 1e6).toFixed(2) + 'M';
                                }
                                return label;
                            }
                        }
                    },
                    annotation: {
                        annotations: {
                            currentPriceLine: {
                                type: 'line',
                                xMin: currentPrice,
                                xMax: currentPrice,
                                borderColor: 'rgb(255, 204, 0)',
                                borderWidth: 2,
                                borderDash: [6, 6],
                                label: {
                                    content: `현재가 ${Number(currentPrice).toLocaleString()}`,
                                    enabled: true,
                                    position: 'start',
                                    backgroundColor: 'rgba(255, 204, 0, 0.8)',
                                    color: '#000',
                                    font: {
                                        weight: 'bold'
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }
}

if (typeof window.LiquidationMap === 'undefined') {
    window.LiquidationMap = LiquidationMap;
    document.addEventListener('DOMContentLoaded', () => {
        new LiquidationMap();
    });
} 