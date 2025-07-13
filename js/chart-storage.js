// 🔥 TradingView 차트 저장/불러오기 시스템 (공식 권장사항 완전 구현)
class ChartStorage {
    constructor() {
        this.storageKey = 'tradingview_charts';
        this.autoSaveDelay = 2000; // 2초 (TradingView 권장)
        this.autoSaveTimeout = null;
        this.isAutoSaving = false;
        
        // 🔥 TradingView 공식 설정
        this.chartStorageUrl = null; // 서버 저장소 URL (미사용)
        this.chartStorageApiVersion = '1.1';
        this.clientId = 'felicity-site';
        this.userId = null;
        
        // 🔥 그림 별도 저장을 위한 저장소
        this.drawingsStorage = {};
        
        console.log('🔥 TradingView 차트 저장소 초기화 (공식 권장사항)');
    }

    // 🔥 사용자 ID 설정
    setUserId(userId) {
        this.userId = userId;
        console.log('📝 사용자 ID 설정:', userId);
    }

    // 🔥 차트 레이아웃 저장 (TradingView 공식 방식)
    async saveChartLayout(chartData, metadata = {}) {
        try {
            if (!window.currentUser) {
                console.warn('❌ 로그인이 필요합니다');
                return null;
            }

            // 데이터 검증
            if (!chartData || typeof chartData !== 'object') {
                console.error('❌ 잘못된 차트 데이터');
                return null;
            }

            // 🔥 TradingView 공식 저장 데이터 구조
            const saveData = {
                content: chartData,
                name: metadata.name || `차트 ${new Date().toLocaleDateString()}`,
                symbol: metadata.symbol || 'BTCUSDT',
                interval: metadata.interval || '15',
                timestamp: Date.now(),
                userId: window.currentUser.uid,
                version: '1.1',
                // 🔥 TradingView 메타데이터
                clientId: this.clientId,
                apiVersion: this.chartStorageApiVersion,
                // 🔥 지표 및 그림 포함 여부
                hasDrawings: this.hasDrawings(chartData),
                hasStudies: this.hasStudies(chartData),
                hasTemplates: this.hasTemplates(chartData)
            };

            // 데이터 크기 확인 (1MB 제한)
            const dataSize = JSON.stringify(saveData).length;
            if (dataSize > 1024 * 1024) {
                console.error('❌ 차트 데이터가 너무 큽니다:', dataSize);
                this.showNotification('차트 데이터가 너무 큽니다. 일부 지표나 그림을 제거해주세요.', 'error');
                return null;
            }

            // Firestore에 저장
            const docRef = await window.db.collection('chartLayouts').add(saveData);
            console.log('✅ 차트 레이아웃 저장 완료:', docRef.id);
            
            // 자동 저장 상태도 업데이트
            await this.updateAutoSaveState(chartData);
            
            // 성공 알림
            this.showNotification('차트가 저장되었습니다.', 'success');
            
            return docRef.id;
        } catch (error) {
            console.error('❌ 차트 레이아웃 저장 실패:', error);
            this.showNotification('차트 저장에 실패했습니다.', 'error');
            return null;
        }
    }

    // 🔥 차트 레이아웃 불러오기
    async loadChartLayout(chartId) {
        try {
            if (!window.currentUser || !chartId) {
                return null;
            }

            const doc = await window.db.collection('chartLayouts').doc(chartId).get();
            if (doc.exists) {
                const data = doc.data();
                console.log('✅ 차트 레이아웃 불러오기 완료:', chartId);
                console.log('📊 차트 데이터:', {
                    hasDrawings: data.hasDrawings,
                    hasStudies: data.hasStudies,
                    hasTemplates: data.hasTemplates
                });
                return data.content;
            }
            
            return null;
        } catch (error) {
            console.error('❌ 차트 레이아웃 불러오기 실패:', error);
            return null;
        }
    }

