/**
 * 🎯 차트 저장 관리자 (Chart Save Manager)
 * samplesave.js 로직을 기반으로 한 개선된 차트 저장 시스템
 */

class ChartSaveManager {
    constructor() {
        this.saveTimeout = null;
        this.lastSaveTime = 0;
        this.chartRestored = false;
        this.widget = null;
        this.isInitialized = false;
        this.initializationAttempts = 0;
        this.maxInitAttempts = 10;
        this.backupInterval = null;
        this.periodicSaveInterval = null;
        this.domObserver = null;
        
        // 설정값
        this.SAVE_COOLDOWN = 3000; // 3초 쿨다운
        this.DEBOUNCE_DELAY = 2000; // 2초 디바운스
        this.BACKUP_INTERVAL = 60000; // 1분 백업 간격
        this.RESTORE_RETRY_DELAY = 2000; // 2초 후 복원 재시도
        this.API_CHECK_INTERVAL = 500; // API 준비 상태 확인 간격
        
        // 컬렉션 이름
        this.CHART_STATES_COLLECTION = 'chartStates';
        this.CHART_LAYOUTS_COLLECTION = 'chartLayouts';
        
        console.log('📊 ChartSaveManager 초기화됨');
    }

    /**
     * 위젯 초기화 및 이벤트 구독
     */
    async initialize(widget) {
        if (this.isInitialized) {
            console.warn('⚠️ ChartSaveManager가 이미 초기화됨');
            return;
        }

        this.widget = widget;
        console.log('🔄 ChartSaveManager 초기화 시작...');
        
        // Widget이 완전히 준비될 때까지 대기
        const isReady = await this.waitForWidgetReady();
        if (!isReady) {
            console.error('❌ Widget 초기화 타임아웃');
            return;
        }
        
        this.isInitialized = true;
        
        // 이벤트 구독
        this.subscribeToEvents();
        
        // 복원 시도
        this.scheduleRestore();
        
        // 주기적 백업 시작
        this.startPeriodicBackup();
        
        // 페이지 종료 시 저장
        this.setupBeforeUnload();
        
        console.log('✅ ChartSaveManager 초기화 완료');
    }

    /**
     * Widget이 완전히 준비될 때까지 대기
     */
    async waitForWidgetReady(maxWaitTime = 30000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
            if (this.isWidgetFullyReady()) {
                console.log('✅ TradingView Widget 완전 준비됨');
                return true;
            }
            
            console.log('🔄 Widget 준비 대기 중...', Math.floor((Date.now() - startTime) / 1000) + 's');
            await this.delay(this.API_CHECK_INTERVAL);
        }
        
