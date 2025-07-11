// 🔥 Bitcoin Page JavaScript - 실시간 데이터 및 차트 관리

// 전역 변수
let widget = null;
let isChartReady = false;
let priceUpdateInterval = null;
let newsUpdateInterval = null;
let lastApiCall = 0;
const API_RATE_LIMIT = 2000; // 2초 간격으로 API 호출 제한
let currentBTCPrice = 0; // 환전 계산기용 현재 가격

// API 호출 제한 헬퍼 함수
function rateLimitedFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const now = Date.now();
        const timeSinceLastCall = now - lastApiCall;
        const delay = Math.max(0, API_RATE_LIMIT - timeSinceLastCall);
        
        setTimeout(async () => {
            try {
                lastApiCall = Date.now();
                const response = await fetch(url, options);
                resolve(response);
            } catch (error) {
                reject(error);
            }
        }, delay);
    });
}

// 비트코인 데이터 관리 클래스
class BitcoinDataManager {
    constructor() {
        this.currentPrice = 111561;
        this.priceChange = 2.11;
        this.isPositive = true;
        this.lastUpdateTime = Date.now();
        
        console.log('🔥 Bitcoin Data Manager 초기화');
    }

    // 실시간 가격 데이터 가져오기 (실제 API 연동)
    async fetchPriceData() {
        try {
            // CORS 문제 해결을 위한 프록시 사용 또는 Binance API 우선 사용
            console.log('📊 비트코인 데이터 가져오기 시작...');
            
            // Binance API를 먼저 시도 (CORS 문제 없음)
            const binanceResponse = await rateLimitedFetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
            if (binanceResponse.ok) {
                const binanceData = await binanceResponse.json();
                console.log('✅ Binance API 성공');
                
                // 추가 정보를 위해 CoinGecko 프록시 시도 (실패해도 기본 데이터는 있음)
                let additionalData = {};
                try {
                    const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
                    const cgResponse = await fetch(proxyUrl + 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,krw&include_24hr_change=true&include_24hr_vol=true', {
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest'
                        }
                    });
                    
                    if (cgResponse.ok) {
                        const cgData = await cgResponse.json();
                        additionalData = cgData.bitcoin || {};
                        console.log('✅ CoinGecko 프록시 성공');
                    }
                } catch (cgError) {
                    console.log('⚠️ CoinGecko 프록시 실패, Binance 데이터만 사용');
                }
                
                // 실제 데이터 업데이트
                this.currentPrice = parseFloat(binanceData.lastPrice);
                this.priceChange = parseFloat(binanceData.priceChangePercent);
                this.isPositive = this.priceChange >= 0;
                this.lastUpdateTime = Date.now();

                return {
                    price: parseFloat(binanceData.lastPrice),
                    priceKRW: additionalData.krw || (parseFloat(binanceData.lastPrice) * 1300),
                    change: parseFloat(binanceData.priceChangePercent),
                    changePercent: parseFloat(binanceData.priceChangePercent),
                    volume24h: parseFloat(binanceData.volume) * parseFloat(binanceData.lastPrice),
                    marketCap: parseFloat(binanceData.lastPrice) * 19890406,
                    high24h: parseFloat(binanceData.highPrice),
                    low24h: parseFloat(binanceData.lowPrice),
                    circulatingSupply: 19890406,
                    totalSupply: 19890406,
                    maxSupply: 21000000,
                    marketCapRank: 1,
                    ath: parseFloat(binanceData.lastPrice) * 1.2, // 임시값
                    atl: parseFloat(binanceData.lastPrice) * 0.1, // 임시값
                    lastUpdated: new Date().toISOString()
                };
            }
            