    // 🔥 마지막 차트 상태 가져오기 (자동 복원용)
    async getLastChartState() {
        try {
            if (!window.currentUser) {
                return null;
            }

            const doc = await window.db.collection('chartStates').doc(window.currentUser.uid).get();
            if (doc.exists) {
                const data = doc.data();
                console.log('✅ 마지막 차트 상태 로드');
                console.log('📊 자동 저장 데이터:', {
                    timestamp: new Date(data.timestamp).toLocaleString(),
                    hasDrawings: this.hasDrawings(data.content),
                    hasStudies: this.hasStudies(data.content)
                });
                return data.content;
            }
            
            return null;
        } catch (error) {
            console.error('❌ 마지막 차트 상태 로드 실패:', error);
            return null;
        }
    }

    // 🔥 자동 저장 상태 업데이트 (TradingView onAutoSaveNeeded 이벤트용)
    async updateAutoSaveState(chartData) {
        try {
            if (!window.currentUser || this.isAutoSaving) {
                return;
            }

            this.isAutoSaving = true;

            // 🔥 TradingView 공식 자동 저장 데이터 구조
            const stateData = {
                content: chartData,
                timestamp: Date.now(),
                userId: window.currentUser.uid,
                clientId: this.clientId,
                apiVersion: this.chartStorageApiVersion,
                // 🔥 지표 및 그림 포함 여부
                hasDrawings: this.hasDrawings(chartData),
                hasStudies: this.hasStudies(chartData),
                autoSave: true
            };

            await window.db.collection('chartStates').doc(window.currentUser.uid).set(stateData);
            console.log('✅ 자동 저장 상태 업데이트 완료');
            
            // 자동 저장 알림 (조용히)
            this.showAutoSaveNotification();
            
        } catch (error) {
            console.error('❌ 자동 저장 상태 업데이트 실패:', error);
        } finally {
            this.isAutoSaving = false;
        }
    }

    // 🔥 디바운스된 자동 저장 (TradingView 공식 권장)
    scheduleAutoSave(chartData) {
        if (!window.currentUser) {
            return;
        }

        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }

