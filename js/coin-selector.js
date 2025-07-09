// 🔥 코인 선택 모달 관리자 (Coin Selector Manager)
class CoinSelectorManager {
    constructor() {
        this.isModalOpen = false;
        this.selectedCoin = 'BTCUSDT';
        this.coins = [];
        this.filteredCoins = [];
        this.onCoinSelectCallback = null;
        
        console.log('🔥 코인 선택 모달 관리자 초기화');
    }

    // 🔥 모달 초기화
    init() {
        this.createModal();
        this.setupEventListeners();
        this.loadCoinsData();
        
        console.log('✅ 코인 선택 모달 초기화 완료');
    }

    // 🔥 모달 HTML 생성
    createModal() {
        const modalHTML = `
            <div id="coin-selector-modal" class="coin-selector-modal">
                <div class="coin-selector-overlay"></div>
                <div class="coin-selector-content">
                    <div class="coin-selector-header">
                        <h3>심볼 찾기</h3>
                        <button class="coin-selector-close" id="coin-selector-close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="coin-selector-search">
                        <div class="search-input-wrapper">
                            <i class="fas fa-search"></i>
                            <input type="text" id="coin-search-input" placeholder="심볼 검색..." />
                        </div>
                    </div>
                    
                    <div class="coin-selector-tabs">
                        <button class="coin-tab active" data-tab="favorites">즐겨찾기</button>
                        <button class="coin-tab" data-tab="spot">Spot</button>
                        <button class="coin-tab" data-tab="futures">Futures</button>
                        <button class="coin-tab" data-tab="all">All</button>
                    </div>
                    
                    <div class="coin-selector-list" id="coin-selector-list">
                        <div class="coin-loading">
                            <i class="fas fa-spinner fa-spin"></i>
                            <span>코인 목록 로딩 중...</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 기존 모달 제거
        const existingModal = document.getElementById('coin-selector-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // 새 모달 추가
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // 🔥 이벤트 리스너 설정
    setupEventListeners() {
        const modal = document.getElementById('coin-selector-modal');
        const overlay = modal.querySelector('.coin-selector-overlay');
        const closeBtn = modal.querySelector('.coin-selector-close');
        const searchInput = modal.querySelector('#coin-search-input');
        const tabs = modal.querySelectorAll('.coin-tab');

        // 모달 닫기
        overlay.addEventListener('click', () => this.closeModal());
        closeBtn.addEventListener('click', () => this.closeModal());

        // ESC 키로 모달 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isModalOpen) {
                this.closeModal();
            }
        });

        // 검색 기능
        searchInput.addEventListener('input', (e) => {
            this.filterCoins(e.target.value);
        });

        // 탭 전환
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
    }

    // 🔥 코인 데이터 로드
    async loadCoinsData() {
        try {
            // Binance API에서 코인 목록 가져오기
            const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
            const data = await response.json();
            
            this.coins = data
                .filter(coin => coin.symbol.endsWith('USDT'))
                .map(coin => ({
                    symbol: coin.symbol,
                    name: coin.symbol.replace('USDT', ''),
                    price: parseFloat(coin.lastPrice),
                    change: parseFloat(coin.priceChangePercent),
                    volume: parseFloat(coin.volume),
                    icon: this.getCoinIcon(coin.symbol.replace('USDT', '')),
                    isFavorite: this.isFavoriteCoin(coin.symbol)
                }))
                .sort((a, b) => b.volume - a.volume); // 거래량 순 정렬

            this.filteredCoins = [...this.coins];
            this.renderCoinList();
            
            console.log(`✅ ${this.coins.length}개 코인 데이터 로드 완료`);
        } catch (error) {
            console.error('❌ 코인 데이터 로드 실패:', error);
            this.showError('코인 데이터를 불러올 수 없습니다.');
        }
    }

    // 🔥 코인 아이콘 가져오기
    getCoinIcon(symbol) {
        // 모든 아이콘을 null로 반환하여 404 오류 방지
        return null;
    }

    // 🔥 기본 아이콘 SVG 생성
    getDefaultIconSVG() {
        return `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="15" fill="#f3f4f6" stroke="#d1d5db" stroke-width="2"/>
            <circle cx="16" cy="16" r="8" fill="#9ca3af"/>
            <text x="16" y="20" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">?</text>
        </svg>`;
    }

    // 🔥 즐겨찾기 확인
    isFavoriteCoin(symbol) {
        const favorites = JSON.parse(localStorage.getItem('favoriteCoinSymbols') || '[]');
        return favorites.includes(symbol);
    }

    // 🔥 코인 목록 렌더링
    renderCoinList() {
        const listContainer = document.getElementById('coin-selector-list');
        
        if (this.filteredCoins.length === 0) {
            listContainer.innerHTML = `
                <div class="coin-empty">
                    <i class="fas fa-search"></i>
                    <span>검색 결과가 없습니다.</span>
                </div>
            `;
            return;
        }

        const coinsHTML = this.filteredCoins.map(coin => `
            <div class="coin-item" data-symbol="${coin.symbol}" data-name="${coin.name}">
                <div class="coin-item-left">
                    <div class="coin-favorite ${coin.isFavorite ? 'active' : ''}" data-symbol="${coin.symbol}">
                        <i class="fas fa-star"></i>
                    </div>
                    <div class="coin-icon">
                        ${coin.icon ? 
                            `<img src="${coin.icon}" alt="${coin.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                             <div style="display:none;">${this.getDefaultIconSVG()}</div>` :
                            this.getDefaultIconSVG()
                        }
                    </div>
                    <div class="coin-info">
                        <div class="coin-name">${coin.name}</div>
                    </div>
                </div>
                <div class="coin-item-right">
                    <div class="coin-price">${coin.price.toFixed(coin.price < 1 ? 6 : 2)}</div>
                    <div class="coin-change ${coin.change >= 0 ? 'positive' : 'negative'}">
                        ${coin.change >= 0 ? '+' : ''}${coin.change.toFixed(2)}%
                    </div>
                </div>
            </div>
        `).join('');

        listContainer.innerHTML = coinsHTML;

        // 코인 선택 이벤트 추가
        listContainer.querySelectorAll('.coin-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.coin-favorite')) {
                    this.selectCoin(item.dataset.symbol, item.dataset.name);
                }
            });
        });

        // 즐겨찾기 토글 이벤트 추가
        listContainer.querySelectorAll('.coin-favorite').forEach(favBtn => {
            favBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFavorite(favBtn.dataset.symbol);
            });
        });
    }

    // 🔥 코인 검색 필터
    filterCoins(searchTerm) {
        const term = searchTerm.toLowerCase();
        this.filteredCoins = this.coins.filter(coin => 
            coin.name.toLowerCase().includes(term) || 
            coin.symbol.toLowerCase().includes(term)
        );
        this.renderCoinList();
    }

    // 🔥 탭 전환
    switchTab(tabName) {
        const tabs = document.querySelectorAll('.coin-tab');
        tabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            }
        });

        switch (tabName) {
            case 'favorites':
                this.filteredCoins = this.coins.filter(coin => coin.isFavorite);
                break;
            case 'spot':
                this.filteredCoins = this.coins.filter(coin => !coin.symbol.includes('PERP'));
                break;
            case 'futures':
                this.filteredCoins = this.coins.filter(coin => coin.symbol.includes('PERP'));
                break;
            case 'all':
            default:
                this.filteredCoins = [...this.coins];
                break;
        }

        this.renderCoinList();
    }

    // 🔥 즐겨찾기 토글
    toggleFavorite(symbol) {
        const favorites = JSON.parse(localStorage.getItem('favoriteCoinSymbols') || '[]');
        const index = favorites.indexOf(symbol);
        
        if (index > -1) {
            favorites.splice(index, 1);
        } else {
            favorites.push(symbol);
        }
        
        localStorage.setItem('favoriteCoinSymbols', JSON.stringify(favorites));
        
        // 코인 목록 업데이트
        this.coins = this.coins.map(coin => ({
            ...coin,
            isFavorite: favorites.includes(coin.symbol)
        }));
        
        this.renderCoinList();
    }

    // 🔥 코인 선택
    selectCoin(symbol, name) {
        this.selectedCoin = symbol;
        
        if (this.onCoinSelectCallback) {
            this.onCoinSelectCallback(symbol, name);
        }
        
        this.closeModal();
        console.log(`✅ 코인 선택: ${symbol}`);
    }

    // 🔥 모달 열기
    openModal() {
        const modal = document.getElementById('coin-selector-modal');
        modal.classList.add('active');
        this.isModalOpen = true;
        
        // 검색 입력창 포커스
        setTimeout(() => {
            const searchInput = document.getElementById('coin-search-input');
            if (searchInput) {
                searchInput.focus();
            }
        }, 100);
        
        console.log('📱 코인 선택 모달 열림');
    }

    // 🔥 모달 닫기
    closeModal() {
        const modal = document.getElementById('coin-selector-modal');
        modal.classList.remove('active');
        this.isModalOpen = false;
        
        // 검색어 초기화
        const searchInput = document.getElementById('coin-search-input');
        if (searchInput) {
            searchInput.value = '';
            this.filteredCoins = [...this.coins];
            this.renderCoinList();
        }
        
        console.log('📱 코인 선택 모달 닫힘');
    }

    // 🔥 에러 표시
    showError(message) {
        const listContainer = document.getElementById('coin-selector-list');
        listContainer.innerHTML = `
            <div class="coin-error">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${message}</span>
            </div>
        `;
    }

    // 🔥 코인 선택 콜백 설정
    onCoinSelect(callback) {
        this.onCoinSelectCallback = callback;
    }

    // 🔥 현재 선택된 코인 반환
    getSelectedCoin() {
        return this.selectedCoin;
    }

    // 🔥 모달 제거
    destroy() {
        const modal = document.getElementById('coin-selector-modal');
        if (modal) {
            modal.remove();
        }
        
        this.isModalOpen = false;
        console.log('🗑️ 코인 선택 모달 제거됨');
    }
}

// 🔥 전역으로 내보내기
window.CoinSelectorManager = CoinSelectorManager; 