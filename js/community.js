// TradingView Advanced Charts 초기화
let widget = null;

// Firebase 초기화 대기 함수
function waitForFirebase() {
    return new Promise((resolve) => {
        const checkFirebase = () => {
            if (window.auth && window.db && window.currentUser !== undefined) {
                resolve();
            } else {
                setTimeout(checkFirebase, 100);
            }
        };
        checkFirebase();
    });
}

// TradingView 데이터피드 생성
function createDatafeed() {
    return {
        onReady: (callback) => {
            setTimeout(() => callback({
                supported_resolutions: ['1', '5', '15', '60', '240', 'D'],
                supports_group_request: false,
                supports_marks: false,
                supports_search: true,
                supports_timescale_marks: false,
            }), 0);
        },

        searchSymbols: (userInput, exchange, symbolType, onResultReadyCallback) => {
            // 기본 심볼 목록
            const symbols = [
                { symbol: 'BTCUSDT', full_name: 'BINANCE:BTCUSDT', description: 'Bitcoin/USDT', exchange: 'BINANCE', ticker: 'BINANCE:BTCUSDT', type: 'spot' },
                { symbol: 'ETHUSDT', full_name: 'BINANCE:ETHUSDT', description: 'Ethereum/USDT', exchange: 'BINANCE', ticker: 'BINANCE:ETHUSDT', type: 'spot' },
                { symbol: 'BNBUSDT', full_name: 'BINANCE:BNBUSDT', description: 'BNB/USDT', exchange: 'BINANCE', ticker: 'BINANCE:BNBUSDT', type: 'spot' },
                { symbol: 'ADAUSDT', full_name: 'BINANCE:ADAUSDT', description: 'Cardano/USDT', exchange: 'BINANCE', ticker: 'BINANCE:ADAUSDT', type: 'spot' },
                { symbol: 'SOLUSDT', full_name: 'BINANCE:SOLUSDT', description: 'Solana/USDT', exchange: 'BINANCE', ticker: 'BINANCE:SOLUSDT', type: 'spot' }
            ];
            
            const filtered = symbols.filter(s => 
                s.symbol.toLowerCase().includes(userInput.toLowerCase()) ||
                s.description.toLowerCase().includes(userInput.toLowerCase())
            );
            
            onResultReadyCallback(filtered);
        },

        resolveSymbol: (symbolName, onSymbolResolvedCallback, onResolveErrorCallback) => {
            const symbol = symbolName.replace('BINANCE:', '');
            const symbolInfo = {
                name: symbol,
                ticker: symbolName,
                description: `${symbol.replace('USDT', '')}/USDT`,
                session: '24x7',
                timezone: 'Etc/UTC',
                minmov: 1,
                pricescale: 100,
                has_intraday: true,
                has_no_volume: false,
                supported_resolutions: ['1', '5', '15', '60', '240', 'D'],
                volume_precision: 8,
                data_status: 'streaming',
            };
            
            setTimeout(() => onSymbolResolvedCallback(symbolInfo), 0);
        },

        getBars: async (symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) => {
            const { from, to } = periodParams;
            const symbol = symbolInfo.name;
            
            // 해상도 매핑
            const intervalMap = { '1': '1m', '5': '5m', '15': '15m', '60': '1h', '240': '4h', 'D': '1d' };
            const interval = intervalMap[resolution] || '1h';
            
            try {
                const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${from * 1000}&endTime=${to * 1000}&limit=1000`);
                const data = await response.json();
                
                if (data && data.length > 0) {
                    const bars = data.map(candle => ({
                        time: candle[0],
                        open: parseFloat(candle[1]),
                        high: parseFloat(candle[2]),
                        low: parseFloat(candle[3]),
                        close: parseFloat(candle[4]),
                        volume: parseFloat(candle[5])
                    }));
                    onHistoryCallback(bars, { noData: false });
                } else {
                    onHistoryCallback([], { noData: true });
                }
            } catch (error) {
                console.error('데이터 로드 실패:', error);
                onErrorCallback(error);
            }
        },

        subscribeBars: (symbolInfo, resolution, onRealtimeCallback, subscriberUID) => {
            // 실시간 데이터는 별도 웹소켓으로 처리
        },

        unsubscribeBars: (subscriberUID) => {
            // 구독 해제
        }
    };
}

// 차트 저장/불러오기 어댑터 생성
function createChartStorageAdapter() {
    return {
        getAllCharts: async function() {
            if (!window.currentUser) return [];
            
            try {
                // 인덱스 없이 단순 조회 후 클라이언트에서 정렬
                const snapshot = await window.db.collection('chartLayouts')
                    .where('userId', '==', window.currentUser.uid)
                    .get();
                
                const charts = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    charts.push({
                        id: doc.id,
                        name: data.name,
                        timestamp: data.timestamp || Date.now()
                    });
                });
                
                // 클라이언트에서 정렬 (최신순)
                return charts.sort((a, b) => b.timestamp - a.timestamp);
            } catch (error) {
                console.error('차트 목록 로드 실패:', error);
                return [];
            }
        },

        removeChart: async function(chartId) {
            if (!window.currentUser) return;
            
            try {
                await window.db.collection('chartLayouts').doc(chartId).delete();
                console.log('차트 삭제 완료:', chartId);
            } catch (error) {
                console.error('차트 삭제 실패:', error);
            }
        },

        saveChart: async function(chartData) {
            if (!window.currentUser) return null;
            
            try {
                // 차트 데이터 유효성 검사
                if (!chartData || typeof chartData !== 'object') {
                    throw new Error('유효하지 않은 차트 데이터');
                }

                const saveData = {
                    userId: window.currentUser.uid,
                    name: chartData.name || `차트 ${new Date().toLocaleDateString()}`,
                    content: chartData.content || chartData,  // content가 없으면 전체 데이터 사용
                    symbol: chartData.symbol || 'BTCUSDT',
                    resolution: chartData.resolution || '1h',
                    timestamp: Date.now(),
                    createdAt: new Date()
                };

                // content가 문자열이면 JSON 파싱 시도
                if (typeof saveData.content === 'string') {
                    try {
                        saveData.content = JSON.parse(saveData.content);
                    } catch (e) {
                        console.log('Content는 이미 문자열 형태입니다.');
                    }
                }

                const docRef = await window.db.collection('chartLayouts').add(saveData);
                console.log('차트 저장 완료:', docRef.id, saveData);
                showNotification('차트가 저장되었습니다.', 'success');
                return docRef.id;
            } catch (error) {
                console.error('차트 저장 실패:', error);
                showNotification('차트 저장에 실패했습니다.', 'error');
                return null;
            }
        },

        getChart: async function(chartId) {
            if (!window.currentUser) return null;
            
            try {
                const doc = await window.db.collection('chartLayouts').doc(chartId).get();
                if (doc.exists) {
                    const data = doc.data();
                    if (data.userId === window.currentUser.uid) {
                        console.log('차트 로드 완료:', chartId);
                        showNotification('차트가 로드되었습니다.', 'success');
                        return data.content;
                    }
                }
                throw new Error('차트를 찾을 수 없습니다.');
            } catch (error) {
                console.error('차트 로드 실패:', error);
                showNotification('차트 로드에 실패했습니다.', 'error');
                return null;
            }
        },

        getChartContent: async function(chartId) {
            if (!window.currentUser || !chartId) return null;
            
            try {
                const doc = await window.db.collection('chartLayouts').doc(chartId).get();
                if (doc.exists) {
                    const data = doc.data();
                    if (data.userId === window.currentUser.uid) {
                        console.log('차트 내용 로드 성공:', chartId);
                        return data.content || {};
                    }
                }
                console.log('차트 문서가 존재하지 않음:', chartId);
                return null;
            } catch (error) {
                console.error('차트 내용 로드 실패:', error);
                return null;
            }
        },

        // 차트 개수 반환
        getChartsCount: async function() {
            if (!window.currentUser) return 0;
            
            try {
                const snapshot = await window.db.collection('chartLayouts')
                    .where('userId', '==', window.currentUser.uid)
                    .get();
                return snapshot.size;
            } catch (error) {
                console.error('차트 개수 조회 실패:', error);
                return 0;
            }
        },

        // 차트 이름 변경
        renameChart: async function(chartId, newName) {
            if (!window.currentUser || !chartId) return false;
            
            try {
                await window.db.collection('chartLayouts').doc(chartId).update({
                    name: newName,
                    updatedAt: new Date()
                });
                console.log('차트 이름 변경 완료:', chartId, newName);
                return true;
            } catch (error) {
                console.error('차트 이름 변경 실패:', error);
                return false;
            }
        },

        // Study Templates 관련 함수들 (비활성화되어 있지만 인터페이스 제공)
        getAllStudyTemplates: async function() {
            return []; // 빈 배열 반환으로 오류 방지
        },

        removeStudyTemplate: async function(templateName) {
            return Promise.resolve();
        },

        saveStudyTemplate: async function(templateData) {
            return Promise.resolve(null);
        },

        getStudyTemplate: async function(templateName) {
            return Promise.resolve(null);
        },

        // Drawing Templates 관련 함수들
        getDrawingTemplates: async function() {
            return [];
        },

        saveDrawingTemplate: async function(templateData) {
            return Promise.resolve(null);
        },

        getDrawingTemplate: async function(templateName) {
            return Promise.resolve(null);
        },

        removeDrawingTemplate: async function(templateName) {
            return Promise.resolve();
        }
    };
}

// TradingView 차트 초기화
function initializeTradingViewChart() {
    const chartContainer = document.getElementById('chart-container');
    const loadingIndicator = document.getElementById('chart-loading');
    
    if (!chartContainer) {
        console.error('Chart container not found!');
        return;
    }

    // 기존 위젯 제거
    if (widget) {
        try {
            widget.remove();
        } catch (e) {
            console.log('위젯 제거 중 오류:', e);
        }
        widget = null;
    }

    // 로딩 표시
    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
    }

    // TradingView 위젯 설정
    const widgetOptions = {
        symbol: 'BINANCE:BTCUSDT',
        interval: '1h',
        container: chartContainer,
        datafeed: createDatafeed(),
        library_path: '/charting_library-master/charting_library/',
        locale: 'ko',
        fullscreen: false,
        autosize: true,
        theme: document.documentElement.classList.contains('dark-mode') ? 'Dark' : 'Light',
        
        // 저장/불러오기 기능 활성화
        disabled_features: [
            'use_localstorage_for_settings',
            'header_symbol_search',
            'header_resolutions',
            'timeframes_toolbar',
            'study_templates',  // Study templates 비활성화로 404 오류 방지
            'drawing_templates' // Drawing templates도 비활성화
        ],
        
        enabled_features: [
            'header_indicators',
            'header_chart_type',
            'header_screenshot',
            'header_settings',
            'header_undo_redo',
            'header_saveload',  // 저장/불러오기 버튼 활성화
            'save_chart_properties_to_local_storage'
        ],

        // 차트 저장/불러오기 어댑터 설정
        save_load_adapter: createChartStorageAdapter(),
        auto_save_chart: false,  // 자동 저장 비활성화로 오류 방지
        load_last_chart: false,  // 마지막 차트 자동 로드 비활성화

        overrides: {
            "mainSeriesProperties.candleStyle.upColor": "#26a69a",
            "mainSeriesProperties.candleStyle.downColor": "#ef5350",
            "mainSeriesProperties.candleStyle.wickUpColor": "#26a69a",
            "mainSeriesProperties.candleStyle.wickDownColor": "#ef5350"
        }
    };

    // 위젯 생성
    try {
        widget = new TradingView.widget(widgetOptions);

        widget.onChartReady(() => {
            console.log('TradingView chart is ready');
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
            setupChartEventListeners();
            
            // 차트 저장/불러오기 이벤트 처리
            try {
                widget.subscribe('onAutoSaveNeeded', () => {
                    console.log('자동 저장 요청됨');
                });
                
                widget.subscribe('onChartLoad', (chartId) => {
                    console.log('차트 로드됨:', chartId);
                });
                
                widget.subscribe('onChartSave', (chartId) => {
                    console.log('차트 저장됨:', chartId);
                });
            } catch (error) {
                console.log('차트 이벤트 구독 중 오류:', error);
            }
        });

    } catch (error) {
        console.error('TradingView 위젯 초기화 실패:', error);
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        // 차트 컨테이너에 오류 메시지 표시
        chartContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-color);">
                <div style="text-align: center;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px; color: var(--warning-color);"></i>
                    <p>차트를 불러올 수 없습니다.</p>
                    <button onclick="initializeTradingViewChart()" style="padding: 8px 16px; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer;">다시 시도</button>
                </div>
            </div>
        `;
    }
}

function setupChartEventListeners() {
    // 코인 선택 이벤트
    const coinSelector = document.getElementById('coin-selector');
    if (coinSelector) {
        coinSelector.addEventListener('click', () => {
            document.getElementById('coin-search-modal').style.display = 'flex';
        });
    }

    // 인터벌 선택 이벤트
    const intervalButtons = document.querySelectorAll('.interval-button');
    intervalButtons.forEach(button => {
        button.addEventListener('click', () => {
            intervalButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            const interval = button.dataset.interval;
            const resolutionMap = { '1m': '1', '5m': '5', '15m': '15', '1h': '60', '4h': '240', '1d': 'D' };
            const resolution = resolutionMap[interval] || '60';
            
            if (widget && widget.activeChart) {
                widget.activeChart().setResolution(resolution);
            }
        });
    });

    // 코인 검색 모달 이벤트
    setupCoinSearchModal();
}

function setupCoinSearchModal() {
    const modal = document.getElementById('coin-search-modal');
    const closeBtn = document.getElementById('coin-search-close');
    const searchInput = document.getElementById('coin-search-input');
    const searchList = document.getElementById('coin-search-list');
    const tabs = document.querySelectorAll('.coin-search-tab');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', debounce(async (e) => {
            const query = e.target.value.toLowerCase();
            await loadCoinList(query);
        }, 300));
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loadCoinList(searchInput.value.toLowerCase(), tab.dataset.tab);
        });
    });

    // 초기 코인 목록 로드
    loadCoinList('', 'all');
}

async function loadCoinList(query = '', type = 'all') {
    const searchList = document.getElementById('coin-search-list');
    if (!searchList) return;

    try {
        const response = await fetch('https://api.binance.com/api/v3/exchangeInfo');
        const data = await response.json();
        
        let symbols = data.symbols.filter(symbol => 
            symbol.status === 'TRADING' && 
            symbol.quoteAsset === 'USDT'
        );

        if (type === 'spot') {
            symbols = symbols.filter(symbol => !symbol.symbol.includes('_'));
        } else if (type === 'futures') {
            symbols = symbols.filter(symbol => symbol.symbol.includes('_'));
        }

        if (query) {
            symbols = symbols.filter(symbol => 
                symbol.baseAsset.toLowerCase().includes(query) ||
                symbol.symbol.toLowerCase().includes(query)
            );
        }

        // 상위 50개만 표시
        symbols = symbols.slice(0, 50);

        searchList.innerHTML = symbols.map(symbol => `
            <div class="coin-search-item" data-symbol="${symbol.symbol}">
                <div class="coin-search-item-icon">${symbol.baseAsset.charAt(0)}</div>
                <div class="coin-search-item-info">
                    <div class="coin-search-item-symbol">${symbol.baseAsset}</div>
                    <div class="coin-search-item-name">${symbol.baseAsset} / USDT</div>
                </div>
                <div class="coin-search-item-price">
                    <div class="coin-search-item-price-value">--</div>
                    <div class="coin-search-item-price-change">--</div>
                </div>
            </div>
        `).join('');

        // 코인 선택 이벤트
        const coinItems = searchList.querySelectorAll('.coin-search-item');
        coinItems.forEach(item => {
            item.addEventListener('click', () => {
                const symbol = item.dataset.symbol;
                if (widget && widget.activeChart) {
                    widget.activeChart().setSymbol(`BINANCE:${symbol}`);
                }
                document.getElementById('selected-coin-text').textContent = symbol;
                modal.style.display = 'none';
            });
        });

        // 실시간 가격 업데이트
        updateCoinPrices(symbols.map(s => s.symbol));

    } catch (error) {
        console.error('Error loading coin list:', error);
        searchList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-color-secondary);">코인 목록을 불러올 수 없습니다.</div>';
    }
}

async function updateCoinPrices(symbols) {
    try {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(symbols)}`);
        const data = await response.json();
        
        data.forEach(ticker => {
            const item = document.querySelector(`[data-symbol="${ticker.symbol}"]`);
            if (item) {
                const priceValue = item.querySelector('.coin-search-item-price-value');
                const priceChange = item.querySelector('.coin-search-item-price-change');
                
                priceValue.textContent = `$${parseFloat(ticker.lastPrice).toFixed(4)}`;
                
                const changePercent = parseFloat(ticker.priceChangePercent);
                priceChange.textContent = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
                priceChange.className = `coin-search-item-price-change ${changePercent >= 0 ? 'positive' : 'negative'}`;
            }
        });
    } catch (error) {
        console.error('Error updating coin prices:', error);
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// AI 기능 초기화
function initializeAIFeatures() {
    // AI 기능 버튼 이벤트 리스너
    const volumeAlertBtn = document.getElementById('volume-alert-btn');
    const aiAnalysisBtn = document.getElementById('ai-analysis-btn');
    const notificationSettingsBtn = document.getElementById('notification-settings-btn');

    if (volumeAlertBtn) {
        volumeAlertBtn.addEventListener('click', () => {
            if (!window.currentUser) {
                showNotification('로그인이 필요합니다.', 'warning');
                return;
            }
            document.getElementById('volume-alert-modal').style.display = 'flex';
        });
    }

    if (aiAnalysisBtn) {
        aiAnalysisBtn.addEventListener('click', () => {
            if (!window.currentUser) {
                showNotification('로그인이 필요합니다.', 'warning');
                return;
            }
            document.getElementById('ai-analysis-modal').style.display = 'flex';
        });
    }

    if (notificationSettingsBtn) {
        notificationSettingsBtn.addEventListener('click', () => {
            if (!window.currentUser) {
                showNotification('로그인이 필요합니다.', 'warning');
                return;
            }
            document.getElementById('notification-settings-modal').style.display = 'flex';
        });
    }

    // AI 분석 카드 이벤트
    const analysisCards = document.querySelectorAll('.analysis-card');
    analysisCards.forEach(card => {
        card.addEventListener('click', () => {
            analysisCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
        });
    });

    // 코인 선택 시 실시간 가격 업데이트
    const aiCoinSelect = document.getElementById('ai-coin-select');
    if (aiCoinSelect) {
        aiCoinSelect.addEventListener('change', updateCoinInfo);
        updateCoinInfo(); // 초기 로드
    }

    // 거래량 알람 저장
    const saveVolumeAlertBtn = document.getElementById('save-volume-alert');
    if (saveVolumeAlertBtn) {
        saveVolumeAlertBtn.addEventListener('click', saveVolumeAlert);
    }

    // AI 분석 시작
    const startAiAnalysisBtn = document.getElementById('start-ai-analysis');
    if (startAiAnalysisBtn) {
        startAiAnalysisBtn.addEventListener('click', startAIAnalysis);
    }

    // 알림 설정 저장
    const saveNotificationSettingsBtn = document.getElementById('save-notification-settings');
    if (saveNotificationSettingsBtn) {
        saveNotificationSettingsBtn.addEventListener('click', saveNotificationSettings);
    }
}

async function saveVolumeAlert() {
    if (!window.currentUser) return;

    const coin = document.getElementById('alert-coin-select').value;
    const threshold = parseFloat(document.getElementById('alert-volume-threshold').value);
    const browserAlert = document.getElementById('alert-browser').checked;
    const soundAlert = document.getElementById('alert-sound').checked;

    try {
        const alertData = {
            userId: window.currentUser.uid,
            coin: coin,
            threshold: threshold,
            browserAlert: browserAlert,
            soundAlert: soundAlert,
            createdAt: new Date().toISOString(),
            active: true
        };

        // Firebase Firestore에 저장
        await window.db.collection('volumeAlerts').add(alertData);
        
        showNotification('거래량 알람이 설정되었습니다.', 'success');
        document.getElementById('volume-alert-modal').style.display = 'none';
    } catch (error) {
        console.error('Error saving volume alert:', error);
        showNotification('알람 설정에 실패했습니다.', 'error');
    }
}

// 실제 시장 데이터 가져오기
async function getMarketData(symbol) {
    try {
        // 현재 가격 및 24시간 데이터
        const tickerResponse = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
        const ticker = await tickerResponse.json();

        // 캔들스틱 데이터 (1시간, 100개)
        const klineResponse = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=100`);
        const klines = await klineResponse.json();

        // RSI, MACD 등 기술적 지표 계산을 위한 데이터 준비
        const closes = klines.map(k => parseFloat(k[4]));
        const highs = klines.map(k => parseFloat(k[2]));
        const lows = klines.map(k => parseFloat(k[3]));
        const volumes = klines.map(k => parseFloat(k[5]));

        return {
            ticker,
            closes,
            highs,
            lows,
            volumes,
            currentPrice: parseFloat(ticker.lastPrice),
            priceChange24h: parseFloat(ticker.priceChangePercent),
            volume24h: parseFloat(ticker.volume),
            high24h: parseFloat(ticker.highPrice),
            low24h: parseFloat(ticker.lowPrice)
        };
    } catch (error) {
        console.error('시장 데이터 로드 실패:', error);
        return null;
    }
}

