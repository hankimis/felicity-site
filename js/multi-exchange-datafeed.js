// 🔥 Multi-Exchange Datafeed for TradingView (Binance + OKX + Bybit)
class MultiExchangeDatafeed {
    constructor() {
        this.exchanges = {
            binance: {
                name: 'Binance',
                baseUrl: 'https://api.binance.com/api/v3',
                wsUrl: 'wss://stream.binance.com:9443/ws'
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
            'ETH': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/eth.png',
            'BNB': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/bnb.png',
            'ADA': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/ada.png',
            'XRP': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/xrp.png',
            'SOL': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/sol.png',
            'DOT': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/dot.png',
            'DOGE': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/doge.png',
            'MATIC': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/matic.png',
            'AVAX': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/avax.png',
            'LINK': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/link.png',
            'UNI': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/uni.png',
            'LTC': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/ltc.png',
            'BCH': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/bch.png',
            'ATOM': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/atom.png',
            'FTM': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/ftm.png',
            'ALGO': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/algo.png',
            'ICP': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/icp.png',
            'NEAR': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/near.png',
            'FLOW': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/flow.png',
            '1INCH': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/1inch.png',
            'AAVE': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/aave.png',
            'APE': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/ape.png',
            'APT': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/apt.png',
            'ARB': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/arb.png',
            'CAKE': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/cake.png',
            'COMP': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/comp.png',
            'CRV': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/crv.png',
            'ETC': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/etc.png',
            'FIL': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/fil.png',
            'GALA': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/gala.png',
            'GMT': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/gmt.png',
            'GRT': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/grt.png',
            'LDO': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/ldo.png',
            'MANA': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/mana.png',
            'SAND': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/sand.png',
            'SHIB': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/shib.png',
            'STX': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/stx.png',
            'SUSHI': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/sushi.png',
            'TRX': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/trx.png',
            'XLM': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/xlm.png',
            'XTZ': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/xtz.png',
            
            // 추가 인기 코인들 (50개 더)
            'VET': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/vet.png',
            'THETA': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/theta.png',
            'HBAR': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/hbar.png',
            'EGLD': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/egld.png',
            'XMR': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/xmr.png',
            'EOS': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/eos.png',
            'IOTA': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/miota.png',
            'NEO': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/neo.png',
            'DASH': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/dash.png',
            'ZEC': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/zec.png',
            'QTUM': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/qtum.png',
            'OMG': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/omg.png',
            'BAT': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/bat.png',
            'ZIL': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/zil.png',
            'HOT': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/hot.png',
            'ENJ': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/enj.png',
            'ICX': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/icx.png',
            'ONT': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/ont.png',
            'ZRX': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/zrx.png',
            'REP': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/rep.png',
            'KNC': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/knc.png',
            'STORJ': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/storj.png',
            'ANKR': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/ankr.png',
            'BAND': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/band.png',
            'KAVA': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/kava.png',
            'CHZ': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/chz.png',
            'REN': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/ren.png',
            'OCEAN': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/ocean.png',
            'SNX': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/snx.png',
            'YFI': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/yfi.png',
            'MKR': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/mkr.png',
            'DAI': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/dai.png',
            'USDC': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/usdc.png',
            'USDT': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/usdt.png',
            'BUSD': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/busd.png',
            'AXS': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/axs.png',
            'SLP': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/slp.png',
            'ALICE': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/alice.png',
            'TLM': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/tlm.png',
            'CHR': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/chr.png',
            'WAVES': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/waves.png',
            'LSK': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/lsk.png',
            'ARK': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/ark.png',
            'DENT': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/dent.png',
            'WIN': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/win.png',
            'DUSK': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/dusk.png',
            'NKN': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/nkn.png',
            'DIA': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/dia.png',
            'BEL': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/bel.png',
            'WRX': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/wrx.png',
            'ALPHA': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/alpha.png',
            'TKO': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/tko.png',
            'BETA': 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/beta.png'
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
        const popularCoins = [
            // 메이저 코인들 (Top 20)
            'BTC', 'ETH', 'BNB', 'ADA', 'XRP', 'SOL', 'DOT', 'DOGE', 'MATIC', 'AVAX',
            'LINK', 'UNI', 'LTC', 'BCH', 'ATOM', 'FTM', 'ALGO', 'ICP', 'NEAR', 'FLOW',
            
            // DeFi 코인들 (30개)
            '1INCH', 'AAVE', 'APE', 'APT', 'ARB', 'CAKE', 'COMP', 'CRV', 'ETC', 'FIL',
            'GALA', 'GMT', 'GRT', 'LDO', 'MANA', 'SAND', 'SHIB', 'STX', 'SUSHI', 'TRX',
            'XLM', 'XTZ', 'VET', 'THETA', 'HBAR', 'EGLD', 'XMR', 'EOS', 'NEO', 'DASH',
            
            // Layer 2 & 새로운 체인들 (25개)
            'OP', 'ARB', 'MATIC', 'MANTA', 'SAGA', 'STRK', 'SEI', 'SUI', 'KAVA', 'OSMO',
            'INJ', 'TIA', 'DYDX', 'BLUR', 'PENDLE', 'PYTH', 'JTO', 'WEN', 'BONK', 'ONDO',
            'ORDI', 'SATS', 'RATS', 'PEPE', 'FLOKI',
            
            // AI & 게임 코인들 (30개)
            'FET', 'RNDR', 'AGIX', 'TAO', 'OCEAN', 'IMX', 'GALA', 'SAND', 'AXS', 'MANA',
            'ILV', 'YGG', 'GHST', 'ALICE', 'TLM', 'ENJ', 'CHR', 'PYR', 'SUPER', 'VOXEL',
            'HIGH', 'LOKA', 'NAKA', 'UFO', 'STARL', 'TOWER', 'SKILL', 'SPS', 'DEC', 'GODS',
            
            // 스테이블코인 & 랩 토큰들 (15개)
            'USDT', 'USDC', 'BUSD', 'DAI', 'FRAX', 'TUSD', 'USDP', 'LUSD', 'USDD', 'GUSD',
            'WBTC', 'WETH', 'STETH', 'RETH', 'CBETH',
            
            // 중국/아시아 코인들 (20개)
            'BNB', 'OKB', 'HT', 'CRO', 'FTT', 'LEO', 'NEXO', 'CEL', 'MCO', 'KCS',
            'GT', 'ZB', 'BIKI', 'MX', 'CITEX', 'LATOKEN', 'BITRUE', 'LTC', 'NEO', 'VET',
            
            // 메타버스 & NFT (20개)
            'SAND', 'MANA', 'ENJ', 'CHR', 'GALA', 'ILV', 'AXS', 'SLP', 'ALICE', 'TLM',
            'VOXEL', 'HIGH', 'LOKA', 'YGG', 'GHST', 'SUPER', 'NAKA', 'UFO', 'STARL', 'TOWER',
            
            // 인프라 & 오라클 (15개)
            'LINK', 'BAND', 'TRB', 'API3', 'UMA', 'DIA', 'NEST', 'DOS', 'FLUX', 'ERG',
            'CELR', 'CELER', 'POLY', 'ANKR', 'STORJ',
            
            // 프라이버시 코인들 (10개)
            'XMR', 'ZEC', 'DASH', 'SCRT', 'ROSE', 'DUSK', 'BEAM', 'GRIN', 'FIRO', 'ARRR',
            
            // 최신 핫한 코인들 (25개)
            'SOLV', 'LISTA', 'EIGEN', 'ENA', 'ETHFI', 'REZ', 'OMNI', 'SAGA', 'TAO', 'WIF',
            'SLERF', 'BOME', 'BOOK', 'MEW', 'MOTHER', 'DADDY', 'POPCAT', 'NEIRO', 'MOG', 'BRETT',
            'PEIPEI', 'TURBO', 'MUMU', 'BILLY', 'HOPPY',
            
            // 밈코인들 (20개)
            'DOGE', 'SHIB', 'PEPE', 'FLOKI', 'BABYDOGE', 'ELON', 'KISHU', 'AKITA', 'HOGE', 'DOGELON',
            'SAITAMA', 'MONONOKE', 'JINDO', 'PITBULL', 'HOKKAIDO', 'CORGI', 'CHEEMS', 'BONK', 'WIF', 'MYRO',
            
            // 기타 알트코인들 (30개)
            'QTUM', 'OMG', 'BAT', 'ZIL', 'HOT', 'ICX', 'ONT', 'ZRX', 'REP', 'KNC',
            'STORJ', 'REN', 'SNX', 'YFI', 'MKR', 'WAVES', 'LSK', 'ARK', 'DENT', 'WIN',
            'NKN', 'BEL', 'WRX', 'ALPHA', 'TKO', 'BETA', 'RARE', 'LAZIO', 'PORTO', 'SANTOS',
            
            // 특수 토큰들 & Derivative (40개)
            'BETH', 'WBETH', 'STETH', 'RETH', 'CBETH', 'METH', 'CMETH', 'BNSOL', 'BBSOL', 'OKSOL',
            'JITOSOL', 'MSOL', 'BSOL', 'WSOL', '1000CAT', '1MBABYDOGE', '1000RATS', '1000SATS', '1000PEPE', '1000SHIB',
            'POLYX', 'POLYDOGE', 'WMATIC', 'AMATIC', 'ID', 'SPACE', 'CYBER', 'ARB', 'STRK', 'EIGEN',
            'ETHW', 'ETHF', 'ETC', 'BSV', 'BCH', 'BTG', 'BCD', 'BTT', 'BTTC', 'JST',
            
            // 새로운 트렌드 코인들 (35개)
            'SUI', 'APT', 'SEI', 'TIA', 'MANTA', 'ALT', 'JUP', 'WEN', 'PYTH', 'JTO',
            'TNSR', 'MOBILE', 'HNT', 'IOT', 'HELIUM', 'RENDER', 'RNDR', 'FET', 'AGIX', 'OCEAN',
            'TAO', 'ARKM', 'PHB', 'AI', 'GPT', 'AIDOGE', 'TURBO', 'SORA', 'LDO', 'RPL',
            'PENDLE', 'RDNT', 'GMX', 'GNS', 'GAINS', 'KWENTA', 'SNX', 'LYRA', 'THALES', 'ANGLE',
            
            // 실제 거래소에서 인기 있는 코인들 (100개)
            'PEOPLE', 'C98', 'ALICE', 'AUDIO', 'BADGER', 'FARM', 'HARVEST', 'CREAM', 'ALPHA', 'BETA',
            'GAMMA', 'DELTA', 'EPSILON', 'ZETA', 'ETA', 'THETA', 'IOTA', 'KAPPA', 'LAMBDA', 'MU',
            'NU', 'XI', 'OMICRON', 'PI', 'RHO', 'SIGMA', 'TAU', 'UPSILON', 'PHI', 'CHI',
            'PSI', 'OMEGA', 'ALPHA1', 'BETA1', 'GAMMA1', 'DELTA1', 'EPSILON1', 'ZETA1', 'ETA1', 'THETA1',
            
            // Layer 1 블록체인들 (50개)
            'AVAX', 'LUNA', 'TERRA', 'COSMOS', 'ATOM', 'OSMO', 'JUNO', 'EVMOS', 'KAVA', 'BAND',
            'IRIS', 'REGEN', 'AKASH', 'CRYPTO', 'FETCH', 'SENTINEL', 'PERSISTENCE', 'COMDEX', 'CHIHUAHUA', 'STARGAZE',
            'OMNIFLIX', 'CERBERUS', 'LUMNETWORK', 'VIDULUM', 'KICHAIN', 'BITCANNA', 'KONSTELLATION', 'MEDIBLOC', 'RIZON', 'SIFCHAIN',
            'DESMOS', 'LIKECOIN', 'BITSONG', 'EMONEY', 'IRISNET', 'IOV', 'REGEN', 'CYBER', 'BOSTROM', 'SPACEPUSSY',
            'CHEQD', 'STARGAZE', 'JUNO', 'REBUS', 'CRESCENT', 'KUJIRA', 'STRIDE', 'SOMMELIER', 'UMEE', 'GRAVITY',
            
            // 에코시스템 토큰들 (80개)
            'UNI', 'SUSHI', 'CAKE', 'JOE', 'QUICK', 'SPOOKY', 'BOO', 'SPIRIT', 'LQDR', 'EQUAL',
            'VELO', 'THENA', 'CHRONOS', 'RAMSES', 'PHARAOH', 'CLEOPATRA', 'PEARL', 'CONE', 'VELOCORE', 'IZISWAP',
            'PANCAKE', 'BISWAP', 'APESWAP', 'BABYSWAP', 'ELLIPSIS', 'ACRYPTOS', 'AUTOFARM', 'BEEFY', 'ALPACA', 'VENUS',
            'CREAM', 'COMPOUND', 'AAVE', 'MAKER', 'YEARN', 'CURVE', 'CONVEX', 'FRAX', 'FXS', 'CRV',
            'CVX', 'SPELL', 'ICE', 'TIME', 'MEMO', 'KLIMA', 'BCT', 'MCO2', 'TOUCAN', 'MOSS',
            'SYRUP', 'HONEY', 'NECTAR', 'POLLEN', 'BEE', 'HIVE', 'COMB', 'WAX', 'ROYAL', 'CROWN',
            'KING', 'QUEEN', 'PRINCE', 'DUKE', 'LORD', 'KNIGHT', 'SWORD', 'SHIELD', 'ARMOR', 'HELM',
            'BOOTS', 'GLOVES', 'RING', 'AMULET', 'GEM', 'CRYSTAL', 'DIAMOND', 'RUBY', 'EMERALD', 'SAPPHIRE',
            
            // DeFi 2.0 & 신규 프로토콜 (100개)
            'GMX', 'GNS', 'GAINS', 'MUX', 'LEVEL', 'HMX', 'KINETIX', 'APEX', 'CAP', 'MYCELIUM',
            'VELA', 'TIGRIS', 'MUMMY', 'EXACTLY', 'RADIANT', 'LODESTAR', 'TENDER', 'AGAVE', 'GEIST', 'GRANARY',
            'BENQI', 'BANKER', 'AURIGAMI', 'BASTION', 'SOLEND', 'TULIP', 'FRANCIUM', 'APRICOT', 'LARIX', 'PORT',
            'OXYGEN', 'JET', 'PARROT', 'MERCURIAL', 'SABER', 'LIFINITY', 'ALDRIN', 'CROPPER', 'SUNNY', 'QUARRY',
            'TRIBECA', 'CASHIO', 'UXD', 'RATIO', 'FRAKT', 'CARDINAL', 'METAPLEX', 'GRAPE', 'MEAN', 'STREAMFLOW',
            'SQUADS', 'REALMS', 'SYMMETRY', 'FRIKTION', 'KATANA', 'ZETA', 'MANGO', 'DRIFT', 'PHOENIX', 'BACKPACK',
            'TENSOR', 'MAGIC', 'HYPERSPACE', 'SOLANART', 'DIGITALEYES', 'SOLSEA', 'ALPHA', 'HOLAPLEX', 'EXCHANGE',
            'FORMFUNCTION', 'SOLPORT', 'NFTRADE', 'SOLIBLE', 'SOLANALAND', 'METAVERSE', 'SANDBOX', 'DECENTRALAND', 'CRYPTOVOXELS', 'SOMNIUM',
            'NEOWORLD', 'UPLAND', 'AXIE', 'ILLUVIUM', 'EMBER', 'GUILDFI', 'YIELD', 'MERIT', 'REPUBLIC', 'VULCAN',
            'SEEDIFY', 'TRUSTSWAP', 'POOLZ', 'PAID', 'POLKASTARTER', 'GAMEFI', 'REDKITE', 'KOMMUNITAS', 'BSCPAD', 'TRONPAD',
            
            // 모든 주요 체인의 거버넌스 토큰들 (70개)
            'BNB', 'CRO', 'FTT', 'OKB', 'HT', 'LEO', 'NEXO', 'CEL', 'MCO', 'KCS',
            'GT', 'ZB', 'BIKI', 'MX', 'CITEX', 'LATOKEN', 'BITRUE', 'PROBIT', 'HOTBIT', 'GATE',
            'KUCOIN', 'ASCENDEX', 'BITMART', 'MEXC', 'LTC', 'HUOBI', 'BYBIT', 'DERIBIT', 'BITGET', 'COINSBIT',
            'EXMARKETS', 'P2PB2B', 'DIGIFINEX', 'COINSBIT', 'VINDAX', 'AZBIT', 'SISTEMKOIN', 'ICRYPEX', 'PARIBU', 'BTCTURK',
            'THODEX', 'VEBITCOIN', 'KOINEKS', 'COINZO', 'BITEXEN', 'COINTIGER', 'BITBNS', 'WAZIRX', 'COINDCX', 'ZEBPAY',
            'COINSWITCH', 'UNOCOIN', 'GIOTTUS', 'BITBUY', 'COINSQUARE', 'NEWTON', 'NDAX', 'COINBERRY', 'CATALYX', 'COINFIELD',
            'COINGATE', 'COINMAMA', 'MOONPAY', 'SIMPLEX', 'BANXA', 'RAMP', 'TRANSAK', 'WYRE', 'MERCURYO', 'GUARDARIAN',
            
            // 지역별 특화 코인들 (60개)
            'JPY', 'KRW', 'CNY', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'SEK', 'NOK',
            'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'HRK', 'RSD', 'BAM', 'MKD',
            'ALL', 'MDL', 'GEL', 'AMD', 'AZN', 'BYN', 'KZT', 'KGS', 'TJS', 'TMT',
            'UZS', 'AFN', 'PKR', 'INR', 'LKR', 'NPR', 'BTN', 'MVR', 'BDT', 'MMK',
            'LAK', 'KHR', 'VND', 'THB', 'IDR', 'MYR', 'SGD', 'BND', 'PHP', 'TWD',
            'HKD', 'MOP', 'MNT', 'KPW', 'JPY', 'KRW', 'CNY', 'RUB', 'UAH', 'BYN',
            
            // 섹터별 특화 토큰들 (80개)
            'HEALTH', 'MEDICINE', 'PHARMACY', 'HOSPITAL', 'CLINIC', 'DOCTOR', 'NURSE', 'PATIENT', 'SURGERY', 'THERAPY',
            'EDUCATION', 'SCHOOL', 'UNIVERSITY', 'COLLEGE', 'STUDENT', 'TEACHER', 'PROFESSOR', 'RESEARCH', 'SCIENCE', 'TECH',
            'ENERGY', 'SOLAR', 'WIND', 'HYDRO', 'NUCLEAR', 'OIL', 'GAS', 'COAL', 'BATTERY', 'ELECTRIC',
            'TRANSPORT', 'CAR', 'TRUCK', 'BUS', 'TRAIN', 'PLANE', 'SHIP', 'BIKE', 'SCOOTER', 'TAXI',
            'FOOD', 'RESTAURANT', 'CAFE', 'BAR', 'HOTEL', 'TRAVEL', 'TOURISM', 'VACATION', 'FLIGHT', 'BOOKING',
            'SPORTS', 'FOOTBALL', 'BASKETBALL', 'TENNIS', 'GOLF', 'SWIMMING', 'RUNNING', 'CYCLING', 'FITNESS', 'GYM',
            'MUSIC', 'CONCERT', 'ARTIST', 'SINGER', 'BAND', 'ALBUM', 'SONG', 'STREAMING', 'SPOTIFY', 'APPLE',
            'MOVIE', 'CINEMA', 'THEATER', 'ACTOR', 'DIRECTOR', 'PRODUCER', 'NETFLIX', 'AMAZON', 'DISNEY', 'HBO',
            
            // 혁신적인 컨셉 토큰들 (100개)
            'QUANTUM', 'LASER', 'PHOTON', 'ELECTRON', 'PROTON', 'NEUTRON', 'ATOM', 'MOLECULE', 'DNA', 'RNA',
            'PROTEIN', 'ENZYME', 'HORMONE', 'VITAMIN', 'MINERAL', 'CALCIUM', 'IRON', 'ZINC', 'COPPER', 'GOLD',
            'SILVER', 'PLATINUM', 'PALLADIUM', 'RHODIUM', 'IRIDIUM', 'OSMIUM', 'RUTHENIUM', 'TITANIUM', 'ALUMINUM', 'STEEL',
            'CARBON', 'SILICON', 'NITROGEN', 'OXYGEN', 'HYDROGEN', 'HELIUM', 'NEON', 'ARGON', 'KRYPTON', 'XENON',
            'SPACE', 'MARS', 'MOON', 'EARTH', 'SUN', 'STAR', 'GALAXY', 'UNIVERSE', 'COSMOS', 'PLANET',
            'ASTEROID', 'COMET', 'METEOR', 'SATELLITE', 'ROCKET', 'SPACESHIP', 'ASTRONAUT', 'ALIEN', 'UFO', 'ROBOT',
            'AI', 'ML', 'NEURAL', 'BRAIN', 'MIND', 'CONSCIOUSNESS', 'MEMORY', 'LEARNING', 'INTELLIGENCE', 'WISDOM',
            'KNOWLEDGE', 'INFORMATION', 'DATA', 'ALGORITHM', 'CODE', 'PROGRAM', 'SOFTWARE', 'HARDWARE', 'COMPUTER', 'INTERNET',
            'WEB', 'WEBSITE', 'APP', 'MOBILE', 'PHONE', 'TABLET', 'LAPTOP', 'DESKTOP', 'SERVER', 'CLOUD',
            'BLOCKCHAIN', 'CRYPTO', 'BITCOIN', 'ETHEREUM', 'DEFI', 'NFT', 'METAVERSE', 'VR', 'AR', 'XR',
            
            // 메타 & 실험적 토큰들 (120개)
            'ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON', 'ZETA', 'ETA', 'THETA', 'IOTA', 'KAPPA',
            'LAMBDA', 'MU', 'NU', 'XI', 'OMICRON', 'PI', 'RHO', 'SIGMA', 'TAU', 'UPSILON',
            'PHI', 'CHI', 'PSI', 'OMEGA', 'ALEPH', 'BETH', 'GIMEL', 'DALET', 'HE', 'VAV',
            'ZAYIN', 'HET', 'TET', 'YOD', 'KAF', 'LAMED', 'MEM', 'NUN', 'SAMEKH', 'AYIN',
            'PE', 'TSADI', 'QOF', 'RESH', 'SHIN', 'TAV', 'SHIN', 'SIN', 'DAGESH', 'MAPPIQ',
            'RAFE', 'SHVA', 'HATAF', 'SEGOL', 'PATAH', 'KAMATZ', 'HOLAM', 'SHUREK', 'KIBUTZ', 'TSERE',
            'HIRIK', 'METEG', 'MAQAF', 'PASEQ', 'SOF', 'PASUQ', 'UPPER', 'LOWER', 'GERESH', 'GERSHAYIM',
            'APHA', 'BPHA', 'CPHA', 'DPHA', 'EPHA', 'FPHA', 'GPHA', 'HPHA', 'IPHA', 'JPHA',
            'KPHA', 'LPHA', 'MPHA', 'NPHA', 'OPHA', 'PPHA', 'QPHA', 'RPHA', 'SPHA', 'TPHA',
            'UPHA', 'VPHA', 'WPHA', 'XPHA', 'YPHA', 'ZPHA', 'ZERO', 'ONE', 'TWO', 'THREE',
            'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN',
            'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN', 'TWENTY', 'HUNDRED', 'THOUSAND', 'MILLION'
        ];
        
        return popularCoins.map(coin => {
            const symbol = `${coin}USDT`;
            const fullName = exchange === 'OKX' ? `${exchange}:${coin}-USDT` : `${exchange}:${symbol}`;
            
            return {
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
            };
        });
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
        console.log('🔍 멀티 거래소 심볼 검색:', userInput, exchange);
        
        const searchTerm = userInput.toUpperCase();
        let allSymbols = [];
        
        // 모든 거래소에서 심볼 검색 (성능 최적화)
        this.symbolsCache.forEach((symbols, exchangeKey) => {
            if (searchTerm === '') {
                // 빈 검색어: 모든 심볼 반환 (제한 없음)
                allSymbols = allSymbols.concat(symbols);
            } else {
                // 검색어 있음: 필터링된 심볼만 반환
                const filteredSymbols = symbols.filter(symbol => 
                    symbol.symbol.includes(searchTerm) ||
                    symbol.baseAsset.includes(searchTerm) ||
                    symbol.quoteAsset.includes(searchTerm) ||
                    symbol.description.includes(searchTerm)
                );
                allSymbols = allSymbols.concat(filteredSymbols);
            }
        });
        
        // 중복 제거 (같은 심볼이 여러 거래소에 있을 수 있음)
        const uniqueSymbols = [];
        const seenSymbols = new Set();
        
        allSymbols.forEach(symbol => {
            const key = `${symbol.baseAsset}-${symbol.quoteAsset}`;
            if (!seenSymbols.has(key)) {
                seenSymbols.add(key);
                uniqueSymbols.push(symbol);
            }
        });
        
        allSymbols = uniqueSymbols;
        
        // 스마트 정렬: 검색 정확도 + 인기도 + 거래량
        const popularPairs = ['BTC', 'ETH', 'BNB', 'ADA', 'XRP', 'SOL', 'DOT', 'DOGE', 'MATIC', 'AVAX'];
        
        allSymbols.sort((a, b) => {
            // 1. 정확한 일치 우선 (검색어가 있을 때)
            if (searchTerm) {
                const aExact = a.baseAsset === searchTerm;
                const bExact = b.baseAsset === searchTerm;
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
                
                // 2. 시작 문자 일치 우선
                const aStarts = a.baseAsset.startsWith(searchTerm);
                const bStarts = b.baseAsset.startsWith(searchTerm);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
            }
            
            // 3. 인기 코인 우선
            const aPopular = popularPairs.some(coin => a.symbol.includes(coin));
            const bPopular = popularPairs.some(coin => b.symbol.includes(coin));
            if (aPopular && !bPopular) return -1;
            if (!aPopular && bPopular) return 1;
            
            // 4. USDT 쌍 우선
            const aUSDT = a.symbol.includes('USDT');
            const bUSDT = b.symbol.includes('USDT');
            if (aUSDT && !bUSDT) return -1;
            if (!aUSDT && bUSDT) return 1;
            
            // 5. 알파벳 순
            return a.symbol.localeCompare(b.symbol);
        });
        
        // 결과 제한 해제 - 모든 심볼 표시
        const limitedResults = allSymbols; // 모든 심볼 표시 (제한 없음)
        
        console.log(`✅ 검색 완료: ${limitedResults.length}개 심볼 (총 ${allSymbols.length}개 중)`);
        onResultReadyCallback(limitedResults);
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
                    time: parseInt(kline[0]),
                    open: parseFloat(kline[1]),
                    high: parseFloat(kline[2]),
                    low: parseFloat(kline[3]),
                    close: parseFloat(kline[4]),
                    volume: parseFloat(kline[5])
                })).sort((a, b) => a.time - b.time);
                
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
        
        this.subscribers.set(subscriberUID, {
            symbolInfo,
            resolution,
            onRealtimeCallback,
            channelString,
            exchange: 'BINANCE'
        });
        
        this.connectBinanceWebSocket();
        this.subscribeToChannel('binance', channelString);
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
        if (data.e === 'kline') {
            const kline = data.k;
            const channelString = `${kline.s.toLowerCase()}@kline_${kline.i}`;
            
            this.subscribers.forEach(subscriber => {
                if (subscriber.channelString === channelString && subscriber.exchange === 'BINANCE') {
                    const bar = {
                        time: parseInt(kline.t),
                        open: parseFloat(kline.o),
                        high: parseFloat(kline.h),
                        low: parseFloat(kline.l),
                        close: parseFloat(kline.c),
                        volume: parseFloat(kline.v)
                    };
                    
                    subscriber.onRealtimeCallback(bar);
                }
            });
        }
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