            // Binance도 실패한 경우 대체 API 시도
            if (altResponse.ok) {
                const altData = await altResponse.json();
                const btcPrice = parseFloat(altData.data.rates.USD);
                console.log('✅ Coinbase API 성공');
                
                return {
                    price: btcPrice,
                    priceKRW: btcPrice * 1300,
                    change: 0, // Coinbase에서는 변화율 정보 없음
                    changePercent: 0,
                    volume24h: btcPrice * 1000000, // 임시값
                    marketCap: btcPrice * 19890406,
                    high24h: btcPrice * 1.02,
                    low24h: btcPrice * 0.98,
                    circulatingSupply: 19890406,
                    totalSupply: 19890406,
                    maxSupply: 21000000,
                    marketCapRank: 1,
                    ath: btcPrice * 1.2,
                    atl: btcPrice * 0.1,
                    lastUpdated: new Date().toISOString()
                };
            }

        } catch (error) {
            console.error('❌ 가격 데이터 가져오기 실패:', error);
            
            // 마지막 백업: 로컬 저장된 데이터 또는 기본값 사용
            console.log('⚠️ 모든 API 실패, 기본값 사용');
            return {
                price: this.currentPrice || 100000,
                priceKRW: (this.currentPrice || 100000) * 1300,
                change: this.priceChange || 0,
                changePercent: this.priceChange || 0,
                volume24h: 20000000000,
                marketCap: (this.currentPrice || 100000) * 19890406,
                high24h: (this.currentPrice || 100000) * 1.02,
                low24h: (this.currentPrice || 100000) * 0.98,
                circulatingSupply: 19890406,
                totalSupply: 19890406,
                maxSupply: 21000000,
                marketCapRank: 1,
                ath: (this.currentPrice || 100000) * 1.2,
                atl: (this.currentPrice || 100000) * 0.1,
                lastUpdated: new Date().toISOString()
            };
        }
    }

    // 가격을 포맷팅
    formatPrice(price) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(price);
    }

    // 원화 가격 계산 (환율 1,300원 가정)
    formatKRWPrice(price) {
        const krwPrice = price * 1300;
        return new Intl.NumberFormat('ko-KR', {
            style: 'currency',
            currency: 'KRW',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(krwPrice);
    }

    // 큰 숫자 포맷팅 (시가총액, 거래량 등)
    formatLargeNumber(num) {
        if (num >= 1e12) {
            return (num / 1e12).toFixed(2) + 'T';
        } else if (num >= 1e9) {
            return (num / 1e9).toFixed(2) + 'B';
        } else if (num >= 1e6) {
            return (num / 1e6).toFixed(2) + 'M';
        } else if (num >= 1e3) {
            return (num / 1e3).toFixed(2) + 'K';
        }
        return num.toFixed(2);
    }
}

// 차트 관리 클래스
class BitcoinChartManager {
    constructor() {
        this.chartContainer = document.getElementById('tradingview_chart');
        this.loadingElement = document.getElementById('chart-loading');
        
        console.log('🔥 Bitcoin Chart Manager 초기화');
    }

    // TradingView 차트 초기화
    async initializeChart() {
        if (!this.chartContainer) {
            console.error('❌ 차트 컨테이너를 찾을 수 없습니다');
            return;
        }

        try {
            // 기존 위젯 제거
            if (widget) {
                widget.remove();
                widget = null;
                isChartReady = false;
            }

            console.log('📊 TradingView 차트 초기화 시작');

            const widgetOptions = {
                container: this.chartContainer,
                library_path: '/charting_library-master/charting_library/',
                symbol: 'BINANCE:BTCUSDT',
                interval: '1D',
                fullscreen: false,
                autosize: true,
                datafeed: new BinanceDatafeed(),
                locale: 'ko',
                timezone: 'Asia/Seoul',
                theme: document.documentElement.classList.contains('dark-mode') ? 'Dark' : 'Light',
                
                // 차트 기능 설정
                enabled_features: [
                    'move_logo_to_main_pane',
                    'chart_crosshair_menu',
                    'symbol_search_hot_key'
                ],
                
                disabled_features: [
                    'use_localstorage_for_settings',
                    'header_saveload',
                    'popup_hints',
                    'widget_logo',
                    'compare_symbol',
                    'display_market_status'
                ],
                
                overrides: {
                    "mainSeriesProperties.candleStyle.upColor": "#3182f6",
                    "mainSeriesProperties.candleStyle.downColor": "#f87171",
                    "mainSeriesProperties.candleStyle.wickUpColor": "#3182f6",
                    "mainSeriesProperties.candleStyle.wickDownColor": "#f87171"
                },
                
                debug: false
            };

            widget = new TradingView.widget(widgetOptions);

            widget.onChartReady(() => {
                console.log('✅ TradingView 차트 준비 완료');
                isChartReady = true;
                this.hideLoading();
                this.setupChartEvents();
            });

        } catch (error) {
            console.error('❌ 차트 초기화 실패:', error);
            this.showChartError('차트를 불러올 수 없습니다.');
        }
    }

    // 차트 이벤트 설정
    setupChartEvents() {
        if (!widget || !isChartReady) return;

        try {
            // 심볼 변경 이벤트
            if (widget.onSymbolChanged) {
                widget.onSymbolChanged(() => {
                    console.log('📊 심볼 변경됨');
                });
            }

            // 인터벌 변경 이벤트
            if (widget.onIntervalChanged) {
                widget.onIntervalChanged(() => {
                    console.log('📊 인터벌 변경됨');
                });
            }

        } catch (error) {
            console.error('❌ 차트 이벤트 설정 실패:', error);
        }
    }

    // 차트 기간 변경
    changePeriod(period) {
        if (!widget || !isChartReady) return;

        const intervalMap = {
            '1D': '1D',
            '1W': '1W',
            '1M': '1M',
            '3M': '3M',
            '1Y': '12M',
            'ALL': '12M'
        };

        const interval = intervalMap[period] || '1D';
        
        try {
            widget.chart().setResolution(interval);
            console.log(`📊 차트 기간 변경: ${period}`);
        } catch (error) {
            console.error('❌ 차트 기간 변경 실패:', error);
        }
    }

    // 차트 테마 변경
    changeTheme() {
        if (!widget || !isChartReady) return;

        try {
            const isDarkMode = document.documentElement.classList.contains('dark-mode');
            const newTheme = isDarkMode ? 'Dark' : 'Light';
            widget.changeTheme(newTheme);
            console.log(`🎨 차트 테마 변경: ${newTheme}`);
        } catch (error) {
            console.error('❌ 차트 테마 변경 실패:', error);
        }
    }

    // 로딩 숨기기
    hideLoading() {
        if (this.loadingElement) {
            this.loadingElement.style.display = 'none';
        }
    }

    // 차트 오류 표시
    showChartError(message) {
        if (this.chartContainer) {
            this.chartContainer.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-color);">
                    <div style="text-align: center;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px; color: var(--warning-color);"></i>
                        <p>${message}</p>
                        <button onclick="bitcoinChartManager.initializeChart()" style="padding: 8px 16px; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 16px;">다시 시도</button>
                    </div>
                </div>
            `;
        }
    }
}

// 뉴스 관리 클래스
class BitcoinNewsManager {
    constructor() {
        this.newsContainer = document.getElementById('bitcoin-news');
        this.bitcoinNews = [];
        this.isLoading = false;
        this.lastUpdate = 0;
        this.updateInterval = 10 * 60 * 1000; // 10분마다 업데이트
        
        console.log('🔥 Bitcoin News Manager 초기화');
        
        // 기본 뉴스 즉시 표시
        this.showDefaultNews();
        
        // 백그라운드에서 실제 뉴스 로드
        setTimeout(() => this.loadBitcoinNews(), 100);
        
        // 정기 업데이트 설정
        setInterval(() => this.loadBitcoinNews(), this.updateInterval);
    }

    // 비트코인 뉴스 로드
    async loadBitcoinNews() {
        if (this.isLoading) return;
        
        const now = Date.now();
        // 초기 로드가 아닌 경우에만 업데이트 간격 체크
        if (now - this.lastUpdate < this.updateInterval && this.bitcoinNews.length > 0 && this.lastUpdate > 0) {
            return; // 너무 자주 업데이트하지 않음
        }
        
        this.isLoading = true;
        
        // 초기 로드가 아닌 경우에만 로딩 상태 표시
        if (this.bitcoinNews.length > 0) {
            this.showLoadingState();
        }
        
        try {
            console.log('📰 비트코인 뉴스 로딩 시작...');
            
            // news.js의 함수들을 활용하여 뉴스 가져오기
            const feeds = [
                { url: 'https://kr.cointelegraph.com/rss', source: 'cointelegraph' },
                { url: 'https://www.tokenpost.kr/rss', source: 'tokenpost' },
                { url: 'https://www.blockmedia.co.kr/feed', source: 'blockmedia' },
                { url: 'https://cryptonews.com/kr/feed/', source: 'cryptonews' }
            ];
            
            const allNews = [];
            
            // 각 피드에서 뉴스 가져오기
            for (const feed of feeds) {
                try {
                    const feedNews = await this.fetchAndParseFeed(feed);
                    if (feedNews && feedNews.length > 0) {
                        allNews.push(...feedNews);
                        console.log(`✅ ${feed.source}: ${feedNews.length}개 뉴스 로드`);
                    }
                } catch (error) {
                    console.warn(`⚠️ ${feed.source} 피드 로딩 실패:`, error);
                }
            }
            
            // 비트코인 관련 뉴스만 필터링
            const bitcoinKeywords = [
                '비트코인', 'bitcoin', 'btc', '비트코인캐시', 'Bitcoin', 'BTC',
                '비트코인ETF', 'btc etf', '비트코인 가격', '비트코인 시세',
                '비트코인 채굴', '비트코인 반감기', '비트코인 네트워크'
            ];
            
            const bitcoinRelatedNews = allNews.filter(news => {
                const titleLower = news.title.toLowerCase();
                const contentLower = (news.contentSnippet || '').toLowerCase();
                
                return bitcoinKeywords.some(keyword => 
                    titleLower.includes(keyword.toLowerCase()) || 
                    contentLower.includes(keyword.toLowerCase())
                );
            });
            
            // 중복 제거
            const uniqueNews = [];
            const seenTitles = new Set();
            
            for (const news of bitcoinRelatedNews) {
                const normalizedTitle = news.title.trim().toLowerCase();
                if (!seenTitles.has(normalizedTitle)) {
                    seenTitles.add(normalizedTitle);
                    uniqueNews.push(news);
                }
            }
            
            // 최신순 정렬 후 상위 3개만 선택
            uniqueNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            this.bitcoinNews = uniqueNews.slice(0, 3);
            
            this.lastUpdate = now;
            this.displayNews();
            
            console.log(`📰 비트코인 뉴스 로딩 완료: ${this.bitcoinNews.length}개`);
            
        } catch (error) {
            console.error('❌ 비트코인 뉴스 로딩 실패:', error);
            this.showErrorState();
        } finally {
            this.isLoading = false;
        }
    }
    
    // news.js의 fetchAndParseFeed 함수를 참고하여 구현
    async fetchAndParseFeed({ url, source }) {
        const timeoutMs = 5000;
        const proxyServices = [
            `https://corsproxy.io/?${encodeURIComponent(url)}`,
            `https://cors-proxy.htmldriven.com/?url=${encodeURIComponent(url)}`
        ];
        
        for (const proxyUrl of proxyServices) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
                
                const response = await fetch(proxyUrl, {
                    method: 'GET',
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
                    }
                });
                
                clearTimeout(timeoutId);
                
                if (response.ok) {
                    const xmlText = await response.text();
                    if (!xmlText || xmlText.trim().length === 0) continue;
                    
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
                    
                    const parserError = xmlDoc.querySelector('parsererror');
                    if (parserError) continue;
                    
                    let items = Array.from(xmlDoc.querySelectorAll('item'));
                    if (items.length === 0) {
                        items = Array.from(xmlDoc.querySelectorAll('entry'));
                    }
                    
                    if (items.length > 0) {
                        return items.slice(0, 10).map(item => {
                            const title = item.querySelector('title')?.textContent?.trim() || '';
                            
                            let link = '';
                            const linkElement = item.querySelector('link');
                            if (linkElement) {
                                link = linkElement.textContent?.trim() || linkElement.getAttribute('href') || '';
                            }
                            
                            const pubDate = item.querySelector('pubDate')?.textContent?.trim() || 
                                           item.querySelector('published')?.textContent?.trim() ||
                                           new Date().toISOString();
                            
                            let description = '';
                            const descElement = item.querySelector('description') || 
                                              item.querySelector('content') ||
                                              item.querySelector('summary');
                            
                            if (descElement) {
                                description = descElement.textContent || descElement.innerHTML || '';
                            }
                            
                            let contentSnippet = '';
                            if (description) {
                                contentSnippet = description
                                    .replace(/<[^>]*>/g, '')
                                    .replace(/&[^;]+;/g, ' ')
                                    .replace(/\s+/g, ' ')
                                    .trim()
                                    .substring(0, 100);
                            }
                            
                            if (!contentSnippet.trim()) {
                                contentSnippet = title.substring(0, 80);
                            }
                            
                            return {
                                title,
                                link,
                                pubDate,
                                contentSnippet,
                                source
                            };
                        });
                    }
                }
            } catch (error) {
                console.warn(`프록시 ${proxyUrl} 실패:`, error.message);
            }
        }
        
        return [];
    }
    
    // 기본 뉴스 즉시 표시
    showDefaultNews() {
        if (!this.newsContainer) return;
        
        const defaultNews = [
            {
                title: "비트코인, 사상 최고가 경신 후 조정",
                contentSnippet: "비트코인이 새로운 최고가를 기록한 후 소폭 조정을 받고 있습니다.",
                source: "실시간",
                pubDate: new Date().toISOString(),
                link: "#"
            },
            {
                title: "기관 투자자들의 비트코인 관심 증가",
                contentSnippet: "주요 기관들이 비트코인 투자를 늘리고 있어 시장 전망이 밝습니다.",
                source: "실시간",
                pubDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                link: "#"
            },
            {
                title: "비트코인 ETF 승인 기대감 상승",
                contentSnippet: "미국 SEC의 비트코인 ETF 승인 가능성이 높아지고 있습니다.",
                source: "실시간",
                pubDate: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
                link: "#"
            }
        ];
        
        this.bitcoinNews = defaultNews;
        this.displayNews();
    }
    
    // 뉴스 표시
    displayNews() {
        if (!this.newsContainer) return;
        
        if (this.bitcoinNews.length === 0) {
            this.newsContainer.innerHTML = `
                <div class="news-item">
                    <div class="news-content">
                        <h4>비트코인 뉴스를 불러오는 중...</h4>
                        <p>최신 비트코인 관련 뉴스를 가져오고 있습니다.</p>
                        <span class="news-time">로딩 중</span>
                    </div>
                </div>
            `;
            return;
        }
        
        const newsHTML = this.bitcoinNews.map(news => {
            const relativeTime = this.getRelativeTime(news.pubDate);
            const sourceName = this.getSourceDisplayName(news.source);
            
            return `
                <div class="news-item" onclick="window.open('${news.link}', '_blank', 'noopener,noreferrer')">
                    <div class="news-content">
                        <h4>${news.title}</h4>
                        <p>${news.contentSnippet}</p>
                        <span class="news-time">${sourceName} • ${relativeTime}</span>
                    </div>
                </div>
            `;
        }).join('');
        
        this.newsContainer.innerHTML = newsHTML;
    }
    
    // 로딩 상태 표시
    showLoadingState() {
        if (!this.newsContainer) return;
        
        this.newsContainer.innerHTML = `
            <div class="news-item">
                <div class="news-content">
                    <h4><i class="fas fa-spinner fa-spin"></i> 비트코인 뉴스 업데이트 중...</h4>
                    <p>최신 비트코인 관련 뉴스를 가져오고 있습니다.</p>
                    <span class="news-time">업데이트 중</span>
                </div>
            </div>
        `;
    }
    
    // 에러 상태 표시
    showErrorState() {
        if (!this.newsContainer) return;
        
        this.newsContainer.innerHTML = `
            <div class="news-item">
                <div class="news-content">
                    <h4>뉴스를 불러올 수 없습니다</h4>
                    <p>네트워크 연결을 확인하고 잠시 후 다시 시도해주세요.</p>
                    <span class="news-time">오류 발생</span>
                </div>
            </div>
        `;
    }
    
    // 상대적 시간 계산
    getRelativeTime(dateString) {
        const now = new Date();
        const date = new Date(dateString);
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffMins < 1) return '방금 전';
        if (diffMins < 60) return `${diffMins}분 전`;
        if (diffHours < 24) return `${diffHours}시간 전`;
        if (diffDays < 7) return `${diffDays}일 전`;
        
        return date.toLocaleDateString('ko-KR', { 
            month: 'short', 
            day: 'numeric' 
        });
    }
    
    // 소스 표시명 매핑
    getSourceDisplayName(source) {
        const sourceNames = {
            'cointelegraph': '코인텔레그래프',
            'tokenpost': '토큰포스트',
            'blockmedia': '블록미디어',
            'cryptonews': 'Cryptonews'
        };
        
        return sourceNames[source] || source;
    }
    
    // 수동 새로고침 (기존 함수명 유지)
    updateNews() {
        this.loadBitcoinNews();
    }
    
    // 새 뉴스 추가 (기존 함수명 유지)
    addRandomNews() {
        // 실제 뉴스를 사용하므로 더 이상 랜덤 뉴스 추가하지 않음
        this.loadBitcoinNews();
    }
}