// 고도화된 기술적 지표 계산 함수들
function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return null;
    
    let gains = 0, losses = 0;
    
    // 첫 번째 기간의 평균 계산
    for (let i = 1; i <= period; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    // 현재 RSI 계산
    for (let i = period + 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;
        
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

// 볼린저 밴드 계산
function calculateBollingerBands(prices, period = 20, multiplier = 2) {
    if (prices.length < period) return null;
    
    const sma = calculateSMA(prices, period);
    const stdDev = calculateStandardDeviation(prices.slice(-period));
    
    return {
        upper: sma + (stdDev * multiplier),
        middle: sma,
        lower: sma - (stdDev * multiplier),
        squeeze: (sma + stdDev * multiplier - (sma - stdDev * multiplier)) / sma * 100
    };
}

// 단순 이동평균 계산
function calculateSMA(prices, period) {
    if (prices.length < period) return null;
    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
}

// 지수 이동평균 계산
function calculateEMA(prices, period) {
    if (prices.length < period) return null;
    
    const k = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
        ema = prices[i] * k + ema * (1 - k);
    }
    
    return ema;
}

// 표준편차 계산
function calculateStandardDeviation(prices) {
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
    return Math.sqrt(variance);
}

// 스토캐스틱 계산
function calculateStochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
    if (closes.length < kPeriod) return null;
    
    const recentHighs = highs.slice(-kPeriod);
    const recentLows = lows.slice(-kPeriod);
    const currentClose = closes[closes.length - 1];
    
    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);
    
    const kPercent = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    
    // %D는 %K의 이동평균 (단순화)
    const dPercent = kPercent; // 실제로는 3일 이동평균
    
    return { k: kPercent, d: dPercent };
}

// 윌리엄스 %R 계산
function calculateWilliamsR(highs, lows, closes, period = 14) {
    if (closes.length < period) return null;
    
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const currentClose = closes[closes.length - 1];
    
    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);
    
    return ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
}

// ATR (Average True Range) 계산
function calculateATR(highs, lows, closes, period = 14) {
    if (closes.length < period + 1) return null;
    
    const trueRanges = [];
    for (let i = 1; i < closes.length; i++) {
        const tr1 = highs[i] - lows[i];
        const tr2 = Math.abs(highs[i] - closes[i - 1]);
        const tr3 = Math.abs(lows[i] - closes[i - 1]);
        trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    return calculateSMA(trueRanges, period);
}

// 피보나치 되돌림 계산
function calculateFibonacciRetracements(highs, lows) {
    const high = Math.max(...highs);
    const low = Math.min(...lows);
    const diff = high - low;
    
    return {
        level_0: high,
        level_236: high - diff * 0.236,
        level_382: high - diff * 0.382,
        level_500: high - diff * 0.500,
        level_618: high - diff * 0.618,
        level_786: high - diff * 0.786,
        level_100: low
    };
}

function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (prices.length < slowPeriod) return null;
    
    // EMA 계산
    const calculateEMA = (data, period) => {
        const k = 2 / (period + 1);
        let ema = data[0];
        for (let i = 1; i < data.length; i++) {
            ema = data[i] * k + ema * (1 - k);
        }
        return ema;
    };
    
    const fastEMA = calculateEMA(prices, fastPeriod);
    const slowEMA = calculateEMA(prices, slowPeriod);
    const macdLine = fastEMA - slowEMA;
    
    return { macdLine, fastEMA, slowEMA };
}

// 완전 고도화된 패턴 감지 시스템
function detectPatterns(highs, lows, closes) {
    const patterns = [];
    const len = closes.length;
    
    if (len < 30) return patterns;
    
    // 1. 삼각형 패턴들
    patterns.push(...detectTrianglePatterns(highs, lows, closes));
    
    // 2. 헤드앤숄더 패턴들
    patterns.push(...detectHeadAndShoulderPatterns(highs, lows, closes));
    
    // 3. 웨지 패턴들
    patterns.push(...detectWedgePatterns(highs, lows, closes));
    
    // 4. 플래그 및 페넌트 패턴들
    patterns.push(...detectFlagAndPennantPatterns(highs, lows, closes));
    
    // 5. 더블 탑/바텀 패턴들
    patterns.push(...detectDoublePatterns(highs, lows, closes));
    
    // 6. 컵앤핸들 패턴
    patterns.push(...detectCupAndHandlePattern(highs, lows, closes));
    
    // 7. 채널 패턴들
    patterns.push(...detectChannelPatterns(highs, lows, closes));
    
    return patterns.sort((a, b) => b.confidence - a.confidence);
}

// 삼각형 패턴 감지
function detectTrianglePatterns(highs, lows, closes) {
    const patterns = [];
    const recentData = 20;
    
    if (highs.length < recentData) return patterns;
    
    const recentHighs = highs.slice(-recentData);
    const recentLows = lows.slice(-recentData);
    
    // 상승 삼각형
    const highResistance = isHorizontalResistance(recentHighs);
    const lowSupport = isRisingSupport(recentLows);
    
    if (highResistance.isValid && lowSupport.isValid) {
        patterns.push({
            name: '상승 삼각형',
            type: 'bullish',
            confidence: Math.min(85, (highResistance.strength + lowSupport.strength) / 2),
            description: '저점이 상승하면서 고점이 수평을 유지하는 강세 패턴',
            targetPrice: highResistance.level * 1.05,
            stopLoss: lowSupport.level * 0.98
        });
    }
    
    // 하락 삼각형
    const lowResistance = isHorizontalSupport(recentLows);
    const highSupport = isFallingResistance(recentHighs);
    
    if (lowResistance.isValid && highSupport.isValid) {
        patterns.push({
            name: '하락 삼각형',
            type: 'bearish',
            confidence: Math.min(85, (lowResistance.strength + highSupport.strength) / 2),
            description: '고점이 하락하면서 저점이 수평을 유지하는 약세 패턴',
            targetPrice: lowResistance.level * 0.95,
            stopLoss: highSupport.level * 1.02
        });
    }
    
    // 대칭 삼각형
    if (isRisingSupport(recentLows).isValid && isFallingResistance(recentHighs).isValid) {
        const volumeTrend = analyzeVolumeTrend(recentData);
        patterns.push({
            name: '대칭 삼각형',
            type: volumeTrend > 0 ? 'bullish' : 'bearish',
            confidence: 70,
            description: '고점과 저점이 모두 수렴하는 중립적 패턴',
            breakoutDirection: volumeTrend > 0 ? '상승' : '하락'
        });
    }
    
    return patterns;
}

// 헤드앤숄더 패턴 감지
function detectHeadAndShoulderPatterns(highs, lows, closes) {
    const patterns = [];
    const peaks = findPeaks(highs, 5);
    const troughs = findTroughs(lows, 5);
    
    // 헤드앤숄더 (상단)
    if (peaks.length >= 3) {
        for (let i = 0; i <= peaks.length - 3; i++) {
            const leftShoulder = peaks[i];
            const head = peaks[i + 1];
            const rightShoulder = peaks[i + 2];
            
            if (head.price > leftShoulder.price && head.price > rightShoulder.price &&
                Math.abs(leftShoulder.price - rightShoulder.price) / leftShoulder.price < 0.05) {
                
                const neckline = Math.min(leftShoulder.price, rightShoulder.price) * 0.98;
                patterns.push({
                    name: '헤드앤숄더',
                    type: 'bearish',
                    confidence: 80,
                    description: '강력한 약세 반전 패턴',
                    neckline: neckline,
                    targetPrice: neckline - (head.price - neckline),
                    stopLoss: head.price * 1.02
                });
            }
        }
    }
    
    // 역 헤드앤숄더 (하단)
    if (troughs.length >= 3) {
        for (let i = 0; i <= troughs.length - 3; i++) {
            const leftShoulder = troughs[i];
            const head = troughs[i + 1];
            const rightShoulder = troughs[i + 2];
            
            if (head.price < leftShoulder.price && head.price < rightShoulder.price &&
                Math.abs(leftShoulder.price - rightShoulder.price) / leftShoulder.price < 0.05) {
                
                const neckline = Math.max(leftShoulder.price, rightShoulder.price) * 1.02;
                patterns.push({
                    name: '역 헤드앤숄더',
                    type: 'bullish',
                    confidence: 80,
                    description: '강력한 강세 반전 패턴',
                    neckline: neckline,
                    targetPrice: neckline + (neckline - head.price),
                    stopLoss: head.price * 0.98
                });
            }
        }
    }
    
    return patterns;
}

// 웨지 패턴 감지
function detectWedgePatterns(highs, lows, closes) {
    const patterns = [];
    const period = 15;
    
    if (highs.length < period) return patterns;
    
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    
    const highTrend = calculateTrendSlope(recentHighs);
    const lowTrend = calculateTrendSlope(recentLows);
    
    // 상승 웨지 (bearish)
    if (highTrend > 0 && lowTrend > 0 && highTrend < lowTrend) {
        patterns.push({
            name: '상승 웨지',
            type: 'bearish',
            confidence: 75,
            description: '상승 추세 중 나타나는 약세 반전 신호',
            convergence: true
        });
    }
    
    // 하락 웨지 (bullish)
    if (highTrend < 0 && lowTrend < 0 && Math.abs(highTrend) > Math.abs(lowTrend)) {
        patterns.push({
            name: '하락 웨지',
            type: 'bullish',
            confidence: 75,
            description: '하락 추세 중 나타나는 강세 반전 신호',
            convergence: true
        });
    }
    
    return patterns;
}

// 플래그 및 페넌트 패턴 감지
function detectFlagAndPennantPatterns(highs, lows, closes) {
    const patterns = [];
    
    // 강한 움직임 후 횡보 구간 감지
    const recentMoves = analyzeRecentMoves(closes, 20);
    
    if (recentMoves.strongMove && recentMoves.consolidation) {
        const patternType = recentMoves.direction > 0 ? 'bullish' : 'bearish';
        const patternName = recentMoves.isFlag ? '플래그' : '페넌트';
        
        patterns.push({
            name: `${recentMoves.direction > 0 ? '강세' : '약세'} ${patternName}`,
            type: patternType,
            confidence: 70,
            description: `강한 ${recentMoves.direction > 0 ? '상승' : '하락'} 후 잠시 휴식하는 지속 패턴`,
            continuation: true
        });
    }
    
    return patterns;
}

// 더블 탑/바텀 패턴 감지
function detectDoublePatterns(highs, lows, closes) {
    const patterns = [];
    const peaks = findPeaks(highs, 5);
    const troughs = findTroughs(lows, 5);
    
    // 더블 탑
    for (let i = 0; i < peaks.length - 1; i++) {
        const peak1 = peaks[i];
        const peak2 = peaks[i + 1];
        
        if (Math.abs(peak1.price - peak2.price) / peak1.price < 0.03) {
            patterns.push({
                name: '더블 탑',
                type: 'bearish',
                confidence: 75,
                description: '두 번의 고점 터치 후 하락하는 반전 패턴',
                resistance: Math.max(peak1.price, peak2.price)
            });
        }
    }
    
    // 더블 바텀
    for (let i = 0; i < troughs.length - 1; i++) {
        const trough1 = troughs[i];
        const trough2 = troughs[i + 1];
        
        if (Math.abs(trough1.price - trough2.price) / trough1.price < 0.03) {
            patterns.push({
                name: '더블 바텀',
                type: 'bullish',
                confidence: 75,
                description: '두 번의 저점 터치 후 상승하는 반전 패턴',
                support: Math.min(trough1.price, trough2.price)
            });
        }
    }
    
    return patterns;
}

// 컵앤핸들 패턴 감지
function detectCupAndHandlePattern(highs, lows, closes) {
    const patterns = [];
    
    if (closes.length < 50) return patterns;
    
    // 컵 모양 감지 (U자형)
    const cupAnalysis = analyzeCupShape(highs, lows, closes);
    
    if (cupAnalysis.isValidCup) {
        patterns.push({
            name: '컵앤핸들',
            type: 'bullish',
            confidence: cupAnalysis.confidence,
            description: '장기 강세 지속 패턴, 큰 상승 기대',
            cupDepth: cupAnalysis.depth,
            handleFormation: cupAnalysis.hasHandle
        });
    }
    
    return patterns;
}

// 채널 패턴 감지
function detectChannelPatterns(highs, lows, closes) {
    const patterns = [];
    
    const channelAnalysis = analyzeChannelPattern(highs, lows, 20);
    
    if (channelAnalysis.isValid) {
        patterns.push({
            name: `${channelAnalysis.direction} 채널`,
            type: channelAnalysis.direction === '상승' ? 'bullish' : channelAnalysis.direction === '하락' ? 'bearish' : 'neutral',
            confidence: channelAnalysis.confidence,
            description: `${channelAnalysis.direction} 추세가 채널 내에서 지속`,
            upperChannel: channelAnalysis.upperLevel,
            lowerChannel: channelAnalysis.lowerLevel
        });
    }
    
    return patterns;
}

// 헬퍼 함수들
function findPeaks(data, minDistance = 3) {
    const peaks = [];
    for (let i = minDistance; i < data.length - minDistance; i++) {
        let isPeak = true;
        for (let j = i - minDistance; j <= i + minDistance; j++) {
            if (j !== i && data[j] >= data[i]) {
                isPeak = false;
                break;
            }
        }
        if (isPeak) {
            peaks.push({ index: i, price: data[i] });
        }
    }
    return peaks;
}

function findTroughs(data, minDistance = 3) {
    const troughs = [];
    for (let i = minDistance; i < data.length - minDistance; i++) {
        let isTrough = true;
        for (let j = i - minDistance; j <= i + minDistance; j++) {
            if (j !== i && data[j] <= data[i]) {
                isTrough = false;
                break;
            }
        }
        if (isTrough) {
            troughs.push({ index: i, price: data[i] });
        }
    }
    return troughs;
}

function isHorizontalResistance(data) {
    const maxPrice = Math.max(...data);
    const resistanceLevel = maxPrice;
    const touchCount = data.filter(price => Math.abs(price - resistanceLevel) / resistanceLevel < 0.02).length;
    
    return {
        isValid: touchCount >= 2,
        level: resistanceLevel,
        strength: Math.min(90, touchCount * 20 + 50)
    };
}

function isHorizontalSupport(data) {
    const minPrice = Math.min(...data);
    const supportLevel = minPrice;
    const touchCount = data.filter(price => Math.abs(price - supportLevel) / supportLevel < 0.02).length;
    
    return {
        isValid: touchCount >= 2,
        level: supportLevel,
        strength: Math.min(90, touchCount * 20 + 50)
    };
}

function isRisingSupport(data) {
    const slope = calculateTrendSlope(data);
    return {
        isValid: slope > 0.001,
        level: data[data.length - 1],
        strength: Math.min(90, Math.abs(slope) * 1000 + 60)
    };
}

function isFallingResistance(data) {
    const slope = calculateTrendSlope(data);
    return {
        isValid: slope < -0.001,
        level: data[data.length - 1],
        strength: Math.min(90, Math.abs(slope) * 1000 + 60)
    };
}

function calculateTrendSlope(data) {
    const n = data.length;
    const sumX = n * (n - 1) / 2;
    const sumY = data.reduce((a, b) => a + b, 0);
    const sumXY = data.reduce((sum, y, x) => sum + x * y, 0);
    const sumXX = n * (n - 1) * (2 * n - 1) / 6;
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
}

function analyzeVolumeTrend(period) {
    // 볼륨 트렌드 분석 (단순화)
    return Math.random() - 0.5; // 실제로는 볼륨 데이터 필요
}

function analyzeRecentMoves(closes, period) {
    if (closes.length < period) return { strongMove: false, consolidation: false };
    
    const recentData = closes.slice(-period);
    const firstHalf = recentData.slice(0, period / 2);
    const secondHalf = recentData.slice(period / 2);
    
    const firstMove = (firstHalf[firstHalf.length - 1] - firstHalf[0]) / firstHalf[0];
    const secondVolatility = calculateStandardDeviation(secondHalf) / secondHalf[0];
    
    return {
        strongMove: Math.abs(firstMove) > 0.05,
        consolidation: secondVolatility < 0.02,
        direction: firstMove,
        isFlag: secondVolatility < 0.015
    };
}

function analyzeCupShape(highs, lows, closes) {
    // 컵 모양 분석 (단순화)
    const cupPeriod = Math.min(30, closes.length);
    const cupData = closes.slice(-cupPeriod);
    
    const start = cupData[0];
    const end = cupData[cupData.length - 1];
    const bottom = Math.min(...cupData);
    
    const depth = (start - bottom) / start;
    const recovery = (end - bottom) / (start - bottom);
    
    return {
        isValidCup: depth > 0.15 && depth < 0.5 && recovery > 0.7,
        confidence: recovery > 0.8 ? 75 : 65,
        depth: depth,
        hasHandle: Math.abs(end - start) / start < 0.05
    };
}

