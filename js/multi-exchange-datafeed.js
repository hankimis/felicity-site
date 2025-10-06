// 🔥 Multi-Exchange Datafeed for TradingView (Binance + OKX + Bybit)
class MultiExchangeDatafeed {
    constructor() {
        this.exchanges = {
            binance: {
                name: 'Binance',
                // 선물(USDT-M) 엔드포인트로 전환: 가격/차트 모두 선물 기준 실시간 반영
                baseUrl: 'https://fapi.binance.com/fapi/v1',
                wsUrl: 'wss://fstream.binance.com/ws'
            },
            okx: {
                name: 'OKX',
                baseUrl: 'https://www.okx.com/api/v5',
                wsUrl: 'wss://ws.okx.com:8443/ws/v5/public'
            },
            bybit: {
                name: 'Bybit',
                baseUrl: 'https://api.bybit.com/v5',
                wsUrl: 'wss://stream.bybit.com/v5/public/spot'
            }
        };
        
        this.subscribers = new Map();
        this.websockets = new Map();
        this.symbolsCache = new Map();
        this.iconDataUriCache = new Map();
        this.reconnectAttempts = new Map();
        this.maxReconnectAttempts = 5;
        this.lastBars = new Map();
        
        // ✅ 심볼 정규화를 위한 기준 데이터
        this.quoteAssets = [
            'USDT','USD','USDC','BTC','ETH','BUSD','FDUSD','TUSD','TRY','BRL','EUR','KRW','DAI','PAX','USTC','BNB','IDR','BIDR','AUD','GBP','RUB','UAH','NGN','ZAR','ARS','COP','MXN','SAR','AED','JPY','CNY','SGD','HKD','PHP','VND','THB','MYR'
        ].sort((a,b)=>b.length-a.length); // 길이 우선 매칭

        this.knownNumericTickers = new Set(['1INCH','1CAT']);

        // ✅ 별칭/래퍼 해제 맵 (필요 시 지속 확장)
        this.aliasMap = {
            // ETH 계열 래퍼/스테이킹
            'BETH':'ETH','WBETH':'ETH','STETH':'ETH','RETH':'ETH','CBETH':'ETH','METH':'ETH','CMETH':'ETH','WETH':'ETH',
            // SOL 래퍼/파생
            'BNSOL':'SOL','BBSOL':'SOL','OKSOL':'SOL','JITOSOL':'SOL','MSOL':'SOL','BSOL':'SOL','WSOL':'SOL','BNSOL':'SOL',
            // BTC 래퍼
            'WBTC':'BTC',
            // 수량 접두 계열
            '1000PEPE':'PEPE','1000SATS':'SATS','1000RATS':'RATS','1000SHIB':'SHIB','1MBABYDOGE':'BABYDOGE',
            // 스테이블/브릿지 토큰 변형
            'AXLUSDC':'USDC','AUSDC':'USDC','USDT.E':'USDT','USDC.E':'USDC'
        };
        
        // 심볼 캐시 초기화
        this.initializeSymbolsCache();
        
        console.log('🔥 Multi-Exchange 데이터피드 초기화 (Binance + OKX + Bybit)');
    }

    // 🔥 심볼에서 베이스 심볼 추출 (e.g., BTCUSDT -> BTC)
    extractBaseSymbol(symbol) {
        if (!symbol) return '';
        let s = symbol.toUpperCase().trim();
        // 구분자 제거
        s = s.replace(/\s+/g,'').replace(/.*:/,'').replace(/[\-/_]/g,'');

        // 선물/파생 접미 제거
        s = s.replace(/(PERP|SWAP|\.P)$/,'');

        // quote 제거 (가장 긴 것부터)
        for (const q of this.quoteAssets) {
            if (s.endsWith(q) && s.length > q.length) {
                s = s.slice(0, -q.length);
                break;
            }
        }

        // 수량 접두 (1000, 10K, 1M 등) 처리 - 예외 화이트리스트 제외
        const m = s.match(/^(1000|10000|10K|1M)([A-Z0-9]+)$/);
        if (m && !this.knownNumericTickers.has(s)) {
            s = m[2];
        }

        // 별칭/래퍼 해제
        if (this.aliasMap[s]) {
            s = this.aliasMap[s];
        }

        return s.replace(/[-:/]/g, '');
    }

    // 🔥 거래소 로고 URL 생성
    getExchangeIcon(exchange) {
        const exchangeLogos = {
            'BINANCE': '/assets/logoicon/binance.webp',
            'OKX': '/assets/logoicon/okx.png',
            'BYBIT': '/assets/logoicon/bybit.png'  // 로컬 Bybit 로고
        };
        
        return exchangeLogos[exchange] || null;
    }

    // 🔥 심볼 아이콘 맵핑 (주요 코인들 - 안정적인 CDN 사용)
    getSymbolIconMapping() {
        return {
            'BTC': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/btc.png',
        };
    }