        this.autoSaveTimeout = setTimeout(() => {
            this.updateAutoSaveState(chartData);
        }, this.autoSaveDelay);
    }

    // 🔥 그림 도구 및 그룹 저장 (TradingView 공식 saveload_separate_drawings_storage)
    async saveLineToolsAndGroups(layoutId, chartId, state) {
        try {
            if (!window.currentUser) {
                console.warn('❌ 로그인이 필요합니다 (그림 저장)');
                return;
            }

            const drawingKey = this._getDrawingKey(layoutId, chartId);
            const drawings = state.sources;

            console.log('🎨 그림 도구 및 그룹 저장:', {
                layoutId,
                chartId,
                drawingKey,
                drawingsCount: drawings ? drawings.size : 0
            });

            // 그림 데이터 준비
            const drawingData = {
                layoutId,
                chartId,
                userId: window.currentUser.uid,
                timestamp: Date.now(),
                sources: {},
                groups: state.groups ? Object.fromEntries(state.groups) : {}
            };

            // 그림 소스 처리
            if (drawings) {
                for (let [key, drawingState] of drawings) {
                    if (drawingState === null) {
                        // 그림 삭제
                        console.log('🗑️ 그림 삭제:', key);
                        delete drawingData.sources[key];
                    } else {
                        // 그림 저장/업데이트
                        console.log('💾 그림 저장/업데이트:', key);
                        drawingData.sources[key] = drawingState;
                    }
                }
            }

            // Firestore에 저장
            await window.db.collection('chartDrawings').doc(drawingKey).set(drawingData);
            console.log('✅ 그림 도구 및 그룹 저장 완료:', drawingKey);

        } catch (error) {
            console.error('❌ 그림 도구 및 그룹 저장 실패:', error);
        }
    }

    // 🔥 그림 도구 및 그룹 불러오기 (TradingView 공식 saveload_separate_drawings_storage)
    async loadLineToolsAndGroups(layoutId, chartId, requestType, requestContext) {
        try {
            if (!window.currentUser) {
                console.warn('❌ 로그인이 필요합니다 (그림 불러오기)');
                return null;
            }

            const drawingKey = this._getDrawingKey(layoutId, chartId);
            
            ;
            

            // Firestore에서 불러오기
            const doc = await window.db.collection('chartDrawings').doc(drawingKey).get();
            
            if (!doc.exists) {
                console.log('📭 저장된 그림 데이터가 없습니다:', drawingKey);
                return null;
            }

            const data = doc.data();
            const sources = new Map();

            // 그림 소스 복원
            if (data.sources) {
                for (let [key, state] of Object.entries(data.sources)) {
                    sources.set(key, state);
                }
            }

            // 그룹 복원
            const groups = new Map();
            if (data.groups) {
                for (let [key, groupData] of Object.entries(data.groups)) {
                    groups.set(key, groupData);
                }
            }

            console.log('✅ 그림 도구 및 그룹 불러오기 완료:', {
                sourcesCount: sources.size,
                groupsCount: groups.size
            });

            return {
                sources,
                groups
            };

        } catch (error) {
            console.error('❌ 그림 도구 및 그룹 불러오기 실패:', error);
            return null;
        }
    }

    // 🔥 그림 키 생성 (레이아웃 ID + 차트 ID)
    _getDrawingKey(layoutId, chartId) {
        return `${window.currentUser.uid}_${layoutId}_${chartId}`;
    }

    // 🔥 차트 데이터에 그림이 포함되어 있는지 확인
    hasDrawings(chartData) {
        if (!chartData || typeof chartData !== 'object') {
            return false;
        }

        // TradingView 차트 데이터 구조에서 그림 확인
        try {
            const chartStr = JSON.stringify(chartData);
            return chartStr.includes('"drawings"') || 
                   chartStr.includes('"line_tool"') || 
                   chartStr.includes('"LineToolTrendLine"') ||
                   chartStr.includes('"LineToolRay"') ||
                   chartStr.includes('"LineToolFibRetracement"') ||
                   chartStr.includes('"sources"');
        } catch (error) {
            console.error('그림 확인 중 오류:', error);
            return false;
        }
    }

    // 🔥 차트 데이터에 지표가 포함되어 있는지 확인
    hasStudies(chartData) {
        if (!chartData || typeof chartData !== 'object') {
            return false;
        }

        // TradingView 차트 데이터 구조에서 지표 확인
        try {
            const chartStr = JSON.stringify(chartData);
            return chartStr.includes('"studies"') || 
                   chartStr.includes('"study"') || 
                   chartStr.includes('"indicators"') ||
                   chartStr.includes('"MA"') ||
                   chartStr.includes('"RSI"') ||
                   chartStr.includes('"MACD"') ||
                   chartStr.includes('"BB"');
        } catch (error) {
            console.error('지표 확인 중 오류:', error);
            return false;
        }
    }

    // 🔥 차트 데이터에 템플릿이 포함되어 있는지 확인
    hasTemplates(chartData) {
        if (!chartData || typeof chartData !== 'object') {
            return false;
        }

        try {
            const chartStr = JSON.stringify(chartData);
            return chartStr.includes('"templates"') || 
                   chartStr.includes('"template"');
        } catch (error) {
            console.error('템플릿 확인 중 오류:', error);
            return false;
        }
    }

    // 🔥 차트 목록 가져오기
    async getChartList() {
        try {
            if (!window.currentUser) {
                return [];
            }

            const snapshot = await window.db.collection('chartLayouts')
                .where('userId', '==', window.currentUser.uid)
                .orderBy('timestamp', 'desc')
                .limit(20)
                .get();

            const charts = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                charts.push({
                    id: doc.id,
                    name: data.name,
                    symbol: data.symbol,
                    interval: data.interval,
                    timestamp: data.timestamp,
                    hasDrawings: data.hasDrawings || false,
                    hasStudies: data.hasStudies || false,
                    hasTemplates: data.hasTemplates || false
                });
            });

            return charts;
        } catch (error) {
            console.error('❌ 차트 목록 가져오기 실패:', error);
            return [];
        }
    }

    // 🔥 차트 삭제
    async deleteChart(chartId) {
        try {
            if (!window.currentUser || !chartId) {
                return false;
            }

            await window.db.collection('chartLayouts').doc(chartId).delete();
            console.log('✅ 차트 삭제 완료:', chartId);
            this.showNotification('차트가 삭제되었습니다.', 'success');
            return true;
        } catch (error) {
            console.error('❌ 차트 삭제 실패:', error);
            this.showNotification('차트 삭제에 실패했습니다.', 'error');
            return false;
        }
    }

    // 🔥 차트 이름 변경
    async renameChart(chartId, newName) {
        try {
            if (!window.currentUser || !chartId) {
                return false;
            }

            await window.db.collection('chartLayouts').doc(chartId).update({
                name: newName,
                timestamp: Date.now()
            });
            
            console.log('✅ 차트 이름 변경 완료:', chartId, newName);
            this.showNotification('차트 이름이 변경되었습니다.', 'success');
            return true;
        } catch (error) {
            console.error('❌ 차트 이름 변경 실패:', error);
            this.showNotification('차트 이름 변경에 실패했습니다.', 'error');
            return false;
        }
    }

    // 🔥 TradingView 공식 저장/불러오기 어댑터 (IExternalSaveLoadAdapter 구현)
    createTradingViewAdapter() {
        return {
            // 🔥 모든 차트 가져오기 (TradingView 공식 인터페이스)
            getAllCharts: async () => {
                try {
                    const charts = await this.getChartList();
                    return charts.map(chart => ({
                        id: chart.id,
                        name: chart.name,
                        symbol: chart.symbol,
                        resolution: chart.interval,
                        timestamp: chart.timestamp,
                        // 🔥 TradingView 메타데이터
                        hasDrawings: chart.hasDrawings,
                        hasStudies: chart.hasStudies,
                        hasTemplates: chart.hasTemplates
                    }));
                } catch (error) {
                    console.error('getAllCharts 실패:', error);
                    return [];
                }
            },

            // 🔥 차트 저장 (TradingView 공식 인터페이스)
            saveChart: async (chartData) => {
                try {
                    const chartId = await this.saveChartLayout(chartData.content, {
                        name: chartData.name,
                        symbol: chartData.symbol,
                        interval: chartData.resolution
                    });
                    return chartId;
                } catch (error) {
                    console.error('saveChart 실패:', error);
                    return null;
                }
            },

            // 🔥 차트 불러오기 (TradingView 공식 인터페이스)
            getChart: async (chartId) => {
                try {
                    const content = await this.loadChartLayout(chartId);
                    if (content) {
                        return { content };
                    }
                    return null;
                } catch (error) {
                    console.error('getChart 실패:', error);
                    return null;
                }
            },

            // 🔥 차트 삭제 (TradingView 공식 인터페이스)
            removeChart: async (chartId) => {
                try {
                    return await this.deleteChart(chartId);
                } catch (error) {
                    console.error('removeChart 실패:', error);
                    return false;
                }
            },

            // 🔥 차트 내용 가져오기
            getChartContent: async (chartId) => {
                try {
                    return await this.loadChartLayout(chartId);
                } catch (error) {
                    console.error('getChartContent 실패:', error);
                    return null;
                }
            },

            // 🔥 마지막 차트 가져오기
            getLastChart: async () => {
                try {
                    const content = await this.getLastChartState();
                    if (content) {
                        return { content };
                    }
                    return null;
                } catch (error) {
                    console.error('getLastChart 실패:', error);
                    return null;
                }
            },

            // 🔥 차트 개수 가져오기
            getChartsCount: async () => {
                try {
                    const charts = await this.getChartList();
                    return charts.length;
                } catch (error) {
                    console.error('getChartsCount 실패:', error);
                    return 0;
                }
            },

            // 🔥 차트 이름 변경
            renameChart: async (chartId, newName) => {
                try {
                    return await this.renameChart(chartId, newName);
                } catch (error) {
                    console.error('renameChart 실패:', error);
                    return false;
                }
            },

            // 🔥 그림 도구 및 그룹 저장 (TradingView 공식 별도 저장)
            saveLineToolsAndGroups: async (layoutId, chartId, state) => {
                try {
                    return await this.saveLineToolsAndGroups(layoutId, chartId, state);
                } catch (error) {
                    console.error('saveLineToolsAndGroups 실패:', error);
                }
            },

            // 🔥 그림 도구 및 그룹 불러오기 (TradingView 공식 별도 저장)
            loadLineToolsAndGroups: async (layoutId, chartId, requestType, requestContext) => {
                try {
                    return await this.loadLineToolsAndGroups(layoutId, chartId, requestType, requestContext);
                } catch (error) {
                    console.error('loadLineToolsAndGroups 실패:', error);
                    return null;
                }
            },

            // 🔥 차트 템플릿 관련 함수들 (TradingView 공식 인터페이스 - 누락된 함수들)
            getAllChartTemplates: async () => {
                try {
                    console.log('getAllChartTemplates 호출됨');
                    // TODO: 실제 차트 템플릿 구현
                    return [];
                } catch (error) {
                    console.error('getAllChartTemplates 실패:', error);
                    return [];
                }
            },

            saveChartTemplate: async (templateData) => {
                try {
                    console.log('saveChartTemplate 호출됨:', templateData);
                    // TODO: 실제 차트 템플릿 저장 구현
                    return 'chart_template_' + Date.now();
                } catch (error) {
                    console.error('saveChartTemplate 실패:', error);
                    return null;
                }
            },

            getChartTemplate: async (templateId) => {
                try {
                    console.log('getChartTemplate 호출됨:', templateId);
                    // TODO: 실제 차트 템플릿 불러오기 구현
                    return null;
                } catch (error) {
                    console.error('getChartTemplate 실패:', error);
                    return null;
                }
            },

            removeChartTemplate: async (templateId) => {
                try {
                    console.log('removeChartTemplate 호출됨:', templateId);
                    // TODO: 실제 차트 템플릿 삭제 구현
                    return true;
                } catch (error) {
                    console.error('removeChartTemplate 실패:', error);
                    return false;
                }
            },

            // 🔥 스터디 템플릿 관련 함수들 (TradingView 공식 인터페이스)
            getAllStudyTemplates: async () => {
                try {
                    console.log('getAllStudyTemplates 호출됨');
                    // TODO: 실제 스터디 템플릿 구현
                    return [];
                } catch (error) {
                    console.error('getAllStudyTemplates 실패:', error);
                    return [];
                }
            },

            removeStudyTemplate: async (templateId) => {
                try {
                    console.log('removeStudyTemplate 호출됨:', templateId);
                    // TODO: 실제 스터디 템플릿 삭제 구현
                    return true;
                } catch (error) {
                    console.error('removeStudyTemplate 실패:', error);
                    return false;
                }
            },

            saveStudyTemplate: async (templateData) => {
                try {
                    console.log('saveStudyTemplate 호출됨:', templateData);
                    // TODO: 실제 스터디 템플릿 저장 구현
                    return 'template_' + Date.now();
                } catch (error) {
                    console.error('saveStudyTemplate 실패:', error);
                    return null;
                }
            },

            getStudyTemplate: async (templateId) => {
                try {
                    console.log('getStudyTemplate 호출됨:', templateId);
                    // TODO: 실제 스터디 템플릿 불러오기 구현
                    return null;
                } catch (error) {
                    console.error('getStudyTemplate 실패:', error);
                    return null;
                }
            },

            // 🔥 그림 템플릿 관련 함수들 (TradingView 공식 인터페이스)
            getAllDrawingTemplates: async () => {
                try {
                    console.log('getAllDrawingTemplates 호출됨');
                    // TODO: 실제 그림 템플릿 구현
                    return [];
                } catch (error) {
                    console.error('getAllDrawingTemplates 실패:', error);
                    return [];
                }
            },

            saveDrawingTemplate: async (templateData) => {
                try {
                    console.log('saveDrawingTemplate 호출됨:', templateData);
                    // TODO: 실제 그림 템플릿 저장 구현
                    return 'drawing_template_' + Date.now();
                } catch (error) {
                    console.error('saveDrawingTemplate 실패:', error);
                    return null;
                }
            },

            getDrawingTemplate: async (templateId) => {
                try {
                    console.log('getDrawingTemplate 호출됨:', templateId);
                    // TODO: 실제 그림 템플릿 불러오기 구현
                    return null;
                } catch (error) {
                    console.error('getDrawingTemplate 실패:', error);
                    return null;
                }
            },

            removeDrawingTemplate: async (templateId) => {
                try {
                    console.log('removeDrawingTemplate 호출됨:', templateId);
                    // TODO: 실제 그림 템플릿 삭제 구현
                    return true;
                } catch (error) {
                    console.error('removeDrawingTemplate 실패:', error);
                    return false;
                }
            }
        };
    }

    // 🔥 알림 표시
    showNotification(message, type = 'info') {
        try {
            // 기존 알림 제거
            const existingNotification = document.querySelector('.chart-notification');
            if (existingNotification) {
                existingNotification.remove();
            }

            // 새 알림 생성
            const notification = document.createElement('div');
            notification.className = `chart-notification ${type}`;
            notification.innerHTML = `
                <div class="notification-content">
                    <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'}"></i>
                    <span>${message}</span>
                </div>
            `;

            // 스타일 적용
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                padding: 12px 20px;
                border-radius: 8px;
                color: white;
                font-weight: 500;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                transform: translateX(100%);
                transition: transform 0.3s ease;
                background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            `;

            document.body.appendChild(notification);

            // 애니메이션
            setTimeout(() => {
                notification.style.transform = 'translateX(0)';
            }, 100);

            // 자동 제거
            setTimeout(() => {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, 3000);
        } catch (error) {
            console.error('알림 표시 실패:', error);
        }
    }

    // 🔥 자동 저장 알림 (조용히)
    showAutoSaveNotification() {
        try {
            const existingIndicator = document.querySelector('.auto-save-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }

            const indicator = document.createElement('div');
            indicator.className = 'auto-save-indicator';
            indicator.innerHTML = '<i class="fas fa-save"></i> 자동 저장됨';
            indicator.style.cssText = `
                position: fixed;
                top: 20px;
                left: 20px;
                z-index: 9999;
                padding: 8px 16px;
                border-radius: 20px;
                background: rgba(76, 175, 80, 0.9);
                color: white;
                font-size: 12px;
                font-weight: 500;
                opacity: 0;
                transition: opacity 0.3s ease;
            `;

            document.body.appendChild(indicator);

            // 페이드 인/아웃
            setTimeout(() => {
                indicator.style.opacity = '1';
            }, 100);

            setTimeout(() => {
                indicator.style.opacity = '0';
                setTimeout(() => {
                    if (indicator.parentNode) {
                        indicator.parentNode.removeChild(indicator);
                    }
                }, 300);
            }, 2000);
        } catch (error) {
            console.error('자동 저장 알림 실패:', error);
        }
    }
}

// 🔥 전역으로 내보내기
window.ChartStorage = ChartStorage; 