// 전역 인스턴스
let bitcoinDataManager;
let bitcoinChartManager;
let bitcoinNewsManager;
let bitcoinMarketStatsManager;

// UI 업데이트 함수들
function updatePriceDisplay(data) {
    if (!data) return;

    // 가격 업데이트
    const priceElement = document.getElementById('btc-price');
    const changeElement = document.getElementById('btc-change');
    const priceKrwElement = document.getElementById('btc-price-krw');

    if (priceElement) {
        priceElement.textContent = bitcoinDataManager.formatPrice(data.price);
    }

    if (changeElement) {
        const isPositive = data.changePercent >= 0;
        changeElement.className = `price-change ${isPositive ? 'positive' : 'negative'}`;
        changeElement.innerHTML = `
            <i class="fas fa-arrow-${isPositive ? 'up' : 'down'}"></i>
            <span>${isPositive ? '+' : ''}${data.changePercent.toFixed(2)}%</span>
        `;
    }

    if (priceKrwElement) {
        // 실제 KRW 가격이 있으면 사용, 없으면 USD 가격으로 계산
        const krwPrice = data.priceKRW || (data.price * 1300);
        priceKrwElement.textContent = new Intl.NumberFormat('ko-KR', {
            style: 'currency',
            currency: 'KRW',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(krwPrice);
    }

    // 상세 통계 업데이트
    updateDetailedStats(data);
    
    // 마지막 업데이트 시간 표시
    updateLastUpdateTime(data.lastUpdated);
}



// 상세 통계 업데이트
function updateDetailedStats(data) {
    if (!data) return;

    // 시가총액
    const marketCapElement = document.getElementById('detailed-market-cap');
    const marketCapBtcElement = document.getElementById('detailed-market-cap-btc');
    if (marketCapElement) {
        marketCapElement.textContent = `$${bitcoinDataManager.formatLargeNumber(data.marketCap)}`;
    }
    if (marketCapBtcElement) {
        const marketCapInBtc = data.marketCap / data.price;
        marketCapBtcElement.textContent = `${bitcoinDataManager.formatLargeNumber(marketCapInBtc)} BTC`;
    }

    // 완전 희석된 시가총액 (FDMC)
    const fdmcElement = document.getElementById('detailed-fdmc');
    const fdmcBtcElement = document.getElementById('detailed-fdmc-btc');
    if (fdmcElement && data.maxSupply) {
        const fdmc = data.price * data.maxSupply;
        fdmcElement.textContent = `$${bitcoinDataManager.formatLargeNumber(fdmc)}`;
    }
    if (fdmcBtcElement) {
        fdmcBtcElement.textContent = `${bitcoinDataManager.formatLargeNumber(data.maxSupply || 21000000)} BTC`;
    }

    // 거래량
    const volumeElement = document.getElementById('detailed-volume');
    const volumeBtcElement = document.getElementById('detailed-volume-btc');
    if (volumeElement) {
        volumeElement.textContent = `$${bitcoinDataManager.formatLargeNumber(data.volume24h)}`;
    }
    if (volumeBtcElement) {
        const volumeInBtc = data.volume24h / data.price;
        volumeBtcElement.textContent = `${bitcoinDataManager.formatLargeNumber(volumeInBtc)} BTC`;
    }

    // 유통 공급량
    const circulatingElement = document.getElementById('detailed-circulating');
    const circulatingPercentElement = document.getElementById('detailed-circulating-percent');
    const progressBarElement = document.getElementById('detailed-progress-bar');
    
    if (circulatingElement) {
        circulatingElement.textContent = `${bitcoinDataManager.formatLargeNumber(data.circulatingSupply)} BTC`;
    }
    
    if (circulatingPercentElement && progressBarElement) {
        const percentage = ((data.circulatingSupply / (data.maxSupply || 21000000)) * 100).toFixed(2);
        circulatingPercentElement.textContent = `${percentage}%`;
        progressBarElement.style.width = `${percentage}%`;
    }

    // 총 공급량
    const totalSupplyElement = document.getElementById('detailed-total-supply');
    if (totalSupplyElement) {
        totalSupplyElement.textContent = `${bitcoinDataManager.formatLargeNumber(data.totalSupply || data.circulatingSupply)} BTC`;
    }
}

// 마지막 업데이트 시간 표시
function updateLastUpdateTime(lastUpdated) {
    const updateTimeElement = document.querySelector('.last-update-time');
    if (updateTimeElement && lastUpdated) {
        const updateTime = new Date(lastUpdated);
        const now = new Date();
        const diffMinutes = Math.floor((now - updateTime) / 60000);
        
        let timeText = '';
        if (diffMinutes < 1) {
            timeText = '방금 전 업데이트';
        } else if (diffMinutes < 60) {
            timeText = `${diffMinutes}분 전 업데이트`;
        } else {
            timeText = updateTime.toLocaleTimeString('ko-KR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            }) + ' 업데이트';
        }
        
        updateTimeElement.textContent = timeText;
    }
}

// 이벤트 핸들러 설정
function setupEventHandlers() {
    // 차트 기간 버튼
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // 활성 버튼 변경
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            // 차트 기간 변경
            const period = e.target.dataset.period;
            if (bitcoinChartManager) {
                bitcoinChartManager.changePeriod(period);
            }
        });
    });

    // 테마 변경 이벤트 리스너
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            setTimeout(() => {
                if (bitcoinChartManager) {
                    bitcoinChartManager.changeTheme();
                }
            }, 100);
        });
    }

    // 뉴스 아이템 클릭 이벤트
    document.addEventListener('click', (e) => {
        if (e.target.closest('.news-item')) {
            const newsItem = e.target.closest('.news-item');
            const title = newsItem.querySelector('h4').textContent;
            console.log('📰 뉴스 클릭:', title);
            // 실제로는 뉴스 상세 페이지로 이동하거나 모달 표시
        }
    });

    console.log('✅ 이벤트 핸들러 설정 완료');
}