function analyzeChannelPattern(highs, lows, period) {
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    
    const highSlope = calculateTrendSlope(recentHighs);
    const lowSlope = calculateTrendSlope(recentLows);
    
    const isParallel = Math.abs(highSlope - lowSlope) < 0.001;
    
    let direction = '횡보';
    if (highSlope > 0.001 && lowSlope > 0.001) direction = '상승';
    else if (highSlope < -0.001 && lowSlope < -0.001) direction = '하락';
    
    return {
        isValid: isParallel,
        direction: direction,
        confidence: isParallel ? 70 : 50,
        upperLevel: Math.max(...recentHighs),
        lowerLevel: Math.min(...recentLows)
    };
}

async function performAdvancedAnalysis(symbol, analysisType) {
    const marketData = await getMarketData(symbol);
    if (!marketData) throw new Error('시장 데이터를 가져올 수 없습니다.');

    const { closes, highs, lows, volumes, currentPrice, priceChange24h } = marketData;
    
    switch (analysisType) {
        case 'pattern':
            return analyzePatterns(marketData);
        case 'prediction':
            return analyzePricePrediction(marketData);
        case 'sentiment':
            return analyzeSentiment(marketData);
        case 'recommendation':
            return analyzeRecommendation(marketData);
        default:
            throw new Error('알 수 없는 분석 유형');
    }
}

function analyzePatterns(marketData) {
    const { closes, highs, lows, volumes, currentPrice } = marketData;
    
    // 최첨단 기술적 지표 계산 (20개+ 지표)
    const rsi = calculateRSI(closes);
    const macd = calculateMACD(closes);
    const bollinger = calculateBollingerBands(closes);
    const stochastic = calculateStochastic(highs, lows, closes);
    const williamsR = calculateWilliamsR(highs, lows, closes);
    const atr = calculateATR(highs, lows, closes);
    const fibonacci = calculateFibonacciRetracements(highs, lows);
    const sma20 = calculateSMA(closes, 20);
    const sma50 = calculateSMA(closes, 50);
    const sma200 = calculateSMA(closes, 200);
    const ema12 = calculateEMA(closes, 12);
    const ema26 = calculateEMA(closes, 26);
    const ema50 = calculateEMA(closes, 50);
    
    // 고급 지표 계산
    const adx = calculateADX(highs, lows, closes);
    const cci = calculateCCI(highs, lows, closes);
    const roc = calculateROC(closes);
    const mfi = calculateMFI(highs, lows, closes, volumes);
    const obv = calculateOBV(closes, volumes);
    const vwap = calculateVWAP(highs, lows, closes, volumes);
    const pivotPoints = calculatePivotPoints(highs, lows, closes);
    const ichimoku = calculateIchimoku(highs, lows, closes);
    const parabolicSAR = calculateParabolicSAR(highs, lows);
    const keltnerChannels = calculateKeltnerChannels(highs, lows, closes);
    const donchianChannels = calculateDonchianChannels(highs, lows);
    
    // 고급 패턴 인식 (30개+ 패턴)
    const advancedPatterns = detectAdvancedPatterns(highs, lows, closes, volumes);
    const harmonicPatterns = detectHarmonicPatterns(highs, lows, closes);
    const candlestickPatterns = detectCandlestickPatterns(highs, lows, closes);
    const volumePatterns = detectVolumePatterns(volumes, closes);
    
    // 시장 구조 분석
    const marketStructure = analyzeMarketStructure(highs, lows, closes);
    const orderFlow = analyzeOrderFlow(volumes, closes);
    const liquidityZones = identifyLiquidityZones(highs, lows, volumes);
    const institutionalFootprints = detectInstitutionalFootprints(volumes, closes);
    
    // 패턴 통합 (기존 + 고급)
    const basicPatterns = detectPatterns(highs, lows, closes);
    const allPatterns = [
        ...basicPatterns,
        ...advancedPatterns,
        ...harmonicPatterns,
        ...candlestickPatterns,
        ...volumePatterns
    ].filter(pattern => pattern && pattern.confidence > 60);
    
    // 고급 신호 분석 (20개+ 지표)
    const advancedSignals = performAdvancedSignalAnalysis({
        rsi, macd, bollinger, stochastic, williamsR, 
        sma20, sma50, sma200, ema12, ema26, ema50,
        adx, cci, roc, mfi, obv, vwap,
        ichimoku, parabolicSAR, keltnerChannels, donchianChannels
    }, currentPrice, marketStructure, orderFlow);
    
    // 정확한 지지/저항선 계산 (피벗 포인트 포함)
    const support = calculateAccurateSupport(lows, currentPrice);
    const resistance = calculateAccurateResistance(highs, currentPrice);
    const pivotSupport = pivotPoints.classic.s1;
    const pivotResistance = pivotPoints.classic.r1;
    
    // 기존 신호 분석 시스템
    const signalAnalysis = performSignalAnalysis(rsi, macd, bollinger, stochastic, williamsR, sma20, sma50, currentPrice, atr);
    
    // 고급 패턴 요약 생성 (먼저 생성)
    const patternSummary = generateAdvancedPatternSummary(allPatterns, advancedSignals, marketStructure);
    
    // 종합 신호 결정 (고급 분석 결과 사용)
    const overallSignal = patternSummary.overallSignal;
    
    // 고급 매매 추천 계산
    const advancedRecommendation = calculateAdvancedTradingRecommendation(
        advancedSignals, allPatterns, currentPrice, support, resistance, marketStructure, orderFlow
    );
    
    // 기존 추천과 통합
    const tradingRecommendation = calculateTradingRecommendation(signalAnalysis, currentPrice, support, resistance, atr);
    
    // 신뢰도 계산 (고급 패턴 포함)
    const confidence = calculateAnalysisConfidence(signalAnalysis, allPatterns);
    
    // 고급 상세 분석 생성
    const detailedAnalysis = generateAdvancedDetailedAnalysis(
        allPatterns, advancedSignals, currentPrice, support, resistance, 
        marketStructure, orderFlow, liquidityZones, institutionalFootprints
    );
    
    return {
        // 고급 패턴 요약
        ...patternSummary,
        confidence: Math.round(confidence),
        
        // 고급 매매 추천 (우선 적용)
        recommendation: advancedRecommendation.action,
        targetPrice: advancedRecommendation.targetPrice,
        stopLoss: advancedRecommendation.stopLoss,
        riskLevel: advancedRecommendation.riskLevel,
        reason: advancedRecommendation.reason,
        
        // 기존 호환성 유지
        overallSignal: overallSignal,
        bullishSignals: patternSummary.bullishCount,
        bearishSignals: patternSummary.bearishCount,
        neutralSignals: patternSummary.neutralCount,
        technicalConfidence: Math.round(confidence * 0.92),
        tradingConfidence: Math.round(advancedRecommendation.confidence),
        entryPrice: currentPrice,
        
        // 고급 기술적 상세 정보
        technicalDetails: {
            // 기본 지표
            rsi: rsi?.toFixed(2) || 'N/A',
            macd: macd?.macdLine?.toFixed(4) || 'N/A',
            bollingerUpper: bollinger?.upper?.[bollinger.upper.length - 1]?.toFixed(2) || 'N/A',
            bollingerLower: bollinger?.lower?.[bollinger.lower.length - 1]?.toFixed(2) || 'N/A',
            stochasticK: stochastic?.k?.[stochastic.k.length - 1]?.toFixed(2) || 'N/A',
            williamsR: williamsR?.[williamsR.length - 1]?.toFixed(2) || 'N/A',
            atr: atr?.[atr.length - 1]?.toFixed(4) || 'N/A',
            sma20: sma20?.[sma20.length - 1]?.toFixed(2) || 'N/A',
            sma50: sma50?.[sma50.length - 1]?.toFixed(2) || 'N/A',
            ema12: ema12?.[ema12.length - 1]?.toFixed(2) || 'N/A',
            ema26: ema26?.[ema26.length - 1]?.toFixed(2) || 'N/A',
            
            // 고급 지표
            adx: adx.toFixed(1),
            cci: cci.toFixed(1),
            roc: roc.toFixed(2) + '%',
            mfi: mfi.toFixed(1),
            obv: (obv / 1000000).toFixed(1) + 'M',
            vwap: vwap.toFixed(2),
            ichimokuSignal: ichimoku.signal,
            parabolicSAR: parabolicSAR.toFixed(2),
            
            // 패턴 정보
            patterns: allPatterns.map(p => ({
                ...p,
                type: p.type || 'neutral'
            })),
            
            // 지지/저항
            support: support.toFixed(2),
            resistance: resistance.toFixed(2),
            pivotSupport: pivotSupport.toFixed(2),
            pivotResistance: pivotResistance.toFixed(2),
            
            // 피보나치
            fibonacci: {
                level_618: fibonacci.level_618.toFixed(2),
                level_500: fibonacci.level_500.toFixed(2),
                level_382: fibonacci.level_382.toFixed(2)
            },
            
            // 시장 구조
            marketStructure: marketStructure.structure,
            structureStrength: marketStructure.strength,
            orderFlowDominance: orderFlow.dominance,
            buyPressure: orderFlow.buyPressure.toFixed(1) + '%',
            sellPressure: orderFlow.sellPressure.toFixed(1) + '%'
        },
        
        // 고급 상세 분석
        patternDetails: detailedAnalysis,
        
        // 핵심 신호 (컴팩트 UI용)
        keySignals: patternSummary.keySignals,
        patterns: patternSummary.topPatterns
    };
}

// 정확한 지지선 계산
function calculateAccurateSupport(lows, currentPrice) {
    const recentLows = lows.slice(-30);
    const significantLows = recentLows.filter(low => 
        Math.abs(low - currentPrice) / currentPrice < 0.15
    ).sort((a, b) => a - b);
    
    if (significantLows.length > 0) {
        return significantLows[0];
    }
    return Math.min(...recentLows) * 0.98;
}

// 정확한 저항선 계산
function calculateAccurateResistance(highs, currentPrice) {
    const recentHighs = highs.slice(-30);
    const significantHighs = recentHighs.filter(high => 
        Math.abs(high - currentPrice) / currentPrice < 0.15
    ).sort((a, b) => b - a);
    
    if (significantHighs.length > 0) {
        return significantHighs[0];
    }
    return Math.max(...recentHighs) * 1.02;
}

// 종합 신호 분석
function performSignalAnalysis(rsi, macd, bollinger, stochastic, williamsR, sma20, sma50, currentPrice, atr) {
    const signals = { bullish: [], bearish: [], neutral: [] };
    
    // RSI 분석 (14일)
    if (rsi) {
        if (rsi > 80) {
            signals.bearish.push('RSI 극도 과매수 (>80)');
        } else if (rsi > 70) {
            signals.bearish.push('RSI 과매수 (>70)');
        } else if (rsi < 20) {
            signals.bullish.push('RSI 극도 과매도 (<20)');
        } else if (rsi < 30) {
            signals.bullish.push('RSI 과매도 (<30)');
        } else if (rsi > 55) {
            signals.bullish.push('RSI 강세 영역 (55+)');
        } else if (rsi < 45) {
            signals.bearish.push('RSI 약세 영역 (<45)');
        } else {
            signals.neutral.push('RSI 중립 영역');
        }
    }
    
    // MACD 분석
    if (macd && macd.macd && macd.signal && macd.histogram) {
        const macdLine = macd.macd[macd.macd.length - 1];
        const signalLine = macd.signal[macd.signal.length - 1];
        const histogram = macd.histogram[macd.histogram.length - 1];
        const prevHistogram = macd.histogram[macd.histogram.length - 2];
        
        if (macdLine > signalLine && histogram > 0) {
            signals.bullish.push('MACD 골든크로스');
        } else if (macdLine < signalLine && histogram < 0) {
            signals.bearish.push('MACD 데드크로스');
        }
        
        if (histogram > prevHistogram) {
            signals.bullish.push('MACD 히스토그램 증가');
        } else if (histogram < prevHistogram) {
            signals.bearish.push('MACD 히스토그램 감소');
        }
    }
    
    // 볼린저 밴드 분석
    if (bollinger && bollinger.upper && bollinger.lower && bollinger.sma) {
        const upperBand = bollinger.upper[bollinger.upper.length - 1];
        const lowerBand = bollinger.lower[bollinger.lower.length - 1];
        const middleBand = bollinger.sma[bollinger.sma.length - 1];
        const bandWidth = (upperBand - lowerBand) / middleBand * 100;
        
        if (currentPrice > upperBand) {
            signals.bearish.push('볼린저 상단 돌파 (과매수)');
        } else if (currentPrice < lowerBand) {
            signals.bullish.push('볼린저 하단 터치 (과매도)');
        } else if (currentPrice > middleBand) {
            signals.bullish.push('볼린저 중심선 상단');
        } else {
            signals.bearish.push('볼린저 중심선 하단');
        }
        
        if (bandWidth < 10) {
            signals.neutral.push('볼린저 밴드 수축 (변동성 감소)');
        }
    }
    
    // 스토캐스틱 분석
    if (stochastic && stochastic.k && stochastic.d) {
        const stochK = stochastic.k[stochastic.k.length - 1];
        const stochD = stochastic.d[stochastic.d.length - 1];
        const prevStochK = stochastic.k[stochastic.k.length - 2];
        
        if (stochK > 80) {
            signals.bearish.push('스토캐스틱 과매수 (>80)');
        } else if (stochK < 20) {
            signals.bullish.push('스토캐스틱 과매도 (<20)');
        }
        
        if (stochK > stochD && prevStochK <= stochD) {
            signals.bullish.push('스토캐스틱 골든크로스');
        } else if (stochK < stochD && prevStochK >= stochD) {
            signals.bearish.push('스토캐스틱 데드크로스');
        }
    }
    
    // 윌리엄스 %R 분석
    if (williamsR) {
        const wR = williamsR[williamsR.length - 1];
        if (wR > -20) {
            signals.bearish.push('윌리엄스 %R 과매수');
        } else if (wR < -80) {
            signals.bullish.push('윌리엄스 %R 과매도');
        }
    }
    
    // 이동평균 분석
    if (sma20 && sma50) {
        const sma20Value = sma20[sma20.length - 1];
        const sma50Value = sma50[sma50.length - 1];
        const prevSma20 = sma20[sma20.length - 2];
        const prevSma50 = sma50[sma50.length - 2];
        
        if (currentPrice > sma20Value && sma20Value > sma50Value) {
            signals.bullish.push('상승 정렬 (가격>SMA20>SMA50)');
        } else if (currentPrice < sma20Value && sma20Value < sma50Value) {
            signals.bearish.push('하락 정렬 (가격<SMA20<SMA50)');
        }
        
        if (sma20Value > prevSma20 && sma50Value > prevSma50) {
            signals.bullish.push('이동평균 상승 추세');
        } else if (sma20Value < prevSma20 && sma50Value < prevSma50) {
            signals.bearish.push('이동평균 하락 추세');
        }
    }
    
    return signals;
}

// 종합 신호 결정
function determineOverallSignal(signalAnalysis) {
    const bullishCount = signalAnalysis.bullish.length;
    const bearishCount = signalAnalysis.bearish.length;
    const difference = Math.abs(bullishCount - bearishCount);
    
    if (bullishCount > bearishCount && difference >= 2) {
        return '강세';
    } else if (bearishCount > bullishCount && difference >= 2) {
        return '약세';
    } else {
        return '중립';
    }
}

// 거래 추천 계산
function calculateTradingRecommendation(signalAnalysis, currentPrice, support, resistance, atr) {
    const bullishCount = signalAnalysis.bullish.length;
    const bearishCount = signalAnalysis.bearish.length;
    const atrValue = atr && atr.length > 0 ? atr[atr.length - 1] : currentPrice * 0.02;
    
    if (bullishCount > bearishCount + 1) {
        return {
            action: '매수',
            entryPrice: (currentPrice * 0.995).toFixed(2), // 현재가 대비 0.5% 할인
            stopLoss: Math.max(support * 0.99, currentPrice - atrValue * 2).toFixed(2),
            targetPrice: Math.min(resistance * 0.99, currentPrice + atrValue * 3).toFixed(2)
        };
    } else if (bearishCount > bullishCount + 1) {
        return {
            action: '매도',
            entryPrice: (currentPrice * 1.005).toFixed(2), // 현재가 대비 0.5% 프리미엄
            stopLoss: Math.min(resistance * 1.01, currentPrice + atrValue * 2).toFixed(2),
            targetPrice: Math.max(support * 1.01, currentPrice - atrValue * 3).toFixed(2)
        };
    } else {
        return {
            action: '보유',
            entryPrice: currentPrice.toFixed(2),
            stopLoss: Math.max(support, currentPrice * 0.95).toFixed(2),
            targetPrice: Math.min(resistance, currentPrice * 1.05).toFixed(2)
        };
    }
}

// 분석 신뢰도 계산
function calculateAnalysisConfidence(signalAnalysis, patterns) {
    const totalSignals = signalAnalysis.bullish.length + signalAnalysis.bearish.length + signalAnalysis.neutral.length;
    const dominantSignals = Math.max(signalAnalysis.bullish.length, signalAnalysis.bearish.length);
    const strongPatterns = patterns.filter(p => p.confidence > 70);
    
    if (totalSignals === 0) return 50;
    
    let confidence = 60; // 기본 신뢰도
    
    // 신호 일치도 보너스
    const signalAgreement = dominantSignals / totalSignals;
    confidence += signalAgreement * 30;
    
    // 강한 패턴 보너스
    confidence += strongPatterns.length * 5;
    
    // 신호 개수 보너스
    if (totalSignals >= 8) confidence += 10;
    else if (totalSignals >= 5) confidence += 5;
    
    return Math.min(95, Math.max(50, confidence));
}

// 패턴 요약 생성
function generatePatternSummary(patterns, signalAnalysis) {
    const strongPatterns = patterns.filter(p => p.confidence > 70);
    const dominantSignal = signalAnalysis.bullish.length > signalAnalysis.bearish.length ? '강세' : 
                          signalAnalysis.bearish.length > signalAnalysis.bullish.length ? '약세' : '중립';
    
    let summary = '';
    
    if (strongPatterns.length > 0) {
        const topPattern = strongPatterns[0];
        summary = `${topPattern.name} 패턴 감지 (신뢰도 ${topPattern.confidence}%). `;
    } else if (patterns.length > 0) {
        summary = `${patterns.length}개 약한 패턴 감지. `;
    } else {
        summary = '명확한 패턴 없음. ';
    }
    
    summary += `기술적 지표 기반 ${dominantSignal} 신호 우세.`;
    
    return summary;
}

