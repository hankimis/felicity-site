/**
 * Crypto Table Management
 */

// 코인 테이블 기능
class CryptoTable {
  constructor() {
    this.coins = [];
    this.filteredCoins = [];
    this.currentPage = 1;
    this.itemsPerPage = 50;
    this.sortField = 'rank';
    this.sortDirection = 'asc';
    this.currentCategory = 'all';
    this.searchTerm = '';
    
    // WebSocket 연결 관리
    this.websockets = new Map();
    this.priceUpdates = new Map();
    this.reconnectAttempts = new Map();
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.lastAdditionalLoadTs = 0; // 추가 페이지 로드 쿨다운
    
    this.init();
  }
  
  async init() {
    // 즉시 이벤트 바인딩과 스켈레톤 표시
    this.bindEvents();
    this.showLoadingTable();
    
    // 백그라운드에서 데이터 로드 (non-blocking)
    this.loadData().then(() => {
      this.render();
      // 데이터 로드 완료 후 즉시 WebSocket 연결
      this.initializeWebSockets();
    }).catch(error => {
      // 데이터 로딩 실패 시에도 스켈레톤은 유지
    });
    
    // 성능 최적화: 사용자가 페이지를 보고 있을 때만 업데이트 (단일 스케줄러)
    let updateInterval;
    
    const startUpdates = () => {
      if (updateInterval) clearInterval(updateInterval);
      updateInterval = setInterval(() => {
        this.loadData();
      }, 300000); // 5분 주기
    };
    
    const stopUpdates = () => {
      if (updateInterval) {
        clearInterval(updateInterval);
      }
    };
    
    // 페이지 가시성 변경 감지
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopUpdates();
      } else {
        startUpdates();
      }
    });
    
    // 초기 시작
    startUpdates();
  }
  
  bindEvents() {
    // 탭 전환
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentCategory = e.target.dataset.category;
        this.currentPage = 1;
        this.filterAndSort();
      });
    });
    
    // 검색
    const searchInput = document.getElementById('coin-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value.toLowerCase();
        this.currentPage = 1;
        this.filterAndSort();
      });
    }
    
    // 새로고침
    const refreshBtn = document.getElementById('refresh-data');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadData();
      });
    }
    
    // 정렬
    document.querySelectorAll('.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const field = th.dataset.sort;
        if (this.sortField === field) {
          this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortField = field;
          this.sortDirection = 'asc';
        }
        this.updateSortHeaders();
        this.filterAndSort();
      });
    });
    
    // 페이지네이션
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.render();
        }
      });
    }
    
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(this.filteredCoins.length / this.itemsPerPage);
        if (this.currentPage < totalPages) {
          this.currentPage++;
          this.render();
        }
      });
    }
  }
  
  // 빠른 초기 로딩을 위한 기본 테이블 표시
  showLoadingTable() {
    const tbody = document.getElementById('crypto-table-body');
    if (!tbody) return;
    
    // 스켈레톤 로딩 행들 생성
    const skeletonRows = Array.from({ length: 20 }, (_, index) => {
      return `
        <tr class="skeleton-row">
          <td>${index + 1}</td>
          <td>
            <div class="coin-info">
              <div class="skeleton-circle"></div>
              <div class="coin-details">
                <div class="skeleton-text"></div>
                <div class="skeleton-text-small"></div>
              </div>
            </div>
          </td>
          <td><div class="skeleton-text"></div></td>
          <td><div class="skeleton-text"></div></td>
          <td><div class="skeleton-text"></div></td>
          <td><div class="skeleton-text"></div></td>
          <td><div class="skeleton-text"></div></td>
          <td><div class="skeleton-text"></div></td>
          <td><div class="skeleton-text"></div></td>
          <td><div class="skeleton-text"></div></td>
          <td><div class="skeleton-text"></div></td>
          <td><div class="skeleton-text"></div></td>
          <td><div class="skeleton-text"></div></td>
          <td><div class="skeleton-text"></div></td>
          <td><div class="skeleton-chart"></div></td>
        </tr>
      `;
    }).join('');
    
    tbody.innerHTML = skeletonRows;
    
    // 스켈레톤 CSS 추가
    if (!document.getElementById('skeleton-styles')) {
      const skeletonStyle = document.createElement('style');
      skeletonStyle.id = 'skeleton-styles';
      skeletonStyle.textContent = `
        .skeleton-row {
          animation: skeleton-pulse 1.5s ease-in-out infinite alternate;
        }
        
        .skeleton-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: skeleton-shimmer 1.5s infinite;
        }
        
        .skeleton-text {
          height: 16px;
          border-radius: 4px;
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: skeleton-shimmer 1.5s infinite;
          width: 80%;
        }
        
        .skeleton-text-small {
          height: 12px;
          border-radius: 4px;
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: skeleton-shimmer 1.5s infinite;
          width: 60%;
          margin-top: 4px;
        }
        
        .skeleton-chart {
          height: 30px;
          border-radius: 4px;
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: skeleton-shimmer 1.5s infinite;
          width: 60px;
        }
        
        @keyframes skeleton-shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        
        @keyframes skeleton-pulse {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0.7;
          }
        }
        
        [data-theme="dark"] .skeleton-circle,
        [data-theme="dark"] .skeleton-text,
        [data-theme="dark"] .skeleton-text-small,
        [data-theme="dark"] .skeleton-chart {
          background: linear-gradient(90deg, #2a2a2a 25%, #3a3a3a 50%, #2a2a2a 75%);
          background-size: 200% 100%;
        }
      `;
      document.head.appendChild(skeletonStyle);
    }
  }
  
  // WebSocket 초기화 (모든 코인 실시간 업데이트)
  initializeWebSockets() {
    // 동적으로 현재 테이블의 모든 코인들을 WebSocket으로 연결
    const symbols = this.getWebSocketSymbols();
    
    // Binance WebSocket 연결 (여러 스트림으로 분할)
    this.connectBinanceWebSocket(symbols);
    
    // Bybit WebSocket 연결 (백업)
    setTimeout(() => {
      this.connectBybitWebSocket(symbols);
    }, 2000);
    
    // OKX WebSocket 연결 (추가 백업)
    setTimeout(() => {
      this.connectOKXWebSocket(symbols);
    }, 4000);
  }
  
  // 현재 로드된 코인들의 WebSocket 심볼 가져오기
  getWebSocketSymbols() {
    const coinToSymbolMap = this.getCoinToSymbolMap();
    return this.coins
      .map(coin => coinToSymbolMap[coin.id])
      .filter(symbol => symbol) // 매핑되지 않은 코인 제외
      .slice(0, 200); // WebSocket 연결 제한
  }
  
  // CoinGecko ID → Binance Symbol 매핑
  getCoinToSymbolMap() {
    return {
      'bitcoin': 'BTCUSDT',
      'ethereum': 'ETHUSDT',
      'binancecoin': 'BNBUSDT',
      'cardano': 'ADAUSDT',
      'solana': 'SOLUSDT',
      'ripple': 'XRPUSDT',
      'polkadot': 'DOTUSDT',
      'chainlink': 'LINKUSDT',
      'litecoin': 'LTCUSDT',
      'bitcoin-cash': 'BCHUSDT',
      'dogecoin': 'DOGEUSDT',
      'matic-network': 'MATICUSDT',
      'avalanche-2': 'AVAXUSDT',
      'uniswap': 'UNIUSDT',
      'cosmos': 'ATOMUSDT',
      'fantom': 'FTMUSDT',
      'near': 'NEARUSDT',
      'algorand': 'ALGOUSDT',
      'vechain': 'VETUSDT',
      'internet-computer': 'ICPUSDT',
      'filecoin': 'FILUSDT',
      'tron': 'TRXUSDT',
      'ethereum-classic': 'ETCUSDT',
      'stellar': 'XLMUSDT',
      'hedera-hashgraph': 'HBARUSDT',
      'the-sandbox': 'SANDUSDT',
      'decentraland': 'MANAUSDT',
      'apecoin': 'APEUSDT',
      'chiliz': 'CHZUSDT',
      'eos': 'EOSUSDT',
      'axie-infinity': 'AXSUSDT',
      'theta-token': 'THETAUSDT',
      'aave': 'AAVEUSDT',
      'curve-dao-token': 'CRVUSDT',
      'compound-governance-token': 'KOMPUSDT',
      'maker': 'MKRUSDT',
      'sushi': 'SUSHIUSDT',
      '1inch': '1INCHUSDT',
      'yearn-finance': 'YFIUSDT',
      'havven': 'SNXUSDT',
      'enjincoin': 'ENJUSDT',
      'basic-attention-token': 'BATUSDT',
      '0x': 'ZRXUSDT',
      'qtum': 'QTUMUSDT',
      'zilliqa': 'ZILUSDT',
      'harmony': 'ONEUSDT',
      'holotoken': 'HOTUSDT',
      'zencash': 'ZENUSDT',
      'zcash': 'ZECUSDT',
      'waves': 'WAVESUSDT',
      'omisego': 'OMGUSDT',
      'iota': 'IOTAUSDT',
      'ontology': 'ONTUSDT',
      'icon': 'ICXUSDT',
      'nkn': 'NKNUSDT',
      'siacoin': 'SCUSDT',
      'digibyte': 'DGBUSDT',
      'bittorrent': 'BTTUSDT',
      'celer-network': 'CELRUSDT',
      'iexec-rlc': 'RLCUSDT',
      'pancakeswap-token': 'CAKEUSDT',
      'terra-luna': 'LUNAUSDT',
      'thorchain': 'RUNEUSDT',
      'kucoin-shares': 'KCSUSDT',
      'elrond-erd-2': 'EGLDUSDT',
      'helium': 'HNTUSDT',
      'flow': 'FLOWUSDT',
      'monero': 'XMRUSDT',
      'dash': 'DASHUSDT',
      'neo': 'NEOUSDT',
      'tezos': 'XTZUSDT',
      'compound-ether': 'CETHUSDT',
      'huobi-token': 'HTUSDT',
      'ftx-token': 'FTTUSDT',
      'celsius-degree-token': 'CELUSDT',
      'loopring': 'LRCUSDT',
      'band-protocol': 'BANDUSDT',
      'uma': 'UMAUSDT',
      'ren': 'RENUSDT',
      'numeraire': 'NMRUSDT',
      'storj': 'STORJUSDT',
      'balancer': 'BALUSDT',
      'kyber-network-crystal': 'KNCUSDT',
      'republic-protocol': 'REPUSDT',
      'reserve-rights-token': 'RSRUSDT',
      'origin-protocol': 'OGNUSDT',
      'bancor': 'BNTUSDT',
      'ocean-protocol': 'OCEANUSDT',
      'polymath': 'POLYUSDT',
      'augur': 'REPUSDT',
      'gnosis': 'GNOSDT',
      'golem': 'GLMUSDT',
      'status': 'SNTUSDT',
      'civic': 'CVICUSDT',
      'arkham': 'ARKMUSDT'
    };
  }
  
  // Binance Symbol → CoinGecko ID 역매핑
  getSymbolToCoinMap() {
    const coinToSymbol = this.getCoinToSymbolMap();
    const symbolToCoin = {};
    
    // 역매핑 생성
    Object.entries(coinToSymbol).forEach(([coinId, symbol]) => {
      symbolToCoin[symbol] = coinId;
    });
    
    return symbolToCoin;
  }
  
  // Binance WebSocket 연결
  connectBinanceWebSocket(symbols) {
    try {
      // URL 길이 제한으로 여러 연결로 분할
      const chunkSize = 20;
      const chunks = [];
      for (let i = 0; i < symbols.length; i += chunkSize) {
        chunks.push(symbols.slice(i, i + chunkSize));
      }
      
      chunks.forEach((chunk, index) => {
        const streamNames = chunk.map(symbol => `${symbol.toLowerCase()}@ticker`).join('/');
        const wsUrl = `wss://stream.binance.com:9443/ws/${streamNames}`;
        
        const ws = new WebSocket(wsUrl);
        const connectionKey = index === 0 ? 'binance' : `binance-${index}`;
        this.websockets.set(connectionKey, ws);
        this.reconnectAttempts.set(connectionKey, 0);
        
        ws.onopen = () => {
          this.reconnectAttempts.set(connectionKey, 0);
          if (index === 0) {
            this.updateWebSocketStatus('binance', 'connected');
          }
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.processBinanceUpdate(data);
          } catch (error) {
            // WebSocket 데이터 파싱 오류 무시
          }
        };
        
        ws.onclose = () => {
          if (index === 0) {
            this.updateWebSocketStatus('binance', 'disconnected');
          }
          this.handleWebSocketReconnect(connectionKey, () => this.connectBinanceWebSocket(symbols));
        };
        
        ws.onerror = () => {
          if (index === 0) {
            this.updateWebSocketStatus('binance', 'disconnected');
          }
          this.handleWebSocketReconnect(connectionKey, () => this.connectBinanceWebSocket(symbols));
        };
      });
      
    } catch (error) {
      // WebSocket 연결 실패 시 재시도
      setTimeout(() => {
        this.connectBinanceWebSocket(symbols);
      }, this.reconnectDelay);
    }
  }
  
  // Bybit WebSocket 연결
  connectBybitWebSocket(symbols) {
    try {
      const ws = new WebSocket('wss://stream.bybit.com/v5/public/spot');
      this.websockets.set('bybit', ws);
      this.reconnectAttempts.set('bybit', 0);
      
      ws.onopen = () => {
        this.reconnectAttempts.set('bybit', 0);
        this.updateWebSocketStatus('bybit', 'connected');
        
        // 구독 메시지 전송
        const subscribeMsg = {
          op: 'subscribe',
          args: symbols.map(symbol => `tickers.${symbol}`)
        };
        ws.send(JSON.stringify(subscribeMsg));
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.processBybitUpdate(data);
        } catch (error) {
          // WebSocket 데이터 파싱 오류 무시
        }
      };
      
      ws.onclose = () => {
        this.updateWebSocketStatus('bybit', 'disconnected');
        this.handleWebSocketReconnect('bybit', () => this.connectBybitWebSocket(symbols));
      };
      
      ws.onerror = () => {
        this.updateWebSocketStatus('bybit', 'disconnected');
        this.handleWebSocketReconnect('bybit', () => this.connectBybitWebSocket(symbols));
      };
      
    } catch (error) {
      // WebSocket 연결 실패 시 재시도
      setTimeout(() => {
        this.connectBybitWebSocket(symbols);
      }, this.reconnectDelay);
    }
  }
  
  // OKX WebSocket 연결
  connectOKXWebSocket(symbols) {
    try {
      const ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');
      this.websockets.set('okx', ws);
      this.reconnectAttempts.set('okx', 0);
      
      ws.onopen = () => {
        this.reconnectAttempts.set('okx', 0);
        this.updateWebSocketStatus('okx', 'connected');
        
        // OKX 구독 메시지 전송 (청크별로 분할)
        const chunkSize = 20;
        for (let i = 0; i < symbols.length; i += chunkSize) {
          const chunk = symbols.slice(i, i + chunkSize);
          const subscribeMsg = {
            op: 'subscribe',
            args: chunk.map(symbol => ({
              channel: 'tickers',
              instId: symbol
            }))
          };
          ws.send(JSON.stringify(subscribeMsg));
        }
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.processOKXUpdate(data);
        } catch (error) {
          // WebSocket 데이터 파싱 오류 무시
        }
      };
      
      ws.onclose = () => {
        this.updateWebSocketStatus('okx', 'disconnected');
        this.handleWebSocketReconnect('okx', () => this.connectOKXWebSocket(symbols));
      };
      
      ws.onerror = () => {
        this.updateWebSocketStatus('okx', 'disconnected');
        this.handleWebSocketReconnect('okx', () => this.connectOKXWebSocket(symbols));
      };
      
    } catch (error) {
      // WebSocket 연결 실패 시 재시도
      setTimeout(() => {
        this.connectOKXWebSocket(symbols);
      }, this.reconnectDelay);
    }
  }
  
  // WebSocket 재연결 처리
  handleWebSocketReconnect(exchange, reconnectFn) {
    const attempts = this.reconnectAttempts.get(exchange) || 0;
    
    if (attempts < this.maxReconnectAttempts) {
      this.reconnectAttempts.set(exchange, attempts + 1);
      const delay = this.reconnectDelay * Math.pow(2, attempts); // 지수 백오프
      
      setTimeout(reconnectFn, delay);
    }
  }
  
  // Binance 데이터 처리
  processBinanceUpdate(data) {
    if (!data.s || !data.c) return;
    
    const symbol = data.s;
    const price = parseFloat(data.c);
    const change24h = parseFloat(data.P);
    
    // Binance Symbol → CoinGecko ID 매핑 (역매핑)
    const coinMap = this.getSymbolToCoinMap();
    
    const coinId = coinMap[symbol];
    if (!coinId) return;
    
    // 가격 업데이트 저장
    this.priceUpdates.set(coinId, {
      price,
      change24h,
      timestamp: Date.now(),
      source: 'binance'
    });
    
    // 실시간 업데이트
    this.updateCoinPrice(coinId, price, change24h);
  }
  
  // Bybit 데이터 처리
  processBybitUpdate(data) {
    if (!data.data || !Array.isArray(data.data)) return;
    
    data.data.forEach(ticker => {
      if (!ticker.symbol || !ticker.lastPrice) return;
      
      const symbol = ticker.symbol;
      const price = parseFloat(ticker.lastPrice);
      const change24h = parseFloat(ticker.price24hPcnt) * 100;
      
      // Binance Symbol → CoinGecko ID 매핑 (역매핑)
      const coinMap = this.getSymbolToCoinMap();
      
      const coinId = coinMap[symbol];
      if (!coinId) return;
      
      // Binance 데이터가 더 최신이면 무시
      const existingUpdate = this.priceUpdates.get(coinId);
      if (existingUpdate && existingUpdate.source === 'binance' && 
          Date.now() - existingUpdate.timestamp < 5000) {
        return;
      }
      
      // 가격 업데이트 저장
      this.priceUpdates.set(coinId, {
        price,
        change24h,
        timestamp: Date.now(),
        source: 'bybit'
      });
      
      // 실시간 업데이트
      this.updateCoinPrice(coinId, price, change24h);
    });
  }
  
  // OKX 데이터 처리
  processOKXUpdate(data) {
    if (!data.data || !Array.isArray(data.data)) return;
    
    data.data.forEach(ticker => {
      if (!ticker.instId || !ticker.last) return;
      
      const symbol = ticker.instId;
      const price = parseFloat(ticker.last);
      const change24h = parseFloat(ticker.sodUtc0) || 0;
      
      // Binance Symbol → CoinGecko ID 매핑 (역매핑)
      const coinMap = this.getSymbolToCoinMap();
      
      const coinId = coinMap[symbol];
      if (!coinId) return;
      
      // Binance나 Bybit 데이터가 더 최신이면 무시
      const existingUpdate = this.priceUpdates.get(coinId);
      if (existingUpdate && 
          (existingUpdate.source === 'binance' || existingUpdate.source === 'bybit') && 
          Date.now() - existingUpdate.timestamp < 10000) {
        return;
      }
      
      // 가격 업데이트 저장
      this.priceUpdates.set(coinId, {
        price,
        change24h,
        timestamp: Date.now(),
        source: 'okx'
      });
      
      // 실시간 업데이트
      this.updateCoinPrice(coinId, price, change24h);
    });
  }
  
  // 코인 가격 실시간 업데이트
  updateCoinPrice(coinId, price, change24h) {
    // 코인 데이터 업데이트
    const coinIndex = this.coins.findIndex(coin => coin.id === coinId);
    if (coinIndex !== -1) {
      const oldPrice = this.coins[coinIndex].price;
      this.coins[coinIndex].price = price;
      this.coins[coinIndex].change24h = change24h;
      
      // 필터링된 데이터도 업데이트
      const filteredIndex = this.filteredCoins.findIndex(coin => coin.id === coinId);
      if (filteredIndex !== -1) {
        this.filteredCoins[filteredIndex].price = price;
        this.filteredCoins[filteredIndex].change24h = change24h;
        
        // 테이블에서 해당 행 업데이트
        this.updateTableRow(coinId, price, change24h, oldPrice);
      }
    }
  }
  
  // 테이블 행 실시간 업데이트
  updateTableRow(coinId, price, change24h, oldPrice) {
    const row = document.querySelector(`tr[data-coin-id="${coinId}"]`);
    if (!row) return;
    
    // 가격 업데이트
    const priceCell = row.querySelector('.price');
    if (priceCell) {
      priceCell.textContent = `$${this.formatPrice(price)}`;
      
      // 가격 변동 애니메이션
      if (oldPrice && oldPrice !== price) {
        priceCell.classList.remove('price-up', 'price-down');
        if (price > oldPrice) {
          priceCell.classList.add('price-up');
        } else if (price < oldPrice) {
          priceCell.classList.add('price-down');
        }
        
        // 애니메이션 제거
        setTimeout(() => {
          priceCell.classList.remove('price-up', 'price-down');
        }, 1000);
      }
    }
    
    // 24시간 변동률 업데이트
    const change24hCells = row.querySelectorAll('.change');
    if (change24hCells.length > 1) {
      const change24hCell = change24hCells[1]; // 두 번째 change 셀이 24h 변동률
      if (change24hCell) {
        change24hCell.innerHTML = `<span class="change ${this.getChangeClass(change24h)}">${this.formatPercent(change24h)}</span>`;
      }
    }
  }
  
  // WebSocket 상태 업데이트 (내부 추적만)
  updateWebSocketStatus(exchange, status) {
    // 내부적으로만 상태 추적
  }
  
  // WebSocket 연결 업데이트 (새로운 코인들 추가)
  updateWebSocketConnections() {
    const newSymbols = this.getWebSocketSymbols();
    
    // 기존 연결들 종료
    this.closeWebSockets();
    
    // 새로운 코인들로 재연결
    setTimeout(() => {
      this.connectBinanceWebSocket(newSymbols);
      setTimeout(() => {
        this.connectBybitWebSocket(newSymbols);
      }, 1000);
      setTimeout(() => {
        this.connectOKXWebSocket(newSymbols);
      }, 2000);
    }, 500);
  }
  
  // WebSocket 연결 종료
  closeWebSockets() {
    this.websockets.forEach((ws, exchange) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      this.updateWebSocketStatus(exchange, 'disconnected');
    });
    this.websockets.clear();
    this.priceUpdates.clear();
    this.reconnectAttempts.clear();
  }
  
  async loadData() {
    const refreshBtn = document.getElementById('refresh-data');
    if (refreshBtn) {
      refreshBtn.classList.add('loading');
    }
    
    try {
      // 단일 호출로 필요한 항목 모두 가져오기 (429 방지)
      const url = 'https://api.coingecko.com/api/v3/coins/markets'
        + '?vs_currency=usd&order=market_cap_desc&per_page=250&page=1'
        + '&sparkline=true&price_change_percentage=1h,24h,7d,30d';

      const res = await fetch(url);
      if (!res.ok) throw new Error(`API 응답 오류: ${res.status}`);
      const allData = await res.json();
      
      // 데이터 처리
      const processedData = allData.map((coin, index) => ({
        id: coin.id,
        rank: coin.market_cap_rank || index + 1,
        name: coin.name?.replace(/['">\s]+/g, ' ').trim() || '',
        symbol: coin.symbol?.replace(/['">\s]+/g, ' ').trim().toUpperCase() || '',
        image: coin.image,
        price: coin.current_price,
        change1h: coin.price_change_percentage_1h_in_currency || 0,
        change24h: coin.price_change_percentage_24h || 0,
        change7d: coin.price_change_percentage_7d_in_currency || 0,
        volume: coin.total_volume,
        marketCap: coin.market_cap,
        sparkline: coin.sparkline_in_7d ? coin.sparkline_in_7d.price : [],
        lastUpdated: new Date().toISOString()
      }));
        
      // 시가총액 순으로 정렬
      processedData.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
        
      // 순위 재정렬
      processedData.forEach((coin, index) => {
        coin.rank = index + 1;
      });
        
      // 추가 데이터 계산
      const data = processedData.map(coin => ({
        ...coin,
        fundingRate: this.calculateFundingRate(coin),
        openInterest: this.calculateOpenInterest(coin),
        liquidation1h: this.calculateLiquidation(coin, '1h'),
        liquidation24h: this.calculateLiquidation(coin, '24h')
      }));
        
      // 데이터 매핑
      this.coins = data.map(coin => ({
        id: coin.id,
        rank: coin.rank,
        name: coin.name,
        symbol: coin.symbol,
        image: coin.image,
        price: coin.price,
        change1h: coin.change1h,
        change24h: coin.change24h,
        fundingRate: coin.fundingRate,
        volume: coin.volume,
        openInterest: coin.openInterest,
        marketCap: coin.marketCap,
        liquidation1h: coin.liquidation1h,
        liquidation24h: coin.liquidation24h,
        sparkline: coin.sparkline || []
      }));
      
      this.filterAndSort();
      
      // 새로운 코인들이 로드되면 WebSocket 재연결
      if (this.websockets.size > 0) {
        this.updateWebSocketConnections();
      }
      
      // 백그라운드에서 추가 데이터 로드
      setTimeout(() => {
        this.loadAdditionalData();
      }, 2000);
      
    } catch (error) {
      // 에러 표시
      const tbody = document.getElementById('crypto-table-body');
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="12" class="loading-row" style="text-align: center; padding: 2rem;">
              <div style="color: var(--text-secondary);">
                <i class="fas fa-exclamation-triangle" style="margin-bottom: 0.5rem; font-size: 1.5rem;"></i>
                <div>실시간 데이터를 불러올 수 없습니다</div>
                <div style="font-size: 0.9rem; margin-top: 0.5rem;">
                  CoinGecko API 호출에 실패했습니다. 잠시 후 다시 시도해주세요.
                </div>
                <button onclick="cryptoTable.loadData()" style="
                  margin-top: 1rem; 
                  padding: 0.5rem 1rem; 
                  border: 1px solid var(--border-strong); 
                  border-radius: 6px; 
                  background: var(--accent-blue); 
                  color: white; 
                  cursor: pointer;
                  font-size: 0.9rem;
                ">
                  <i class="fas fa-sync-alt"></i> 다시 시도
                </button>
              </div>
            </td>
          </tr>
        `;
      }
    } finally {
      if (refreshBtn) {
        refreshBtn.classList.remove('loading');
      }
    }
  }
  
  // 백그라운드에서 추가 데이터 로드
  async loadAdditionalData() {
    try {
      // 2~5페이지(총 1000개) 추가 로드 - 중복/빈번 호출 방지 쿨다운(15분)
      const now = Date.now();
      if (this.lastAdditionalLoadTs && now - this.lastAdditionalLoadTs < 15 * 60 * 1000) {
        return; // 최근에 이미 로드함
      }
      this.lastAdditionalLoadTs = now;
      const pages = [2, 3, 4, 5];
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const requests = pages.map(page =>
        fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}&sparkline=true&price_change_percentage=1h,24h,7d,30d`, {
          signal: controller.signal
        }).then(res => {
          if (!res.ok) throw new Error(`API 응답 오류: ${res.status}`);
          return res.json();
        })
      );
      
      const results = await Promise.allSettled(requests);
      clearTimeout(timeoutId);
      
      let additionalData = [];
      for (const r of results) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          additionalData.push(...r.value);
        }
      }
      if (additionalData.length === 0) return;
      
      // 기존 데이터와 병합(중복 제거 및 최신값 반영)
      const idToCoin = new Map(this.coins.map(c => [c.id, c]));
      
      additionalData.forEach(coin => {
        const normalized = {
          id: coin.id,
          rank: 0, // 추후 재계산
          name: coin.name?.replace(/['">\s]+/g, ' ').trim() || '',
          symbol: coin.symbol?.replace(/['">\s]+/g, ' ').trim().toUpperCase() || '',
          image: coin.image,
          price: coin.current_price,
          change1h: coin.price_change_percentage_1h_in_currency || 0,
          change24h: coin.price_change_percentage_24h || 0,
          fundingRate: this.calculateFundingRate(coin),
          volume: coin.total_volume,
          openInterest: this.calculateOpenInterest(coin),
          marketCap: coin.market_cap,
          liquidation1h: this.calculateLiquidation(coin, '1h'),
          liquidation24h: this.calculateLiquidation(coin, '24h'),
          sparkline: coin.sparkline_in_7d ? coin.sparkline_in_7d.price : []
        };
        idToCoin.set(normalized.id, normalized);
      });
      
      this.coins = Array.from(idToCoin.values());
      // 시가총액으로 정렬 후 순위 재계산
      this.coins.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
      this.coins.forEach((coin, index) => {
        coin.rank = index + 1;
      });
      
      this.filterAndSort();
      this.updateWebSocketConnections();
    } catch (error) {
    }
  }
  
  filterAndSort() {
    let filtered = [...this.coins];
    
    // 카테고리 필터링
    switch (this.currentCategory) {
      case 'gainers':
        filtered = filtered.filter(coin => coin.change24h > 0);
        break;
      case 'losers':
        filtered = filtered.filter(coin => coin.change24h < 0);
        break;
    }
   
   // 검색 필터링
   if (this.searchTerm) {
     filtered = filtered.filter(coin => 
       coin.name.toLowerCase().includes(this.searchTerm) ||
       coin.symbol.toLowerCase().includes(this.searchTerm)
     );
   }
   
   // 정렬
   filtered.sort((a, b) => {
     let aVal = a[this.sortField];
     let bVal = b[this.sortField];
     
     if (typeof aVal === 'string') {
       aVal = aVal.toLowerCase();
       bVal = bVal.toLowerCase();
     }
     
     if (this.sortDirection === 'asc') {
       return aVal > bVal ? 1 : -1;
     } else {
       return aVal < bVal ? 1 : -1;
     }
   });
   
   this.filteredCoins = filtered;
   this.currentPage = 1;
   this.render();
 }
 
 render() {
   const tbody = document.getElementById('crypto-table-body');
   if (!tbody) return;
   
   const startIndex = (this.currentPage - 1) * this.itemsPerPage;
   const endIndex = startIndex + this.itemsPerPage;
   const pageCoins = this.filteredCoins.slice(startIndex, endIndex);
   
   if (pageCoins.length === 0) {
     tbody.innerHTML = `
       <tr>
         <td colspan="12" class="loading-row">
           ${this.coins.length === 0 ? 
             '<div class="loading-spinner"></div> 데이터 로딩 중...' : 
             '검색 결과가 없습니다.'
           }
         </td>
       </tr>
     `;
     return;
   }
   
   tbody.innerHTML = pageCoins.map(coin => {
     const fallbackSvg = this.createFallbackSvg(coin.symbol);
     return `
     <tr data-coin-id="${coin.id}" ${coin.id === 'bitcoin' ? 'style="cursor: pointer;" onclick="window.location.href=\'/currencies/bitcoin/\'"' : ''}>
       <td>${coin.rank}</td>
       <td>
         <div class="coin-info">
           <img src="${coin.image}" alt="${coin.name}" class="coin-logo" 
                onerror="this.src='${fallbackSvg}'">
           <div class="coin-details">
             <div class="coin-name">${coin.name}</div>
             <div class="coin-symbol">${coin.symbol}</div>
           </div>
         </div>
       </td>
       <td class="price">$${this.formatPrice(coin.price)}</td>
       <td><span class="change ${this.getChangeClass(coin.change1h)}">${this.formatPercent(coin.change1h)}</span></td>
       <td><span class="change ${this.getChangeClass(coin.change24h)}">${this.formatPercent(coin.change24h)}</span></td>
       <td><span class="change ${this.getChangeClass(coin.fundingRate)}">${this.formatPercent(coin.fundingRate)}</span></td>
       <td class="volume">$${this.formatNumber(coin.volume)}</td>
       <td class="oi">$${this.formatNumber(coin.openInterest)}</td>
       <td class="market-cap">$${this.formatNumber(coin.marketCap)}</td>
       <td class="liquidation">$${this.formatNumber(coin.liquidation1h)}</td>
       <td class="liquidation">$${this.formatNumber(coin.liquidation24h)}</td>
       <td>
         <canvas class="mini-chart" width="60" height="30" 
                onclick="window.open('https://www.tradingview.com/chart/?symbol=BINANCE:${coin.symbol}USDT', '_blank')"
                 data-sparkline='${JSON.stringify(coin.sparkline)}'></canvas>
       </td>
     </tr>
     `;
   }).join('');
   
   // 미니 차트 그리기
   this.drawMiniCharts();
   
   // 페이지네이션 업데이트
   this.updatePagination();
 }
 
 drawMiniCharts() {
   document.querySelectorAll('.mini-chart').forEach(canvas => {
     const sparkline = JSON.parse(canvas.dataset.sparkline || '[]');
     if (!sparkline || sparkline.length === 0) return;
     
     const ctx = canvas.getContext('2d');
     const width = canvas.width;
     const height = canvas.height;
     
     ctx.clearRect(0, 0, width, height);
     
     const min = Math.min(...sparkline);
     const max = Math.max(...sparkline);
     const range = max - min;
     
     if (range === 0) return;
     
     ctx.strokeStyle = sparkline[sparkline.length - 1] > sparkline[0] ? '#10b981' : '#ef4444';
     ctx.lineWidth = 1.5;
     ctx.beginPath();
     
     sparkline.forEach((price, index) => {
       const x = (index / (sparkline.length - 1)) * width;
       const y = height - ((price - min) / range) * height;
       
       if (index === 0) {
         ctx.moveTo(x, y);
       } else {
         ctx.lineTo(x, y);
       }
     });
     
     ctx.stroke();
   });
 }
 
 updateSortHeaders() {
   document.querySelectorAll('.sortable').forEach(th => {
     th.classList.remove('sort-asc', 'sort-desc');
     if (th.dataset.sort === this.sortField) {
       th.classList.add(`sort-${this.sortDirection}`);
     }
   });
 }
 
 updatePagination() {
   const totalPages = Math.ceil(this.filteredCoins.length / this.itemsPerPage);
   
   const prevBtn = document.getElementById('prev-page');
   const nextBtn = document.getElementById('next-page');
   const pageInfo = document.getElementById('page-info');
   
   if (prevBtn) prevBtn.disabled = this.currentPage === 1;
   if (nextBtn) nextBtn.disabled = this.currentPage === totalPages || totalPages === 0;
   if (pageInfo) {
     const startItem = (this.currentPage - 1) * this.itemsPerPage + 1;
     const endItem = Math.min(this.currentPage * this.itemsPerPage, this.filteredCoins.length);
     pageInfo.textContent = `${startItem}-${endItem} / ${this.filteredCoins.length} (페이지 ${this.currentPage}/${totalPages || 1})`;
   }
 }
 
 formatPrice(price) {
   if (price >= 1) {
     return price.toLocaleString('en-US', {
       minimumFractionDigits: 2,
       maximumFractionDigits: 2
     });
   } else {
     return price.toFixed(6);
   }
 }
 
 formatPercent(percent) {
   const sign = percent >= 0 ? '+' : '';
   return `${sign}${percent.toFixed(2)}%`;
 }
 
 formatNumber(num) {
   if (num >= 1e12) {
     return (num / 1e12).toFixed(2) + 'T';
   } else if (num >= 1e9) {
     return (num / 1e9).toFixed(2) + 'B';
   } else if (num >= 1e6) {
     return (num / 1e6).toFixed(2) + 'M';
   } else if (num >= 1e3) {
     return (num / 1e3).toFixed(2) + 'K';
   } else {
     return num.toLocaleString();
   }
 }
 
 getChangeClass(change) {
   if (change > 0) return 'positive';
   if (change < 0) return 'negative';
   return 'neutral';
 }
 
 // 백업 SVG 생성
 createFallbackSvg(symbol) {
   const firstChar = symbol ? symbol.charAt(0) : '?';
   const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
     <circle cx="16" cy="16" r="16" fill="#ddd"/>
     <text x="16" y="20" text-anchor="middle" fill="#999" font-size="10">${firstChar}</text>
   </svg>`;
   return 'data:image/svg+xml,' + encodeURIComponent(svg);
 }
 
 // 추가 데이터 계산 함수들
 calculateFundingRate(coin) {
   const volatility = Math.abs(coin.change24h || 0);
   const volumeRatio = Math.min((coin.volume || 0) / (coin.marketCap || 1), 1);
   
   let funding = (Math.sin(coin.rank || 1) * 0.05) + (volatility * 0.01);
   funding *= (1 + volumeRatio * 0.5);
   
   return Math.max(-0.1, Math.min(0.1, funding));
 }
 
 calculateOpenInterest(coin) {
   const baseRatio = 0.08;
   const volumeBoost = Math.min((coin.volume || 0) / (coin.marketCap || 1), 0.5) * 0.1;
   const rankBoost = Math.max(0, (100 - (coin.rank || 100)) / 1000);
   
   return (coin.marketCap || 0) * (baseRatio + volumeBoost + rankBoost);
 }

 calculateOIChange(coin, period) {
   const priceChange = period === '1h' ? 
     (coin.change1h || 0) : 
     (coin.change24h || 0) / 4;
   
   const correlation = -0.3 + (Math.random() * 0.6);
   return priceChange * correlation;
 }
 
 calculateLiquidation(coin, period) {
   const volatility = Math.abs(coin.change24h || 0);
   const volume = coin.volume || 0;
   
   const liquidationRatio = Math.min(volatility * 0.02, 0.1);
   const baseLiquidation = volume * liquidationRatio;
   
   return period === '24h' ? baseLiquidation : baseLiquidation / 24;
 }
}

// CSS 스타일 추가
const style = document.createElement('style');
style.textContent = `
  .price-up {
    background-color: rgba(34, 197, 94, 0.2) !important;
    color: #22c55e !important;
    transition: all 0.3s ease;
  }
  
  .price-down {
    background-color: rgba(239, 68, 68, 0.2) !important;
    color: #ef4444 !important;
    transition: all 0.3s ease;
  }
  
     .crypto-table .price {
     transition: background-color 0.3s ease, color 0.3s ease;
     border-radius: 4px;
     padding: 4px 8px;
   }
`;
document.head.appendChild(style);

// 페이지 종료 시 WebSocket 정리
window.addEventListener('beforeunload', () => {
  if (window.cryptoTable) {
    window.cryptoTable.closeWebSockets();
  }
});

// 페이지 가시성 변경 시 WebSocket 관리
document.addEventListener('visibilitychange', () => {
  if (window.cryptoTable) {
    if (document.hidden) {
      // 페이지가 숨겨지면 WebSocket 일시 중단
      window.cryptoTable.closeWebSockets();
    } else {
      // 페이지가 다시 보이면 WebSocket 재연결
      setTimeout(() => {
        window.cryptoTable.initializeWebSockets();
      }, 1000);
    }
  }
});

window.CryptoTable = CryptoTable;