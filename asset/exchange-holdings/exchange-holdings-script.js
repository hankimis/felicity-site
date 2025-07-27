class ExchangeHoldingsAnalyzer {
  constructor() {
    this.chart = null;
    this.currentData = [];
    this.currentSymbol = 'BTCUSDT';
    this.currentPeriod = 'all';
    this.isLoading = false;
    this.init();
  }

  async init() {
    this.bindEvents();
    await this.loadData();
  }

  bindEvents() {
    // 심볼 변경
    const symbolSelect = document.getElementById('symbol-select');
    if (symbolSelect) {
      symbolSelect.addEventListener('change', (e) => {
        this.currentSymbol = e.target.value;
        this.loadData();
      });
    }

    // 기간 변경
    const periodSelect = document.getElementById('period-select');
    if (periodSelect) {
      periodSelect.addEventListener('change', (e) => {
        this.currentPeriod = e.target.value;
        this.loadData();
      });
    }

    // 타임프레임 버튼
    document.querySelectorAll('.timeframe-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentPeriod = e.target.dataset.timeframe;
        this.loadData();
      });
    });
  }

  async loadData() {
    if (this.isLoading) return;
    this.isLoading = true;
    
    const chartArea = document.getElementById('chart-area');
    chartArea.innerHTML = `
      <div class="loading">
        <div class="loading-spinner"></div>
        <div>데이터 로딩 중...</div>
      </div>
      <div class="watermark">Onbit</div>
    `;

    try {
      // Chart.js 로딩
      await this.loadChartJS();
      
      // 바이낸스 API에서 가격 데이터 가져오기
      const priceData = await this.fetchPriceData();
      
      // 거래소 보유량 데이터 시뮬레이션
      const holdingsData = this.simulateExchangeHoldings(priceData);
      
      // 차트 렌더링
      await this.renderChart(priceData, holdingsData);
      
      // 통계 업데이트
      this.updateStats(priceData, holdingsData);
      
    } catch (error) {
      console.error('데이터 로딩 실패:', error);
      chartArea.innerHTML = `
        <div class="loading">
          <div>데이터 로딩에 실패했습니다.</div>
        </div>
        <div class="watermark">Onbit</div>
      `;
    } finally {
      this.isLoading = false;
    }
  }

  async loadChartJS() {
    if (window.Chart) {
      return window.Chart;
    }

    return new Promise((resolve, reject) => {
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

  async fetchPriceData() {
    const limit = this.getLimitByPeriod();
    const url = `https://api.binance.com/api/v3/klines?symbol=${this.currentSymbol}&interval=1d&limit=${limit}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`API 요청 실패: ${response.status}`);
      }
      
      const data = await response.json();
      return data.map(item => ({
        time: new Date(item[0]),
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5])
      }));
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  getLimitByPeriod() {
    const limits = {
      '1d': 1,
      '1w': 7,
      '1M': 30,
      '1y': 365,
      'all': 1000
    };
    return limits[this.currentPeriod] || 1000;
  }

  simulateExchangeHoldings(priceData) {
    // 거래소 보유량 시뮬레이션
    // 실제로는 거래소 API에서 보유량 데이터를 가져와야 함
    
    const baseHoldings = 2500000; // 기본 보유량 250만 BTC
    const holdings = [];
    
    priceData.forEach((item, index) => {
      const price = item.close;
      const volume = item.volume;
      
      // 가격 변동에 따른 보유량 변화 시뮬레이션
      const priceChange = index > 0 ? (price - priceData[index-1].close) / priceData[index-1].close : 0;
      const volumeRatio = volume / Math.max(...priceData.map(d => d.volume));
      
      // 보유량 변화 계산 (가격과 반비례 관계)
      let holdingsChange = 0;
      
      if (priceChange > 0.05) { // 가격 상승 시 보유량 감소
        holdingsChange = -Math.random() * 50000 - 20000;
      } else if (priceChange < -0.05) { // 가격 하락 시 보유량 증가
        holdingsChange = Math.random() * 50000 + 20000;
      } else { // 안정적일 때 작은 변화
        holdingsChange = (Math.random() - 0.5) * 10000;
      }
      
      // 거래량에 따른 추가 변화
      if (volumeRatio > 0.8) {
        holdingsChange += (Math.random() - 0.5) * 30000;
      }
      
      const currentHoldings = index === 0 ? baseHoldings : holdings[index-1].holdings + holdingsChange;
      
      holdings.push({
        time: item.time,
        holdings: Math.max(0, currentHoldings),
        price: price,
        volume: volume,
        holdingsChange: holdingsChange,
        priceChange: priceChange
      });
    });
    
    return holdings;
  }

  async renderChart(priceData, holdingsData) {
    const chartArea = document.getElementById('chart-area');
    chartArea.innerHTML = '';
    
    // 캔버스 생성
    const canvas = document.createElement('canvas');
    canvas.id = 'holdings-chart';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    chartArea.appendChild(canvas);
    
    // 워터마크 추가
    const watermark = document.createElement('div');
    watermark.className = 'watermark';
    watermark.textContent = 'Onbit';
    chartArea.appendChild(watermark);

    // 기존 차트 제거
    if (this.chart) {
      this.chart.destroy();
    }

    // Chart.js가 로드되었는지 확인
    if (!window.Chart) {
      throw new Error('Chart.js가 로드되지 않았습니다.');
    }

    // 가격 데이터 포인트
    const pricePoints = priceData.map(item => ({
      x: item.time.getTime(),
      y: item.close
    }));

    // 보유량 데이터 포인트
    const holdingsPoints = holdingsData.map(item => ({
      x: item.time.getTime(),
      y: item.holdings
    }));

    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: '가격(USD)',
            data: pricePoints,
            borderColor: '#000000',
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            borderWidth: 2,
            fill: false,
            yAxisID: 'y1',
            pointRadius: 0,
            pointHoverRadius: 0
          },
          {
            label: '거래소 보유량',
            data: holdingsPoints,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            borderWidth: 2,
            fill: false,
            yAxisID: 'y',
            pointRadius: 0,
            pointHoverRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
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
                const dataPoint = context[0].raw;
                const date = new Date(dataPoint.x);
                return date.toISOString().split('T')[0].replace(/-/g, ' ') + ' UTC';
              },
              label: function(context) {
                const dataPoint = context.raw;
                if (context.dataset.label === '가격(USD)') {
                  return `가격: $${(dataPoint.y / 1000).toFixed(2)}K`;
                } else {
                  return `보유량: ${(dataPoint.y / 1000000).toFixed(2)}M BTC`;
                }
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
              font: {
                size: 11
              }
            },
            border: {
              color: 'rgba(59, 130, 246, 0.3)'
            }
          },
          y: {
            type: 'linear',
            position: 'left',
            title: {
              display: true,
              text: '보유량 (M BTC)',
              color: '#cccccc'
            },
            grid: {
              color: 'rgba(59, 130, 246, 0.2)',
              borderColor: 'rgba(59, 130, 246, 0.3)',
              borderDash: [5, 5]
            },
            ticks: {
              color: '#cccccc',
              font: {
                size: 11
              },
              callback: function(value) {
                return (value / 1000000).toFixed(1) + 'M';
              }
            },
            border: {
              color: 'rgba(59, 130, 246, 0.3)'
            }
          },
          y1: {
            type: 'logarithmic',
            position: 'right',
            title: {
              display: true,
              text: '가격 (USD)',
              color: '#cccccc'
            },
            grid: {
              drawOnChartArea: false,
            },
            ticks: {
              color: '#cccccc',
              font: {
                size: 11
              },
              callback: function(value) {
                if (value >= 1000) {
                  return '$' + (value / 1000) + 'K';
                }
                return '$' + value;
              }
            },
            border: {
              color: 'rgba(59, 130, 246, 0.3)'
            }
          }
        }
      }
    });
  }

  updateStats(priceData, holdingsData) {
    if (holdingsData.length === 0) return;

    const current = holdingsData[holdingsData.length - 1];
    const previous = holdingsData[holdingsData.length - 2] || current;
    
    // 현재 거래소 보유량
    const currentHoldings = current.holdings;
    document.getElementById('current-holdings').textContent = `${(currentHoldings / 1000000).toFixed(2)}M BTC`;
    
    const holdingsChange = currentHoldings - previous.holdings;
    const holdingsChangeEl = document.getElementById('holdings-change');
    holdingsChangeEl.textContent = `${holdingsChange >= 0 ? '+' : ''}${(holdingsChange / 1000).toFixed(1)}K BTC`;
    holdingsChangeEl.className = `stat-change ${holdingsChange >= 0 ? 'positive' : 'negative'}`;

    // 현재 가격
    const currentPrice = current.price;
    document.getElementById('current-price').textContent = `$${currentPrice.toLocaleString()}`;
    
    const priceChange = current.priceChange * 100;
    const priceChangeEl = document.getElementById('price-change');
    priceChangeEl.textContent = `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`;
    priceChangeEl.className = `stat-change ${priceChange >= 0 ? 'positive' : 'negative'}`;

    // 보유량 변화율
    const holdingsChangeRate = (holdingsChange / previous.holdings) * 100;
    document.getElementById('holdings-change-rate').textContent = `${holdingsChangeRate >= 0 ? '+' : ''}${holdingsChangeRate.toFixed(2)}%`;
    
    let changeTrend = '안정';
    if (holdingsChangeRate > 1) {
      changeTrend = '급증';
    } else if (holdingsChangeRate > 0.1) {
      changeTrend = '증가';
    } else if (holdingsChangeRate < -1) {
      changeTrend = '급감';
    } else if (holdingsChangeRate < -0.1) {
      changeTrend = '감소';
    }
    document.getElementById('change-trend').textContent = changeTrend;

    // 시장 신호
    let signal = '관망';
    let signalDesc = '보유량이 안정적';
    
    if (holdingsChangeRate > 2 && priceChange < -2) {
      signal = '매도 신호';
      signalDesc = '보유량 급증 + 가격 하락';
    } else if (holdingsChangeRate < -2 && priceChange > 2) {
      signal = '매수 신호';
      signalDesc = '보유량 급감 + 가격 상승';
    } else if (holdingsChangeRate > 1) {
      signal = '주의';
      signalDesc = '보유량 증가로 매도 압력';
    } else if (holdingsChangeRate < -1) {
      signal = '관심';
      signalDesc = '보유량 감소로 매수 압력';
    }

    document.getElementById('market-signal').textContent = signal;
    document.getElementById('signal-description').textContent = signalDesc;
  }
}

// 전역 함수로 등록
window.initExchangeHoldingsAnalyzer = function() {
  return new ExchangeHoldingsAnalyzer();
}; 