    // 🔥 고품질 코인 아이콘 가져오기 (프록시 단일 URL 사용)
    getHighQualityCoinIcon(symbol) {
        const iconMap = this.getSymbolIconMapping();
        const baseSymbol = this.extractBaseSymbol(symbol);

        // 1) 사전 매핑이 있으면 그대로 사용 (가장 안정적)
        if (iconMap[baseSymbol]) {
            return iconMap[baseSymbol];
        }

        // 2) 프록시 단일 엔드포인트 사용 (실패 시 프록시가 플레이스홀더 반환)
        const primary = this.aliasMap[baseSymbol] ? this.aliasMap[baseSymbol].toLowerCase() : baseSymbol.toLowerCase();
        return `/api/icon/${primary}`;
    }

    // 🔥 모든 가능한 아이콘 소스 반환 (참고용)
    getAllIconSources(symbol) {
        const baseSymbol = symbol.toUpperCase();
        return [
            `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/${baseSymbol.toLowerCase()}.png`,
            `https://cryptoicon-api.vercel.app/api/icon/${baseSymbol.toLowerCase()}`,
            `https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@master/32/color/${baseSymbol.toLowerCase()}.png`,
            `https://coinicons-api.vercel.app/${baseSymbol.toLowerCase()}.png`,
            this.getDefaultCoinIcon(baseSymbol)
        ];
    }

    // 🔥 기본 아이콘 생성 (SVG)
    getDefaultCoinIcon(symbol) {
        const firstLetter = symbol.charAt(0).toUpperCase();
        const svgIcon = `data:image/svg+xml;base64,${btoa(`
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="15" fill="#6366f1" stroke="#4f46e5" stroke-width="2"/>
                <text x="16" y="21" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">${firstLetter}</text>
            </svg>
        `)}`;
        
        return svgIcon;
    }

    // 🔥 원격 아이콘을 오버레이하는 합성 SVG 생성 (원격 실패 시에도 문자가 보임)
    buildCompositeSvgIcon(symbol, remoteUrl) {
        const firstLetter = symbol.charAt(0).toUpperCase();
        const svg = `
            <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <clipPath id="circleClip"><circle cx="16" cy="16" r="15"/></clipPath>
                </defs>
                <circle cx="16" cy="16" r="15" fill="#0f172a" stroke="#1f2937" stroke-width="2"/>
                <text x="16" y="21" text-anchor="middle" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="14" font-weight="bold">${firstLetter}</text>
                <image href="${remoteUrl}" x="0" y="0" width="32" height="32" preserveAspectRatio="xMidYMid slice" clip-path="url(#circleClip)"/>
            </svg>
        `;
        return `data:image/svg+xml;base64,${btoa(svg)}`;
    }

    // 🔥 여러 원격 이미지를 레이어드하는 SVG 생성 (먼저 로드되는 소스가 보임)
    buildMultiSourceIcon(symbol, urls) {
        const firstLetter = symbol.charAt(0).toUpperCase();
        const safeUrls = Array.from(new Set(urls)).slice(0, 12); // 과도한 길이 방지
        const images = safeUrls.map((u) => `<image href="${u}" x="0" y="0" width="32" height="32" preserveAspectRatio="xMidYMid slice" clip-path="url(#circleClip)"/>`).join('');
        const svg = `
            <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <clipPath id="circleClip"><circle cx="16" cy="16" r="15"/></clipPath>
                </defs>
                <circle cx="16" cy="16" r="15" fill="#0f172a" stroke="#1f2937" stroke-width="2"/>
                <text x="16" y="21" text-anchor="middle" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="14" font-weight="bold">${firstLetter}</text>
                ${images}
            </svg>
        `;
        return `data:image/svg+xml;base64,${btoa(svg)}`;
    }

    // 🔥 대안 심볼 이름 생성 (접두/접미/숫자 제거 등 일반 규칙)
    generateAlternativeSymbols(lowerSymbol) {
        const alts = new Set();
        const s = lowerSymbol;
        // 숫자 제거 버전
        alts.add(s.replace(/\d+/g, ''));
        // 공통 프리픽스 제거
        const prefixes = ['1000', '1m', 'cm', 'bn', 'bb', 'ok', 'w', 'st', 'r', 'cb', 'm', 'b', 'jito', 'a'];
        prefixes.forEach((p) => {
            if (s.startsWith(p) && s.length > p.length + 1) {
                alts.add(s.substring(p.length));
            }
        });
        // 공통 서픽스 제거
        const suffixes = ['coin', 'token', 'inu', 'doge', 'cat', 'dog'];
        suffixes.forEach((p) => {
            if (s.endsWith(p) && s.length > p.length + 1) {
                alts.add(s.substring(0, s.length - p.length));
            }
        });
        return Array.from(alts).filter(Boolean);
    }