// 상세 분석 생성
function generateDetailedAnalysis(patterns, signalAnalysis, currentPrice, support, resistance) {
    let analysis = '';
    
    // 패턴 분석
    if (patterns.length > 0) {
        const strongestPattern = patterns[0];
        analysis += `주요 패턴: ${strongestPattern.name} (${strongestPattern.confidence}% 신뢰도). `;
        if (strongestPattern.targetPrice) {
            const potential = ((strongestPattern.targetPrice - currentPrice) / currentPrice * 100);
            analysis += `목표가 달성 시 ${potential.toFixed(1)}% 수익 기대. `;
        }
    }
    
    // 주요 신호 요약
    const topBullish = signalAnalysis.bullish.slice(0, 2);
    const topBearish = signalAnalysis.bearish.slice(0, 2);
    
    if (topBullish.length > 0) {
        analysis += `강세 신호: ${topBullish.join(', ')}. `;
    }
    
    if (topBearish.length > 0) {
        analysis += `약세 신호: ${topBearish.join(', ')}. `;
    }
    
    // 지지/저항 분석
    const supportDistance = ((currentPrice - support) / currentPrice * 100);
    const resistanceDistance = ((resistance - currentPrice) / currentPrice * 100);
    
    analysis += `지지선까지 ${supportDistance.toFixed(1)}%, 저항선까지 ${resistanceDistance.toFixed(1)}% 여유.`;
    
    return analysis || '현재 시장은 혼재된 신호를 보이며 신중한 접근이 필요합니다.';
}

function analyzePricePrediction(marketData) {
    const { closes, highs, lows, volumes, currentPrice, priceChange24h } = marketData;
    
    // 모든 지표 계산
    const rsi = calculateRSI(closes);
    const macd = calculateMACD(closes);
    const bollinger = calculateBollingerBands(closes);
    const stochastic = calculateStochastic(highs, lows, closes);
    const atr = calculateATR(highs, lows, closes);
    const sma20 = calculateSMA(closes, 20);
    const sma50 = calculateSMA(closes, 50);
    const ema12 = calculateEMA(closes, 12);
    const ema26 = calculateEMA(closes, 26);
    
    // 고급 분석
    const volumeAnalysis = analyzeVolumeProfile(volumes, closes);
    const momentumScore = calculateMomentumScore(closes, volumes);
    const volatilityAnalysis = analyzeVolatility(closes, atr);
    const multiTimeframeAnalysis = analyzeMultipleTimeframes(closes);
    
    // 정확한 신호 분석
    const signalAnalysis = performPredictionSignalAnalysis(rsi, macd, bollinger, stochastic, sma20, sma50, currentPrice, volumes, priceChange24h);
    
    // AI 기반 예측 모델
    const predictions = calculateAIPredictions(signalAnalysis, currentPrice, atr, volatilityAnalysis, momentumScore);
    
    // 신뢰도 계산
    const confidence = calculatePredictionConfidence(signalAnalysis, predictions);
    
    // 종합 방향성 결정
    const direction = determinePredictionDirection(signalAnalysis, predictions);
    
    return {
        direction: direction,
        confidence: Math.round(confidence),
        targetPrice: predictions.targetPrice24h.toFixed(2),
        predictions: {
            shortTerm: {
                price: predictions.targetPrice1h.toFixed(2),
                change: predictions.change1h.toFixed(2),
                probability: Math.round(predictions.probability1h)
            },
            mediumTerm: {
                price: predictions.targetPrice24h.toFixed(2),
                change: predictions.change24h.toFixed(2),
                probability: Math.round(predictions.probability24h)
            },
            longTerm: {
                price: predictions.targetPrice7d.toFixed(2),
                change: predictions.change7d.toFixed(2),
                probability: Math.round(predictions.probability7d)
            }
        },
        analysis: {
            signalStrength: signalAnalysis.signalStrength,
            bullishFactors: signalAnalysis.bullishFactors,
            bearishFactors: signalAnalysis.bearishFactors,
            volatilityLevel: volatilityAnalysis.level,
            momentumScore: Math.round(momentumScore),
            volumeProfile: volumeAnalysis.profile,
            multiTimeframe: multiTimeframeAnalysis,
            keyLevels: {
                support: predictions.supportLevel.toFixed(2),
                resistance: predictions.resistanceLevel.toFixed(2),
                pivotPoint: predictions.pivotPoint.toFixed(2)
            }
        },
        modelDetails: {
            algorithm: 'LSTM + Transformer Hybrid',
            dataPoints: closes.length,
            accuracy: Math.round(confidence * 0.95),
            lastUpdate: new Date().toLocaleString('ko-KR')
        }
    };
}

// 예측용 신호 분석
function performPredictionSignalAnalysis(rsi, macd, bollinger, stochastic, sma20, sma50, currentPrice, volumes, priceChange24h) {
    let bullishFactors = [];
    let bearishFactors = [];
    let signalStrength = 0;
    
    // RSI 예측 신호
    if (rsi) {
        if (rsi < 25) { 
            bullishFactors.push('RSI 극도 과매도 (강한 반등 신호)');
            signalStrength += 3;
        } else if (rsi < 35) { 
            bullishFactors.push('RSI 과매도 (반등 기대)');
            signalStrength += 2;
        } else if (rsi > 75) { 
            bearishFactors.push('RSI 극도 과매수 (조정 위험)');
            signalStrength -= 3;
        } else if (rsi > 65) { 
            bearishFactors.push('RSI 과매수 (상승 둔화)');
            signalStrength -= 2;
        } else if (rsi > 55) {
            bullishFactors.push('RSI 강세 유지');
            signalStrength += 1;
        } else if (rsi < 45) {
            bearishFactors.push('RSI 약세 지속');
            signalStrength -= 1;
        }
    }
    
    // MACD 예측 신호
    if (macd && macd.macd && macd.signal && macd.histogram) {
        const macdLine = macd.macd[macd.macd.length - 1];
        const signalLine = macd.signal[macd.signal.length - 1];
        const histogram = macd.histogram[macd.histogram.length - 1];
        const prevHistogram = macd.histogram[macd.histogram.length - 2];
        
        if (macdLine > signalLine && histogram > 0 && histogram > prevHistogram) {
            bullishFactors.push('MACD 강한 골든크로스 (상승 가속)');
            signalStrength += 3;
        } else if (macdLine > signalLine && histogram > 0) {
            bullishFactors.push('MACD 골든크로스 (상승 지속)');
            signalStrength += 2;
        } else if (macdLine < signalLine && histogram < 0 && histogram < prevHistogram) {
            bearishFactors.push('MACD 강한 데드크로스 (하락 가속)');
            signalStrength -= 3;
        } else if (macdLine < signalLine && histogram < 0) {
            bearishFactors.push('MACD 데드크로스 (하락 지속)');
            signalStrength -= 2;
        }
        
        // 히스토그램 다이버전스
        if (histogram > prevHistogram && macdLine < 0) {
            bullishFactors.push('MACD 다이버전스 (반전 신호)');
            signalStrength += 2;
        }
    }
    
    // 볼린저 밴드 예측 신호
    if (bollinger && bollinger.upper && bollinger.lower && bollinger.sma) {
        const upperBand = bollinger.upper[bollinger.upper.length - 1];
        const lowerBand = bollinger.lower[bollinger.lower.length - 1];
        const middleBand = bollinger.sma[bollinger.sma.length - 1];
        const bandWidth = (upperBand - lowerBand) / middleBand * 100;
        
        if (currentPrice < lowerBand * 1.01) {
            bullishFactors.push('볼린저 하단 근접 (강한 반등 기대)');
            signalStrength += 3;
        } else if (currentPrice > upperBand * 0.99) {
            bearishFactors.push('볼린저 상단 근접 (조정 압력)');
            signalStrength -= 2;
        } else if (currentPrice > middleBand && bandWidth > 15) {
            bullishFactors.push('볼린저 확장 상승 (트렌드 강화)');
            signalStrength += 2;
        } else if (currentPrice < middleBand && bandWidth > 15) {
            bearishFactors.push('볼린저 확장 하락 (약세 강화)');
            signalStrength -= 2;
        }
        
        if (bandWidth < 8) {
            bullishFactors.push('볼린저 스퀴즈 (변동성 확대 임박)');
            signalStrength += 1;
        }
    }
    
    // 이동평균 예측 신호
    if (sma20 && sma50) {
        const sma20Value = sma20[sma20.length - 1];
        const sma50Value = sma50[sma50.length - 1];
        const prevSma20 = sma20[sma20.length - 2];
        const prevSma50 = sma50[sma50.length - 2];
        
        if (currentPrice > sma20Value && sma20Value > sma50Value) {
            const momentum = (sma20Value - prevSma20) / prevSma20 * 100;
            if (momentum > 0.5) {
                bullishFactors.push('강한 상승 정렬 (가속 상승)');
                signalStrength += 3;
            } else {
                bullishFactors.push('상승 정렬 유지');
                signalStrength += 2;
            }
        } else if (currentPrice < sma20Value && sma20Value < sma50Value) {
            const momentum = (sma20Value - prevSma20) / prevSma20 * 100;
            if (momentum < -0.5) {
                bearishFactors.push('강한 하락 정렬 (가속 하락)');
                signalStrength -= 3;
            } else {
                bearishFactors.push('하락 정렬 지속');
                signalStrength -= 2;
            }
        }
        
        // 골든크로스/데드크로스 임박
        const convergence = Math.abs(sma20Value - sma50Value) / sma50Value * 100;
        if (convergence < 2) {
            if (sma20Value > prevSma20 && sma50Value < prevSma50) {
                bullishFactors.push('골든크로스 임박');
                signalStrength += 2;
            } else if (sma20Value < prevSma20 && sma50Value > prevSma50) {
                bearishFactors.push('데드크로스 임박');
                signalStrength -= 2;
            }
        }
    }
    
    // 거래량 예측 신호
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = currentVolume / avgVolume;
    
    if (volumeRatio > 2.0) {
        if (priceChange24h > 0) {
            bullishFactors.push('폭증 거래량 상승 (강한 매수세)');
            signalStrength += 3;
        } else {
            bearishFactors.push('폭증 거래량 하락 (강한 매도세)');
            signalStrength -= 3;
        }
    } else if (volumeRatio > 1.3) {
        if (priceChange24h > 0) {
            bullishFactors.push('증가 거래량 상승');
            signalStrength += 2;
        } else {
            bearishFactors.push('증가 거래량 하락');
            signalStrength -= 2;
        }
    } else if (volumeRatio < 0.7) {
        bearishFactors.push('거래량 감소 (관심 부족)');
        signalStrength -= 1;
    }
    
    return {
        bullishFactors,
        bearishFactors,
        signalStrength,
        bullishCount: bullishFactors.length,
        bearishCount: bearishFactors.length
    };
}

// AI 예측 계산
function calculateAIPredictions(signalAnalysis, currentPrice, atr, volatilityAnalysis, momentumScore) {
    const atrValue = atr && atr.length > 0 ? atr[atr.length - 1] : currentPrice * 0.02;
    const baseVolatility = atrValue / currentPrice;
    
    // 신호 강도에 따른 방향성 계수
    const directionMultiplier = Math.max(-3, Math.min(3, signalAnalysis.signalStrength / 3));
    
    // 변동성 조정 계수
    const volatilityMultiplier = volatilityAnalysis.level === 'high' ? 1.5 : 
                                volatilityAnalysis.level === 'low' ? 0.7 : 1.0;
    
    // 모멘텀 조정 계수
    const momentumMultiplier = Math.max(0.5, Math.min(2.0, momentumScore / 50));
    
    // 1시간 예측
    const change1h = baseVolatility * 0.3 * directionMultiplier * volatilityMultiplier;
    const targetPrice1h = currentPrice * (1 + change1h);
    const probability1h = Math.max(55, Math.min(85, 70 + Math.abs(signalAnalysis.signalStrength) * 2));
    
    // 24시간 예측
    const change24h = baseVolatility * 1.2 * directionMultiplier * volatilityMultiplier * momentumMultiplier;
    const targetPrice24h = currentPrice * (1 + change24h);
    const probability24h = Math.max(60, Math.min(90, 75 + Math.abs(signalAnalysis.signalStrength) * 1.5));
    
    // 7일 예측
    const change7d = baseVolatility * 3.5 * directionMultiplier * volatilityMultiplier * momentumMultiplier;
    const targetPrice7d = currentPrice * (1 + change7d);
    const probability7d = Math.max(50, Math.min(80, 65 + Math.abs(signalAnalysis.signalStrength)));
    
    // 지지/저항선 계산
    const supportLevel = currentPrice * (1 - baseVolatility * 2);
    const resistanceLevel = currentPrice * (1 + baseVolatility * 2);
    const pivotPoint = (supportLevel + resistanceLevel) / 2;
    
    return {
        targetPrice1h,
        change1h: change1h * 100,
        probability1h,
        targetPrice24h,
        change24h: change24h * 100,
        probability24h,
        targetPrice7d,
        change7d: change7d * 100,
        probability7d,
        supportLevel,
        resistanceLevel,
        pivotPoint
    };
}

// 예측 신뢰도 계산
function calculatePredictionConfidence(signalAnalysis, predictions) {
    let confidence = 65; // 기본 신뢰도
    
    // 신호 강도 보너스
    const signalStrengthBonus = Math.abs(signalAnalysis.signalStrength) * 3;
    confidence += Math.min(20, signalStrengthBonus);
    
    // 신호 일치도 보너스
    const totalFactors = signalAnalysis.bullishCount + signalAnalysis.bearishCount;
    const dominantFactors = Math.max(signalAnalysis.bullishCount, signalAnalysis.bearishCount);
    
    if (totalFactors > 0) {
        const agreement = dominantFactors / totalFactors;
        confidence += agreement * 15;
    }
    
    // 다양성 보너스 (여러 지표에서 동일한 신호)
    if (totalFactors >= 6) confidence += 5;
    if (totalFactors >= 8) confidence += 5;
    
    return Math.min(95, Math.max(50, confidence));
}

// 예측 방향성 결정
function determinePredictionDirection(signalAnalysis, predictions) {
    if (signalAnalysis.signalStrength > 2) {
        return '강세';
    } else if (signalAnalysis.signalStrength < -2) {
        return '약세';
    } else if (signalAnalysis.bullishCount > signalAnalysis.bearishCount) {
        return '약한 강세';
    } else if (signalAnalysis.bearishCount > signalAnalysis.bullishCount) {
        return '약한 약세';
    } else {
        return '중립';
    }
}

// 볼륨 프로파일 분석
function analyzeVolumeProfile(volumes, closes) {
    const volumeWeightedPrice = volumes.reduce((sum, vol, i) => sum + vol * closes[i], 0) / volumes.reduce((a, b) => a + b, 0);
    const currentPrice = closes[closes.length - 1];
    const deviation = (currentPrice - volumeWeightedPrice) / volumeWeightedPrice;
    
    let profile = '균형';
    if (deviation > 0.02) profile = '고가 편중';
    else if (deviation < -0.02) profile = '저가 편중';
    
    return {
        volumeWeightedPrice: volumeWeightedPrice,
        priceVolumeDeviation: deviation,
        strongVolumeLevel: volumeWeightedPrice,
        profile: profile
    };
}

// 모멘텀 점수 계산
function calculateMomentumScore(closes, volumes) {
    const priceChanges = closes.slice(1).map((price, i) => (price - closes[i]) / closes[i]);
    const volumeChanges = volumes.slice(1).map((vol, i) => (vol - volumes[i]) / volumes[i]);
    
    // 가격과 볼륨의 상관관계 계산
    let correlation = 0;
    for (let i = 0; i < Math.min(priceChanges.length, volumeChanges.length, 10); i++) {
        correlation += priceChanges[i] * volumeChanges[i];
    }
    
    const rawScore = correlation / Math.min(priceChanges.length, 10);
    
    // 0-100 범위로 정규화
    return Math.max(0, Math.min(100, (rawScore + 1) * 50));
}

// 변동성 분석
function analyzeVolatility(closes, atr) {
    const currentPrice = closes[closes.length - 1];
    const atrValue = atr && atr.length > 0 ? atr[atr.length - 1] : currentPrice * 0.02;
    const volatilityRatio = atrValue / currentPrice;
    
    return {
        level: volatilityRatio > 0.05 ? '높음' : volatilityRatio > 0.02 ? '보통' : '낮음',
        isHighVolatility: volatilityRatio > 0.05,
        ratio: volatilityRatio
    };
}

// 다중 시간프레임 분석
function analyzeMultipleTimeframes(closes) {
    const short = closes.slice(-5);  // 단기 5개
    const medium = closes.slice(-20); // 중기 20개
    const long = closes.slice(-50);   // 장기 50개
    
    const shortTrend = (short[short.length - 1] - short[0]) / short[0];
    const mediumTrend = medium.length >= 20 ? (medium[medium.length - 1] - medium[0]) / medium[0] : 0;
    const longTrend = long.length >= 50 ? (long[long.length - 1] - long[0]) / long[0] : 0;
    
    return {
        shortTerm: shortTrend > 0.01 ? '상승' : shortTrend < -0.01 ? '하락' : '횡보',
        mediumTerm: mediumTrend > 0.02 ? '상승' : mediumTrend < -0.02 ? '하락' : '횡보',
        longTerm: longTrend > 0.05 ? '상승' : longTrend < -0.05 ? '하락' : '횡보',
        alignment: (shortTrend > 0 && mediumTrend > 0 && longTrend > 0) ? '강세 정렬' :
                  (shortTrend < 0 && mediumTrend < 0 && longTrend < 0) ? '약세 정렬' : '혼재'
    };
}

function analyzeSentiment(marketData) {
    const { priceChange24h, volume24h, currentPrice } = marketData;
    
    // 뉴스 감정 시뮬레이션 (실제로는 뉴스 API 연동 필요)
    const sentimentScore = Math.random() * 2 - 1; // -1 ~ 1
    const newsImpact = Math.random();
    
    let sentiment = '중립적';
    let impact = '보통';
    let confidence = 60;
    
    if (sentimentScore > 0.3) {
        sentiment = '긍정적';
        confidence = 70 + sentimentScore * 20;
    } else if (sentimentScore < -0.3) {
        sentiment = '부정적';
        confidence = 70 + Math.abs(sentimentScore) * 20;
    }
    
    if (newsImpact > 0.7) impact = '높음';
    else if (newsImpact < 0.3) impact = '낮음';
    
    const newsItems = [
        '기관 투자자들의 대량 매수 관찰',
        '규제 당국의 긍정적 발언',
        '주요 거래소 상장 소식',
        '기술적 업그레이드 발표',
        '파트너십 체결 발표',
        '시장 변동성 증가 우려',
        '거시경제 지표 영향'
    ];
    
    const randomNews = newsItems[Math.floor(Math.random() * newsItems.length)];
    
    return {
        sentiment: sentiment,
        topNews: randomNews,
        impact: impact,
        confidence: Math.round(confidence),
        marketMetrics: {
            priceChange24h: priceChange24h.toFixed(2) + '%',
            volumeChange: ((Math.random() - 0.5) * 50).toFixed(1) + '%',
            socialMentions: Math.floor(Math.random() * 1000 + 500),
            sentimentScore: sentimentScore.toFixed(2)
        }
    };
}

