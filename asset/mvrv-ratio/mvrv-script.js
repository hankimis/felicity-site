class MVRVAnalyzer {
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
      
      // 바이낸스 API에서 MVRV 데이터 가져오기
      const mvrvData = await this.fetchMVRVData();
      
      // 가격 데이터 추출
      const priceData = mvrvData.map(item => ({
        time: item.time,
        close: item.price
      }));
      
      // 차트 렌더링
      await this.renderChart(priceData, mvrvData);
      
      // 통계 업데이트
      this.updateStats(priceData, mvrvData);
      
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

  async fetchMVRVData() {
    // 바이낸스 API를 사용하여 MVRV 비율 데이터 계산
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
      
      // 실현 시가총액 계산
      const realizedCapData = this.calculateRealizedCap(priceData);
      
      // MVRV 비율 계산
      const mvrvData = [];
      const totalSupply = 19500000; // BTC 총 공급량 (근사값)
      
      for (let i = 0; i < priceData.length; i++) {
        const price = priceData[i].price;
        const marketCap = price * totalSupply;
        const realizedCap = realizedCapData[i]?.realizedCap || 0;
        
        if (realizedCap > 0) {
          const mvrvRatio = marketCap / realizedCap;
          
          mvrvData.push({
            time: priceData[i].time,
            mvrv: mvrvRatio,
            price: price,
            marketCap: marketCap,
            realizedCap: realizedCap,
            priceChange: i > 0 ? (price - priceData[i-1].price) / priceData[i-1].price : 0
          });
        }
      }
      
      return mvrvData;
      
    } catch (error) {
      console.error('MVRV 데이터 로딩 실패:', error);
      throw error;
    }
  }

  calculateRealizedCap(priceData) {
    // 실현 시가총액 계산 (개선된 방법)
    // 실제로는 UTXO 기반 계산이 필요하지만, 여기서는 가중 이동평균으로 근사
    const realizedCapData = [];
    const windowSize = 90; // 90일 가중 이동평균 (더 긴 기간)
    const totalSupply = 19500000; // BTC 총 공급량 (근사값)
    
    for (let i = 0; i < priceData.length; i++) {
      let weightedSum = 0;
      let weightSum = 0;
      
      // 가중 이동평균 계산 (최근 데이터에 더 높은 가중치)
      for (let j = Math.max(0, i - windowSize); j <= i; j++) {
        const weight = Math.exp((j - i) / 30); // 지수 감쇠 가중치
        weightedSum += priceData[j].price * weight;
        weightSum += weight;
      }
      
      const avgPrice = weightedSum / weightSum;
      const realizedCap = avgPrice * totalSupply;
      
      realizedCapData.push({
        time: priceData[i].time,
        realizedCap: realizedCap
      });
    }
    
    return realizedCapData;
  }

  async renderChart(priceData, mvrvData) {
    const chartArea = document.getElementById('chart-area');
    chartArea.innerHTML = '';
    
    // 캔버스 생성
    const canvas = document.createElement('canvas');
    canvas.id = 'mvrv-chart';
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

    // MVRV 데이터 포인트
    const mvrvPoints = mvrvData.map(item => ({
      x: item.time.getTime(),
      y: item.mvrv
    }));

    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: '가격(USD)',
            data: pricePoints,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            fill: false,
            yAxisID: 'y1',
            pointRadius: 0, // 점 제거
            pointHoverRadius: 0 // 호버 시 점 제거
          },
          {
            label: 'MVRV 비율',
            data: mvrvPoints,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            borderWidth: 2,
            fill: false,
            yAxisID: 'y',
            pointRadius: 0, // 점 제거
            pointHoverRadius: 0 // 호버 시 점 제거
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
                  return `MVRV: ${dataPoint.y.toFixed(2)}`;
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
              text: 'MVRV 비율',
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
              }
            },
            border: {
              color: 'rgba(59, 130, 246, 0.3)'
            },
            // MVRV = 1 기준선 추가
            afterDraw: function(chart) {
              const ctx = chart.ctx;
              const yAxis = chart.scales.y;
              const y1 = yAxis.getPixelForValue(1);
              
              ctx.save();
              ctx.strokeStyle = '#10b981';
              ctx.lineWidth = 1;
              ctx.setLineDash([5, 5]);
              ctx.beginPath();
              ctx.moveTo(chart.chartArea.left, y1);
              ctx.lineTo(chart.chartArea.right, y1);
              ctx.stroke();
              ctx.restore();
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

  updateStats(priceData, mvrvData) {
    if (mvrvData.length === 0) return;

    const current = mvrvData[mvrvData.length - 1];
    const previous = mvrvData[mvrvData.length - 2] || current;
    
    // 현재 MVRV 비율
    const currentMVRV = current.mvrv;
    document.getElementById('current-mvrv').textContent = currentMVRV.toFixed(2);
    
    const mvrvChange = currentMVRV - previous.mvrv;
    const mvrvChangeEl = document.getElementById('mvrv-change');
    mvrvChangeEl.textContent = `${mvrvChange >= 0 ? '+' : ''}${mvrvChange.toFixed(2)}`;
    mvrvChangeEl.className = `stat-change ${mvrvChange >= 0 ? 'positive' : 'negative'}`;

    // 현재 가격
    const currentPrice = current.price;
    document.getElementById('current-price').textContent = `$${currentPrice.toLocaleString()}`;
    
    const priceChange = current.priceChange * 100;
    const priceChangeEl = document.getElementById('price-change');
    priceChangeEl.textContent = `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`;
    priceChangeEl.className = `stat-change ${priceChange >= 0 ? 'positive' : 'negative'}`;

    // 실현 시가총액
    const currentRealizedCap = current.realizedCap;
    document.getElementById('realized-cap').textContent = `$${(currentRealizedCap / 1e12).toFixed(2)}T`;
    
    const realizedCapChange = current.realizedCap - previous.realizedCap;
    const realizedCapChangeEl = document.getElementById('realized-cap-change');
    realizedCapChangeEl.textContent = `${realizedCapChange >= 0 ? '+' : ''}$${(realizedCapChange / 1e9).toFixed(2)}B`;
    realizedCapChangeEl.className = `stat-change ${realizedCapChange >= 0 ? 'positive' : 'negative'}`;

    // 평가 상태
    let valuationStatus = '공정가치';
    let valuationDesc = 'MVRV ≈ 1';
    
    if (currentMVRV < 0.8) {
      valuationStatus = '심각한 저평가';
      valuationDesc = '매수 기회';
    } else if (currentMVRV < 1) {
      valuationStatus = '저평가';
      valuationDesc = '매수 고려';
    } else if (currentMVRV < 2) {
      valuationStatus = '적정가치';
      valuationDesc = '중립';
    } else if (currentMVRV < 3.7) {
      valuationStatus = '고평가';
      valuationDesc = '매도 고려';
    } else {
      valuationStatus = '심각한 고평가';
      valuationDesc = '매도 신호';
    }

    document.getElementById('valuation-status').textContent = valuationStatus;
    document.getElementById('valuation-description').textContent = valuationDesc;

    // 시장 신호
    let signal = '관망';
    let signalDesc = 'MVRV 비율이 중립 수준';
    
    if (currentMVRV < 1) {
      signal = '매수 신호';
      signalDesc = '저평가 구간, 매수 기회';
    } else if (currentMVRV > 3.7) {
      signal = '매도 신호';
      signalDesc = '고평가 구간, 매도 고려';
    } else if (currentMVRV > 2) {
      signal = '주의';
      signalDesc = '고평가 구간, 리스크 관리';
    } else if (currentMVRV < 1.5) {
      signal = '관심';
      signalDesc = '적정가치 구간, 관망';
    }

    document.getElementById('market-signal').textContent = signal;
    document.getElementById('signal-description').textContent = signalDesc;
  }
}

// 전역 함수로 MVRV 분석기 초기화
window.initMVRVAnalyzer = function() {
  return new MVRVAnalyzer();
}; 