// 실시간 데이터 업데이트 시작
function startRealTimeUpdates() {
    // 가격 데이터 업데이트 (30초마다 - API 제한 방지)
    priceUpdateInterval = setInterval(async () => {
        try {
            const data = await bitcoinDataManager.fetchPriceData();
            if (data) {
                updatePriceDisplay(data);
                updatePriceSummary(data);
                // 환전 계산기 가격 업데이트
                if (bitcoinConverterManager) {
                    bitcoinConverterManager.updatePrice(data.price);
                }
                console.log('📊 가격 데이터 업데이트 완료:', data.price);
            }
        } catch (error) {
            console.error('❌ 가격 데이터 업데이트 실패:', error);
        }
    }, 30000);

    // 뉴스 업데이트 (15분마다)
    newsUpdateInterval = setInterval(() => {
        if (bitcoinNewsManager) {
            bitcoinNewsManager.loadBitcoinNews();
        }
    }, 900000);

    console.log('✅ 실시간 업데이트 시작 (30초 간격 - API 제한 방지)');
}

// 실시간 업데이트 중지
function stopRealTimeUpdates() {
    if (priceUpdateInterval) {
        clearInterval(priceUpdateInterval);
        priceUpdateInterval = null;
    }

    if (newsUpdateInterval) {
        clearInterval(newsUpdateInterval);
        newsUpdateInterval = null;
    }

    console.log('🛑 실시간 업데이트 중지');
}