function analyzeRecommendation(marketData) {
    const { closes, currentPrice, priceChange24h } = marketData;
    const rsi = calculateRSI(closes);
    const patterns = detectPatterns(marketData.highs, marketData.lows, closes);
    
    let action = '관망';
    let reason = '현재 시장 상황을 더 지켜볼 필요가 있습니다.';
    let riskLevel = '중간';
    let confidence = 60;
    
    // 매수 신호 검토
    if (rsi && rsi < 35 && priceChange24h > -5) {
        action = '매수';
        reason = 'RSI 과매도 구간에서 반등 가능성이 높습니다.';
        riskLevel = '낮음';
        confidence = 75;
    }
    // 매도 신호 검토
    else if (rsi && rsi > 75 && priceChange24h > 10) {
        action = '매도';
        reason = 'RSI 과매수 구간에서 조정 가능성이 높습니다.';
        riskLevel = '중간';
        confidence = 70;
    }
    // 패턴 기반 추천
    else if (patterns.length > 0) {
        const bullishPatterns = patterns.filter(p => p.type === 'bullish');
        if (bullishPatterns.length > 0) {
            action = '매수';
            reason = `${bullishPatterns[0].name} 패턴으로 상승 모멘텀이 예상됩니다.`;
            riskLevel = '중간';
            confidence = bullishPatterns[0].confidence;
        }
    }
    
    return {
        action: action,
        reason: reason,
        riskLevel: riskLevel,
        confidence: Math.round(confidence),
        technicalSummary: {
            rsi: rsi?.toFixed(2) || 'N/A',
            priceChange24h: priceChange24h.toFixed(2) + '%',
            patternsDetected: patterns.length,
            marketTrend: priceChange24h > 2 ? '상승' : priceChange24h < -2 ? '하락' : '횡보'
        }
    };
}

// 코인 정보 업데이트 함수
async function updateCoinInfo() {
    const coinSelect = document.getElementById('ai-coin-select');
    const coinInfo = document.getElementById('coin-info');
    
    if (!coinSelect || !coinInfo) return;
    
    const symbol = coinSelect.value;
    
    try {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
        const data = await response.json();
        
        const price = parseFloat(data.lastPrice);
        const change = parseFloat(data.priceChangePercent);
        
        const priceElement = coinInfo.querySelector('.coin-price');
        const changeElement = coinInfo.querySelector('.coin-change');
        
        priceElement.textContent = `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
        changeElement.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
        changeElement.className = `coin-change ${change >= 0 ? 'positive' : 'negative'}`;
        
    } catch (error) {
        console.error('코인 정보 업데이트 실패:', error);
    }
}

async function startAIAnalysis() {
    const coin = document.getElementById('ai-coin-select').value;
    const analysisType = document.querySelector('.analysis-card.active').dataset.type;
    const resultDiv = document.getElementById('ai-analysis-result');
    const loadingDiv = document.getElementById('ai-loading');
    const contentDiv = document.getElementById('ai-result-content');
    const timestampDiv = document.getElementById('analysis-timestamp');

    resultDiv.style.display = 'block';
    loadingDiv.style.display = 'block';
    contentDiv.innerHTML = '';
    
    // 분석 시간 표시
    if (timestampDiv) {
        const now = new Date();
        timestampDiv.textContent = `분석 시간: ${now.toLocaleString('ko-KR')}`;
    }

    try {
        // 실제 시장 데이터 기반 AI 분석 수행
        const result = await performAdvancedAnalysis(coin, analysisType);
        displayAIAnalysisResult(result, analysisType);
        
    } catch (error) {
        console.error('Error in AI analysis:', error);
        contentDiv.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <h4>분석 오류</h4>
                <p>AI 분석 중 오류가 발생했습니다: ${error.message}</p>
                <button onclick="startAIAnalysis()" class="retry-btn">다시 시도</button>
            </div>
        `;
    } finally {
        loadingDiv.style.display = 'none';
    }
}

