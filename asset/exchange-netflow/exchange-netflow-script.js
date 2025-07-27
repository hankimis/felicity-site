class ExchangeNetflowAnalyzer {
  constructor() {
    this.chart = null;
    this.currentData = [];
    this.currentPeriod = 'all';
    this.isLoading = false;
    this.init();
  }

  async init() {
    this.bindEvents();
    await this.loadData();
  }

  bindEvents() {
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
      
      // 바이낸스 API에서 데이터 가져오기
      const netflowData = await this.fetchNetflowData();
      
      // 가격 데이터 추출
      const priceData = netflowData.map(item => ({
        time: item.time,
        close: item.price
      }));
      
      // 차트 렌더링
      await this.renderChart(priceData, netflowData);
      
      // 통계 업데이트
      this.updateStats(priceData, netflowData);
      
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

  async fetchNetflowData() {
    // 바이낸스 API를 사용하여 순입출금량 데이터 계산
    const limit = this.getLimitByPeriod();
    
    try {
      // 바이낸스 API에서 가격 데이터 가져오기
      const url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=${limit}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`바이낸스 API 요청 실패: ${response.status}`);
      }
      
      const data = await response.json();
      
      // 가격 데이터 처리
      const priceData = data.map(item => ({
        time: new Date(item[0]),
        price: parseFloat(item[4]), // close price
        volume: parseFloat(item[5])
      }));
      
      // 순입출금량 시뮬레이션 (실제로는 거래소 API 필요)
      const netflowData = this.simulateNetflow(priceData);
      
      return netflowData;
      
    } catch (error) {
      console.error('순입출금량 데이터 로딩 실패:', error);
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

  simulateNetflow(priceData) {
    // 순입출금량 시뮬레이션
    // 실제로는 거래소 입출금 API가 필요하지만, 여기서는 가격 변동과 거래량을 기반으로 시뮬레이션
    
    const netflowData = [];
    const baseNetflow = 0;
    
    priceData.forEach((item, index) => {
      const price = item.price;
      const volume = item.volume;
      
      // 가격 변동에 따른 순입출금량 변화 시뮬레이션
      const priceChange = index > 0 ? (price - priceData[index-1].price) / priceData[index-1].price : 0;
      const volumeRatio = volume / Math.max(...priceData.map(d => d.volume));
      
      // 순입출금량 변화 계산
      let netflowChange = 0;
      
      if (priceChange > 0.05) { // 가격 상승 시 순유출 증가
        netflowChange = -Math.random() * 50000 - 20000;
      } else if (priceChange < -0.05) { // 가격 하락 시 순유입 증가
        netflowChange = Math.random() * 50000 + 20000;
      } else { // 안정적일 때 작은 변화
        netflowChange = (Math.random() - 0.5) * 10000;
      }
      
      // 거래량에 따른 추가 변화
      if (volumeRatio > 0.8) {
        netflowChange += (Math.random() - 0.5) * 30000;
      }
      
      // 랜덤 요소 추가
      netflowChange += (Math.random() - 0.5) * 15000;
      
      const currentNetflow = index === 0 ? baseNetflow : netflowData[index-1].netflow + netflowChange;
      
      netflowData.push({
        time: item.time,
        netflow: currentNetflow,
        price: price,
        volume: volume,
        netflowChange: netflowChange,
        priceChange: priceChange
      });
    });
    
    return netflowData;
  }

  async renderChart(priceData, netflowData) {
    const chartArea = document.getElementById('chart-area');
    chartArea.innerHTML = '';
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.id = 'netflow-chart';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    chartArea.appendChild(canvas);
    
    // Add watermark
    const watermark = document.createElement('div');
    watermark.className = 'watermark';
    watermark.textContent = 'Onbit';
    chartArea.appendChild(watermark);

    // Destroy previous chart
    if (this.chart) {
      this.chart.destroy();
    }

    // Check if Chart.js is loaded
    if (!window.Chart) {
      throw new Error('Chart.js가 로드되지 않았습니다.');
    }

    // 가격 데이터 포인트
    const pricePoints = priceData.map(item => ({
      x: item.time.getTime(),
      y: item.close
    }));

    // 순입출금량 데이터 포인트
    const netflowPoints = netflowData.map(item => ({
      x: item.time.getTime(),
      y: item.netflow
    }));

    this.chart = new Chart(canvas, {
      type: 'bar',
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
            type: 'line',
            pointRadius: 0,
            pointHoverRadius: 0
          },
          {
            label: '거래소 순입출금량 (Netflow)',
            data: netflowPoints,
            backgroundColor: netflowPoints.map(point => point.y >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)'),
            borderColor: netflowPoints.map(point => point.y >= 0 ? '#10b981' : '#ef4444'),
            borderWidth: 1,
            yAxisID: 'y',
            type: 'bar'
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
                    return `순입출금량: ${(dataPoint.y / 1000).toFixed(1)}K BTC`;
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
              text: '순입출금량 (K BTC)',
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
                return (value / 1000).toFixed(0) + 'K';
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

  updateStats(priceData, netflowData) {
    if (netflowData.length === 0) return;

    const current = netflowData[netflowData.length - 1];
    const previous = netflowData[netflowData.length - 2] || current;
    
    // 현재 순입출금량
    const currentNetflow = current.netflow;
    document.getElementById('current-netflow').textContent = `${(currentNetflow / 1000).toFixed(1)}K BTC`;
    
    const netflowChange = currentNetflow - previous.netflow;
    const netflowChangeEl = document.getElementById('netflow-change');
    netflowChangeEl.textContent = `${netflowChange >= 0 ? '+' : ''}${(netflowChange / 1000).toFixed(1)}K BTC`;
    netflowChangeEl.className = `stat-change ${netflowChange >= 0 ? 'positive' : 'negative'}`;

    // 현재 가격
    const currentPrice = current.price;
    document.getElementById('current-price').textContent = `$${currentPrice.toLocaleString()}`;
    
    const priceChange = current.priceChange * 100;
    const priceChangeEl = document.getElementById('price-change');
    priceChangeEl.textContent = `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`;
    priceChangeEl.className = `stat-change ${priceChange >= 0 ? 'positive' : 'negative'}`;

    // 순입출금 상태
    let flowStatus = '균형';
    let flowDesc = '입출금이 균형을 이루고 있음';
    
    if (currentNetflow > 10000) {
      flowStatus = '순유입';
      flowDesc = '거래소로 순유입 중';
    } else if (currentNetflow < -10000) {
      flowStatus = '순유출';
      flowDesc = '거래소에서 순유출 중';
    } else if (currentNetflow > 0) {
      flowStatus = '소폭 유입';
      flowDesc = '거래소로 소폭 유입';
    } else {
      flowStatus = '소폭 유출';
      flowDesc = '거래소에서 소폭 유출';
    }

    document.getElementById('flow-status').textContent = flowStatus;
    document.getElementById('flow-description').textContent = flowDesc;

    // 시장 신호
    let signal = '관망';
    let signalDesc = '순입출금량이 안정적';
    
    if (currentNetflow > 50000 && priceChange < -2) {
      signal = '매도 신호';
      signalDesc = '대량 순유입 + 가격 하락';
    } else if (currentNetflow < -50000 && priceChange > 2) {
      signal = '매수 신호';
      signalDesc = '대량 순유출 + 가격 상승';
    } else if (currentNetflow > 20000) {
      signal = '주의';
      signalDesc = '순유입으로 매도 압력';
    } else if (currentNetflow < -20000) {
      signal = '관심';
      signalDesc = '순유출로 매수 압력';
    }

    document.getElementById('market-signal').textContent = signal;
    document.getElementById('signal-description').textContent = signalDesc;
  }
}

// 전역 함수로 등록
window.initExchangeNetflowAnalyzer = function() {
  return new ExchangeNetflowAnalyzer();
}; 