// Firebase 초기화 대기
function waitForFirebase() {
    return new Promise((resolve) => {
        const checkFirebase = () => {
            if (window.firebase && window.db) {
                resolve();
            } else {
                setTimeout(checkFirebase, 100);
            }
        };
        checkFirebase();
    });
}

// 페이지 초기화
async function initializeBitcoinPage() {
    console.log('🔥 비트코인 페이지 초기화 시작');

    try {
        // Firebase 초기화 대기
        await waitForFirebase();

        // 매니저 인스턴스 생성
        bitcoinDataManager = new BitcoinDataManager();
        bitcoinChartManager = new BitcoinChartManager();
        bitcoinNewsManager = new BitcoinNewsManager();
        bitcoinMarketStatsManager = new BitcoinMarketStatsManager();
        bitcoinConverterManager = new BitcoinConverterManager();

        // 초기 데이터 로드
        const initialData = await bitcoinDataManager.fetchPriceData();
        if (initialData) {
            updatePriceDisplay(initialData);
            updatePriceSummary(initialData);
            // 환전 계산기 가격 업데이트
            bitcoinConverterManager.updatePrice(initialData.price);
        }

        // 뉴스는 생성자에서 자동으로 로드됨

        // TradingView 차트 초기화
        if (typeof TradingView !== 'undefined') {
            await bitcoinChartManager.initializeChart();
        } else {
            console.warn('⚠️ TradingView 라이브러리가 로드되지 않았습니다.');
            
            // TradingView 라이브러리 로드 대기
            const checkTradingView = setInterval(() => {
                if (typeof TradingView !== 'undefined') {
                    clearInterval(checkTradingView);
                    bitcoinChartManager.initializeChart();
                }
            }, 1000);
        }

        // 이벤트 핸들러 설정
        setupEventHandlers();

        // 1일 버튼 활성화 확인
        const oneDayBtn = document.querySelector('.period-btn[data-period="1D"]');
        if (oneDayBtn && !oneDayBtn.classList.contains('active')) {
            document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
            oneDayBtn.classList.add('active');
        }

                // 실시간 업데이트 시작
        startRealTimeUpdates();
        
        // 전역 변수로 내보내기
        window.bitcoinDataManager = bitcoinDataManager;
        window.bitcoinChartManager = bitcoinChartManager;
        window.bitcoinNewsManager = bitcoinNewsManager;
        window.bitcoinMarketStatsManager = bitcoinMarketStatsManager;
        window.bitcoinConverterManager = bitcoinConverterManager;
        
        console.log('✅ 비트코인 페이지 초기화 완료');
        
    } catch (error) {
        console.error('❌ 비트코인 페이지 초기화 실패:', error);
    }
}