        return false;
    }

    /**
     * Widget이 완전히 준비되었는지 확인 (개선된 버전)
     */
    isWidgetFullyReady() {
        try {
            if (!this.widget) {
                return false;
            }

            // 1. 기본 Widget 객체 확인
            if (typeof this.widget.onChartReady !== 'function') {
                return false;
            }

            // 2. Chart API 접근 확인
            if (!this.widget.chart) {
                return false;
            }

            // 3. 내부 API 확인 (더 안전한 방식)
            try {
                const hasActiveChart = this.widget.chart() !== null;
                return hasActiveChart;
            } catch (e) {
                return false;
            }

        } catch (error) {
            return false;
        }
    }

    /**
     * 차트 레이아웃 저장
     */
    async saveChartLayout(layoutData, isManual = false) {
        if (!window.currentUser || !layoutData) {
            console.warn('⚠️ 사용자 미로그인 또는 레이아웃 데이터 없음');
            return false;
        }

        const now = Date.now();
        
        // 쿨다운 체크 (수동 저장은 예외)
        if (!isManual && now - this.lastSaveTime < this.SAVE_COOLDOWN) {
            console.log('⏳ 저장 쿨다운 중...');
            return false;
        }

        try {
            // JSON 직렬화
            let serializedData;
            try {
                serializedData = JSON.stringify(layoutData);
            } catch (jsonError) {
                console.error('❌ JSON 직렬화 실패:', jsonError);
                return false;
            }

            // 저장 데이터 구성
            const saveData = {
                content: serializedData,
                timestamp: new Date(),
                updatedAt: now,
                userId: window.currentUser.uid,
                symbol: this.getCurrentSymbol(),
                interval: this.getCurrentInterval(),
                isManual: isManual,
                version: '1.0'
            };

            // Firestore에 저장
            const collection = isManual ? this.CHART_LAYOUTS_COLLECTION : this.CHART_STATES_COLLECTION;
            const docId = isManual ? `${window.currentUser.uid}_${now}` : window.currentUser.uid;
            
            await window.db.collection(collection).doc(docId).set(saveData);
            
            this.lastSaveTime = now;
            
            // 저장 알림 표시
            this.showSaveNotification(isManual);
            
            console.log(`✅ 차트 ${isManual ? '수동' : '자동'} 저장 완료 (크기: ${serializedData.length} bytes)`);
            return true;
            
        } catch (error) {
            console.error('❌ 차트 저장 실패:', error);
            this.showErrorNotification('저장 실패');
            return false;
        }
    }

    /**
     * 디바운스된 자동 저장
     */
    debouncedAutoSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = setTimeout(() => {
            if (this.widget && this.widget.save) {
                this.widget.save((layoutData) => {
                    if (layoutData) {
                        this.saveChartLayout(layoutData, false);
                    }
                });
            }
        }, this.DEBOUNCE_DELAY);
    }

    /**
     * 디바운스된 저장 (이벤트 기반)
     */
    debouncedSave(eventType = 'unknown') {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = setTimeout(() => {
            if (this.isWidgetFullyReady() && window.currentUser) {
                console.log(`💾 차트 자동 저장 (${eventType})`);
                this.widget.save((layoutData) => {
                    if (layoutData) {
                        this.saveChartLayout(layoutData, false);
                    }
                });
            }
        }, this.DEBOUNCE_DELAY);
    }

    /**
     * 수동 저장 (사용자 요청)
     */
    async manualSave() {
        if (!this.widget || !this.widget.save) {
            console.error('❌ 위젯이 초기화되지 않음');
            return false;
        }

        return new Promise((resolve) => {
            this.widget.save(async (layoutData) => {
                if (layoutData) {
                    const success = await this.saveChartLayout(layoutData, true);
                    resolve(success);
                } else {
                    console.error('❌ 레이아웃 데이터 없음');
                    resolve(false);
                }
            });
        });
    }

    /**
     * 차트 복원
     */
    async restoreChart() {
        if (this.chartRestored || !window.currentUser) {
            return false;
        }

        try {
            const userId = window.currentUser.uid;
            console.log('🔄 차트 복원 시작...', userId);

            // 1단계: 임시 저장된 차트 확인
            const tempChart = await this.loadTempChart(userId);
            if (tempChart) {
                return true;
            }

            // 2단계: 자동 저장된 차트 확인
            const autoSavedChart = await this.loadAutoSavedChart(userId);
            if (autoSavedChart) {
                return true;
            }

            // 3단계: 수동 저장된 차트 확인
            const manualSavedChart = await this.loadManualSavedChart(userId);
            if (manualSavedChart) {
                return true;
            }

            console.log('ℹ️ 복원할 차트 없음');
            return false;

        } catch (error) {
            console.error('❌ 차트 복원 실패:', error);
            return false;
        }
    }

    /**
     * 임시 저장된 차트 로드
     */
    async loadTempChart(userId) {
        try {
            const tempStateStr = localStorage.getItem('tempChartState');
            if (tempStateStr) {
                const tempState = JSON.parse(tempStateStr);
                if (tempState.userId === userId && tempState.content) {
                    const layoutData = this.parseLayoutData(tempState.content);
                    if (layoutData) {
                        const success = await this.safeLoadChart(layoutData);
                        if (success) {
                            this.chartRestored = true;
                            this.showRestoreNotification('임시 저장된 차트가 복원되었습니다');
                            console.log('✅ 임시 저장 차트 복원 완료');
                            // 임시 데이터 삭제
                            localStorage.removeItem('tempChartState');
                            return true;
                        }
                    }
                }
            }
            return false;
        } catch (error) {
            console.error('❌ 임시 저장 차트 로드 실패:', error);
            return false;
        }
    }

    /**
     * 자동 저장된 차트 로드
     */
    async loadAutoSavedChart(userId) {
        try {
            const chartDoc = await window.db.collection(this.CHART_STATES_COLLECTION).doc(userId).get();
            
            if (chartDoc.exists) {
                const data = chartDoc.data();
                if (data.content) {
                    const layoutData = this.parseLayoutData(data.content);
                    if (layoutData) {
                        const success = await this.safeLoadChart(layoutData);
                        if (success) {
                            this.chartRestored = true;
                            this.showRestoreNotification('자동 저장된 차트가 복원되었습니다');
                            console.log('✅ 자동 저장 차트 복원 완료');
                            return true;
                        }
                    }
                }
            }
            return false;
        } catch (error) {
            console.error('❌ 자동 저장 차트 로드 실패:', error);
            return false;
        }
    }

    /**
     * 안전한 차트 로드 (개선된 버전)
     */
    async safeLoadChart(layoutData, maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                // Widget 완전 준비 상태 재확인
                if (!this.isWidgetFullyReady()) {
                    console.warn(`⚠️ Widget이 아직 준비되지 않음, 재시도 중... ${i + 1}/${maxRetries}`);
                    await this.delay(1000);
                    continue;
                }

                // 차트 로드 시도
                return new Promise((resolve) => {
                    try {
                        this.widget.load(layoutData);
                        console.log('✅ 차트 로드 성공');
                        resolve(true);
                    } catch (loadError) {
                        console.error(`❌ 차트 로드 실패 (시도 ${i + 1}):`, loadError);
                        resolve(false);
                    }
                });

            } catch (error) {
                console.error(`❌ 차트 로드 오류 (시도 ${i + 1}):`, error);
                if (i === maxRetries - 1) {
                    return false;
                }
                await this.delay(1000);
            }
        }
        return false;
    }

    /**
     * Widget이 준비되었는지 확인 (레거시 호환)
     */
    isWidgetReady() {
        return this.isWidgetFullyReady();
    }

    /**
     * 지연 함수
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 수동 저장된 차트 로드
     */
    async loadManualSavedChart(userId) {
        try {
            const layoutSnapshot = await window.db.collection(this.CHART_LAYOUTS_COLLECTION)
                .where('userId', '==', userId)
                .orderBy('timestamp', 'desc')
                .limit(1)
                .get();

            if (!layoutSnapshot.empty) {
                const latestLayout = layoutSnapshot.docs[0].data();
                if (latestLayout.content) {
                    const layoutData = this.parseLayoutData(latestLayout.content);
                    if (layoutData) {
                        const success = await this.safeLoadChart(layoutData);
                        if (success) {
                            this.chartRestored = true;
                            this.showRestoreNotification(`"${latestLayout.name}" 차트가 복원되었습니다`);
                            console.log('✅ 수동 저장 차트 복원 완료');
                            return true;
                        }
                    }
                }
            }
            return false;
        } catch (error) {
            console.error('❌ 수동 저장 차트 로드 실패:', error);
            return false;
        }
    }

    /**
     * 레이아웃 데이터 파싱
     */
    parseLayoutData(content) {
        try {
            return typeof content === 'string' ? JSON.parse(content) : content;
        } catch (parseError) {
            console.error('❌ 레이아웃 데이터 파싱 실패:', parseError);
            return null;
        }
    }

    /**
     * 이벤트 구독 (TradingView 공식 API 호환)
     */
    subscribeToEvents() {
        if (!this.widget) return;

        try {
            console.log('📊 TradingView 이벤트 구독 시작');

            // 1. TradingView 공식 자동 저장 이벤트
            if (this.widget.onAutoSaveNeeded) {
                this.widget.onAutoSaveNeeded.subscribe(null, () => {
                    console.log('💾 TradingView onAutoSaveNeeded 이벤트');
                    this.debouncedSave('auto_save_needed');
                });
                console.log('✅ onAutoSaveNeeded 이벤트 구독 완료');
            }

            // 2. 차트 준비 완료 후 추가 이벤트 구독
            this.widget.onChartReady(() => {
                console.log('📊 차트 준비 완료, 추가 이벤트 구독 시작');
                
                try {
                    const chart = this.widget.chart();
                    if (chart) {
                        // 심볼 변경 이벤트
                        if (typeof chart.onSymbolChanged === 'function') {
                            chart.onSymbolChanged().subscribe(null, () => {
                                console.log('🔄 심볼 변경됨');
                                this.debouncedSave('symbol_changed');
                            });
                        }
                        
                        // 간격 변경 이벤트
                        if (typeof chart.onIntervalChanged === 'function') {
                            chart.onIntervalChanged().subscribe(null, () => {
                                console.log('🔄 간격 변경됨');
                                this.debouncedSave('interval_changed');
                            });
                        }

                        console.log('✅ 차트 기본 이벤트 구독 완료');
                    }
                } catch (chartError) {
                    console.warn('⚠️ 차트 이벤트 구독 실패:', chartError.message);
                }

                // 3. 사용자 상호작용 기반 저장 트리거
                this.setupUserInteractionEvents();
            });

            // 4. 위젯 레벨 이벤트 구독
            this.setupWidgetEvents();
            
            console.log('✅ 모든 이벤트 구독 설정 완료');
            
        } catch (error) {
            console.error('❌ 이벤트 구독 실패:', error);
        }
    }

    /**
     * 사용자 상호작용 이벤트 설정
     */
    setupUserInteractionEvents() {
        try {
            // TradingView 공식 이벤트 구독 방식
            if (this.widget.subscribe) {
                // 드로잉/지표 추가 이벤트
                this.widget.subscribe('study_added', () => {
                    console.log('📈 지표 추가됨');
                    this.debouncedSave('study_added');
                });

                // 드로잉/지표 제거 이벤트  
                this.widget.subscribe('study_removed', () => {
                    console.log('📉 지표 제거됨');
                    this.debouncedSave('study_removed');
                });

                // 드로잉 도구 이벤트
                this.widget.subscribe('drawing_event', () => {
                    console.log('✏️ 드로잉 변경됨');
                    this.debouncedSave('drawing_changed');
                });
            }

            // 대체 방법: DOM 이벤트 기반 감지
            this.setupDOMBasedDetection();

            console.log('✅ 사용자 상호작용 이벤트 설정 완료');
        } catch (error) {
            console.warn('⚠️ 사용자 상호작용 이벤트 설정 실패:', error.message);
            // 대체 방법으로 DOM 기반 감지 시도
            this.setupDOMBasedDetection();
        }
    }

    /**
     * DOM 기반 변경 감지 (대체 방법)
     */
    setupDOMBasedDetection() {
        try {
            // MutationObserver로 차트 영역의 변화 감지
            const chartContainer = document.getElementById('chart-container') || 
                                 document.querySelector('.chart-container') ||
                                 document.querySelector('[id*="chart"]');

            if (chartContainer) {
                const observer = new MutationObserver((mutations) => {
                    const relevantChanges = mutations.some(mutation => {
                        // 차트 관련 변화만 감지 (오더북 등 분석 콘텐츠 제외)
                        if (mutation.type !== 'childList') return false;
                        
                        // 분석 콘텐츠의 변화는 무시
                        const target = mutation.target;
                        if (target.closest('.analysis-content') || 
                            target.closest('.orderbook-container') ||
                            target.closest('.whale-trades-container')) {
                            return false;
                        }
                        
                        // 차트 관련 변화만 허용
                        return (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) &&
                               target.closest('#tradingview_chart');
                    });

                    if (relevantChanges && this.isWidgetFullyReady()) {
                        console.log('🔍 차트 DOM 변화 감지, 저장 트리거');
                        this.debouncedSave('chart_dom_change');
                    }
                });

                observer.observe(chartContainer, {
                    childList: true,
                    subtree: true,
                    attributes: false
                });

                this.domObserver = observer;
                console.log('✅ DOM 기반 변경 감지 설정 완료');
            }
        } catch (error) {
            console.warn('⚠️ DOM 기반 감지 설정 실패:', error.message);
        }
    }

    /**
     * 위젯 레벨 이벤트 설정
     */
    setupWidgetEvents() {
        try {
            // 주기적 저장 (백업용)
            this.periodicSaveInterval = setInterval(() => {
                if (this.isWidgetFullyReady() && window.currentUser) {
                    console.log('🔄 주기적 백업 저장');
                    this.debouncedSave('periodic_backup');
                }
            }, 30000); // 30초마다

            // 포커스 상실 시 저장
            window.addEventListener('blur', () => {
                if (this.isWidgetFullyReady() && window.currentUser) {
                    console.log('👁️ 윈도우 포커스 상실, 저장 시도');
                    this.quickSave();
                }
            });

            // 페이지 가시성 변경 시 저장
            document.addEventListener('visibilitychange', () => {
                if (document.hidden && this.isWidgetFullyReady() && window.currentUser) {
                    console.log('👁️ 페이지 숨김, 저장 시도');
                    this.quickSave();
                }
            });

            console.log('✅ 위젯 레벨 이벤트 설정 완료');
        } catch (error) {
            console.warn('⚠️ 위젯 레벨 이벤트 설정 실패:', error.message);
        }
    }

    /**
     * 사용자 상호작용 이벤트 구독
     */
    subscribeToUserInteractions() {
        const chartContainer = document.getElementById('tradingview_chart');
        if (!chartContainer) return;

        // 마우스/터치 이벤트
        ['mouseup', 'touchend', 'click'].forEach(eventType => {
            chartContainer.addEventListener(eventType, () => {
                this.debouncedAutoSave();
            });
        });

        // 키보드 이벤트 (드로잉 도구)
        document.addEventListener('keyup', (e) => {
            if (['Delete', 'Backspace', 'Escape'].includes(e.key)) {
                this.debouncedAutoSave();
            }
        });

        console.log('✅ 사용자 상호작용 이벤트 구독 완료');
    }

    /**
     * 복원 스케줄링 (개선된 버전)
     */
    scheduleRestore() {
        // 즉시 첫 번째 복원 시도
        setTimeout(async () => {
            console.log('🔄 첫 번째 차트 복원 시도');
            await this.restoreChart();
        }, 500);
        
        // 백업 복원 시도
        setTimeout(async () => {
            if (!this.chartRestored) {
                console.log('🔄 백업 차트 복원 시도');
                await this.restoreChart();
            }
        }, this.RESTORE_RETRY_DELAY);
        
        // 최종 복원 시도
        setTimeout(async () => {
            if (!this.chartRestored) {
                console.log('🔄 최종 차트 복원 시도');
                await this.restoreChart();
            }
        }, this.RESTORE_RETRY_DELAY * 2);
    }

    /**
     * 주기적 백업 시작
     */
    startPeriodicBackup() {
        if (this.backupInterval) {
            clearInterval(this.backupInterval);
        }
        
        this.backupInterval = setInterval(() => {
            if (this.isWidgetFullyReady() && window.currentUser) {
                console.log('⏰ 주기적 백업 저장');
                this.debouncedAutoSave();
            }
        }, this.BACKUP_INTERVAL);
    }

    /**
     * 모든 인터벌과 이벤트 리스너 정리
     */
    cleanup() {
        try {
            // 인터벌 정리
            if (this.saveTimeout) {
                clearTimeout(this.saveTimeout);
                this.saveTimeout = null;
            }
            
            if (this.backupInterval) {
                clearInterval(this.backupInterval);
                this.backupInterval = null;
            }
            
            if (this.periodicSaveInterval) {
                clearInterval(this.periodicSaveInterval);
                this.periodicSaveInterval = null;
            }

            // DOM Observer 정리
            if (this.domObserver) {
                this.domObserver.disconnect();
                this.domObserver = null;
            }
            
            console.log('✅ ChartSaveManager 정리 완료');
        } catch (error) {
            console.error('❌ ChartSaveManager 정리 실패:', error);
        }
    }

    /**
     * 페이지 종료 시 저장 설정
     */
    setupBeforeUnload() {
        window.addEventListener('beforeunload', () => {
            if (this.isInitialized && this.widget) {
                try {
                    // 동기적으로 빠른 저장 시도
                    this.quickSave();
                } catch (error) {
                    console.error('❌ 페이지 종료 시 저장 실패:', error);
                }
            }
        });
    }

    /**
     * 빠른 저장 (동기적)
     */
    quickSave() {
        if (!this.isWidgetFullyReady() || !window.currentUser) return;

        try {
            this.widget.save((state) => {
                if (state && state.content) {
                    // localStorage에 임시 저장
                    localStorage.setItem('tempChartState', JSON.stringify({
                        content: state.content,
                        timestamp: Date.now(),
                        userId: window.currentUser.uid
                    }));
                    console.log('💾 임시 차트 상태 저장 완료');
                }
            });
        } catch (error) {
            console.error('❌ 빠른 저장 실패:', error);
        }
    }

    /**
     * 현재 심볼 가져오기
     */
    getCurrentSymbol() {
        try {
            return this.widget.activeChart()?.symbol() || 'BTCUSDT';
        } catch {
            return 'BTCUSDT';
        }
    }

    /**
     * 현재 간격 가져오기
     */
    getCurrentInterval() {
        try {
            return this.widget.activeChart()?.resolution() || '1h';
        } catch {
            return '1h';
        }
    }

    /**
     * 저장 알림 표시
     */
    showSaveNotification(isManual) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            background: #22c55e; color: white; padding: 8px 12px;
            border-radius: 6px; font-size: 12px; font-weight: 500;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            animation: slideInRight 0.3s ease-out;
        `;
        notification.innerHTML = `
            <i class="fas fa-save"></i> 
            ${isManual ? '수동 저장 완료' : '자동 저장됨'}
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease-out';
                setTimeout(() => {
                    notification.parentNode.removeChild(notification);
                }, 300);
            }
        }, 2000);
    }

    /**
     * 복원 알림 표시
     */
    showRestoreNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            background: #3b82f6; color: white; padding: 8px 12px;
            border-radius: 6px; font-size: 12px; font-weight: 500;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            animation: slideInRight 0.3s ease-out;
        `;
        notification.innerHTML = `
            <i class="fas fa-undo"></i> 
            ${message}
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease-out';
                setTimeout(() => {
                    notification.parentNode.removeChild(notification);
                }, 300);
            }
        }, 3000);
    }

    /**
     * 오류 알림 표시
     */
    showErrorNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            background: #ef4444; color: white; padding: 8px 12px;
            border-radius: 6px; font-size: 12px; font-weight: 500;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            animation: slideInRight 0.3s ease-out;
        `;
        notification.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i> 
            ${message}
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease-out';
                setTimeout(() => {
                    notification.parentNode.removeChild(notification);
                }, 300);
            }
        }, 3000);
    }

    /**
     * 차트 저장 목록 가져오기
     */
    async getSavedCharts() {
        if (!window.currentUser) return [];

        try {
            const snapshot = await window.db.collection(this.CHART_LAYOUTS_COLLECTION)
                .where('userId', '==', window.currentUser.uid)
                .orderBy('timestamp', 'desc')
                .limit(10)
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate()
            }));
        } catch (error) {
            console.error('❌ 저장된 차트 목록 가져오기 실패:', error);
            return [];
        }
    }

    /**
     * 저장된 차트 삭제
     */
    async deleteSavedChart(chartId) {
        if (!window.currentUser) return false;

        try {
            await window.db.collection(this.CHART_LAYOUTS_COLLECTION).doc(chartId).delete();
            console.log('✅ 차트 삭제 완료:', chartId);
            return true;
        } catch (error) {
            console.error('❌ 차트 삭제 실패:', error);
            return false;
        }
    }
}

// 전역 인스턴스 생성
window.chartSaveManager = new ChartSaveManager();

// CSS 애니메이션 추가
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

console.log('✅ ChartSaveManager 모듈 로드 완료'); 