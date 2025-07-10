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
        
        // 설정값
        this.SAVE_COOLDOWN = 3000; // 3초 쿨다운
        this.DEBOUNCE_DELAY = 2000; // 2초 디바운스
        this.BACKUP_INTERVAL = 60000; // 1분 백업 간격
        this.RESTORE_RETRY_DELAY = 3000; // 3초 후 복원 재시도
        
        // 컬렉션 이름
        this.CHART_STATES_COLLECTION = 'chartStates';
        this.CHART_LAYOUTS_COLLECTION = 'chartLayouts';
        
        console.log('📊 ChartSaveManager 초기화됨');
    }

    /**
     * 위젯 초기화 및 이벤트 구독
     */
    initialize(widget) {
        if (this.isInitialized) {
            console.warn('⚠️ ChartSaveManager가 이미 초기화됨');
            return;
        }

        this.widget = widget;
        this.isInitialized = true;
        
        console.log('🔄 ChartSaveManager 초기화 시작...');
        
        // 이벤트 구독
        this.subscribeToEvents();
        
        // 복원 시도
        this.scheduleRestore();
        
        // 주기적 백업 시작
        this.startPeriodicBackup();
        
        // 페이지 종료 시 저장
        this.setupPageExitHandlers();
        
        console.log('✅ ChartSaveManager 초기화 완료');
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
        if (!window.currentUser) {
            console.log('❌ 사용자 미로그인 - 차트 복원 건너뜀');
            return false;
        }

        if (this.chartRestored) {
            console.log('ℹ️ 차트가 이미 복원됨');
            return true;
        }

        try {
            const userId = window.currentUser.uid;
            console.log('🔄 차트 복원 시작...', userId);

            // 1단계: 자동 저장된 차트 확인
            const autoSavedChart = await this.loadAutoSavedChart(userId);
            if (autoSavedChart) {
                return true;
            }

            // 2단계: 수동 저장된 차트 확인
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
                        this.widget.load(layoutData);
                        this.chartRestored = true;
                        this.showRestoreNotification('자동 저장된 차트가 복원되었습니다');
                        console.log('✅ 자동 저장 차트 복원 완료');
                        return true;
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
                const latestDoc = layoutSnapshot.docs[0];
                const data = latestDoc.data();
                
                if (data.content) {
                    const layoutData = this.parseLayoutData(data.content);
                    if (layoutData) {
                        this.widget.load(layoutData);
                        this.chartRestored = true;
                        this.showRestoreNotification('수동 저장된 차트가 복원되었습니다');
                        console.log('✅ 수동 저장 차트 복원 완료');
                        return true;
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
     * 이벤트 구독
     */
    subscribeToEvents() {
        try {
            // TradingView 공식 이벤트
            if (this.widget.onAutoSaveNeeded) {
                this.widget.onAutoSaveNeeded.subscribe(null, () => {
                    console.log('📊 TradingView onAutoSaveNeeded 이벤트');
                    this.debouncedAutoSave();
                });
                console.log('✅ onAutoSaveNeeded 이벤트 구독 완료');
            }

            // 차트 변경 이벤트
            const chart = this.widget.activeChart();
            if (chart) {
                chart.onSymbolChanged().subscribe(null, () => {
                    console.log('📊 심볼 변경');
                    this.debouncedAutoSave();
                });
                
                chart.onIntervalChanged().subscribe(null, () => {
                    console.log('📊 간격 변경');
                    this.debouncedAutoSave();
                });
            }

            // 사용자 상호작용 이벤트
            this.subscribeToUserInteractions();

            console.log('✅ 차트 이벤트 구독 완료');
        } catch (error) {
            console.error('❌ 차트 이벤트 구독 실패:', error);
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
     * 복원 스케줄링
     */
    scheduleRestore() {
        // 즉시 복원 시도
        setTimeout(() => this.restoreChart(), 100);
        
        // 백업 복원 시도
        setTimeout(() => {
            if (!this.chartRestored) {
                console.log('🔄 백업 차트 복원 시도');
                this.restoreChart();
            }
        }, this.RESTORE_RETRY_DELAY);
    }

    /**
     * 주기적 백업 시작
     */
    startPeriodicBackup() {
        setInterval(() => {
            if (window.currentUser && this.widget) {
                console.log('⏰ 주기적 백업 저장');
                this.debouncedAutoSave();
            }
        }, this.BACKUP_INTERVAL);
    }

    /**
     * 페이지 종료 시 저장 설정
     */
    setupPageExitHandlers() {
        const handlePageExit = () => {
            if (window.currentUser && this.widget) {
                this.widget.save((layoutData) => {
                    if (layoutData) {
                        try {
                            const serializedData = JSON.stringify(layoutData);
                            
                            // 즉시 저장 (동기)
                            window.db.collection(this.CHART_STATES_COLLECTION)
                                .doc(window.currentUser.uid)
                                .set({
                                    content: serializedData,
                                    timestamp: new Date(),
                                    updatedAt: Date.now(),
                                    userId: window.currentUser.uid,
                                    symbol: this.getCurrentSymbol(),
                                    interval: this.getCurrentInterval()
                                });
                            console.log('🚪 페이지 종료 시 차트 저장 완료');
                        } catch (error) {
                            console.error('❌ 페이지 종료 시 저장 실패:', error);
                        }
                    }
                });
            }
        };

        window.addEventListener('beforeunload', handlePageExit);
        window.addEventListener('pagehide', handlePageExit);
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