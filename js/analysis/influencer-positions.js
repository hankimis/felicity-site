/**
 * Influencer Positions Tracker
 * 실시간 인플루언서 포지션 추적 모듈
 */
export class InfluencerPositions {
    constructor() {
        this.positions = [];
        this.isTracking = false;
        this.updateInterval = null;
        this.priceUpdateInterval = null;
        this.binanceWs = null;
        
        // 실제 인플루언서 데이터 (사진 기반)
        this.influencers = [
            {
                id: 1,
                name: '잠구',
                avatar: this.createAvatarDataURL('잠', '#22c55e'),
                time: '19시',
                symbol: 'BTCUSDT',
                side: 'short',
                leverage: 20,
                positionSize: 5.5,
                pnl: -400044.00,  // 5.5 * (105741.40 - 109381.80) * (-1) * 20 = -400044
                pnlPercent: -3.44,  // (109381.80 - 105741.40) / 105741.40 * (-1) * 100 = -3.44%
                isOnline: true,
                entryPrice: 105741.40,
                currentPrice: 109381.80,
                liquidationPrice: 125000.00,
                targetPrice: 110511.10,
                streamUrl: 'https://www.youtube.com/watch?v=example1'
            },
            {
                id: 2,
                name: '사또',
                avatar: this.createAvatarDataURL('사', '#3b82f6'),
                time: '1일',
                symbol: 'BTCUSDT',
                side: 'long',
                leverage: 15,
                positionSize: 2.8,
                pnl: 89504.49,  // 2.8 * (109381.80 - 107250.73) * 1 * 15 = 89504.49
                pnlPercent: 1.99,  // (109381.80 - 107250.73) / 107250.73 * 1 * 100 = 1.99%
                isOnline: true,
                entryPrice: 107250.73,
                currentPrice: 109381.80,
                liquidationPrice: 85000.00,
                targetPrice: 96201.93,
                streamUrl: 'https://www.twitch.tv/example2'
            },
            {
                id: 3,
                name: '박호두',
                avatar: this.createAvatarDataURL('박', '#8b5cf6'),
                time: '1일',
                symbol: 'BTCUSDT',
                side: 'long',
                leverage: 10,
                positionSize: 1.88,
                pnl: 59330.02,  // 1.88 * (109381.80 - 106226.90) * 1 * 10 = 59330.02
                pnlPercent: 2.97,  // (109381.80 - 106226.90) / 106226.90 * 1 * 100 = 2.97%
                isOnline: true,
                entryPrice: 106226.90,
                currentPrice: 109381.80,
                liquidationPrice: 95000.00,
                targetPrice: 104882.00,
                streamUrl: 'https://www.youtube.com/watch?v=example3'
            },
            {
                id: 4,
                name: '김치프리미엄',
                avatar: this.createAvatarDataURL('김', '#ef4444'),
                time: '18시',
                symbol: 'ETHUSDT',
                side: 'long',
                leverage: 25,
                positionSize: 38.96,
                pnl: 195427.00,  // 38.96 * (4050.80 - 3850.25) * 1 * 25 = 195427
                pnlPercent: 5.21,  // (4050.80 - 3850.25) / 3850.25 * 1 * 100 = 5.21%
                isOnline: true,
                entryPrice: 3850.25,
                currentPrice: 4050.80,
                liquidationPrice: 3200.00,
                targetPrice: 4200.00,
                streamUrl: 'https://www.twitch.tv/example4'
            },
            {
                id: 5,
                name: '코인마법사',
                avatar: this.createAvatarDataURL('코', '#f59e0b'),
                time: '2시간',
                symbol: 'SOLUSDT',
                side: 'short',
                leverage: 12,
                positionSize: 539.57,
                pnl: 42094.74,  // 539.57 * (185.40 - 178.90) * (-1) * 12 = 42094.74 (short이므로 가격 하락시 수익)
                pnlPercent: -3.51,  // (178.90 - 185.40) / 185.40 * (-1) * 100 = -3.51%
                isOnline: false,
                entryPrice: 185.40,
                currentPrice: 178.90,
                liquidationPrice: 220.00,
                targetPrice: 170.00,
                streamUrl: 'https://www.youtube.com/watch?v=example5'
            },
            {
                id: 6,
                name: '트레이딩킹',
                avatar: this.createAvatarDataURL('트', '#10b981'),
                time: '30분',
                symbol: 'XRPUSDT',
                side: 'long',
                leverage: 18,
                positionSize: 116279.07,
                pnl: 481052.73,  // 116279.07 * (2.380 - 2.150) * 1 * 18 = 481052.73
                pnlPercent: 10.70,  // (2.380 - 2.150) / 2.150 * 1 * 100 = 10.70%
                isOnline: true,
                entryPrice: 2.150,
                currentPrice: 2.380,
                liquidationPrice: 1.800,
                targetPrice: 2.500,
                streamUrl: 'https://www.twitch.tv/example6'
            }
        ];
        
        this.init();
    }