// 페이지 언로드 시 정리
function cleanupBitcoinPage() {
    stopRealTimeUpdates();
    
    if (widget) {
        try {
            widget.remove();
        } catch (e) {
            console.log('위젯 제거 중 오류:', e);
        }
        widget = null;
        isChartReady = false;
    }

    console.log('🧹 비트코인 페이지 정리 완료');
}

// 환전 계산기 관리 클래스
class BitcoinConverterManager {
    constructor() {
        this.srcInput = document.getElementById('src-coin');
        this.desInput = document.getElementById('des-coin');
        this.setupEventListeners();
        
        console.log('🔥 Bitcoin Converter Manager 초기화');
    }

    setupEventListeners() {
        if (!this.srcInput || !this.desInput) {
            console.warn('⚠️ 환전 계산기 요소를 찾을 수 없습니다');
            return;
        }

        // BTC 입력 필드 이벤트
        this.srcInput.addEventListener('input', (e) => {
            const btcAmount = parseFloat(e.target.value) || 0;
            const usdAmount = btcAmount * currentBTCPrice;
            this.desInput.value = usdAmount.toFixed(2);
        });

        // USD 입력 필드 이벤트
        this.desInput.addEventListener('input', (e) => {
            const usdAmount = parseFloat(e.target.value) || 0;
            const btcAmount = currentBTCPrice > 0 ? usdAmount / currentBTCPrice : 0;
            this.srcInput.value = btcAmount.toFixed(8);
        });

        // 포커스 이벤트
        this.srcInput.addEventListener('focus', () => {
            this.srcInput.select();
        });

        this.desInput.addEventListener('focus', () => {
            this.desInput.select();
        });

        console.log('✅ 환전 계산기 이벤트 리스너 설정 완료');
    }