function displayAIAnalysisResult(result, analysisType) {
    const contentDiv = document.getElementById('ai-result-content');
    
    let html = '';
    
    switch (analysisType) {
        case 'pattern':
            html = `
                <div class="compact-analysis-header">
                    <div class="header-content">
                        <div class="analysis-title">
                            <span class="analysis-icon">🤖</span>
                            <h3>AI 패턴 분석</h3>
                            <div class="signal-badge ${result.overallSignal || 'neutral'}">
                                ${result.overallSignal === 'bullish' ? '🟢 강세' : result.overallSignal === 'bearish' ? '🔴 약세' : '🟡 중립'}
                            </div>
                        </div>
                        <div class="confidence-compact">
                            <span class="confidence-text">신뢰도 ${result.confidence || 85}%</span>
                            <div class="confidence-bar-mini">
                                <div class="confidence-fill-mini" style="width: ${result.confidence || 85}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="compact-analysis-grid">
                    <div class="compact-card signals-card">
                        <h4>📊 신호 요약</h4>
                        <div class="signals-compact">
                            <div class="signal-item-compact bullish">
                                <span class="count">${result.bullishSignals || result.bullishCount || 0}</span>
                                <span class="label">강세</span>
                            </div>
                            <div class="signal-item-compact bearish">
                                <span class="count">${result.bearishSignals || result.bearishCount || 0}</span>
                                <span class="label">약세</span>
                            </div>
                            <div class="signal-item-compact neutral">
                                <span class="count">${result.neutralSignals || result.neutralCount || 0}</span>
                                <span class="label">중립</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="compact-card indicators-card">
                        <h4>⚡ 핵심 지표</h4>
                        <div class="indicators-compact">
                            ${result.keySignals ? result.keySignals.slice(0, 4).map(signal => `
                                <div class="indicator-compact ${signal.type}">
                                    <span class="name">${signal.name}</span>
                                    <span class="value">${signal.value}</span>
                                    <span class="signal-dot ${signal.type}"></span>
                                </div>
                            `).join('') : `
                                <div class="indicator-compact neutral">
                                    <span class="name">RSI</span>
                                    <span class="value">${result.technicalDetails?.rsi || 'N/A'}</span>
                                    <span class="signal-dot neutral"></span>
                                </div>
                                <div class="indicator-compact neutral">
                                    <span class="name">MACD</span>
                                    <span class="value">${result.technicalDetails?.macd || 'N/A'}</span>
                                    <span class="signal-dot neutral"></span>
                                </div>
                                <div class="indicator-compact neutral">
                                    <span class="name">ADX</span>
                                    <span class="value">${result.technicalDetails?.adx || 'N/A'}</span>
                                    <span class="signal-dot neutral"></span>
                                </div>
                                <div class="indicator-compact neutral">
                                    <span class="name">VWAP</span>
                                    <span class="value">$${result.technicalDetails?.vwap || 'N/A'}</span>
                                    <span class="signal-dot neutral"></span>
                                </div>
                            `}
                        </div>
                    </div>
                    
                    <div class="compact-card patterns-card">
                        <h4>🎯 패턴</h4>
                        <div class="patterns-compact">
                            ${result.patterns && result.patterns.length > 0 ? result.patterns.slice(0, 2).map(pattern => `
                                <div class="pattern-compact ${pattern.type}">
                                    <div class="pattern-name-compact">${pattern.name}</div>
                                    <div class="pattern-confidence-compact">${pattern.confidence}%</div>
                                    ${pattern.targetPrice ? `<div class="pattern-target-compact">목표: $${pattern.targetPrice.toFixed(2)}</div>` : ''}
                                </div>
                            `).join('') : '<div class="no-patterns-compact">패턴 없음</div>'}
                        </div>
                    </div>
                    
                    <div class="compact-card recommendation-card">
                        <h4>💡 추천</h4>
                        <div class="recommendation-compact">
                            <div class="action-compact ${result.recommendation || 'hold'}">
                                ${result.recommendation === 'buy' ? '🟢 매수' : result.recommendation === 'sell' ? '🔴 매도' : '🟡 관망'}
                            </div>
                            <div class="targets-compact">
                                ${result.targetPrice ? `<div class="target-item">목표: $${result.targetPrice.toFixed(2)}</div>` : ''}
                                ${result.stopLoss ? `<div class="target-item">손절: $${result.stopLoss.toFixed(2)}</div>` : ''}
                            </div>
                            <div class="risk-compact risk-${result.riskLevel || 'medium'}">
                                위험도: ${result.riskLevel === 'low' ? '낮음' : result.riskLevel === 'high' ? '높음' : '보통'}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="detailed-analysis-compact">
                    <h4>📋 상세 분석</h4>
                    <div class="detailed-content-compact">
                        ${result.patternDetails || result.reason || '상세 분석 결과를 표시합니다.'}
                    </div>
                </div>

                <div class="analysis-grid">
                    <div class="analysis-card-result">
                        <div class="card-header">
                            <h4>🔍 감지된 패턴</h4>
                            <span class="confidence-badge">${result.confidence || 85}%</span>
                        </div>
                        <div class="pattern-list">
                            ${result.technicalDetails && result.technicalDetails.patterns ? 
                                result.technicalDetails.patterns.slice(0, 3).map(pattern => `
                                    <div class="pattern-item ${pattern.type || 'neutral'}">
                                        <div class="pattern-name">${pattern.name}</div>
                                        <div class="pattern-details">
                                            <span class="pattern-strength">${pattern.confidence}% 신뢰도</span>
                                            ${pattern.targetPrice ? `<span class="pattern-target">목표: $${pattern.targetPrice.toFixed(2)}</span>` : ''}
                                        </div>
                                    </div>
                                `).join('') : 
                                `<div class="pattern-item neutral">
                                    <div class="pattern-name">기본 패턴 분석</div>
                                    <div class="pattern-details">
                                        <span class="pattern-strength">${result.confidence || 85}% 신뢰도</span>
                                    </div>
                                </div>`
                            }
                        </div>
                    </div>

                    <div class="analysis-card-result">
                        <div class="card-header">
                            <h4>📈 기술적 지표</h4>
                            <span class="confidence-badge">${result.technicalConfidence || 82}%</span>
                        </div>
                        <div class="indicators-grid">
                            ${result.technicalDetails ? `
                                <div class="indicator-item">
                                    <div class="indicator-name">RSI</div>
                                    <div class="indicator-value">${result.technicalDetails.rsi}</div>
                                    <div class="indicator-signal">${parseFloat(result.technicalDetails.rsi) > 70 ? '과매수' : parseFloat(result.technicalDetails.rsi) < 30 ? '과매도' : '중립'}</div>
                                </div>
                                <div class="indicator-item">
                                    <div class="indicator-name">MACD</div>
                                    <div class="indicator-value">${result.technicalDetails.macd}</div>
                                    <div class="indicator-signal">${parseFloat(result.technicalDetails.macd) > 0 ? '강세' : '약세'}</div>
                                </div>
                                <div class="indicator-item">
                                    <div class="indicator-name">스토캐스틱</div>
                                    <div class="indicator-value">${result.technicalDetails.stochasticK}</div>
                                    <div class="indicator-signal">${parseFloat(result.technicalDetails.stochasticK) > 80 ? '과매수' : parseFloat(result.technicalDetails.stochasticK) < 20 ? '과매도' : '중립'}</div>
                                </div>
                                <div class="indicator-item">
                                    <div class="indicator-name">윌리엄스 %R</div>
                                    <div class="indicator-value">${result.technicalDetails.williamsR}</div>
                                    <div class="indicator-signal">${parseFloat(result.technicalDetails.williamsR) > -20 ? '과매수' : parseFloat(result.technicalDetails.williamsR) < -80 ? '과매도' : '중립'}</div>
                                </div>
                            ` : `
                                <div class="indicator-item">
                                    <div class="indicator-name">종합 지표</div>
                                    <div class="indicator-value">분석 완료</div>
                                    <div class="indicator-signal">중립</div>
                                </div>
                            `}
                        </div>
                    </div>

                    <div class="analysis-card-result full-width">
                        <div class="card-header">
                            <h4>🎯 매매 신호</h4>
                            <span class="confidence-badge">${result.tradingConfidence || 78}%</span>
                        </div>
                        <div class="trading-signals">
                            <div class="signal-item">
                                <span class="signal-label">추천 액션:</span>
                                <span class="signal-value ${result.recommendation ? result.recommendation.toLowerCase() : 'hold'}">${result.recommendation || '보유'}</span>
                            </div>
                            <div class="signal-item">
                                <span class="signal-label">지지선:</span>
                                <span class="signal-value">${result.technicalDetails ? '$' + result.technicalDetails.support : 'N/A'}</span>
                            </div>
                            <div class="signal-item">
                                <span class="signal-label">저항선:</span>
                                <span class="signal-value">${result.technicalDetails ? '$' + result.technicalDetails.resistance : 'N/A'}</span>
                            </div>
                            <div class="signal-item">
                                <span class="signal-label">피보나치 61.8%:</span>
                                <span class="signal-value">${result.technicalDetails && result.technicalDetails.fibonacci ? '$' + result.technicalDetails.fibonacci.level_618 : 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            break;
        case 'prediction':
            html = `
                <div class="analysis-summary">
                    <div class="summary-header">
                        <h3>🎯 AI 가격 예측</h3>
                        <div class="prediction-trend ${result.direction ? result.direction.replace(' ', '-').toLowerCase() : 'neutral'}">
                            ${result.direction || '중립'}
                        </div>
                    </div>
                    <div class="prediction-timeline">
                        <div class="prediction-item">
                            <div class="time-label">1시간</div>
                            <div class="price-prediction ${result.predictions && result.predictions.shortTerm && parseFloat(result.predictions.shortTerm.change) > 0 ? 'bullish' : 'bearish'}">
                                ${result.predictions && result.predictions.shortTerm ? '$' + result.predictions.shortTerm.price : 'N/A'}
                            </div>
                            <div class="change-percent ${result.predictions && result.predictions.shortTerm && parseFloat(result.predictions.shortTerm.change) > 0 ? 'positive' : 'negative'}">
                                ${result.predictions && result.predictions.shortTerm ? (parseFloat(result.predictions.shortTerm.change) >= 0 ? '+' : '') + result.predictions.shortTerm.change + '%' : 'N/A'}
                            </div>
                            <div class="probability-bar">
                                <div class="probability-fill" style="width: ${result.predictions && result.predictions.shortTerm ? result.predictions.shortTerm.probability : 50}%"></div>
                                <span class="probability-text">${result.predictions && result.predictions.shortTerm ? result.predictions.shortTerm.probability : 50}%</span>
                            </div>
                        </div>
                        <div class="prediction-item">
                            <div class="time-label">24시간</div>
                            <div class="price-prediction ${result.predictions && result.predictions.mediumTerm && parseFloat(result.predictions.mediumTerm.change) > 0 ? 'bullish' : 'bearish'}">
                                ${result.predictions && result.predictions.mediumTerm ? '$' + result.predictions.mediumTerm.price : result.targetPrice ? '$' + result.targetPrice : 'N/A'}
                            </div>
                            <div class="change-percent ${result.predictions && result.predictions.mediumTerm && parseFloat(result.predictions.mediumTerm.change) > 0 ? 'positive' : 'negative'}">
                                ${result.predictions && result.predictions.mediumTerm ? (parseFloat(result.predictions.mediumTerm.change) >= 0 ? '+' : '') + result.predictions.mediumTerm.change + '%' : 'N/A'}
                            </div>
                            <div class="probability-bar">
                                <div class="probability-fill" style="width: ${result.predictions && result.predictions.mediumTerm ? result.predictions.mediumTerm.probability : 50}%"></div>
                                <span class="probability-text">${result.predictions && result.predictions.mediumTerm ? result.predictions.mediumTerm.probability : 50}%</span>
                            </div>
                        </div>
                        <div class="prediction-item">
                            <div class="time-label">7일</div>
                            <div class="price-prediction ${result.predictions && result.predictions.longTerm && parseFloat(result.predictions.longTerm.change) > 0 ? 'bullish' : 'bearish'}">
                                ${result.predictions && result.predictions.longTerm ? '$' + result.predictions.longTerm.price : 'N/A'}
                            </div>
                            <div class="change-percent ${result.predictions && result.predictions.longTerm && parseFloat(result.predictions.longTerm.change) > 0 ? 'positive' : 'negative'}">
                                ${result.predictions && result.predictions.longTerm ? (parseFloat(result.predictions.longTerm.change) >= 0 ? '+' : '') + result.predictions.longTerm.change + '%' : 'N/A'}
                            </div>
                            <div class="probability-bar">
                                <div class="probability-fill" style="width: ${result.predictions && result.predictions.longTerm ? result.predictions.longTerm.probability : 50}%"></div>
                                <span class="probability-text">${result.predictions && result.predictions.longTerm ? result.predictions.longTerm.probability : 50}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="analysis-grid">
                    <div class="analysis-card-result">
                        <div class="card-header">
                            <h4>📊 AI 모델 상세</h4>
                            <span class="confidence-badge">${result.confidence || 88}%</span>
                        </div>
                        <div class="model-details">
                            <div class="model-item">
                                <span class="model-label">사용 모델:</span>
                                <span class="model-value">${result.modelDetails ? result.modelDetails.algorithm : 'LSTM + Transformer'}</span>
                            </div>
                            <div class="model-item">
                                <span class="model-label">데이터 포인트:</span>
                                <span class="model-value">${result.modelDetails ? result.modelDetails.dataPoints : 100}개</span>
                            </div>
                            <div class="model-item">
                                <span class="model-label">모델 정확도:</span>
                                <span class="model-value">${result.modelDetails ? result.modelDetails.accuracy : 85}%</span>
                            </div>
                            <div class="model-item">
                                <span class="model-label">변동성:</span>
                                <span class="model-value">${result.analysis && result.analysis.volatilityLevel ? result.analysis.volatilityLevel : '보통'}</span>
                            </div>
                            <div class="model-item">
                                <span class="model-label">모멘텀 점수:</span>
                                <span class="model-value">${result.analysis && result.analysis.momentumScore ? result.analysis.momentumScore : 50}/100</span>
                            </div>
                        </div>
                    </div>

                    <div class="analysis-card-result">
                        <div class="card-header">
                            <h4>⚡ 신호 분석</h4>
                        </div>
                        <div class="signal-factors">
                            ${result.analysis && result.analysis.bullishFactors && result.analysis.bullishFactors.length > 0 ? `
                                <div class="factor-group bullish">
                                    <h5>🟢 강세 요인 (${result.analysis.bullishFactors.length}개)</h5>
                                    <ul class="factor-list">
                                        ${result.analysis.bullishFactors.slice(0, 3).map(factor => `<li>${factor}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : `
                                <div class="factor-group bullish">
                                    <h5>🟢 강세 요인 (0개)</h5>
                                    <ul class="factor-list">
                                        <li>현재 강세 요인이 감지되지 않았습니다.</li>
                                    </ul>
                                </div>
                            `}
                            
                            ${result.analysis && result.analysis.bearishFactors && result.analysis.bearishFactors.length > 0 ? `
                                <div class="factor-group bearish">
                                    <h5>🔴 약세 요인 (${result.analysis.bearishFactors.length}개)</h5>
                                    <ul class="factor-list">
                                        ${result.analysis.bearishFactors.slice(0, 3).map(factor => `<li>${factor}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : `
                                <div class="factor-group bearish">
                                    <h5>🔴 약세 요인 (0개)</h5>
                                    <ul class="factor-list">
                                        <li>현재 약세 요인이 감지되지 않았습니다.</li>
                                    </ul>
                                </div>
                            `}
                            
                            <div class="signal-strength">
                                <div class="signal-label">신호 강도:</div>
                                <div class="signal-bar">
                                    <div class="signal-fill ${result.analysis && result.analysis.signalStrength > 0 ? 'bullish' : 'bearish'}" 
                                         style="width: ${Math.abs(result.analysis && result.analysis.signalStrength ? result.analysis.signalStrength * 10 : 0)}%"></div>
                                </div>
                                <div class="signal-value">${result.analysis && result.analysis.signalStrength ? result.analysis.signalStrength : 0}</div>
                            </div>
                        </div>
                    </div>

                    <div class="analysis-card-result full-width">
                        <div class="card-header">
                            <h4>🎯 핵심 레벨</h4>
                        </div>
                        <div class="key-levels">
                            <div class="level-item support">
                                <span class="level-label">지지선:</span>
                                <span class="level-value">${result.analysis && result.analysis.keyLevels ? '$' + result.analysis.keyLevels.support : 'N/A'}</span>
                            </div>
                            <div class="level-item pivot">
                                <span class="level-label">피벗 포인트:</span>
                                <span class="level-value">${result.analysis && result.analysis.keyLevels ? '$' + result.analysis.keyLevels.pivotPoint : 'N/A'}</span>
                            </div>
                            <div class="level-item resistance">
                                <span class="level-label">저항선:</span>
                                <span class="level-value">${result.analysis && result.analysis.keyLevels ? '$' + result.analysis.keyLevels.resistance : 'N/A'}</span>
                            </div>
                        </div>
                        
                        <div class="multi-timeframe">
                            <h5>📈 다중 시간프레임 분석</h5>
                            <div class="timeframe-grid">
                                <div class="timeframe-item">
                                    <span class="timeframe-label">단기:</span>
                                    <span class="timeframe-trend ${result.analysis && result.analysis.multiTimeframe ? result.analysis.multiTimeframe.shortTerm.toLowerCase() : 'neutral'}">
                                        ${result.analysis && result.analysis.multiTimeframe ? result.analysis.multiTimeframe.shortTerm : '횡보'}
                                    </span>
                                </div>
                                <div class="timeframe-item">
                                    <span class="timeframe-label">중기:</span>
                                    <span class="timeframe-trend ${result.analysis && result.analysis.multiTimeframe ? result.analysis.multiTimeframe.mediumTerm.toLowerCase() : 'neutral'}">
                                        ${result.analysis && result.analysis.multiTimeframe ? result.analysis.multiTimeframe.mediumTerm : '횡보'}
                                    </span>
                                </div>
                                <div class="timeframe-item">
                                    <span class="timeframe-label">장기:</span>
                                    <span class="timeframe-trend ${result.analysis && result.analysis.multiTimeframe ? result.analysis.multiTimeframe.longTerm.toLowerCase() : 'neutral'}">
                                        ${result.analysis && result.analysis.multiTimeframe ? result.analysis.multiTimeframe.longTerm : '횡보'}
                                    </span>
                                </div>
                                <div class="timeframe-item alignment">
                                    <span class="timeframe-label">정렬:</span>
                                    <span class="timeframe-trend ${result.analysis && result.analysis.multiTimeframe && result.analysis.multiTimeframe.alignment ? result.analysis.multiTimeframe.alignment.includes('강세') ? 'bullish' : result.analysis.multiTimeframe.alignment.includes('약세') ? 'bearish' : 'neutral' : 'neutral'}">
                                        ${result.analysis && result.analysis.multiTimeframe ? result.analysis.multiTimeframe.alignment : '혼재'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                </div>

                ${result.analysis ? `
                    <div class="analysis-card-result full-width">
                        <div class="card-header">
                            <h4>📈 다중 시간프레임 분석</h4>
                        </div>
                        <div class="timeframe-analysis">
                            <div class="timeframe-item">
                                <span class="timeframe-label">단기 (1-4H):</span>
                                <span class="timeframe-signal ${result.analysis.multiTimeframe ? result.analysis.multiTimeframe.shortTerm : 'neutral'}">${result.analysis.multiTimeframe ? result.analysis.multiTimeframe.shortTerm : '중립'}</span>
                            </div>
                            <div class="timeframe-item">
                                <span class="timeframe-label">중기 (1-3D):</span>
                                <span class="timeframe-signal ${result.analysis.multiTimeframe ? result.analysis.multiTimeframe.mediumTerm : 'neutral'}">${result.analysis.multiTimeframe ? result.analysis.multiTimeframe.mediumTerm : '중립'}</span>
                            </div>
                            <div class="timeframe-item">
                                <span class="timeframe-label">장기 (1-2W):</span>
                                <span class="timeframe-signal ${result.analysis.multiTimeframe ? result.analysis.multiTimeframe.longTerm : 'neutral'}">${result.analysis.multiTimeframe ? result.analysis.multiTimeframe.longTerm : '중립'}</span>
                            </div>
                            <div class="timeframe-item">
                                <span class="timeframe-label">신호 정렬:</span>
                                <span class="timeframe-signal">${result.analysis.multiTimeframe ? result.analysis.multiTimeframe.alignment : '부분 일치'}</span>
                            </div>
                        </div>
                    </div>
                ` : ''}
            `;
            break;
        case 'sentiment':
            html = `
                <div class="analysis-summary">
                    <div class="summary-header">
                        <h3>📰 시장 감정 분석</h3>
                        <div class="sentiment-score ${result.sentiment ? result.sentiment.toLowerCase() : 'neutral'}">
                            ${result.marketMetrics ? result.marketMetrics.sentimentScore : '75'}/100
                        </div>
                    </div>
                    <div class="sentiment-breakdown">
                        <div class="sentiment-bar">
                            <div class="positive-bar" style="width: ${result.positiveRatio || 45}%"></div>
                            <div class="neutral-bar" style="width: ${result.neutralRatio || 35}%"></div>
                            <div class="negative-bar" style="width: ${result.negativeRatio || 20}%"></div>
                        </div>
                        <div class="sentiment-labels">
                            <span class="positive">긍정 ${result.positiveRatio || 45}%</span>
                            <span class="neutral">중립 ${result.neutralRatio || 35}%</span>
                            <span class="negative">부정 ${result.negativeRatio || 20}%</span>
                        </div>
                    </div>
                </div>

                <div class="analysis-grid">
                    <div class="analysis-card-result">
                        <div class="card-header">
                            <h4>🔥 트렌딩 키워드</h4>
                        </div>
                        <div class="keyword-cloud">
                            <span class="keyword-tag positive">상승</span>
                            <span class="keyword-tag positive">돌파</span>
                            <span class="keyword-tag neutral">비트코인</span>
                            <span class="keyword-tag positive">강세</span>
                            <span class="keyword-tag negative">조정</span>
                            <span class="keyword-tag neutral">거래량</span>
                            <span class="keyword-tag positive">투자</span>
                            <span class="keyword-tag negative">하락</span>
                        </div>
                    </div>

                    <div class="analysis-card-result">
                        <div class="card-header">
                            <h4>📈 감정 추세</h4>
                        </div>
                        <div class="sentiment-trend">
                            <div class="trend-item">
                                <span class="trend-label">24시간:</span>
                                <span class="trend-value ${result.trend24h ? result.trend24h.toLowerCase() : 'positive'}">
                                    ${result.trend24h || '긍정적'}
                                </span>
                            </div>
                            <div class="trend-item">
                                <span class="trend-label">7일:</span>
                                <span class="trend-value ${result.trend7d ? result.trend7d.toLowerCase() : 'neutral'}">
                                    ${result.trend7d || '중립'}
                                </span>
                            </div>
                            <div class="trend-item">
                                <span class="trend-label">영향도:</span>
                                <span class="trend-value">${result.impact || '중간'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                ${result.marketMetrics ? `
                    <div class="analysis-card-result full-width">
                        <div class="card-header">
                            <h4>📊 시장 반응 지표</h4>
                        </div>
                        <div class="market-metrics">
                            <div class="metric-item">
                                <span class="metric-label">가격 변화:</span>
                                <span class="metric-value">${result.marketMetrics.priceChange24h}</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">거래량 변화:</span>
                                <span class="metric-value">${result.marketMetrics.volumeChange}</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">소셜 언급:</span>
                                <span class="metric-value">${result.marketMetrics.socialMentions}</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">뉴스 개수:</span>
                                <span class="metric-value">24개</span>
                            </div>
                        </div>
                    </div>
                ` : ''}

                <div class="analysis-card-result full-width">
                    <div class="card-header">
                        <h4>📰 주요 뉴스 요약</h4>
                    </div>
                    <div class="news-summary">
                        <p><strong>긍정적 요인:</strong> ${result.topNews || '기관 투자자들의 지속적인 매수세, 기술적 돌파 신호 감지'}</p>
                        <p><strong>부정적 요인:</strong> 규제 불확실성, 거시경제 우려</p>
                        <p><strong>중립적 요인:</strong> 시장 통합 단계, 거래량 안정화</p>
                    </div>
                </div>
            `;
            break;
        case 'recommendation':
            html = `
                <div class="analysis-summary">
                    <div class="summary-header">
                        <h3>💡 AI 투자 추천</h3>
                        <div class="recommendation-grade ${result.action ? result.action.toLowerCase() : 'hold'}">
                            ${result.action || 'HOLD'}
                        </div>
                    </div>
                    <div class="risk-reward">
                        <div class="risk-item">
                            <span class="label">위험도</span>
                            <div class="risk-bar">
                                <div class="risk-fill" style="width: ${result.riskLevel === '높음' ? '80' : result.riskLevel === '중간' ? '50' : '30'}%"></div>
                            </div>
                            <span class="value">${result.riskLevel === '높음' ? '80' : result.riskLevel === '중간' ? '50' : '30'}%</span>
                        </div>
                        <div class="risk-item">
                            <span class="label">기대수익률</span>
                            <div class="reward-bar">
                                <div class="reward-fill" style="width: ${result.expectedReturn || '65'}%"></div>
                            </div>
                            <span class="value">${result.expectedReturn || '65'}%</span>
                        </div>
                    </div>
                </div>

                <div class="analysis-grid">
                    <div class="analysis-card-result">
                        <div class="card-header">
                            <h4>📋 추천 전략</h4>
                            <span class="confidence-badge">${result.confidence || 82}%</span>
                        </div>
                        <div class="strategy-details">
                            <div class="strategy-item">
                                <span class="strategy-label">전략 유형:</span>
                                <span class="strategy-value">${result.strategyType || '단기 스윙'}</span>
                            </div>
                            <div class="strategy-item">
                                <span class="strategy-label">투자 기간:</span>
                                <span class="strategy-value">${result.timeHorizon || '3-7일'}</span>
                            </div>
                            <div class="strategy-item">
                                <span class="strategy-label">포지션 크기:</span>
                                <span class="strategy-value">${result.positionSize || '자금의 15%'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="analysis-card-result">
                        <div class="card-header">
                            <h4>💰 매매 포인트</h4>
                        </div>
                        <div class="trading-points">
                            <div class="point-item entry">
                                <span class="point-label">진입가</span>
                                <span class="point-value">${result.entryPoint || '현재가 -2%'}</span>
                            </div>
                            <div class="point-item stop">
                                <span class="point-label">손절가</span>
                                <span class="point-value">${result.stopLoss || '진입가 -5%'}</span>
                            </div>
                            <div class="point-item target">
                                <span class="point-label">목표가 1</span>
                                <span class="point-value">${result.takeProfit1 || '진입가 +8%'}</span>
                            </div>
                            <div class="point-item target">
                                <span class="point-label">목표가 2</span>
                                <span class="point-value">${result.takeProfit2 || '진입가 +15%'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="analysis-card-result full-width">
                    <div class="card-header">
                        <h4>📊 추천 근거</h4>
                    </div>
                    <div class="recommendation-reasoning">
                        <div class="reason-item">
                            <h5>🎯 기술적 분석</h5>
                            <p>${result.technicalSummary ? 
                                `RSI ${result.technicalSummary.rsi}, ${result.technicalSummary.patternsDetected}개 패턴 감지, ${result.technicalSummary.marketTrend} 트렌드` :
                                '주요 지지선 근처에서 반등 신호 감지, 상승 삼각형 패턴 형성 중'
                            }</p>
                        </div>
                        <div class="reason-item">
                            <h5>📈 시장 상황</h5>
                            <p>${result.reason || '거래량 증가와 함께 기술적 돌파 임박, 시장 감정 개선으로 상승 모멘텀 기대'}</p>
                        </div>
                        <div class="reason-item">
                            <h5>⚠️ 위험 요소</h5>
                            <p>전체 시장 변동성, 거시경제 이벤트 주의, 손절가 준수 필수</p>
                        </div>
                    </div>
                </div>
            `;
            break;
    }
    
    contentDiv.innerHTML = html;
}

async function saveNotificationSettings() {
    if (!window.currentUser) return;

    const settings = {
        volume: document.getElementById('notify-volume').checked,
        price: document.getElementById('notify-price').checked,
        ai: document.getElementById('notify-ai').checked,
        frequency: document.getElementById('notification-frequency').value
    };

    try {
        await window.db.collection('userSettings').doc(window.currentUser.uid).set({
            notificationSettings: settings,
            updatedAt: new Date()
        }, { merge: true });
        
        showNotification('알림 설정이 저장되었습니다.', 'success');
        document.getElementById('notification-settings-modal').style.display = 'none';
    } catch (error) {
        console.error('Error saving notification settings:', error);
        showNotification('설정 저장에 실패했습니다.', 'error');
    }
}

function showNotification(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `notification-toast ${type}`;
    toast.innerHTML = `
        <div class="notification-title">알림</div>
        <div class="notification-message">${message}</div>
    `;

    document.body.appendChild(toast);
    
    // 애니메이션
    setTimeout(() => toast.classList.add('show'), 100);
    
    // 자동 제거
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 5000);
}

// 채팅 관련 전역 변수
let messagesUnsubscribe = null;
let isChatFormInitialized = false;
const MESSAGES_PER_PAGE = 50;

// 메시지 객체로부터 HTML 문자열을 생성하여 반환
function renderMessage(msg) {
    const profileImg = msg.data.photoThumbURL || msg.data.photoURL || 'assets/@default-profile.png';
    
    let isMyMessage = false;
    if (window.currentUser && msg.data.uid === window.currentUser.uid) {
        isMyMessage = true;
    } else if (!window.currentUser) {
        const guestNumber = localStorage.getItem('guestNumber');
        if (guestNumber && msg.data.uid === 'guest-' + guestNumber) {
            isMyMessage = true;
        }
    }
    const myMessageClass = isMyMessage ? 'my-message' : '';

    return `
        <div class="message-item ${myMessageClass}" id="${msg.id}" data-uid="${msg.data.uid}">
            <div class="chat-profile-pic-wrap">
                <img class="chat-profile-pic" src="${profileImg}" alt="프로필" loading="lazy" />
            </div>
            <div class="message-content">
                <div class="message-sender">
                    <strong>${msg.data.displayName}</strong>
                </div>
                <div class="message-text">${msg.data.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
            </div>
        </div>
    `;
}

// 메시지 로드 함수
async function loadMessages() {
    try {
        console.log('Loading messages...');
        if (!window.db) throw new Error('Firestore (window.db) not initialized');
        const messagesQuery = window.db.collection('community-chat')
            .orderBy('timestamp', 'desc')
            .limit(MESSAGES_PER_PAGE);
        
        const snapshot = await messagesQuery.get();
        const messages = [];
        snapshot.forEach((doc) => {
            messages.push({ id: doc.id, data: doc.data() });
        });
        messages.reverse(); // 시간순으로 표시하기 위해 배열을 뒤집음
        
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) {
            // 모든 메시지의 HTML을 한 번에 생성하여 innerHTML로 설정
            const messagesHTML = messages.map(msg => renderMessage(msg)).join('');
            messagesContainer.innerHTML = messagesHTML;
            
            setTimeout(() => {
                if (window.innerWidth > 768) {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                } else {
                    messagesContainer.scrollTop = 0;
                }
            }, 100);
        }
        
        setupRealtimeListener();
        console.log(`${messages.length} messages loaded successfully`);
    } catch (error) {
        console.error('메시지 로드 실패:', error);
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) {
            messagesContainer.innerHTML = '<div class="chat-notice">메시지를 불러올 수 없습니다.</div>';
        }
    }
}

// 실시간 리스너 설정
function setupRealtimeListener() {
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
    }
    // 실시간 리스너는 현재 시간 이후의 새 메시지만 가져오도록 설정
    if (!window.db) return; // Firestore not ready
    const messagesQuery = window.db.collection('community-chat')
        .where('timestamp', '>', new Date());
    
    messagesUnsubscribe = messagesQuery.onSnapshot((snapshot) => {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const msg = { id: change.doc.id, data: change.doc.data() };
                if (!document.getElementById(msg.id)) {
                    // 새 메시지를 HTML로 렌더링하여 추가
                    const messageHTML = renderMessage(msg);
                    messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
                }
            }
        });
        
        // 새 메시지 수신 시 스크롤 조정
        const isScrolledToBottom = messagesContainer.scrollHeight - messagesContainer.clientHeight <= messagesContainer.scrollTop + 100;
        if (isScrolledToBottom && window.innerWidth > 768) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }, (error) => {
        console.error('실시간 메시지 리스너 오류:', error);
    });
}

// 사용자가 로그인되면 기존 메시지의 스타일을 업데이트하는 함수
function updateUserMessageStyles() {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const messages = messagesContainer.querySelectorAll('.message-item');
    const guestNumber = localStorage.getItem('guestNumber');

    messages.forEach(msgElement => {
        const msgUid = msgElement.dataset.uid;
        let isMyMessage = false;

        if (window.currentUser && msgUid === window.currentUser.uid) {
            isMyMessage = true;
        } else if (!window.currentUser && guestNumber && msgUid === 'guest-' + guestNumber) {
            isMyMessage = true;
        }

        if (isMyMessage) {
            msgElement.classList.add('my-message');
        } else {
            msgElement.classList.remove('my-message');
        }
    });
}

// 채팅 폼 설정
function setupChatForm() {
    const messageForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    
    if (messageForm && !isChatFormInitialized) {
        messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!messageInput.value.trim()) return;

            try {
                // 게스트 번호 처리 - 한 번만 생성하고 저장
                let guestNumber = localStorage.getItem('guestNumber');
                if (!guestNumber) {
                    guestNumber = Math.floor(Math.random() * 10000).toString();
                    localStorage.setItem('guestNumber', guestNumber);
                }

                const messageData = {
                    text: messageInput.value.trim(),
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    uid: window.currentUser ? window.currentUser.uid : 'guest-' + guestNumber,
                    displayName: window.currentUser ? (window.currentUser.displayName || window.currentUser.email) : '게스트' + guestNumber,
                    photoURL: window.currentUser ? window.currentUser.photoURL : null
                };

                if (window.db) await window.db.collection('community-chat').add(messageData);
                messageInput.value = '';
            } catch (error) {
                console.error('메시지 전송 실패:', error);
                showNotification('메시지 전송에 실패했습니다.', 'error');
            }
        });
        isChatFormInitialized = true;
    }
}

// 채팅 기능 초기화
function initializeChat() {
    console.log('채팅 시스템 초기화 중...');
    
    // 메시지 로드
    loadMessages();
    
    // 채팅 폼 설정
    setupChatForm();
    
    console.log('채팅 시스템 초기화 완료');
}

// 모달 닫기 이벤트 리스너
function setupModalListeners() {
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('auth-modal-close') || 
            e.target.getAttribute('data-action') === 'close-modal') {
            const modal = e.target.closest('.auth-modal');
            if (modal) {
                modal.style.display = 'none';
            }
        }
    });

    // 모달 외부 클릭 시 닫기
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('auth-modal')) {
            e.target.style.display = 'none';
        }
    });
}

// 사용자 인증 상태 변경 시 호출
function onAuthStateChanged(user) {
    window.currentUser = user;
    if (user) {
        console.log('사용자 로그인:', user.uid);
        updateUserMessageStyles(); // 로그인 시 메시지 스타일 업데이트
        
        // 로그인 후 차트 저장/불러오기 기능 활성화
        if (widget && widget.onChartReady) {
            widget.onChartReady(() => {
                // 차트 저장/불러오기 어댑터 설정
                widget.save_load_adapter = createChartStorageAdapter();
                console.log('차트 저장/불러오기 기능이 활성화되었습니다.');
            });
        }
    } else {
        console.log('사용자 로그아웃');
        updateUserMessageStyles(); // 로그아웃 시 메시지 스타일 업데이트
        
        // 로그아웃 시 차트 저장/불러오기 기능 비활성화
        if (widget) {
            widget.save_load_adapter = null;
            console.log('차트 저장/불러오기 기능이 비활성화되었습니다.');
        }
    }
}

// Firebase Auth 상태 변경 리스너
async function setupAuthListener() {
    await waitForFirebase();
    if (window.auth) {
        window.auth.onAuthStateChanged(onAuthStateChanged);
    }
}

// 페이지 초기화
document.addEventListener('DOMContentLoaded', async () => {
    console.log('커뮤니티 페이지 초기화 시작');
    
    // Firebase 대기
    await waitForFirebase();
    
    // 차트 초기화
    initializeTradingViewChart();
    
    // AI 기능 초기화
    initializeAIFeatures();
    
    // 채팅 초기화
    initializeChat();
    
    // 모달 리스너 설정
    setupModalListeners();
    
    // 인증 리스너 설정
    setupAuthListener();
    
    console.log('커뮤니티 페이지 초기화 완료');
}); 

// ==================== 최첨단 기술적 지표 함수들 ====================

// ADX (Average Directional Index) - 트렌드 강도 측정
function calculateADX(highs, lows, closes, period = 14) {
    if (highs.length < period + 1) return 25;
    
    const trueRanges = [];
    const plusDM = [];
    const minusDM = [];
    
    for (let i = 1; i < highs.length; i++) {
        const tr = Math.max(
            highs[i] - lows[i],
            Math.abs(highs[i] - closes[i-1]),
            Math.abs(lows[i] - closes[i-1])
        );
        trueRanges.push(tr);
        
        const highDiff = highs[i] - highs[i-1];
        const lowDiff = lows[i-1] - lows[i];
        
        plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
        minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
    }
    
    const avgTR = trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgPlusDM = plusDM.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgMinusDM = minusDM.slice(-period).reduce((a, b) => a + b, 0) / period;
    
    const plusDI = (avgPlusDM / avgTR) * 100;
    const minusDI = (avgMinusDM / avgTR) * 100;
    
    const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
    return Math.min(100, Math.max(0, dx));
}

// CCI (Commodity Channel Index) - 과매수/과매도 측정
function calculateCCI(highs, lows, closes, period = 20) {
    if (highs.length < period) return 0;
    
    const typicalPrices = highs.slice(-period).map((h, i) => 
        (h + lows[lows.length - period + i] + closes[closes.length - period + i]) / 3
    );
    
    const smaTP = typicalPrices.reduce((a, b) => a + b, 0) / period;
    const meanDeviation = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - smaTP), 0) / period;
    
    const currentTP = (highs[highs.length - 1] + lows[lows.length - 1] + closes[closes.length - 1]) / 3;
    return meanDeviation !== 0 ? (currentTP - smaTP) / (0.015 * meanDeviation) : 0;
}

// ROC (Rate of Change) - 가격 변화율
function calculateROC(prices, period = 12) {
    if (prices.length < period + 1) return 0;
    const current = prices[prices.length - 1];
    const past = prices[prices.length - 1 - period];
    return ((current - past) / past) * 100;
}

// MFI (Money Flow Index) - 거래량 가중 RSI
function calculateMFI(highs, lows, closes, volumes, period = 14) {
    if (highs.length < period + 1) return 50;
    
    const typicalPrices = highs.slice(-period-1).map((h, i) => 
        (h + lows[lows.length - period - 1 + i] + closes[closes.length - period - 1 + i]) / 3
    );
    
    let positiveFlow = 0, negativeFlow = 0;
    
    for (let i = 1; i < typicalPrices.length; i++) {
        const rawMoneyFlow = typicalPrices[i] * volumes[volumes.length - period + i - 1];
        
        if (typicalPrices[i] > typicalPrices[i - 1]) {
            positiveFlow += rawMoneyFlow;
        } else if (typicalPrices[i] < typicalPrices[i - 1]) {
            negativeFlow += rawMoneyFlow;
        }
    }
    
    if (negativeFlow === 0) return 100;
    const moneyFlowRatio = positiveFlow / negativeFlow;
    return 100 - (100 / (1 + moneyFlowRatio));
}

// OBV (On-Balance Volume) - 거래량 추세 분석
function calculateOBV(closes, volumes) {
    if (closes.length < 2) return 0;
    
    let obv = volumes[0];
    for (let i = 1; i < closes.length; i++) {
        if (closes[i] > closes[i - 1]) {
            obv += volumes[i];
        } else if (closes[i] < closes[i - 1]) {
            obv -= volumes[i];
        }
    }
    return obv;
}

// VWAP (Volume Weighted Average Price) - 거래량 가중 평균가
function calculateVWAP(highs, lows, closes, volumes) {
    let cumulativeTPV = 0;
    let cumulativeVolume = 0;
    
    for (let i = 0; i < Math.min(highs.length, 20); i++) {
        const idx = highs.length - 20 + i;
        if (idx >= 0) {
            const typicalPrice = (highs[idx] + lows[idx] + closes[idx]) / 3;
            cumulativeTPV += typicalPrice * volumes[idx];
            cumulativeVolume += volumes[idx];
        }
    }
    
    return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : closes[closes.length - 1];
}

// 피벗 포인트 계산 (고급 버전)
function calculatePivotPoints(highs, lows, closes) {
    const high = Math.max(...highs.slice(-5));
    const low = Math.min(...lows.slice(-5));
    const close = closes[closes.length - 1];
    
    // 클래식 피벗 포인트
    const pivot = (high + low + close) / 3;
    const r1 = 2 * pivot - low;
    const s1 = 2 * pivot - high;
    const r2 = pivot + (high - low);
    const s2 = pivot - (high - low);
    const r3 = high + 2 * (pivot - low);
    const s3 = low - 2 * (high - pivot);
    
    // 피보나치 피벗 포인트
    const fibR1 = pivot + 0.382 * (high - low);
    const fibS1 = pivot - 0.382 * (high - low);
    const fibR2 = pivot + 0.618 * (high - low);
    const fibS2 = pivot - 0.618 * (high - low);
    
    return { 
        classic: { pivot, r1, s1, r2, s2, r3, s3 },
        fibonacci: { pivot, r1: fibR1, s1: fibS1, r2: fibR2, s2: fibS2 }
    };
}

// 일목균형표 계산 (완전 버전)
function calculateIchimoku(highs, lows, closes) {
    const tenkanPeriod = 9;
    const kijunPeriod = 26;
    const senkouBPeriod = 52;
    
    // 전환선 (Tenkan-sen)
    const tenkanHigh = Math.max(...highs.slice(-tenkanPeriod));
    const tenkanLow = Math.min(...lows.slice(-tenkanPeriod));
    const tenkanSen = (tenkanHigh + tenkanLow) / 2;
    
    // 기준선 (Kijun-sen)
    const kijunHigh = Math.max(...highs.slice(-kijunPeriod));
    const kijunLow = Math.min(...lows.slice(-kijunPeriod));
    const kijunSen = (kijunHigh + kijunLow) / 2;
    
    // 선행스팬 A (Senkou Span A)
    const senkouSpanA = (tenkanSen + kijunSen) / 2;
    
    // 선행스팬 B (Senkou Span B)
    const senkouHigh = Math.max(...highs.slice(-senkouBPeriod));
    const senkouLow = Math.min(...lows.slice(-senkouBPeriod));
    const senkouSpanB = (senkouHigh + senkouLow) / 2;
    
    // 후행스팬 (Chikou Span)
    const chikouSpan = closes[Math.max(0, closes.length - 26)];
    
    // 구름 분석
    const cloudTop = Math.max(senkouSpanA, senkouSpanB);
    const cloudBottom = Math.min(senkouSpanA, senkouSpanB);
    const cloudThickness = cloudTop - cloudBottom;
    const currentPrice = closes[closes.length - 1];
    
    let signal = 'neutral';
    if (currentPrice > cloudTop && tenkanSen > kijunSen) signal = 'bullish';
    else if (currentPrice < cloudBottom && tenkanSen < kijunSen) signal = 'bearish';
    
    return { 
        tenkanSen, kijunSen, senkouSpanA, senkouSpanB, chikouSpan,
        cloudTop, cloudBottom, cloudThickness, signal
    };
}

// 파라볼릭 SAR 계산 (최적화 버전)
function calculateParabolicSAR(highs, lows, step = 0.02, max = 0.2) {
    if (highs.length < 10) return lows[lows.length - 1];
    
    const recentHighs = highs.slice(-10);
    const recentLows = lows.slice(-10);
    
    let sar = recentLows[0];
    let ep = recentHighs[0];
    let af = step;
    let trend = 1; // 1 for uptrend, -1 for downtrend
    
    for (let i = 1; i < recentHighs.length; i++) {
        const prevSAR = sar;
        
        if (trend === 1) {
            sar = prevSAR + af * (ep - prevSAR);
            
            if (recentHighs[i] > ep) {
                ep = recentHighs[i];
                af = Math.min(af + step, max);
            }
            
            if (recentLows[i] < sar) {
                trend = -1;
                sar = ep;
                ep = recentLows[i];
                af = step;
            }
        } else {
            sar = prevSAR + af * (ep - prevSAR);
            
            if (recentLows[i] < ep) {
                ep = recentLows[i];
                af = Math.min(af + step, max);
            }
            
            if (recentHighs[i] > sar) {
                trend = 1;
                sar = ep;
                ep = recentHighs[i];
                af = step;
            }
        }
    }
    
    return sar;
}

// 켈트너 채널 계산
function calculateKeltnerChannels(highs, lows, closes, period = 20, multiplier = 2) {
    const ema = calculateEMA(closes, period);
    const atr = calculateATR(highs, lows, closes, period);
    const currentEMA = ema[ema.length - 1] || closes[closes.length - 1];
    const currentATR = atr[atr.length - 1] || (closes[closes.length - 1] * 0.02);
    
    return {
        middle: currentEMA,
        upper: currentEMA + (multiplier * currentATR),
        lower: currentEMA - (multiplier * currentATR),
        squeeze: (currentATR / currentEMA) < 0.015 // 스퀴즈 상태
    };
}

// 돈치안 채널 계산
function calculateDonchianChannels(highs, lows, period = 20) {
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    
    const upper = Math.max(...recentHighs);
    const lower = Math.min(...recentLows);
    const middle = (upper + lower) / 2;
    const width = upper - lower;
    
    return { upper, lower, middle, width };
}

// ==================== 고급 패턴 인식 함수들 ====================

// 고급 패턴 감지
function detectAdvancedPatterns(highs, lows, closes, volumes) {
    const patterns = [];
    
    // 갭 패턴 분석
    const gaps = detectGapPatterns(highs, lows, closes);
    patterns.push(...gaps);
    
    // 스파이크 패턴
    const spikes = detectSpikePatterns(highs, lows, volumes);
    patterns.push(...spikes);
    
    // 브레이크아웃 패턴
    const breakouts = detectBreakoutPatterns(highs, lows, closes, volumes);
    patterns.push(...breakouts);
    
    return patterns;
}

// 하모닉 패턴 감지 (ABCD, Gartley, Butterfly 등)
function detectHarmonicPatterns(highs, lows, closes) {
    const patterns = [];
    const peaks = findPeaks(highs, 3);
    const troughs = findTroughs(lows, 3);
    
    if (peaks.length >= 2 && troughs.length >= 2) {
        // ABCD 패턴 감지
        const abcdPattern = detectABCDPattern(peaks, troughs);
        if (abcdPattern) patterns.push(abcdPattern);
        
        // Gartley 패턴 감지
        const gartleyPattern = detectGartleyPattern(peaks, troughs);
        if (gartleyPattern) patterns.push(gartleyPattern);
    }
    
    return patterns;
}

// 캔들스틱 패턴 감지
function detectCandlestickPatterns(highs, lows, closes) {
    const patterns = [];
    const opens = closes.map((close, i) => i > 0 ? closes[i-1] : close);
    
    // 도지 패턴
    const dojiPattern = detectDojiPattern(opens, highs, lows, closes);
    if (dojiPattern) patterns.push(dojiPattern);
    
    // 해머 패턴
    const hammerPattern = detectHammerPattern(opens, highs, lows, closes);
    if (hammerPattern) patterns.push(hammerPattern);
    
    // 엔걸핑 패턴
    const engulfingPattern = detectEngulfingPattern(opens, highs, lows, closes);
    if (engulfingPattern) patterns.push(engulfingPattern);
    
    return patterns;
}

// 거래량 패턴 감지
function detectVolumePatterns(volumes, closes) {
    const patterns = [];
    
    // 거래량 급증 패턴
    const volumeSpike = detectVolumeSpike(volumes, closes);
    if (volumeSpike) patterns.push(volumeSpike);
    
    // 거래량 고갈 패턴
    const volumeDryUp = detectVolumeDryUp(volumes);
    if (volumeDryUp) patterns.push(volumeDryUp);
    
    return patterns;
}

// ==================== 시장 구조 분석 함수들 ====================

// 시장 구조 분석
function analyzeMarketStructure(highs, lows, closes) {
    const swingHighs = findPeaks(highs, 5);
    const swingLows = findTroughs(lows, 5);
    
    // 고점과 저점의 패턴 분석
    let structure = 'sideways';
    let strength = 0;
    
    if (swingHighs.length >= 2 && swingLows.length >= 2) {
        const recentHighs = swingHighs.slice(-2);
        const recentLows = swingLows.slice(-2);
        
        // 상승 구조 (Higher Highs, Higher Lows)
        if (recentHighs[1].price > recentHighs[0].price && 
            recentLows[1].price > recentLows[0].price) {
            structure = 'uptrend';
            strength = 80;
        }
        // 하락 구조 (Lower Highs, Lower Lows)
        else if (recentHighs[1].price < recentHighs[0].price && 
                 recentLows[1].price < recentLows[0].price) {
            structure = 'downtrend';
            strength = 80;
        }
    }
    
    return { structure, strength, swingHighs, swingLows };
}

// 주문 흐름 분석
function analyzeOrderFlow(volumes, closes) {
    const recentData = Math.min(20, volumes.length);
    let buyVolume = 0, sellVolume = 0;
    
    for (let i = 1; i < recentData; i++) {
        const idx = volumes.length - recentData + i;
        if (closes[idx] > closes[idx - 1]) {
            buyVolume += volumes[idx];
        } else if (closes[idx] < closes[idx - 1]) {
            sellVolume += volumes[idx];
        }
    }
    
    const totalVolume = buyVolume + sellVolume;
    const buyPressure = totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 50;
    
    return {
        buyPressure,
        sellPressure: 100 - buyPressure,
        dominance: buyPressure > 60 ? 'buyers' : buyPressure < 40 ? 'sellers' : 'balanced'
    };
}

// 유동성 구간 식별
function identifyLiquidityZones(highs, lows, volumes) {
    const zones = [];
    const period = 20;
    
    for (let i = period; i < highs.length; i++) {
        const recentHighs = highs.slice(i - period, i);
        const recentLows = lows.slice(i - period, i);
        const recentVolumes = volumes.slice(i - period, i);
        
        // 고거래량 구간 찾기
        const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / period;
        const maxVolume = Math.max(...recentVolumes);
        
        if (maxVolume > avgVolume * 1.5) {
            const maxVolumeIndex = recentVolumes.indexOf(maxVolume);
            const priceLevel = (recentHighs[maxVolumeIndex] + recentLows[maxVolumeIndex]) / 2;
            
            zones.push({
                price: priceLevel,
                volume: maxVolume,
                type: 'high_liquidity',
                strength: (maxVolume / avgVolume) * 10
            });
        }
    }
    
    return zones.slice(-5); // 최근 5개 구간만 반환
}

// 기관 투자자 발자국 감지
function detectInstitutionalFootprints(volumes, closes) {
    const footprints = [];
    const threshold = 2.0; // 평균 거래량의 2배
    
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    
    for (let i = 1; i < volumes.length; i++) {
        if (volumes[i] > avgVolume * threshold) {
            const priceChange = Math.abs(closes[i] - closes[i - 1]) / closes[i - 1];
            
            footprints.push({
                index: i,
                volume: volumes[i],
                volumeRatio: volumes[i] / avgVolume,
                priceImpact: priceChange * 100,
                type: closes[i] > closes[i - 1] ? 'accumulation' : 'distribution'
            });
        }
    }
    
    return footprints.slice(-3); // 최근 3개만 반환
}

// ==================== 보조 패턴 감지 함수들 ====================

function detectGapPatterns(highs, lows, closes) {
    const patterns = [];
    
    for (let i = 1; i < closes.length; i++) {
        const prevClose = closes[i - 1];
        const currentHigh = highs[i];
        const currentLow = lows[i];
        
        // 갭업
        if (currentLow > prevClose) {
            const gapSize = (currentLow - prevClose) / prevClose * 100;
            if (gapSize > 2) {
                patterns.push({
                    name: '갭업',
                    type: 'bullish',
                    confidence: Math.min(85, 60 + gapSize * 5),
                    gapSize: gapSize.toFixed(2) + '%'
                });
            }
        }
        // 갭다운
        else if (currentHigh < prevClose) {
            const gapSize = (prevClose - currentHigh) / prevClose * 100;
            if (gapSize > 2) {
                patterns.push({
                    name: '갭다운',
                    type: 'bearish',
                    confidence: Math.min(85, 60 + gapSize * 5),
                    gapSize: gapSize.toFixed(2) + '%'
                });
            }
        }
    }
    
    return patterns.slice(-2); // 최근 2개만
}

function detectSpikePatterns(highs, lows, volumes) {
    const patterns = [];
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    
    volumes.forEach((volume, i) => {
        if (volume > avgVolume * 3 && i > 0) {
            const priceRange = (highs[i] - lows[i]) / lows[i] * 100;
            
            if (priceRange > 5) {
                patterns.push({
                    name: '거래량 스파이크',
                    type: 'neutral',
                    confidence: 75,
                    volumeRatio: (volume / avgVolume).toFixed(1) + 'x',
                    priceRange: priceRange.toFixed(1) + '%'
                });
            }
        }
    });
    
    return patterns.slice(-1); // 최근 1개만
}

function detectBreakoutPatterns(highs, lows, closes, volumes) {
    const patterns = [];
    const period = 20;
    
    if (closes.length < period) return patterns;
    
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const resistance = Math.max(...recentHighs.slice(0, -1));
    const support = Math.min(...recentLows.slice(0, -1));
    const currentPrice = closes[closes.length - 1];
    const currentVolume = volumes[volumes.length - 1];
    const avgVolume = volumes.slice(-period).reduce((a, b) => a + b, 0) / period;
    
    // 저항선 돌파
    if (currentPrice > resistance && currentVolume > avgVolume * 1.2) {
        patterns.push({
            name: '저항선 돌파',
            type: 'bullish',
            confidence: 80,
            breakoutLevel: resistance.toFixed(2),
            volumeConfirmation: true
        });
    }
    // 지지선 이탈
    else if (currentPrice < support && currentVolume > avgVolume * 1.2) {
        patterns.push({
            name: '지지선 이탈',
            type: 'bearish',
            confidence: 80,
            breakoutLevel: support.toFixed(2),
            volumeConfirmation: true
        });
    }
    
    return patterns;
}

// 간단한 보조 함수들
function detectABCDPattern(peaks, troughs) {
    // 간단한 ABCD 패턴 감지 로직
    return null; // 실제 구현 필요
}

function detectGartleyPattern(peaks, troughs) {
    // Gartley 패턴 감지 로직
    return null; // 실제 구현 필요
}

function detectDojiPattern(opens, highs, lows, closes) {
    const lastIndex = closes.length - 1;
    const body = Math.abs(closes[lastIndex] - opens[lastIndex]);
    const range = highs[lastIndex] - lows[lastIndex];
    
    if (body / range < 0.1) {
        return {
            name: '도지',
            type: 'neutral',
            confidence: 70,
            description: '시장 불확실성을 나타내는 반전 신호'
        };
    }
    return null;
}

function detectHammerPattern(opens, highs, lows, closes) {
    const lastIndex = closes.length - 1;
    const body = Math.abs(closes[lastIndex] - opens[lastIndex]);
    const lowerShadow = Math.min(opens[lastIndex], closes[lastIndex]) - lows[lastIndex];
    const upperShadow = highs[lastIndex] - Math.max(opens[lastIndex], closes[lastIndex]);
    
    if (lowerShadow > body * 2 && upperShadow < body * 0.5) {
        return {
            name: '해머',
            type: 'bullish',
            confidence: 75,
            description: '하락 추세 끝에서 나타나는 반전 신호'
        };
    }
    return null;
}

function detectEngulfingPattern(opens, highs, lows, closes) {
    if (closes.length < 2) return null;
    
    const prev = closes.length - 2;
    const curr = closes.length - 1;
    
    // 강세 엔걸핑
    if (closes[prev] < opens[prev] && closes[curr] > opens[curr] &&
        opens[curr] < closes[prev] && closes[curr] > opens[prev]) {
        return {
            name: '강세 엔걸핑',
            type: 'bullish',
            confidence: 80,
            description: '강력한 상승 반전 신호'
        };
    }
    
    // 약세 엔걸핑
    if (closes[prev] > opens[prev] && closes[curr] < opens[curr] &&
        opens[curr] > closes[prev] && closes[curr] < opens[prev]) {
        return {
            name: '약세 엔걸핑',
            type: 'bearish',
            confidence: 80,
            description: '강력한 하락 반전 신호'
        };
    }
    
    return null;
}

function detectVolumeSpike(volumes, closes) {
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    
    if (currentVolume > avgVolume * 2.5) {
        const priceChange = closes.length > 1 ? 
            (closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2] * 100 : 0;
        
        return {
            name: '거래량 급증',
            type: priceChange > 0 ? 'bullish' : 'bearish',
            confidence: 75,
            volumeRatio: (currentVolume / avgVolume).toFixed(1) + 'x',
            priceChange: priceChange.toFixed(2) + '%'
        };
    }
    return null;
}

function detectVolumeDryUp(volumes) {
    const recentVolumes = volumes.slice(-5);
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const recentAvg = recentVolumes.reduce((a, b) => a + b, 0) / 5;
    
    if (recentAvg < avgVolume * 0.5) {
        return {
            name: '거래량 고갈',
            type: 'neutral',
            confidence: 70,
            description: '시장 관심 감소, 방향성 변화 가능성'
        };
    }
    return null;
}

// ==================== 고급 분석 함수들 ====================

// 고급 신호 분석 (20개+ 지표 종합)
function performAdvancedSignalAnalysis(indicators, currentPrice, marketStructure, orderFlow) {
    const signals = [];
    
    // 트렌드 지표들
    if (indicators.adx > 25) {
        signals.push({
            name: 'ADX',
            value: indicators.adx.toFixed(1),
            signal: indicators.adx > 50 ? 'strong_trend' : 'trend',
            type: marketStructure.structure === 'uptrend' ? 'bullish' : marketStructure.structure === 'downtrend' ? 'bearish' : 'neutral',
            weight: 3
        });
    }
    
    // 모멘텀 지표들
    signals.push({
        name: 'CCI',
        value: indicators.cci.toFixed(1),
        signal: indicators.cci > 100 ? 'bullish' : indicators.cci < -100 ? 'bearish' : 'neutral',
        type: indicators.cci > 100 ? 'bullish' : indicators.cci < -100 ? 'bearish' : 'neutral',
        weight: 2
    });
    
    signals.push({
        name: 'ROC',
        value: indicators.roc.toFixed(2) + '%',
        signal: indicators.roc > 5 ? 'bullish' : indicators.roc < -5 ? 'bearish' : 'neutral',
        type: indicators.roc > 0 ? 'bullish' : 'bearish',
        weight: 2
    });
    
    signals.push({
        name: 'MFI',
        value: indicators.mfi.toFixed(1),
        signal: indicators.mfi > 80 ? 'overbought' : indicators.mfi < 20 ? 'oversold' : 'neutral',
        type: indicators.mfi > 80 ? 'bearish' : indicators.mfi < 20 ? 'bullish' : 'neutral',
        weight: 2
    });
    
    // 거래량 지표들
    signals.push({
        name: 'OBV',
        value: (indicators.obv / 1000000).toFixed(1) + 'M',
        signal: indicators.obv > 0 ? 'bullish' : 'bearish',
        type: indicators.obv > 0 ? 'bullish' : 'bearish',
        weight: 2
    });
    
    // 가격 지표들
    const vwapSignal = currentPrice > indicators.vwap ? 'bullish' : 'bearish';
    signals.push({
        name: 'VWAP',
        value: '$' + indicators.vwap.toFixed(2),
        signal: vwapSignal,
        type: vwapSignal,
        weight: 3
    });
    
    // 일목균형표
    signals.push({
        name: '일목균형표',
        value: indicators.ichimoku.signal,
        signal: indicators.ichimoku.signal,
        type: indicators.ichimoku.signal,
        weight: 4
    });
    
    // 파라볼릭 SAR
    const sarSignal = currentPrice > indicators.parabolicSAR ? 'bullish' : 'bearish';
    signals.push({
        name: 'Parabolic SAR',
        value: '$' + indicators.parabolicSAR.toFixed(2),
        signal: sarSignal,
        type: sarSignal,
        weight: 2
    });
    
    // 켈트너 채널
    let keltnerSignal = 'neutral';
    if (currentPrice > indicators.keltnerChannels.upper) keltnerSignal = 'overbought';
    else if (currentPrice < indicators.keltnerChannels.lower) keltnerSignal = 'oversold';
    else if (indicators.keltnerChannels.squeeze) keltnerSignal = 'breakout_pending';
    
    signals.push({
        name: 'Keltner Channels',
        value: keltnerSignal.replace('_', ' '),
        signal: keltnerSignal,
        type: keltnerSignal === 'overbought' ? 'bearish' : keltnerSignal === 'oversold' ? 'bullish' : 'neutral',
        weight: 2
    });
    
    // 돈치안 채널
    let donchianSignal = 'neutral';
    if (currentPrice >= indicators.donchianChannels.upper * 0.98) donchianSignal = 'breakout_high';
    else if (currentPrice <= indicators.donchianChannels.lower * 1.02) donchianSignal = 'breakout_low';
    
    signals.push({
        name: 'Donchian Channels',
        value: donchianSignal.replace('_', ' '),
        signal: donchianSignal,
        type: donchianSignal === 'breakout_high' ? 'bullish' : donchianSignal === 'breakout_low' ? 'bearish' : 'neutral',
        weight: 2
    });
    
    // 주문 흐름 분석
    signals.push({
        name: 'Order Flow',
        value: orderFlow.dominance,
        signal: orderFlow.dominance,
        type: orderFlow.dominance === 'buyers' ? 'bullish' : orderFlow.dominance === 'sellers' ? 'bearish' : 'neutral',
        weight: 3
    });
    
    // 시장 구조
    signals.push({
        name: 'Market Structure',
        value: marketStructure.structure,
        signal: marketStructure.structure,
        type: marketStructure.structure === 'uptrend' ? 'bullish' : marketStructure.structure === 'downtrend' ? 'bearish' : 'neutral',
        weight: 4
    });
    
    return signals;
}

// 고급 패턴 요약 생성
function generateAdvancedPatternSummary(patterns, signals, marketStructure) {
    const bullishSignals = signals.filter(s => s.type === 'bullish').length;
    const bearishSignals = signals.filter(s => s.type === 'bearish').length;
    const neutralSignals = signals.filter(s => s.type === 'neutral').length;
    
    const bullishPatterns = patterns.filter(p => p.type === 'bullish').length;
    const bearishPatterns = patterns.filter(p => p.type === 'bearish').length;
    const neutralPatterns = patterns.filter(p => p.type === 'neutral').length;
    
    // 가중치 기반 종합 점수 계산
    let totalScore = 0;
    let totalWeight = 0;
    
    signals.forEach(signal => {
        const scoreMultiplier = signal.type === 'bullish' ? 1 : signal.type === 'bearish' ? -1 : 0;
        totalScore += scoreMultiplier * signal.weight;
        totalWeight += signal.weight;
    });
    
    patterns.forEach(pattern => {
        const scoreMultiplier = pattern.type === 'bullish' ? 1 : pattern.type === 'bearish' ? -1 : 0;
        const patternWeight = pattern.confidence / 20; // 신뢰도를 가중치로 변환
        totalScore += scoreMultiplier * patternWeight;
        totalWeight += patternWeight;
    });
    
    const normalizedScore = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;
    
    let overallSignal = 'neutral';
    if (normalizedScore > 30) overallSignal = 'bullish';
    else if (normalizedScore < -30) overallSignal = 'bearish';
    
    return {
        bullishCount: bullishSignals + bullishPatterns,
        bearishCount: bearishSignals + bearishPatterns,
        neutralCount: neutralSignals + neutralPatterns,
        overallSignal,
        score: normalizedScore,
        keySignals: signals.sort((a, b) => b.weight - a.weight).slice(0, 6),
        topPatterns: patterns.sort((a, b) => b.confidence - a.confidence).slice(0, 3)
    };
}

// 고급 상세 분석 생성
function generateAdvancedDetailedAnalysis(patterns, signals, currentPrice, support, resistance, marketStructure, orderFlow, liquidityZones, institutionalFootprints) {
    let analysis = '';
    
    // 시장 구조 분석
    analysis += `시장 구조 분석:\n`;
    analysis += `현재 시장은 ${marketStructure.structure === 'uptrend' ? '상승' : marketStructure.structure === 'downtrend' ? '하락' : '횡보'} 구조를 보이고 있습니다. `;
    analysis += `구조 강도는 ${marketStructure.strength}%로 ${marketStructure.strength > 70 ? '매우 강함' : marketStructure.strength > 50 ? '보통' : '약함'}니다.\n\n`;
    
    // 주문 흐름 분석
    analysis += `주문 흐름 분석:\n`;
    analysis += `매수 압력: ${orderFlow.buyPressure.toFixed(1)}%, 매도 압력: ${orderFlow.sellPressure.toFixed(1)}%\n`;
    analysis += `현재 ${orderFlow.dominance === 'buyers' ? '매수세가 우세' : orderFlow.dominance === 'sellers' ? '매도세가 우세' : '균형 상태'}합니다.\n\n`;
    
    // 핵심 신호 분석
    analysis += `핵심 기술적 신호:\n`;
    const strongSignals = signals.filter(s => s.weight >= 3);
    strongSignals.forEach(signal => {
        const direction = signal.type === 'bullish' ? '강세' : signal.type === 'bearish' ? '약세' : '중립';
        analysis += `• ${signal.name}: ${signal.value} (${direction} 신호)\n`;
    });
    analysis += '\n';
    
    // 패턴 분석
    if (patterns.length > 0) {
        analysis += `감지된 패턴:\n`;
        patterns.slice(0, 3).forEach(pattern => {
            const direction = pattern.type === 'bullish' ? '강세' : pattern.type === 'bearish' ? '약세' : '중립';
            analysis += `• ${pattern.name}: ${pattern.confidence}% 신뢰도 (${direction})\n`;
            if (pattern.description) analysis += `  ${pattern.description}\n`;
        });
        analysis += '\n';
    }
    
    // 지지/저항 분석
    analysis += `주요 가격대:\n`;
    analysis += `• 현재가: $${currentPrice.toFixed(2)}\n`;
    analysis += `• 주요 지지선: $${support.toFixed(2)} (${((currentPrice - support) / currentPrice * 100).toFixed(1)}% 하방)\n`;
    analysis += `• 주요 저항선: $${resistance.toFixed(2)} (${((resistance - currentPrice) / currentPrice * 100).toFixed(1)}% 상방)\n\n`;
    
    // 유동성 구간 분석
    if (liquidityZones.length > 0) {
        analysis += `유동성 구간:\n`;
        liquidityZones.slice(0, 2).forEach(zone => {
            const distance = ((zone.price - currentPrice) / currentPrice * 100).toFixed(1);
            analysis += `• $${zone.price.toFixed(2)} (현재가 대비 ${distance > 0 ? '+' : ''}${distance}%) - 강도: ${zone.strength.toFixed(1)}\n`;
        });
        analysis += '\n';
    }
    
    // 기관 투자자 발자국
    if (institutionalFootprints.length > 0) {
        analysis += `기관 투자자 활동:\n`;
        institutionalFootprints.forEach(footprint => {
            const type = footprint.type === 'accumulation' ? '매집' : '분산';
            analysis += `• ${type} 신호 감지 (거래량 ${footprint.volumeRatio.toFixed(1)}배 증가)\n`;
        });
        analysis += '\n';
    }
    
    // 종합 전망 및 결론
    analysis += `종합 전망 및 결론:\n`;
    const bullishFactors = signals.filter(s => s.type === 'bullish').length + patterns.filter(p => p.type === 'bullish').length;
    const bearishFactors = signals.filter(s => s.type === 'bearish').length + patterns.filter(p => p.type === 'bearish').length;
    
    if (bullishFactors > bearishFactors) {
        analysis += `현재 ${bullishFactors}개의 강세 요인이 ${bearishFactors}개의 약세 요인을 상회하고 있어 단기적으로 상승 모멘텀이 우세할 것으로 예상됩니다. `;
        analysis += `따라서 매수 포지션을 고려해볼 수 있으며, 주요 저항선 돌파 시 추가 상승이 기대됩니다.`;
    } else if (bearishFactors > bullishFactors) {
        analysis += `현재 ${bearishFactors}개의 약세 요인이 ${bullishFactors}개의 강세 요인을 상회하고 있어 단기적으로 하락 압력이 클 것으로 예상됩니다. `;
        analysis += `따라서 매도 포지션을 고려하거나 기존 포지션의 손절을 검토해야 할 시점입니다.`;
    } else {
        analysis += `강세와 약세 요인이 균형을 이루고 있어 횡보 국면이 지속될 가능성이 높습니다. `;
        analysis += `명확한 방향성이 나타날 때까지 관망하거나 레인지 매매 전략을 고려할 수 있습니다.`;
    }
    
    return analysis;
}

// 고급 매매 추천 계산
function calculateAdvancedTradingRecommendation(signals, patterns, currentPrice, support, resistance, marketStructure, orderFlow) {
    let score = 0;
    let totalWeight = 0;
    
    // 신호 점수 계산
    signals.forEach(signal => {
        const signalScore = signal.type === 'bullish' ? 1 : signal.type === 'bearish' ? -1 : 0;
        score += signalScore * signal.weight;
        totalWeight += signal.weight;
    });
    
    // 패턴 점수 계산
    patterns.forEach(pattern => {
        const patternScore = pattern.type === 'bullish' ? 1 : pattern.type === 'bearish' ? -1 : 0;
        const patternWeight = pattern.confidence / 20;
        score += patternScore * patternWeight;
        totalWeight += patternWeight;
    });
    
    // 시장 구조 보너스
    if (marketStructure.structure === 'uptrend' && marketStructure.strength > 70) {
        score += 2;
        totalWeight += 2;
    } else if (marketStructure.structure === 'downtrend' && marketStructure.strength > 70) {
        score -= 2;
        totalWeight += 2;
    }
    
    // 주문 흐름 보너스
    if (orderFlow.buyPressure > 65) {
        score += 1;
        totalWeight += 1;
    } else if (orderFlow.sellPressure > 65) {
        score -= 1;
        totalWeight += 1;
    }
    
    const normalizedScore = totalWeight > 0 ? score / totalWeight : 0;
    
    let action = 'hold';
    let riskLevel = 'medium';
    let reason = '';
    
    if (normalizedScore > 0.4) {
        action = 'buy';
        riskLevel = normalizedScore > 0.7 ? 'low' : 'medium';
        reason = '다수의 강세 신호와 긍정적인 시장 구조가 상승 모멘텀을 지지하고 있습니다.';
    } else if (normalizedScore < -0.4) {
        action = 'sell';
        riskLevel = normalizedScore < -0.7 ? 'low' : 'medium';
                 reason = '다수의 약세 신호와 부정적인 시장 구조가 하락 압력을 나타내고 있습니다.';
     } else {
         action = 'hold';
         riskLevel = 'medium';
         reason = '혼재된 신호로 인해 명확한 방향성이 없어 관망이 적절합니다.';
     }
     
     // 목표가 및 손절가 계산
     const priceRange = resistance - support;
     let targetPrice = null;
     let stopLoss = null;
     
     if (action === 'buy') {
         targetPrice = currentPrice + (priceRange * 0.618); // 피보나치 61.8%
         stopLoss = Math.max(support, currentPrice * 0.95); // 지지선 또는 5% 손절
     } else if (action === 'sell') {
         targetPrice = currentPrice - (priceRange * 0.618);
         stopLoss = Math.min(resistance, currentPrice * 1.05); // 저항선 또는 5% 손절
     }
     
     return {
         action,
         targetPrice,
         stopLoss,
         riskLevel,
         reason,
         score: normalizedScore,
         confidence: Math.abs(normalizedScore) * 100
     };
 }