    // 포지션 데이터 저장
    savePositions() {
        try {
            const dataToSave = {
                positions: this.positions,
                timestamp: Date.now()
            };
            localStorage.setItem('influencer-positions', JSON.stringify(dataToSave));
            console.log('💾 포지션 데이터 저장됨');
        } catch (error) {
            console.error('포지션 데이터 저장 실패:', error);
        }
    }

    // 포지션 데이터 로드
    loadPositions() {
        try {
            const savedData = localStorage.getItem('influencer-positions');
            if (savedData) {
                const parsedData = JSON.parse(savedData);
                
                // 데이터가 24시간 이내인지 확인 (선택사항)
                const isDataFresh = (Date.now() - parsedData.timestamp) < (24 * 60 * 60 * 1000);
                
                if (parsedData.positions && Array.isArray(parsedData.positions)) {
                    this.positions = parsedData.positions;
                    console.log('📂 저장된 포지션 데이터 로드됨:', this.positions.length + '개');
                    return;
                }
            }
        } catch (error) {
            console.error('포지션 데이터 로드 실패:', error);
        }
        
        // 저장된 데이터가 없거나 로드 실패 시 기본 데이터 사용
        this.positions = [...this.influencers];
        console.log('📋 기본 포지션 데이터 사용됨');
    }

    // 포지션 추가
    addPosition(newPosition) {
        // 새 ID 생성 (기존 ID 중 최대값 + 1)
        const maxId = Math.max(...this.positions.map(p => p.id), 0);
        newPosition.id = maxId + 1;
        
        this.positions.push(newPosition);
        this.updateDisplay();
        console.log('➕ 새 포지션 추가됨:', newPosition.name);
    }

    // 포지션 수정
    updatePosition(positionId, updateData) {
        const index = this.positions.findIndex(p => p.id === positionId);
        if (index !== -1) {
            this.positions[index] = { ...this.positions[index], ...updateData };
            this.updateDisplay();
            console.log('✏️ 포지션 수정됨:', this.positions[index].name);
        }
    }

    // 포지션 삭제
    removePosition(positionId) {
        const index = this.positions.findIndex(p => p.id === positionId);
        if (index !== -1) {
            const removedPosition = this.positions.splice(index, 1)[0];
            this.updateDisplay();
            console.log('🗑️ 포지션 삭제됨:', removedPosition.name);
        }
    }