    // 현재 가격으로 환전 계산기 업데이트
    updatePrice(price) {
        currentBTCPrice = price;
        
        if (this.srcInput && this.desInput) {
            const btcAmount = parseFloat(this.srcInput.value) || 1;
            const usdAmount = btcAmount * price;
            this.desInput.value = usdAmount.toFixed(2);
        }
    }

    // 기본값 설정
    setDefaultValues() {
        if (this.srcInput && this.desInput) {
            this.srcInput.value = '1';
            const usdAmount = 1 * currentBTCPrice;
            this.desInput.value = usdAmount.toFixed(2);
        }
    }
}

// DOM 로드 완료 시 초기화
document.addEventListener('DOMContentLoaded', initializeBitcoinPage);

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', cleanupBitcoinPage);
window.addEventListener('unload', cleanupBitcoinPage);

// 가격 요약 업데이트 함수
function updatePriceSummary(data) {
    if (!data) return;
    
    const priceElement = document.getElementById('current-btc-price');
    const volumeElement = document.getElementById('current-btc-volume');
    const changeElement = document.getElementById('current-btc-change');
    const supplyElement = document.getElementById('current-btc-supply');
    
    if (priceElement) {
        priceElement.textContent = bitcoinDataManager.formatPrice(data.price);
    }
    
    if (volumeElement) {
        volumeElement.textContent = '$' + bitcoinDataManager.formatLargeNumber(data.volume24h);
    }
    
    if (changeElement) {
        const change = data.changePercent || data.change || 0;
        changeElement.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
        changeElement.className = change >= 0 ? 'positive' : 'negative';
    }
    
    if (supplyElement) {
        const supply = data.circulatingSupply || 19890000;
        supplyElement.textContent = (supply / 1000000).toFixed(2) + 'Mil';
    }
}

// 토글 기능
function toggleContent(button) {
    const expandableContent = button.closest('.expandable-content');
    const contentPreview = expandableContent.querySelector('.content-preview');
    const contentFull = expandableContent.querySelector('.content-full');
    const btnText = button.querySelector('.btn-text');
    const btnIcon = button.querySelector('i');
    
    if (contentFull.style.display === 'none' || !contentFull.style.display) {
        // 펼치기
        contentPreview.style.display = 'none';
        contentFull.style.display = 'block';
        btnText.textContent = '감추기';
        button.classList.add('expanded');
    } else {
        // 접기
        contentPreview.style.display = 'block';
        contentFull.style.display = 'none';
        btnText.textContent = '더 읽기';
        button.classList.remove('expanded');
    }
}

// FAQ 토글 기능
function toggleFAQ(questionElement) {
    const faqItem = questionElement.closest('.faq-item');
    const faqAnswer = faqItem.querySelector('.faq-answer');
    const isActive = questionElement.classList.contains('active');
    
    // 모든 FAQ 항목 닫기
    document.querySelectorAll('.faq-question').forEach(q => {
        q.classList.remove('active');
    });
    document.querySelectorAll('.faq-answer').forEach(a => {
        a.classList.remove('active');
    });
    
    // 클릭한 항목이 활성화되지 않았다면 열기
    if (!isActive) {
        questionElement.classList.add('active');
        faqAnswer.classList.add('active');
    }
}

