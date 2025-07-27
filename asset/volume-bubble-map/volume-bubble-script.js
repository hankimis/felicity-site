class VolumeBubbleMapManager {
  constructor() {
    this.currentSymbol = 'BTCUSDT';
    this.currentPeriod = 'all';
    this.chart = null;
    this.bubbleData = [];
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadData();
  }

  bindEvents() {
    // Symbol selector
    document.getElementById('symbol-select').addEventListener('change', (e) => {
      this.currentSymbol = e.target.value;
      this.loadData();
    });

    // Timeframe buttons
    document.querySelectorAll('.timeframe-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentPeriod = e.target.dataset.period;
        this.loadData();
      });
    });
  }

  async loadData() {
    try {
      this.showLoading();
      
      // Chart.js 로딩
      await this.loadChartJS();
      
      const data = await this.fetchData();
      this.bubbleData = this.processData(data);
      await this.renderChart();
      this.updateStats();
    } catch (error) {
      this.handleError(error);
    } finally {
      this.hideLoading();
    }
  }

  async loadChartJS() {
    return new Promise((resolve, reject) => {
      if (window.Chart) {
        resolve(window.Chart);
        return;
      }
      
      const script1 = document.createElement('script');
      script1.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      script1.onload = () => {
        const script2 = document.createElement('script');
        script2.src = 'https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns';
        script2.onload = () => resolve(window.Chart);
        script2.onerror = reject;
        document.head.appendChild(script2);
      };
      script1.onerror = reject;
      document.head.appendChild(script1);
    });
  }

  async fetchData() {
    const limit = this.getLimitByPeriod();
    const url = `https://api.binance.com/api/v3/klines?symbol=${this.currentSymbol}&interval=1d&limit=${limit}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw new Error(`Data loading failed: ${error.message}`);
    }
  }

  getLimitByPeriod() {
    const limits = {
      '1d': 24,
      '1w': 168,
      '1m': 720,
      '1y': 8760,
      'all': 1000
    };
    return limits[this.currentPeriod] || 1000;
  }

  processData(klinesData) {
    const processedData = [];
    
    klinesData.forEach((kline, index) => {
      const [openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, takerBuyBase, takerBuyQuote, ignore] = kline;
      
      const time = new Date(openTime);
      const price = parseFloat(close);
      const volumeValue = parseFloat(volume);
      
      // Calculate volume change rate
      let volumeChangeRate = 0;
      if (index > 0) {
        const prevVolume = parseFloat(klinesData[index-1][5]);
        volumeChangeRate = ((volumeValue - prevVolume) / prevVolume) * 100;
      }
      
      // Determine volume status
      let volumeStatus = 'neutral';
      if (volumeChangeRate < -5) {
        volumeStatus = 'cooling';
      } else if (volumeChangeRate > 20) {
        volumeStatus = 'overheating';
      } else if (volumeChangeRate > 5) {
        volumeStatus = 'heating';
      }
      
      // Calculate bubble size (normalized volume)
      const maxVolume = Math.max(...klinesData.map(k => parseFloat(k[5])));
      const minVolume = Math.min(...klinesData.map(k => parseFloat(k[5])));
      const normalizedVolume = (volumeValue - minVolume) / (maxVolume - minVolume);
      const bubbleSize = Math.max(5, normalizedVolume * 30); // Min 5px, max 35px
      
      processedData.push({
        time: time,
        price: price,
        volume: volumeValue,
        volumeChangeRate: volumeChangeRate,
        volumeStatus: volumeStatus,
        bubbleSize: bubbleSize
      });
    });
    
    return processedData;
  }

  async renderChart() {
    const chartArea = document.getElementById('chart-area');
    chartArea.innerHTML = '';
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.id = 'bubble-chart';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    chartArea.appendChild(canvas);
    
    // Add watermark
    const watermark = document.createElement('div');
    watermark.className = 'watermark';
    watermark.textContent = 'ONBIT';
    chartArea.appendChild(watermark);

    // Destroy previous chart
    if (this.chart) {
      this.chart.destroy();
    }

    // Check if Chart.js is loaded
    if (!window.Chart) {
      throw new Error('Chart.js가 로드되지 않았습니다.');
    }

    // Create datasets for each status
    const datasets = this.createDatasets();

    // Create chart
    this.chart = new Chart(canvas, {
      type: 'scatter',
      data: {
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'nearest'
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            borderColor: '#333333',
            borderWidth: 1,
            cornerRadius: 6,
            displayColors: true,
            callbacks: {
              title: function(context) {
                if (!context || context.length === 0 || !context[0]) return '';
                const dataPoint = context[0].parsed || context[0].raw;
                if (!dataPoint || !dataPoint.x) return '';
                const date = new Date(dataPoint.x);
                return date.toISOString().split('T')[0].replace(/-/g, ' ') + ' UTC';
              },
              label: function(context) {
                if (!context || context.length === 0 || !context[0]) return [];
                const dataPoint = context[0].parsed || context[0].raw;
                if (!dataPoint) return [];
                
                const statusText = {
                  'neutral': '중립',
                  'cooling': '냉각',
                  'heating': '과열',
                  'overheating': '매우 과열'
                };
                
                // 데이터셋 라벨에서 상태 정보 가져오기
                const datasetLabel = context[0].dataset?.label || '';
                const statusKey = datasetLabel.toLowerCase();
                
                return [
                  `상태: ${statusText[statusKey] || '알 수 없음'}`,
                  `가격: $${(dataPoint.y / 1000).toFixed(4)}K`,
                  `거래량: ${(dataPoint.r / 1000000000).toFixed(4)}B`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'day',
              displayFormats: {
                day: 'yyyy MM dd'
              }
            },
            grid: {
              color: 'rgba(59, 130, 246, 0.2)',
              borderColor: 'rgba(59, 130, 246, 0.3)',
              borderDash: [5, 5]
            },
            ticks: {
              color: '#cccccc',
              maxTicksLimit: 8,
              font: { size: 11 }
            },
            border: {
              color: 'rgba(59, 130, 246, 0.3)'
            }
          },
          y: {
            type: 'logarithmic',
            position: 'right',
            grid: {
              color: 'rgba(59, 130, 246, 0.2)',
              borderColor: 'rgba(59, 130, 246, 0.3)',
              borderDash: [5, 5]
            },
            ticks: {
              color: '#cccccc',
              font: { size: 11 }
            },
            border: {
              color: 'rgba(59, 130, 246, 0.3)'
            }
          }
        }
      }
    });


  }

  createDatasets() {
    const datasets = {
      neutral: [],
      cooling: [],
      heating: [],
      overheating: []
    };

    this.bubbleData.forEach((point, index) => {
      const dataPoint = {
        x: point.time.getTime(),
        y: point.price,
        r: point.bubbleSize,
        index: index
      };
      
      datasets[point.volumeStatus].push(dataPoint);
    });

    return [
      {
        label: 'Neutral',
        data: datasets.neutral,
        backgroundColor: '#3b82f6',
        borderColor: '#3b82f6',
        borderWidth: 1
      },
      {
        label: 'Cooling',
        data: datasets.cooling,
        backgroundColor: '#10b981',
        borderColor: '#10b981',
        borderWidth: 1
      },
      {
        label: 'Heating',
        data: datasets.heating,
        backgroundColor: '#f59e0b',
        borderColor: '#f59e0b',
        borderWidth: 1
      },
      {
        label: 'Overheating',
        data: datasets.overheating,
        backgroundColor: '#ef4444',
        borderColor: '#ef4444',
        borderWidth: 1
      }
    ];
  }

  showTooltip(event, dataPoint) {
    // Chart.js 기본 툴팁을 사용하므로 이 메서드는 더 이상 필요하지 않음
  }

  hideTooltip() {
    // Chart.js 기본 툴팁을 사용하므로 이 메서드는 더 이상 필요하지 않음
  }

  updateStats() {
    if (this.bubbleData.length === 0) return;
    
    const current = this.bubbleData[this.bubbleData.length - 1];
    const volumes = this.bubbleData.map(d => d.volume);
    const maxVolume = Math.max(...volumes);
    const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
    
    document.getElementById('current-volume').textContent = current.volume.toLocaleString();
    document.getElementById('volume-change').textContent = `${current.volumeChangeRate.toFixed(2)}%`;
    document.getElementById('max-volume').textContent = maxVolume.toLocaleString();
    document.getElementById('avg-volume').textContent = Math.round(avgVolume).toLocaleString();
  }

  showLoading() {
    const chartArea = document.getElementById('chart-area');
    chartArea.innerHTML = `
      <div class="loading">
        <div class="loading-spinner"></div>
        데이터 로딩 중...
      </div>
    `;
  }

  hideLoading() {
    // Loading will be hidden when chart is rendered
  }

  handleError(error) {
    console.error('Data loading failed:', error);
    const chartArea = document.getElementById('chart-area');
    chartArea.innerHTML = `
      <div class="error-message">
        <p>데이터 로딩에 실패했습니다.</p>
        <button onclick="location.reload()">다시 시도</button>
      </div>
    `;
  }
}

// 전역 함수로 노출
window.initVolumeBubbleMapManager = function() {
  return new VolumeBubbleMapManager();
}; 