    // 바이낸스 웹소켓 연결 설정
    setupBinanceWebSocket() {
        try {
            // 현재 포지션에서 사용되는 심볼들 추출
            const symbols = [...new Set(this.positions.map(p => p.symbol))];
            const streams = symbols.map(symbol => `${symbol.toLowerCase()}@ticker`).join('/');
            
            const wsUrl = `wss://stream.binance.com:9443/ws/${streams}`;
            this.binanceWs = new WebSocket(wsUrl);
            
            this.binanceWs.onopen = () => {
                console.log('📡 바이낸스 웹소켓 연결됨');
            };
            
            this.binanceWs.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.s && data.c) {
                        this.updateRealTimePrice(data.s, parseFloat(data.c));
                    }
                } catch (error) {
                    console.error('웹소켓 데이터 파싱 오류:', error);
                }
            };
            
            this.binanceWs.onerror = (error) => {
                console.error('바이낸스 웹소켓 오류:', error);
            };
            
            this.binanceWs.onclose = () => {
                console.log('📡 바이낸스 웹소켓 연결 종료');
                // 5초 후 재연결 시도
                setTimeout(() => {
                    if (this.isTracking) {
                        this.setupBinanceWebSocket();
                    }
                }, 5000);
            };
            
        } catch (error) {
            console.error('바이낸스 웹소켓 설정 오류:', error);
        }
    }

    // 실시간 가격 업데이트
    updateRealTimePrice(symbol, price) {
        let updated = false;
        
        this.positions.forEach(position => {
            if (position.symbol === symbol) {
                const oldPrice = position.currentPrice;
                position.currentPrice = price;
                
                // PnL 재계산 (코인 개수 기반)
                const priceChange = position.currentPrice - position.entryPrice;
                const multiplier = position.side === 'long' ? 1 : -1;
                position.pnlPercent = (priceChange / position.entryPrice) * multiplier * 100;
                // 코인 개수 * 가격 변동 * 레버리지
                position.pnl = position.positionSize * priceChange * multiplier * position.leverage;
                
                updated = true;
            }
        });
        
        if (updated) {
            this.updateDisplay();
        }
    }

    createAvatarDataURL(text, bgColor) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 캔버스 크기 설정
        canvas.width = 32;
        canvas.height = 32;
        
        // 배경 그리기
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, 32, 32);
        
        // 텍스트 스타일 설정
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 텍스트 그리기
        ctx.fillText(text, 16, 16);
        
        // Data URL로 변환
        return canvas.toDataURL();
    }

    async init() {
        console.log('📈 Influencer Positions Tracker initializing...');
        
        // 저장된 포지션 데이터 로드
        this.loadPositions();
        
        // 즉시 버튼 숨김 처리
        this.hideAdminButtons();
        
        this.setupBinanceWebSocket();
        await this.setupEventListeners();
        this.updateDisplay();
    }

    // 어드민 버튼들을 즉시 숨김
    hideAdminButtons() {
        const moreBtn = document.getElementById('more-positions-btn');
        const addBtn = document.getElementById('add-position-btn');
        
        if (moreBtn) {
            moreBtn.classList.remove('admin-visible');
            moreBtn.style.display = 'none';
        }
        
        if (addBtn) {
            addBtn.classList.remove('admin-visible');
            addBtn.style.display = 'none';
        }
    }

    async setupEventListeners() {
        // 어드민 버튼들 권한 확인
        await this.setupAdminButtons();
    }

    async setupAdminButtons() {
        const moreBtn = document.getElementById('more-positions-btn');
        const addBtn = document.getElementById('add-position-btn');
        
        // 기본적으로 모든 버튼 숨김
        [moreBtn, addBtn].forEach(btn => {
            if (btn) {
                btn.classList.remove('admin-visible');
                btn.style.display = 'none';
            }
        });
        
        try {
            const isAdminUser = await this.isAdmin();
            console.log('어드민 버튼 권한 확인:', isAdminUser);
            
            if (isAdminUser) {
                // 더보기 버튼 설정
                if (moreBtn) {
                    moreBtn.classList.add('admin-visible');
                    moreBtn.style.display = 'flex';
                    
                    moreBtn.removeEventListener('click', this.moreButtonHandler);
                    this.moreButtonHandler = () => this.showMorePositions();
                    moreBtn.addEventListener('click', this.moreButtonHandler);
                }
                
                // 포지션 추가 버튼 설정
                if (addBtn) {
                    addBtn.classList.add('admin-visible');
                    addBtn.style.display = 'flex';
                    
                    addBtn.removeEventListener('click', this.addButtonHandler);
                    this.addButtonHandler = () => this.showAddModal();
                    addBtn.addEventListener('click', this.addButtonHandler);
                }
                
                console.log('✅ 어드민 버튼들 표시됨');
            } else {
                console.log('🚫 어드민 버튼들 숨김 (일반 사용자)');
            }
        } catch (error) {
            console.log('권한 확인 중 오류:', error);
            [moreBtn, addBtn].forEach(btn => {
                if (btn) {
                    btn.classList.remove('admin-visible');
                    btn.style.display = 'none';
                }
            });
        }
    }

    showMorePositions() {
        if (this.isAdmin()) {
            // 어드민인 경우 관리 메뉴 표시
            const menu = document.createElement('div');
            menu.className = 'admin-menu';
            menu.innerHTML = `
                <div class="admin-menu-overlay" onclick="this.parentElement.remove()">
                    <div class="admin-menu-content" onclick="event.stopPropagation()">
                        <h4>인플루언서 포지션 관리</h4>
                        <button onclick="window.influencerPositions.showAddModal(); this.closest('.admin-menu').remove()">새 포지션 추가</button>
                        <button onclick="window.influencerPositions.showAllPositions(); this.closest('.admin-menu').remove()">전체 포지션 보기</button>
                        <button onclick="window.influencerPositions.exportPositions(); this.closest('.admin-menu').remove()">데이터 내보내기</button>
                        <button onclick="this.closest('.admin-menu').remove()">취소</button>
                    </div>
                </div>
            `;
            document.body.appendChild(menu);
        } else {
            // 일반 사용자인 경우 전체 포지션 보기만
            this.showAllPositions();
        }
    }

    showAllPositions() {
        const modal = document.createElement('div');
        modal.className = 'positions-view-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content large">
                    <div class="modal-header">
                        <h3>전체 인플루언서 포지션</h3>
                        <button class="modal-close" onclick="this.closest('.positions-view-modal').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="positions-grid">
                            ${this.positions.map(position => this.createPositionHTML(position)).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    exportPositions() {
        const data = JSON.stringify(this.positions, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `influencer-positions-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        alert('포지션 데이터가 다운로드되었습니다.');
    }

    start() {
        if (this.isTracking) return;
        
        this.isTracking = true;
        console.log('📈 Starting influencer positions tracking...');
        
        // 30초마다 포지션 업데이트 (실제 데이터 변동 시뮬레이션)
        this.updateInterval = setInterval(() => {
            this.updatePositions();
        }, 30000);
    }

    stop() {
        this.isTracking = false;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        console.log('📈 Influencer positions tracking stopped');
    }

    updatePositions() {
        if (!this.isTracking) return;
        
        // 실시간 시장 데이터 시뮬레이션
        this.positions.forEach(position => {
            // 현실적인 변동성 적용 (코인별 다름)
            const volatility = this.getVolatilityForSymbol(position.symbol);
            const change = (Math.random() - 0.5) * volatility * 2;
            
            // 현재가 업데이트 (실시간 시장가)
            const newPrice = position.currentPrice * (1 + change);
            position.currentPrice = Math.max(newPrice, position.currentPrice * 0.95); // 최대 5% 하락 제한
            
            // 실현 손익 정확한 계산
            const priceChange = position.currentPrice - position.entryPrice;
            const multiplier = position.side === 'long' ? 1 : -1;
            
            // 퍼센트 계산
            position.pnlPercent = (priceChange / position.entryPrice) * multiplier * 100;
            
            // 실제 손익 금액 계산 (레버리지 고려)
            const leverage = this.getLeverageForPosition(position);
            const baseAmount = this.getPositionSize(position);
            position.pnl = (priceChange * multiplier * baseAmount * leverage) / position.entryPrice;
            
            // 시간 업데이트 (실시간 느낌)
            this.updateTimeDisplay(position);
        });
        
        this.updateDisplay();
    }

    getVolatilityForSymbol(symbol) {
        const volatilities = {
            'BTCUSDT': 0.005,  // 0.5%
            'ETHUSDT': 0.008,  // 0.8%
            'SOLUSDT': 0.015,  // 1.5%
            'XRPUSDT': 0.012,  // 1.2%
            'ADAUSDT': 0.010   // 1.0%
        };
        return volatilities[symbol] || 0.008;
    }

    getLeverageForPosition(position) {
        // 포지션별 레버리지 (보통 5x-20x)
        const leverages = {
            1: 10, 2: 15, 3: 5, 4: 20, 5: 8, 6: 12
        };
        return leverages[position.id] || 10;
    }

    getPositionSize(position) {
        // 포지션 크기 (코인 개수)
        const sizes = {
            1: 5.5,     // 잠구: 5.5 BTC
            2: 85.7,    // 사또: 85.7 ETH  
            3: 2.1,     // 박호두: 2.1 BTC
            4: 42.8,    // 김치프리미엄: 42.8 ETH
            5: 1.0,     // 코인마법사: 1.0 BTC
            6: 2800,    // 트레이딩킹: 2800 SOL
        };
        return sizes[position.id] || 1.0;
    }

    updateTimeDisplay(position) {
        // 시간 업데이트 로직 (실제로는 고정값 유지)
        const timeFormats = ['19시', '1일', '18시', '2시간', '30분'];
        if (!position.originalTime) {
            position.originalTime = position.time;
        }
        // 시간은 고정값으로 유지 (실제 구현에서는 실시간 업데이트)
    }

    async updateDisplay() {
        const container = document.getElementById('influencer-positions-container');
        if (!container) return;

        const positionsList = container.querySelector('.positions-list');
        if (!positionsList) return;

        // 포지션 목록 업데이트 (최대 4개만 표시)
        const displayPositions = this.positions.slice(0, 4);
        
        // 비동기 HTML 생성
        const htmlPromises = displayPositions.map(position => this.createPositionHTML(position));
        const htmlArray = await Promise.all(htmlPromises);
        
        positionsList.innerHTML = htmlArray.join('');
    }

    async createPositionHTML(position) {
        const pnlClass = position.pnl >= 0 ? 'positive' : 'negative';
        const pnlSign = position.pnl >= 0 ? '+' : '';
        const sideClass = position.side === 'long' ? 'long' : 'short';
        const sideText = position.side === 'long' ? 'LONG' : 'SHORT';
        const statusClass = position.isOnline ? 'online' : 'offline';
        
        // 어드민 권한 확인 (비동기)
        let isAdminUser = false;
        try {
            // Firebase Auth가 없거나 로그인하지 않은 경우 즉시 false
            if (!firebase || !firebase.auth || !firebase.auth().currentUser) {
                isAdminUser = false;
            } else {
                isAdminUser = await this.isAdmin();
            }
        } catch (error) {
            console.log('권한 확인 중 오류:', error);
            isAdminUser = false;
        }
        
        console.log('포지션 카드 어드민 권한:', isAdminUser);
        
        return `
            <div class="influencer-position-card clickable" data-position-id="${position.id}" onclick="window.influencerPositions.handleCardClick(${position.id}, '${position.streamUrl}')">
                <div class="position-header">
                    <div class="trader-info">
                        <img src="${position.avatar}" alt="${position.name}" class="trader-avatar" />
                        <div class="trader-details">
                            <span class="trader-name">${position.name}</span>
                            <span class="position-time">${position.time}</span>
                        </div>
                    </div>
                    <div class="status-indicator ${statusClass}"></div>
                </div>
                
                <div class="position-main">
                    <div class="symbol-side">
                        <span class="symbol">${position.symbol.replace('USDT', '')}</span>
                        <span class="side-badge ${sideClass}">${sideText}</span>
                        <span class="leverage">${position.leverage}x</span>
                    </div>
                    
                    <div class="pnl-display">
                        <div class="pnl-amount ${pnlClass}">${pnlSign}${this.formatNumber(Math.abs(position.pnl))}</div>
                        <div class="pnl-percent ${pnlClass}">${pnlSign}${position.pnlPercent.toFixed(2)}%</div>
                    </div>
                </div>
                
                <div class="position-details">
                    <div class="price-info">
                        <div class="price-item">
                            <span class="label">진입</span>
                            <span class="value">${this.formatPrice(position.entryPrice)}</span>
                        </div>
                        <div class="price-item">
                            <span class="label">현재</span>
                            <span class="value realtime-price">${this.formatPrice(position.currentPrice)}</span>
                        </div>
                        <div class="price-item liquidation">
                            <span class="label">청산</span>
                            <span class="value">${this.formatPrice(position.liquidationPrice)}</span>
                        </div>
                    </div>
                </div>
                
                ${isAdminUser ? `<button class="admin-edit-btn" onclick="event.stopPropagation(); window.influencerPositions.editPosition(${position.id})" title="포지션 편집">⚙️</button>` : ''}
            </div>
        `;
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return '$' + (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return '$' + (num / 1000).toFixed(0) + 'K';
        }
        return '$' + num.toFixed(0);
    }

    formatPrice(price) {
        if (price >= 1000) {
            return '$' + price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        } else if (price >= 1) {
            return '$' + price.toFixed(2);
        } else {
            return '$' + price.toFixed(4);
        }
    }

    // 방송 주소로 이동
    openStream(streamUrl) {
        if (streamUrl) {
            window.open(streamUrl, '_blank');
        } else {
            alert('방송 주소가 설정되지 않았습니다.');
        }
    }

    // 이미지 미리보기
    previewImage(input, previewId) {
        const preview = document.getElementById(previewId);
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(input.files[0]);
        }
    }

    // 기본 아바타로 리셋
    resetAvatar(previewId, name) {
        const preview = document.getElementById(previewId);
        if (name) {
            preview.src = this.createAvatarDataURL(name.charAt(0), this.getRandomColor());
        } else {
            preview.src = '';
            preview.style.display = 'none';
        }
        
        // 파일 입력 초기화
        const fileInput = previewId.includes('edit') ? 
            document.getElementById('edit-avatar') : 
            document.getElementById('add-avatar');
        if (fileInput) {
            fileInput.value = '';
        }
    }

    // 어드민 권한 확인 (admin.js 참고)
    async isAdmin() {
        // 게스트 사용자는 무조건 false
        if (!firebase || !firebase.auth) {
            console.log('🚫 Firebase Auth 없음 - 게스트 사용자');
            return false;
        }

        try {
            const user = firebase.auth().currentUser;
            
            // 로그인하지 않은 사용자는 무조건 false
            if (!user) {
                console.log('🚫 로그인하지 않은 사용자');
                return false;
            }

            // Firestore에서 사용자 역할 확인
            try {
                const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
                if (userDoc.exists() && userDoc.data().role === 'admin') {
                    console.log('✅ Firestore 어드민 권한 확인됨');
                    return true;
                }
            } catch (firestoreError) {
                console.log('Firestore 확인 실패:', firestoreError);
            }
            
            // 실제 어드민 이메일 목록 (백업)
            const adminEmails = [
                'admin@felicity.com',
                'manager@felicity.com',
                'hankim@felicity.com',
                'test@admin.com'
            ];
            
            if (adminEmails.includes(user.email)) {
                console.log('✅ 이메일 기반 어드민 권한 확인됨:', user.email);
                return true;
            }

        } catch (error) {
            console.log('Firebase 어드민 확인 실패:', error);
        }
        
        // 개발 환경에서만 로컬 스토리지 확인 (로그인 사용자만)
        if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && 
            firebase.auth().currentUser) {
            const isLocalAdmin = localStorage.getItem('isAdmin') === 'true';
            if (isLocalAdmin) {
                console.log('🔑 로컬 개발 어드민 권한 확인됨');
                return true;
            }
        }
        
        console.log('🚫 어드민 권한 없음');
        return false;
    }

    // 포지션 편집 모달 열기
    async editPosition(positionId) {
        const isAdminUser = await this.isAdmin();
        if (!isAdminUser) {
            alert('관리자 권한이 필요합니다.');
            return;
        }
        
        const position = this.positions.find(p => p.id === positionId);
        if (!position) return;
        
        this.showEditModal(position);
    }

    // 포지션 카드 클릭 시 어드민 확인
    async handleCardClick(positionId, streamUrl) {
        const isAdminUser = await this.isAdmin();
        
        if (isAdminUser) {
            // 어드민인 경우 설정 메뉴 표시
            this.showAdminCardMenu(positionId, streamUrl);
        } else {
            // 일반 사용자인 경우 방송으로 이동
            this.openStream(streamUrl);
        }
    }

    // 어드민 카드 메뉴 표시
    showAdminCardMenu(positionId, streamUrl) {
        const position = this.positions.find(p => p.id === positionId);
        if (!position) return;

        const menu = document.createElement('div');
        menu.className = 'admin-card-menu';
        menu.innerHTML = `
            <div class="admin-menu-overlay" onclick="this.parentElement.remove()">
                <div class="admin-menu-content" onclick="event.stopPropagation()">
                    <h4>${position.name} 포지션 관리</h4>
                    <div class="menu-buttons">
                        <button onclick="window.influencerPositions.openStream('${streamUrl}'); this.closest('.admin-card-menu').remove()">
                            📺 방송 보기
                        </button>
                        <button onclick="window.influencerPositions.editPosition(${positionId}); this.closest('.admin-card-menu').remove()">
                            ⚙️ 포지션 편집
                        </button>
                        <button onclick="window.influencerPositions.deletePosition(${positionId}); this.closest('.admin-card-menu').remove()">
                            🗑️ 포지션 삭제
                        </button>
                        <button onclick="this.closest('.admin-card-menu').remove()">
                            ❌ 취소
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(menu);
    }

    // 편집 모달 표시
    showEditModal(position) {
        const modal = document.createElement('div');
        modal.className = 'position-edit-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>포지션 편집 - ${position.name}</h3>
                        <button class="modal-close" onclick="this.closest('.position-edit-modal').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        <form id="position-edit-form">
                            <div class="form-group">
                                <label>트레이더 이름</label>
                                <input type="text" id="edit-name" value="${position.name}" required>
                            </div>
                            <div class="form-group">
                                <label>BJ 이미지</label>
                                <div class="image-upload-container">
                                    <img id="edit-avatar-preview" src="${position.avatar}" alt="현재 이미지" class="avatar-preview">
                                    <input type="file" id="edit-avatar" accept="image/*" onchange="window.influencerPositions.previewImage(this, 'edit-avatar-preview')">
                                    <button type="button" onclick="window.influencerPositions.resetAvatar('edit-avatar-preview', '${position.name}')">기본 이미지로 변경</button>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>방송 주소</label>
                                <input type="url" id="edit-stream-url" value="${position.streamUrl || ''}" placeholder="https://www.youtube.com/watch?v=...">
                            </div>
                            <div class="form-group">
                                <label>심볼</label>
                                <select id="edit-symbol" required>
                                    <option value="BTCUSDT" ${position.symbol === 'BTCUSDT' ? 'selected' : ''}>BTCUSDT</option>
                                    <option value="ETHUSDT" ${position.symbol === 'ETHUSDT' ? 'selected' : ''}>ETHUSDT</option>
                                    <option value="SOLUSDT" ${position.symbol === 'SOLUSDT' ? 'selected' : ''}>SOLUSDT</option>
                                    <option value="XRPUSDT" ${position.symbol === 'XRPUSDT' ? 'selected' : ''}>XRPUSDT</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>포지션</label>
                                <select id="edit-side" required>
                                    <option value="long" ${position.side === 'long' ? 'selected' : ''}>Long</option>
                                    <option value="short" ${position.side === 'short' ? 'selected' : ''}>Short</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>레버리지</label>
                                <input type="number" id="edit-leverage" value="${position.leverage}" min="1" max="100" required>
                            </div>
                            <div class="form-group">
                                <label>포지션 크기 (코인 개수)</label>
                                <input type="number" id="edit-position-size" value="${position.positionSize}" min="0.001" step="0.001" required>
                            </div>
                            <div class="form-group">
                                <label>진입가 ($)</label>
                                <input type="number" id="edit-entry-price" value="${position.entryPrice}" step="0.01" required>
                            </div>
                            <div class="form-group">
                                <label>현재가 ($)</label>
                                <input type="number" id="edit-current-price" value="${position.currentPrice}" step="0.01" required>
                            </div>
                            <div class="form-group">
                                <label>청산가 ($)</label>
                                <input type="number" id="edit-liquidation-price" value="${position.liquidationPrice}" step="0.01" required>
                            </div>
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="edit-online" ${position.isOnline ? 'checked' : ''}>
                                    온라인 상태
                                </label>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-secondary" onclick="this.closest('.position-edit-modal').remove()">취소</button>
                        <button type="button" class="btn-danger" onclick="window.influencerPositions.deletePosition(${position.id}); this.closest('.position-edit-modal').remove()">삭제</button>
                        <button type="button" class="btn-primary" onclick="window.influencerPositions.savePosition(${position.id})">저장</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    // 포지션 저장
    savePosition(positionId) {
        const form = document.getElementById('position-edit-form');
        const formData = new FormData(form);
        
        const updateData = {
            name: document.getElementById('edit-name').value,
            symbol: document.getElementById('edit-symbol').value,
            side: document.getElementById('edit-side').value,
            leverage: parseInt(document.getElementById('edit-leverage').value),
            positionSize: parseFloat(document.getElementById('edit-position-size').value),
            entryPrice: parseFloat(document.getElementById('edit-entry-price').value),
            currentPrice: parseFloat(document.getElementById('edit-current-price').value),
            liquidationPrice: parseFloat(document.getElementById('edit-liquidation-price').value),
            isOnline: document.getElementById('edit-online').checked,
            streamUrl: document.getElementById('edit-stream-url').value
        };
        
        // 이미지 업데이트
        const avatarPreview = document.getElementById('edit-avatar-preview');
        if (avatarPreview && avatarPreview.src) {
            updateData.avatar = avatarPreview.src;
        }
        
        // PnL 재계산 (코인 개수 기반)
        const priceChange = updateData.currentPrice - updateData.entryPrice;
        const multiplier = updateData.side === 'long' ? 1 : -1;
        updateData.pnlPercent = (priceChange / updateData.entryPrice) * multiplier * 100;
        // 코인 개수 * 가격 변동 * 레버리지
        updateData.pnl = updateData.positionSize * priceChange * multiplier * updateData.leverage;
        
        this.updatePosition(positionId, updateData);
        document.querySelector('.position-edit-modal').remove();
        
        // 데이터 저장
        this.savePositions();
        
        alert('포지션이 성공적으로 수정되었습니다.');
    }

    // 포지션 삭제
    deletePosition(positionId) {
        if (confirm('정말로 이 포지션을 삭제하시겠습니까?')) {
            this.removePosition(positionId);
            
            // 데이터 저장
            this.savePositions();
            
            alert('포지션이 삭제되었습니다.');
        }
    }

    // 새 포지션 추가 모달
    async showAddModal() {
        const isAdminUser = await this.isAdmin();
        if (!isAdminUser) {
            alert('관리자 권한이 필요합니다.');
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'position-edit-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>새 포지션 추가</h3>
                        <button class="modal-close" onclick="this.closest('.position-edit-modal').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        <form id="position-add-form">
                            <div class="form-group">
                                <label>트레이더 이름</label>
                                <input type="text" id="add-name" required>
                            </div>
                            <div class="form-group">
                                <label>BJ 이미지</label>
                                <div class="image-upload-container">
                                    <img id="add-avatar-preview" src="" alt="이미지 미리보기" class="avatar-preview" style="display: none;">
                                    <input type="file" id="add-avatar" accept="image/*" onchange="window.influencerPositions.previewImage(this, 'add-avatar-preview')">
                                    <button type="button" onclick="window.influencerPositions.resetAvatar('add-avatar-preview', '')">기본 이미지로 변경</button>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>방송 주소</label>
                                <input type="url" id="add-stream-url" placeholder="https://www.youtube.com/watch?v=...">
                            </div>
                            <div class="form-group">
                                <label>심볼</label>
                                <select id="add-symbol" required>
                                    <option value="BTCUSDT">BTCUSDT</option>
                                    <option value="ETHUSDT">ETHUSDT</option>
                                    <option value="SOLUSDT">SOLUSDT</option>
                                    <option value="XRPUSDT">XRPUSDT</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>포지션</label>
                                <select id="add-side" required>
                                    <option value="long">Long</option>
                                    <option value="short">Short</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>레버리지</label>
                                <input type="number" id="add-leverage" value="10" min="1" max="100" required>
                            </div>
                            <div class="form-group">
                                <label>포지션 크기 (코인 개수)</label>
                                <input type="number" id="add-position-size" value="1" min="0.001" step="0.001" required>
                            </div>
                            <div class="form-group">
                                <label>진입가 ($)</label>
                                <input type="number" id="add-entry-price" step="0.01" required>
                            </div>
                            <div class="form-group">
                                <label>현재가 ($)</label>
                                <input type="number" id="add-current-price" step="0.01" required>
                            </div>
                            <div class="form-group">
                                <label>청산가 ($)</label>
                                <input type="number" id="add-liquidation-price" step="0.01" required>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-secondary" onclick="this.closest('.position-edit-modal').remove()">취소</button>
                        <button type="button" class="btn-primary" onclick="window.influencerPositions.addNewPosition()">추가</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    // 새 포지션 추가
    addNewPosition() {
        const name = document.getElementById('add-name').value.trim();
        const symbol = document.getElementById('add-symbol').value;
        const side = document.getElementById('add-side').value;
        const leverage = parseInt(document.getElementById('add-leverage').value);
        const positionSize = parseFloat(document.getElementById('add-position-size').value);
        const entryPrice = parseFloat(document.getElementById('add-entry-price').value);
        const currentPrice = parseFloat(document.getElementById('add-current-price').value);
        const liquidationPrice = parseFloat(document.getElementById('add-liquidation-price').value);
        const streamUrl = document.getElementById('add-stream-url').value.trim();
        
        // 필수 필드 검증
        if (!name || !symbol || !side || !leverage || !positionSize || !entryPrice || !currentPrice || !liquidationPrice) {
            alert('모든 필수 필드를 입력해주세요.');
            return;
        }
        
        // 이미지 처리
        const avatarPreview = document.getElementById('add-avatar-preview');
        let avatar;
        if (avatarPreview && avatarPreview.src && avatarPreview.style.display !== 'none') {
            avatar = avatarPreview.src;
        } else {
            avatar = this.createAvatarDataURL(name.charAt(0), this.getRandomColor());
        }
        
        // PnL 계산 (코인 개수 기반)
        const priceChange = currentPrice - entryPrice;
        const multiplier = side === 'long' ? 1 : -1;
        const pnlPercent = (priceChange / entryPrice) * multiplier * 100;
        // 코인 개수 * 가격 변동 * 레버리지
        const pnl = positionSize * priceChange * multiplier * leverage;
        
        const newPosition = {
            id: Date.now(),
            name,
            avatar,
            time: '방금',
            originalTime: '방금',
            symbol,
            side,
            leverage,
            positionSize,
            pnl,
            pnlPercent,
            isOnline: true,
            status: 'online',
            entryPrice,
            currentPrice,
            liquidationPrice,
            streamUrl
        };
        
        this.addPosition(newPosition);
        document.querySelector('.position-edit-modal').remove();
        
        // 데이터 저장
        this.savePositions();
        
        alert('새 포지션이 성공적으로 추가되었습니다.');
    }

    getRandomColor() {
        const colors = ['#22c55e', '#3b82f6', '#8b5cf6', '#ef4444', '#f59e0b', '#10b981'];
        return colors[Math.floor(Math.random() * colors.length)];
    }



    // 관리자 기능 - 전체 포지션 목록 반환
    getAllPositions() {
        return this.positions;
    }

    // 외부에서 접근 가능한 메서드들
    getPositions() {
        return this.positions;
    }

    getStats() {
        const stats = {
            totalPositions: this.positions.length,
            longPositions: this.positions.filter(p => p.side === 'long').length,
            shortPositions: this.positions.filter(p => p.side === 'short').length,
            profitablePositions: this.positions.filter(p => p.pnl > 0).length,
            onlineTraders: this.positions.filter(p => p.isOnline).length
        };
        
        return stats;
    }
}

// 전역 객체로 내보내기
window.InfluencerPositions = InfluencerPositions; 