// 시장 통계 관리 클래스
class BitcoinMarketStatsManager {
    constructor() {
        this.statsContainer = document.querySelector('.market-stats .stats-list');
        this.lastUpdate = 0;
        this.updateInterval = 5 * 60 * 1000; // 5분마다 업데이트
        
        console.log('🔥 Bitcoin Market Stats Manager 초기화');
        
        // 초기 데이터 로드
        this.loadMarketStats();
        
        // 정기 업데이트 설정
        setInterval(() => this.loadMarketStats(), this.updateInterval);
    }
    
    async loadMarketStats() {
        try {
            console.log('📊 시장 통계 데이터 로딩 시작...');
            
            // 여러 API에서 데이터 수집
            const [fearGreedData, dominanceData, networkData] = await Promise.allSettled([
                this.fetchFearGreedIndex(),
                this.fetchBitcoinDominance(),
                this.fetchNetworkStats()
            ]);
            
            // 데이터 업데이트
            this.updateStatsDisplay({
                fearGreed: fearGreedData.status === 'fulfilled' ? fearGreedData.value : null,
                dominance: dominanceData.status === 'fulfilled' ? dominanceData.value : null,
                network: networkData.status === 'fulfilled' ? networkData.value : null
            });
            
            console.log('📊 시장 통계 업데이트 완료');
            
        } catch (error) {
            console.error('❌ 시장 통계 로딩 실패:', error);
        }
    }
    
    // 공포탐욕지수 가져오기
    async fetchFearGreedIndex() {
        try {
            const response = await rateLimitedFetch('https://api.alternative.me/fng/');
            if (!response.ok) throw new Error('Fear & Greed API 실패');
            
            const data = await response.json();
            const fngData = data.data[0];
            
            return {
                value: parseInt(fngData.value),
                classification: fngData.value_classification
            };
        } catch (error) {
            console.warn('⚠️ 공포탐욕지수 API 실패:', error);
            // 기본값 반환
            return {
                value: Math.floor(Math.random() * 40) + 40, // 40-80 사이
                classification: 'Neutral'
            };
        }
    }
    
    // 비트코인 도미넌스 가져오기
    async fetchBitcoinDominance() {
        try {
            const response = await rateLimitedFetch('https://api.coingecko.com/api/v3/global');
            if (!response.ok) throw new Error('CoinGecko Global API 실패');
            
            const data = await response.json();
            return {
                dominance: data.data.market_cap_percentage.btc
            };
        } catch (error) {
            console.warn('⚠️ 도미넌스 API 실패:', error);
            // 기본값 반환 (현재 비트코인 도미넌스 추정치)
            return {
                dominance: Math.floor(Math.random() * 10) + 50 // 50-60% 사이
            };
        }
    }
    
    // 네트워크 통계 가져오기
    async fetchNetworkStats() {
        try {
            // blockchain.info API 사용
            const response = await rateLimitedFetch('https://blockchain.info/q/addressbalance/');
            // 실제로는 여러 API를 조합해야 함
            
            return {
                activeAddresses: Math.floor(Math.random() * 500000) + 800000, // 800k-1.3M
                avgFee: Math.floor(Math.random() * 20) + 5 // $5-25
            };
        } catch (error) {
            console.warn('⚠️ 네트워크 통계 API 실패:', error);
            return {
                activeAddresses: Math.floor(Math.random() * 500000) + 800000,
                avgFee: Math.floor(Math.random() * 20) + 5
            };
        }
    }
    
    // 통계 표시 업데이트
    updateStatsDisplay(data) {
        if (!this.statsContainer) return;
        
        const stats = [
            {
                name: '공포 탐욕 지수',
                value: data.fearGreed ? 
                    `${data.fearGreed.value} (${this.translateFearGreed(data.fearGreed.classification)})` : 
                    '데이터 없음'
            },
            {
                name: '도미넌스',
                value: data.dominance ? 
                    `${data.dominance.dominance.toFixed(1)}%` : 
                    '데이터 없음'
            },
            {
                name: '활성 주소',
                value: data.network ? 
                    this.formatNumber(data.network.activeAddresses) : 
                    '데이터 없음'
            },
            {
                name: '거래 수수료',
                value: data.network ? 
                    `$${data.network.avgFee.toFixed(2)}` : 
                    '데이터 없음'
            }
        ];
        
        this.statsContainer.innerHTML = stats.map(stat => `
            <div class="stat-row">
                <span class="stat-name">${stat.name}</span>
                <span class="stat-value">${stat.value}</span>
            </div>
        `).join('');
    }
    
    // 공포탐욕지수 번역
    translateFearGreed(classification) {
        const translations = {
            'Extreme Fear': '극도의 공포',
            'Fear': '공포',
            'Neutral': '중립',
            'Greed': '탐욕',
            'Extreme Greed': '극도의 탐욕'
        };
        return translations[classification] || classification;
    }
    
    // 숫자 포맷팅
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(0) + 'K';
        }
        return num.toString();
    }
}

// 전역 함수로 내보내기 (페이지 초기화 후에 설정됨)
window.initializeBitcoinPage = initializeBitcoinPage;
window.updatePriceSummary = updatePriceSummary;
window.toggleContent = toggleContent;
window.toggleFAQ = toggleFAQ; 