    // 🔥 외부 요청 없이 생성되는 기본 PNG 아이콘 (원형 배경 + 첫 글자)
    getDefaultCoinIconPng(symbol) {
        try {
            const size = 32;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) return this.getDefaultCoinIcon(symbol);

            const palette = ['#6366F1', '#0EA5E9', '#22C55E', '#EAB308', '#F97316', '#EF4444', '#A855F7', '#14B8A6'];
            const strokePalette = ['#4F46E5', '#0284C7', '#16A34A', '#CA8A04', '#EA580C', '#DC2626', '#7C3AED', '#0D9488'];
            const idx = symbol.charCodeAt(0) % palette.length;
            const bg = palette[idx];
            const stroke = strokePalette[idx];

            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
            ctx.fillStyle = bg;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = stroke;
            ctx.stroke();

            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 16px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(symbol.charAt(0), size / 2, size / 2 + 1);

            return canvas.toDataURL('image/png');
        } catch (e) {
            return this.getDefaultCoinIcon(symbol);
        }
    }

    // 심볼 캐시 초기화 (병렬 로딩 + 백그라운드 로딩)
    async initializeSymbolsCache() {
        console.log('🔄 거래소 심볼 캐시 초기화 중... (병렬 로딩)');
        
        // 즉시 기본 심볼들로 시작
        this.setDefaultSymbols();
        
        try {
            // 병렬로 모든 거래소 심볼 로드
            const loadPromises = [
                this.loadBinanceSymbols(),
                this.loadOKXSymbols(),
                this.loadBybitSymbols()
            ];
            
            // 타임아웃과 함께 로드 (30초)
            await Promise.race([
                Promise.all(loadPromises),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('캐시 로딩 타임아웃')), 30000)
                )
            ]);
            
            console.log('✅ 모든 거래소 심볼 캐시 완료');
            this.logCacheStats();
        } catch (error) {
            console.error('❌ 심볼 캐시 초기화 실패:', error);
            console.log('⚠️ 기본 심볼로 계속 진행');
        }
    }

    // 기본 심볼들 미리 설정
    setDefaultSymbols() {
        // BTCUSDT만 미리 설정
        const defaultSymbols = {
            binance: this.createDefaultSymbolList('BINANCE'),
            okx: this.createDefaultSymbolList('OKX'), 
            bybit: this.createDefaultSymbolList('BYBIT')
        };
        
        Object.entries(defaultSymbols).forEach(([exchange, symbols]) => {
            this.symbolsCache.set(exchange, symbols);
        });
        
        console.log('✅ 기본 심볼 캐시 설정 완료');
    }

    // 기본 심볼 리스트 생성 (200개+ 코인)
    createDefaultSymbolList(exchange) {
        // BTCUSDT만 반환
        const coin = 'BTC';
            const symbol = `${coin}USDT`;
            const fullName = exchange === 'OKX' ? `${exchange}:${coin}-USDT` : `${exchange}:${symbol}`;
        return [{
                symbol,
                full_name: fullName,
                description: `${coin}/USDT`,
                exchange,
                type: 'crypto',
                baseAsset: coin,
                quoteAsset: 'USDT',
                logo_urls: [this.getHighQualityCoinIcon(coin)],
                exchange_logo: this.getExchangeIcon(exchange),
                provider_id: exchange.toLowerCase()
        }];
    }

    // 캐시 통계 로그
    logCacheStats() {
        let totalSymbols = 0;
        this.symbolsCache.forEach((symbols, exchange) => {
            console.log(`📊 ${exchange}: ${symbols.length}개 심볼`);
            totalSymbols += symbols.length;
        });
        console.log(`📊 총 ${totalSymbols}개 심볼 캐시됨`);
    }

    // Binance 심볼 로드
    async loadBinanceSymbols() {
        try {
            const response = await fetch(`${this.exchanges.binance.baseUrl}/exchangeInfo`);
            const data = await response.json();
            
                            const symbols = data.symbols
                .filter(symbol => symbol.status === 'TRADING')
                .map(symbol => ({
                    symbol: symbol.symbol,
                    full_name: `BINANCE:${symbol.symbol}`,
                    description: `${symbol.baseAsset}/${symbol.quoteAsset}`,
                    exchange: 'BINANCE',
                    type: 'crypto',
                    baseAsset: symbol.baseAsset,
                    quoteAsset: symbol.quoteAsset,
                    filters: symbol.filters,
                    // 🔥 아이콘 정보 추가
                    logo_urls: [this.getHighQualityCoinIcon(symbol.baseAsset)],
                    exchange_logo: this.getExchangeIcon('BINANCE'),
                    provider_id: 'binance'
                }));
            
            this.symbolsCache.set('binance', symbols);
            console.log(`✅ Binance 심볼 ${symbols.length}개 로드 완료`);

            // 백그라운드 임베딩 비활성화됨
        } catch (error) {
            console.error('❌ Binance 심볼 로드 실패:', error);
            this.symbolsCache.set('binance', []);
        }
    }

    // OKX 심볼 로드
    async loadOKXSymbols() {
        try {
            const response = await fetch(`${this.exchanges.okx.baseUrl}/public/instruments?instType=SPOT`);
            const data = await response.json();
            
            if (data.code === '0') {
                const symbols = data.data
                    .filter(instrument => instrument.state === 'live')
                    .map(instrument => ({
                        symbol: instrument.instId.replace('-', ''),
                        full_name: `OKX:${instrument.instId}`,
                        description: `${instrument.baseCcy}/${instrument.quoteCcy}`,
                        exchange: 'OKX',
                        type: 'crypto',
                        baseAsset: instrument.baseCcy,
                        quoteAsset: instrument.quoteCcy,
                        instId: instrument.instId,
                        tickSz: instrument.tickSz,
                        lotSz: instrument.lotSz,
                        // 🔥 아이콘 정보 추가
                        logo_urls: [this.getHighQualityCoinIcon(instrument.baseCcy)],
                        exchange_logo: this.getExchangeIcon('OKX'),
                        provider_id: 'okx'
                    }));
                
                this.symbolsCache.set('okx', symbols);
                console.log(`✅ OKX 심볼 ${symbols.length}개 로드 완료`);

                // 백그라운드 임베딩 비활성화됨
            }
        } catch (error) {
            console.error('❌ OKX 심볼 로드 실패:', error);
            this.symbolsCache.set('okx', []);
        }
    }

    // Bybit 심볼 로드
    async loadBybitSymbols() {
        try {
            const response = await fetch(`${this.exchanges.bybit.baseUrl}/market/instruments-info?category=spot`);
            const data = await response.json();
            
            if (data.retCode === 0) {
                const symbols = data.result.list
                    .filter(instrument => instrument.status === 'Trading')
                    .map(instrument => ({
                        symbol: instrument.symbol,
                        full_name: `BYBIT:${instrument.symbol}`,
                        description: `${instrument.baseCoin}/${instrument.quoteCoin}`,
                        exchange: 'BYBIT',
                        type: 'crypto',
                        baseAsset: instrument.baseCoin,
                        quoteAsset: instrument.quoteCoin,
                        priceFilter: instrument.priceFilter,
                        lotSizeFilter: instrument.lotSizeFilter,
                        // 🔥 아이콘 정보 추가
                        logo_urls: [this.getHighQualityCoinIcon(instrument.baseCoin)],
                        exchange_logo: this.getExchangeIcon('BYBIT'),
                        provider_id: 'bybit'
                    }));
                
                this.symbolsCache.set('bybit', symbols);
                console.log(`✅ Bybit 심볼 ${symbols.length}개 로드 완료`);

                // 백그라운드 임베딩 비활성화됨
            }
        } catch (error) {
            console.error('❌ Bybit 심볼 로드 실패:', error);
            this.symbolsCache.set('bybit', []);
        }
    }

    // 🔥 아이콘 URL 후보 생성 (현재 미사용)
    getIconUrlCandidatesFor(baseSymbolLower) {
        const urls = [
            `/api/icon/${baseSymbolLower}` // 프록시만 사용
        ];
        return urls;
    }

    // 🔥 원격 이미지를 data URI로 변환 (현재 비활성화)
    async fetchIconAsDataUri(baseSymbol) {
        // 백그라운드 임베딩 비활성화 - 프록시 사용으로 대체
        return this.getDefaultCoinIcon(baseSymbol);
    }

    // 🔥 백그라운드로 상위 심볼들의 아이콘을 data URI로 임베딩 (현재 비활성화)
    async embedIconsInBackground(exchangeKey) {
        // 백그라운드 임베딩 비활성화 - 프록시 사용으로 대체
        console.log(`🖼️ ${exchangeKey} 백그라운드 임베딩 비활성화됨 (프록시 사용)`);
    }

    // TradingView 데이터피드 구성 정보
    onReady(callback) {
        setTimeout(() => {
            callback({
                supports_search: true,
                supports_group_request: false,
                supported_resolutions: ['1', '3', '5', '15', '30', '60', '120', '240', '360', '480', '720', '1D', '3D', '1W', '1M'],
                supports_marks: false,
                supports_timescale_marks: false,
                supports_time: true,
                exchanges: [
                    { value: 'BINANCE', name: 'Binance', desc: 'Binance' },
                    { value: 'OKX', name: 'OKX', desc: 'OKX' },
                    { value: 'BYBIT', name: 'Bybit', desc: 'Bybit' }
                ],
                symbols_types: [
                    { name: 'crypto', value: 'crypto' }
                ]
            });
        }, 0);
    }

    // 심볼 검색 (모든 거래소)
    searchSymbols(userInput, exchange, symbolType, onResultReadyCallback) {
        console.log('🔍 멀티 거래소 심볼 검색(비트코인만 노출):', userInput, exchange);
        let btcOnly = [];
        this.symbolsCache.forEach((symbols) => {
            const filtered = (symbols || []).filter(s => s.baseAsset === 'BTC' && s.quoteAsset === 'USDT');
            btcOnly = btcOnly.concat(filtered);
        });
        if (btcOnly.length === 0) {
            btcOnly = ['BINANCE','OKX','BYBIT'].map(ex => this.createDefaultSymbolList(ex)[0]);
        }
        onResultReadyCallback(btcOnly);
    }

    // 심볼 정보 조회
    resolveSymbol(symbolName, onSymbolResolvedCallback, onResolveErrorCallback) {
        console.log('🔍 심볼 정보 조회:', symbolName);
        
        const [exchange, symbol] = symbolName.includes(':') ? 
            symbolName.split(':') : ['BINANCE', symbolName];
        
        switch (exchange.toUpperCase()) {
            case 'BINANCE':
                this.resolveBinanceSymbol(symbol, onSymbolResolvedCallback, onResolveErrorCallback);
                break;
            case 'OKX':
                this.resolveOKXSymbol(symbol, onSymbolResolvedCallback, onResolveErrorCallback);
                break;
            case 'BYBIT':
                this.resolveBybitSymbol(symbol, onSymbolResolvedCallback, onResolveErrorCallback);
                break;
            default:
                // 기본적으로 Binance에서 찾기
                this.resolveBinanceSymbol(symbolName, onSymbolResolvedCallback, onResolveErrorCallback);
                break;
        }
    }

    // Binance 심볼 정보 조회
    async resolveBinanceSymbol(symbol, onSymbolResolvedCallback, onResolveErrorCallback) {
        try {
            const response = await fetch(`${this.exchanges.binance.baseUrl}/exchangeInfo?symbol=${symbol}`);
            const data = await response.json();
            
            if (data.symbols && data.symbols.length > 0) {
                const symbolInfo = data.symbols[0];
                
                const symbolData = {
                    name: symbol,
                    full_name: `BINANCE:${symbol}`,
                    description: `${symbolInfo.baseAsset}/${symbolInfo.quoteAsset}`,
                    type: 'crypto',
                    session: '24x7',
                    exchange: 'BINANCE',
                    listed_exchange: 'BINANCE',
                    timezone: 'Asia/Seoul',
                    format: 'price',
                    pricescale: this.getBinancePriceScale(symbolInfo.filters),
                    minmov: 1,
                    has_intraday: true,
                    has_daily: true,
                    has_weekly_and_monthly: true,
                    supported_resolutions: ['1', '3', '5', '15', '30', '60', '120', '240', '360', '480', '720', '1D', '3D', '1W', '1M'],
                    volume_precision: 8,
                    data_status: 'streaming',
                    // 🔥 아이콘 정보 추가
                    logo_urls: [this.getHighQualityCoinIcon(symbolInfo.baseAsset)],
                    exchange_logo: this.getExchangeIcon('BINANCE'),
                    provider_id: 'binance'
                };
                
                onSymbolResolvedCallback(symbolData);
            } else {
                onResolveErrorCallback('Binance에서 심볼을 찾을 수 없습니다');
            }
        } catch (error) {
            console.error('Binance 심볼 정보 조회 오류:', error);
            onResolveErrorCallback('Binance 심볼 정보 조회 실패');
        }
    }

    // OKX 심볼 정보 조회
    async resolveOKXSymbol(instId, onSymbolResolvedCallback, onResolveErrorCallback) {
        try {
            // OKX는 instId 형태 (예: BTC-USDT)
            const formattedInstId = instId.includes('-') ? instId : this.formatOKXInstId(instId);
            
            const response = await fetch(`${this.exchanges.okx.baseUrl}/public/instruments?instType=SPOT&instId=${formattedInstId}`);
            const data = await response.json();
            
            if (data.code === '0' && data.data.length > 0) {
                const instrument = data.data[0];
                
                const symbolData = {
                    name: instId,
                    full_name: `OKX:${formattedInstId}`,
                    description: `${instrument.baseCcy}/${instrument.quoteCcy}`,
                    type: 'crypto',
                    session: '24x7',
                    exchange: 'OKX',
                    listed_exchange: 'OKX',
                    timezone: 'Asia/Seoul',
                    format: 'price',
                    pricescale: this.getOKXPriceScale(instrument.tickSz),
                    minmov: 1,
                    has_intraday: true,
                    has_daily: true,
                    has_weekly_and_monthly: true,
                    supported_resolutions: ['1', '3', '5', '15', '30', '60', '120', '240', '360', '480', '720', '1D', '3D', '1W', '1M'],
                    volume_precision: 8,
                    data_status: 'streaming',
                    // 🔥 아이콘 정보 추가
                    logo_urls: [this.getHighQualityCoinIcon(instrument.baseCcy)],
                    exchange_logo: this.getExchangeIcon('OKX'),
                    provider_id: 'okx'
                };
                
                onSymbolResolvedCallback(symbolData);
            } else {
                onResolveErrorCallback('OKX에서 심볼을 찾을 수 없습니다');
            }
        } catch (error) {
            console.error('OKX 심볼 정보 조회 오류:', error);
            onResolveErrorCallback('OKX 심볼 정보 조회 실패');
        }
    }

    // Bybit 심볼 정보 조회
    async resolveBybitSymbol(symbol, onSymbolResolvedCallback, onResolveErrorCallback) {
        try {
            const response = await fetch(`${this.exchanges.bybit.baseUrl}/market/instruments-info?category=spot&symbol=${symbol}`);
            const data = await response.json();
            
            if (data.retCode === 0 && data.result.list.length > 0) {
                const instrument = data.result.list[0];
                
                const symbolData = {
                    name: symbol,
                    full_name: `BYBIT:${symbol}`,
                    description: `${instrument.baseCoin}/${instrument.quoteCoin}`,
                    type: 'crypto',
                    session: '24x7',
                    exchange: 'BYBIT',
                    listed_exchange: 'BYBIT',
                    timezone: 'Asia/Seoul',
                    format: 'price',
                    pricescale: this.getBybitPriceScale(instrument.priceFilter.tickSize),
                    minmov: 1,
                    has_intraday: true,
                    has_daily: true,
                    has_weekly_and_monthly: true,
                    supported_resolutions: ['1', '3', '5', '15', '30', '60', '120', '240', '360', '480', '720', '1D', '3D', '1W', '1M'],
                    volume_precision: 8,
                    data_status: 'streaming',
                    // 🔥 아이콘 정보 추가
                    logo_urls: [this.getHighQualityCoinIcon(instrument.baseCoin)],
                    exchange_logo: this.getExchangeIcon('BYBIT'),
                    provider_id: 'bybit'
                };
                
                onSymbolResolvedCallback(symbolData);
            } else {
                onResolveErrorCallback('Bybit에서 심볼을 찾을 수 없습니다');
            }
        } catch (error) {
            console.error('Bybit 심볼 정보 조회 오류:', error);
            onResolveErrorCallback('Bybit 심볼 정보 조회 실패');
        }
    }

    // 가격 스케일 계산 함수들
    getBinancePriceScale(filters) {
        const priceFilter = filters.find(f => f.filterType === 'PRICE_FILTER');
        if (priceFilter && priceFilter.tickSize) {
            const tickSize = parseFloat(priceFilter.tickSize);
            return Math.round(1 / tickSize);
        }
        return 100;
    }

    getOKXPriceScale(tickSz) {
        const tickSize = parseFloat(tickSz);
        return Math.round(1 / tickSize);
    }

    getBybitPriceScale(tickSize) {
        const tick = parseFloat(tickSize);
        return Math.round(1 / tick);
    }

    // OKX InstId 포맷팅
    formatOKXInstId(symbol) {
        // BTCUSDT -> BTC-USDT 형태로 변환
        const commonQuotes = ['USDT', 'USDC', 'BTC', 'ETH', 'DAI'];
        for (const quote of commonQuotes) {
            if (symbol.endsWith(quote)) {
                const base = symbol.slice(0, -quote.length);
                return `${base}-${quote}`;
            }
        }
        return symbol;
    }

    // 히스토리 데이터 가져오기 (거래소별 라우팅)
    getBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) {
        const exchange = symbolInfo.exchange;
        
        switch (exchange) {
            case 'BINANCE':
                this.getBinanceBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback);
                break;
            case 'OKX':
                this.getOKXBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback);
                break;
            case 'BYBIT':
                this.getBybitBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback);
                break;
            default:
                onErrorCallback('지원하지 않는 거래소입니다');
                break;
        }
    }

    // Binance 히스토리 데이터
    async getBinanceBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) {
        const { from, to } = periodParams;
        const symbol = symbolInfo.name;
        const interval = this.convertBinanceResolution(resolution);
        
        try {
            const url = `${this.exchanges.binance.baseUrl}/klines?symbol=${symbol}&interval=${interval}&startTime=${from * 1000}&endTime=${to * 1000}&limit=1000`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (Array.isArray(data)) {
                const bars = data.map(kline => ({
                    time: parseInt(kline[0]), // ms (UTC)
                    open: parseFloat(kline[1]),
                    high: parseFloat(kline[2]),
                    low: parseFloat(kline[3]),
                    close: parseFloat(kline[4]),
                    volume: parseFloat(kline[5])
                }))
                .filter(b=> isFinite(b.time))
                .sort((a, b) => a.time - b.time)
                .reduce((acc, b)=>{ // 중복/역주행 제거
                    const last = acc[acc.length-1];
                    if (!last || b.time > last.time) acc.push(b);
                    return acc;
                }, []);
                
                onHistoryCallback(bars, { noData: bars.length === 0 });
            } else {
                onErrorCallback('Binance 데이터 형식 오류');
            }
        } catch (error) {
            console.error('Binance 히스토리 데이터 오류:', error);
            onErrorCallback('Binance 히스토리 데이터 로드 실패');
        }
    }

    // OKX 히스토리 데이터
    async getOKXBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) {
        const { from, to } = periodParams;
        const instId = symbolInfo.full_name.replace('OKX:', '');
        const bar = this.convertOKXResolution(resolution);
        
        try {
            const url = `${this.exchanges.okx.baseUrl}/market/history-candles?instId=${instId}&bar=${bar}&before=${to * 1000}&after=${from * 1000}&limit=100`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.code === '0' && Array.isArray(data.data)) {
                const bars = data.data.map(candle => ({
                    time: parseInt(candle[0]),
                    open: parseFloat(candle[1]),
                    high: parseFloat(candle[2]),
                    low: parseFloat(candle[3]),
                    close: parseFloat(candle[4]),
                    volume: parseFloat(candle[5])
                })).sort((a, b) => a.time - b.time);
                
                onHistoryCallback(bars, { noData: bars.length === 0 });
            } else {
                onErrorCallback('OKX 데이터 형식 오류');
            }
        } catch (error) {
            console.error('OKX 히스토리 데이터 오류:', error);
            onErrorCallback('OKX 히스토리 데이터 로드 실패');
        }
    }

    // Bybit 히스토리 데이터
    async getBybitBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) {
        const { from, to } = periodParams;
        const symbol = symbolInfo.name;
        const interval = this.convertBybitResolution(resolution);
        
        try {
            const url = `${this.exchanges.bybit.baseUrl}/market/kline?category=spot&symbol=${symbol}&interval=${interval}&start=${from * 1000}&end=${to * 1000}&limit=200`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.retCode === 0 && Array.isArray(data.result.list)) {
                const bars = data.result.list.map(kline => ({
                    time: parseInt(kline[0]),
                    open: parseFloat(kline[1]),
                    high: parseFloat(kline[2]),
                    low: parseFloat(kline[3]),
                    close: parseFloat(kline[4]),
                    volume: parseFloat(kline[5])
                })).sort((a, b) => a.time - b.time);
                
                onHistoryCallback(bars, { noData: bars.length === 0 });
            } else {
                onErrorCallback('Bybit 데이터 형식 오류');
            }
        } catch (error) {
            console.error('Bybit 히스토리 데이터 오류:', error);
            onErrorCallback('Bybit 히스토리 데이터 로드 실패');
        }
    }

    // 해상도 변환 함수들
    convertBinanceResolution(resolution) {
        const resolutionMap = {
            '1': '1m', '3': '3m', '5': '5m', '15': '15m', '30': '30m',
            '60': '1h', '120': '2h', '240': '4h', '360': '6h', '480': '8h', '720': '12h',
            '1D': '1d', '3D': '3d', '1W': '1w', '1M': '1M'
        };
        return resolutionMap[resolution] || '1h';
    }

    convertOKXResolution(resolution) {
        const resolutionMap = {
            '1': '1m', '3': '3m', '5': '5m', '15': '15m', '30': '30m',
            '60': '1H', '120': '2H', '240': '4H', '360': '6H', '480': '8H', '720': '12H',
            '1D': '1D', '3D': '3D', '1W': '1W', '1M': '1M'
        };
        return resolutionMap[resolution] || '1H';
    }

    convertBybitResolution(resolution) {
        const resolutionMap = {
            '1': '1', '3': '3', '5': '5', '15': '15', '30': '30',
            '60': '60', '120': '120', '240': '240', '360': '360', '480': '480', '720': '720',
            '1D': 'D', '3D': '3D', '1W': 'W', '1M': 'M'
        };
        return resolutionMap[resolution] || '60';
    }

    // 실시간 데이터 구독 (Binance만 구현, 다른 거래소는 기본적으로 Binance로 폴백)
    subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) {
        console.log('🔔 실시간 데이터 구독:', symbolInfo.full_name, resolution);
        
        // 현재는 Binance WebSocket만 구현, 다른 거래소는 폴링으로 대체 가능
        if (symbolInfo.exchange === 'BINANCE') {
            this.subscribeBinanceBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID);
        } else {
            console.log(`⚠️ ${symbolInfo.exchange} 실시간 구독은 현재 미지원`);
        }
    }

    // Binance 실시간 구독
    subscribeBinanceBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID) {
        const symbol = symbolInfo.name.toLowerCase();
        const interval = this.convertBinanceResolution(resolution);
        const channelString = `${symbol}@kline_${interval}`;
        const bookTickerChannel = `${symbol}@bookTicker`;
        
        this.subscribers.set(subscriberUID, {
            symbolInfo,
            resolution,
            onRealtimeCallback,
            channelString,
            bookTickerChannel,
            exchange: 'BINANCE'
        });
        
        this.connectBinanceWebSocket();
        this.subscribeToChannel('binance', channelString);
        this.subscribeToChannel('binance', bookTickerChannel);
    }

    // Binance WebSocket 연결
    connectBinanceWebSocket() {
        if (this.websockets.has('binance') && this.websockets.get('binance').readyState === WebSocket.OPEN) {
            return;
        }
        
        const ws = new WebSocket(this.exchanges.binance.wsUrl);
        this.websockets.set('binance', ws);
        
        ws.onopen = () => {
            console.log('✅ Binance WebSocket 연결 성공');
            this.reconnectAttempts.set('binance', 0);
            // 현재 구독 중인 모든 채널 재구독
            const channels = new Set();
            this.subscribers.forEach((sub) => {
                if (sub.exchange === 'BINANCE') {
                    if (sub.channelString) channels.add(sub.channelString);
                    if (sub.bookTickerChannel) channels.add(sub.bookTickerChannel);
                }
            });
            channels.forEach((ch) => this.subscribeToChannel('binance', ch));
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleBinanceMessage(data);
            } catch (error) {
                console.error('Binance WebSocket 메시지 파싱 오류:', error);
            }
        };
        
        ws.onclose = () => {
            console.log('🔌 Binance WebSocket 연결 종료');
            this.reconnectBinanceWebSocket();
        };
    }

    // Binance 메시지 처리
    handleBinanceMessage(data) {
        // kline 업데이트
        if (data.e === 'kline') {
            const kline = data.k;
            const channelString = `${kline.s.toLowerCase()}@kline_${kline.i}`;
            this.subscribers.forEach((subscriber, uid) => {
                if (subscriber.channelString === channelString && subscriber.exchange === 'BINANCE') {
                    // Binance kline.t: open time in ms (UTC)
                    const newTime = parseInt(kline.t);
                    const prev = subscriber.lastBar || this.lastBars.get(uid);
                    let bar;
                    if (prev && newTime < prev.time) {
                        // 시간 역행 데이터는 무시
                        return;
                    }
                    if (prev && newTime === prev.time) {
                        // 동일 버킷 업데이트: 고/저/종가 갱신
                        bar = {
                            time: prev.time,
                            open: prev.open,
                            high: Math.max(prev.high, parseFloat(kline.h)),
                            low: Math.min(prev.low, parseFloat(kline.l)),
                            close: parseFloat(kline.c),
                            volume: parseFloat(kline.v)
                        };
                    } else {
                        bar = {
                            time: newTime,
                            open: parseFloat(kline.o),
                            high: parseFloat(kline.h),
                            low: parseFloat(kline.l),
                            close: parseFloat(kline.c),
                            volume: parseFloat(kline.v)
                        };
                    }
                    subscriber.lastBar = bar;
                    this.lastBars.set(uid, bar);
                    subscriber.onRealtimeCallback(bar);
                }
            });
            return;
        }

        // bookTicker 업데이트 (최우선 호가 기반 초저지연 가격)
        if (data && data.s && data.b && data.a) {
            const symbol = String(data.s).toUpperCase();
            const bid = parseFloat(data.b);
            const ask = parseFloat(data.a);
            if (!isFinite(bid) || !isFinite(ask)) return;
            const mid = (bid + ask) / 2;
            // 서버 이벤트 시간을 우선 사용하여 시간 역행 방지
            const eventMs = (typeof data.E === 'number' && data.E>0) ? data.E : Date.now();
            this.subscribers.forEach((subscriber, uid) => {
                if (subscriber.exchange !== 'BINANCE') return;
                const subSymbol = subscriber.symbolInfo?.name?.toUpperCase();
                if (subSymbol !== symbol) return;
                const bucketMs = this.getResolutionMs(subscriber.resolution);
                const bucketStart = Math.floor(eventMs / bucketMs) * bucketMs;
                const prev = subscriber.lastBar || this.lastBars.get(uid);
                let bar;
                if (prev && prev.time === bucketStart) {
                    bar = {
                        time: prev.time,
                        open: prev.open,
                        high: Math.max(prev.high, mid),
                        low: Math.min(prev.low, mid),
                        close: mid,
                        volume: prev.volume || 0
                    };
                } else {
                    // 시간 역행 가드: 신규 버킷이 이전 바보다 과거면 무시
                    if (prev && bucketStart < prev.time) {
                        return;
                    }
                    const open = prev ? prev.close : mid;
                    bar = {
                        time: bucketStart,
                        open,
                        high: Math.max(open, mid),
                        low: Math.min(open, mid),
                        close: mid,
                        volume: 0
                    };
                }
                subscriber.lastBar = bar;
                this.lastBars.set(uid, bar);
                subscriber.onRealtimeCallback(bar);
            });
            return;
        }
    }

    getResolutionMs(resolution) {
        const res = String(resolution).toUpperCase();
        const num = parseInt(res, 10);
        if (!isNaN(num)) return num * 60 * 1000; // minutes
        if (res === '1D') return 24 * 60 * 60 * 1000;
        if (res === '3D') return 3 * 24 * 60 * 60 * 1000;
        if (res === '1W') return 7 * 24 * 60 * 60 * 1000;
        if (res === '1M') return 30 * 24 * 60 * 60 * 1000;
        return 60 * 60 * 1000; // default 1h
    }

    // 채널 구독
    subscribeToChannel(exchange, channelString) {
        const ws = this.websockets.get(exchange);
        if (ws && ws.readyState === WebSocket.OPEN) {
            const subscribeMsg = {
                method: 'SUBSCRIBE',
                params: [channelString],
                id: Date.now()
            };
            
            ws.send(JSON.stringify(subscribeMsg));
            console.log(`📡 ${exchange} 채널 구독:`, channelString);
        }
    }

    // 재연결
    reconnectBinanceWebSocket() {
        const attempts = this.reconnectAttempts.get('binance') || 0;
        if (attempts < this.maxReconnectAttempts) {
            this.reconnectAttempts.set('binance', attempts + 1);
            setTimeout(() => {
                this.connectBinanceWebSocket();
            }, 3000 * (attempts + 1));
        }
    }

    // 구독 해제
    unsubscribeBars(subscriberUID) {
        const subscriber = this.subscribers.get(subscriberUID);
        if (subscriber) {
            // 구독 해제 로직
            this.subscribers.delete(subscriberUID);
        }
    }

    // 서버 시간
    getServerTime(callback) {
        fetch(`${this.exchanges.binance.baseUrl}/time`)
            .then(response => response.json())
            .then(data => callback(Math.floor(data.serverTime / 1000)))
            .catch(() => callback(Math.floor(Date.now() / 1000)));
    }
}

// 전역으로 내보내기
window.MultiExchangeDatafeed = MultiExchangeDatafeed;