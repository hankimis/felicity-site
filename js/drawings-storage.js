// 🔥 Drawings Storage - TradingView 공식 그림 도구 별도 저장 시스템
// Firebase 기반 그림 도구 관리 (심볼별 저장 지원)

class DrawingsStorage {
    constructor() {
        this.userId = null;
        this.drawings = {}; // 심볼별 그림 저장: { symbol: { drawingId: state } }
        this.drawingSourceSymbols = {}; // 그림 ID와 심볼 매핑
        this.initialized = false;
        this.saveTimeout = null;
        this.SAVE_DELAY = 2000; // 2초 디바운스
        
        console.log('🔥 Drawings Storage 초기화');
    }

    // 🔥 사용자 ID 설정
    async setUserId(userId) {
        this.userId = userId;
        console.log('👤 Drawings Storage 사용자 ID 설정:', userId);
        
        if (userId) {
            try {
                await this.loadUserDrawings();
            } catch (error) {
                console.error('Drawings 로딩 실패:', error);
                // 빈 상태로 초기화
                this.drawings = {};
                this.drawingSourceSymbols = {};
                this.initialized = true;
            }
        } else {
            // 사용자 데이터 정리
            this.drawings = {};
            this.drawingSourceSymbols = {};
            this.initialized = true;
        }
    }

    // 🔥 Firebase에서 사용자 그림 로드
    async loadUserDrawings() {
        if (!this.userId) {
            console.warn('⚠️ 사용자 ID가 없습니다');
            this.drawings = {};
            this.drawingSourceSymbols = {};
            this.initialized = true;
            return;
        }
        
        if (!window.db) {
            console.warn('⚠️ Firebase DB가 없습니다 - 빈 그림 저장소 사용');
            this.drawings = {};
            this.drawingSourceSymbols = {};
            this.initialized = true;
            return;
        }

        try {
            const docRef = window.db.collection('userDrawings').doc(this.userId);
            const doc = await docRef.get();
            
            if (doc.exists) {
                const data = doc.data();
                this.drawings = data.drawings || {};
                this.drawingSourceSymbols = data.drawingSourceSymbols || {};
                console.log('✅ 사용자 그림 로드 완료:', Object.keys(this.drawings).length, '개 심볼');
            } else {
                console.log('📝 새 사용자 - 빈 그림 저장소 초기화');
                this.drawings = {};
                this.drawingSourceSymbols = {};
            }
            
            this.initialized = true;
        } catch (error) {
            console.error('❌ 사용자 그림 로드 실패:', error);
            this.drawings = {};
            this.drawingSourceSymbols = {};
            this.initialized = true;
        }
    }

    // 🔥 Firebase에 사용자 그림 저장
    async saveUserDrawings() {
        if (!this.userId || !window.db) {
            console.warn('⚠️ 사용자 ID 또는 Firebase DB가 없습니다');
            return;
        }

        try {
            const docRef = window.db.collection('userDrawings').doc(this.userId);
            await docRef.set({
                drawings: this.drawings,
                drawingSourceSymbols: this.drawingSourceSymbols,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            console.log('💾 사용자 그림 저장 완료');
        } catch (error) {
            console.error('❌ 사용자 그림 저장 실패:', error);
        }
    }

    // 🔥 TradingView Save Load Adapter 인터페이스 구현
    createTradingViewAdapter() {
        return {
            // 🔥 그림 도구 및 그룹 저장
            saveLineToolsAndGroups: async (layoutId, chartId, state) => {
                return this.saveLineToolsAndGroups(layoutId, chartId, state);
            },
            
            // 🔥 그림 도구 및 그룹 로드
            loadLineToolsAndGroups: async (layoutId, chartId, requestType, requestContext) => {
                return this.loadLineToolsAndGroups(layoutId, chartId, requestType, requestContext);
            }
        };
    }

    // 🔥 그림 도구 및 그룹 저장 (TradingView 공식 메서드)
    async saveLineToolsAndGroups(layoutId, chartId, state) {
        if (!this.initialized) {
            console.warn('⚠️ Drawings Storage가 초기화되지 않았습니다. 사용자 ID:', this.userId);
            // 초기화되지 않았어도 메모리에는 저장
            if (!state || !state.sources) {
                return;
            }
            
            // 메모리 저장 로직
            for (let [drawingId, drawingState] of state.sources) {
                if (drawingState.state === 'removed') {
                    // 그림 삭제
                    const symbol = drawingState.symbol || this.drawingSourceSymbols[drawingId];
                    if (symbol && this.drawings[symbol]) {
                        delete this.drawings[symbol][drawingId];
                        delete this.drawingSourceSymbols[drawingId];
                        
                        if (Object.keys(this.drawings[symbol]).length === 0) {
                            delete this.drawings[symbol];
                        }
                    }
                } else {
                    // 그림 저장/업데이트
                    const symbol = drawingState.symbol || this.drawingSourceSymbols[drawingId];
                    
                    if (symbol) {
                        if (!this.drawings[symbol]) {
                            this.drawings[symbol] = {};
                        }
                        
                        this.drawings[symbol][drawingId] = drawingState;
                        this.drawingSourceSymbols[drawingId] = symbol;
                    }
                }
            }
            return;
        }

        console.log('🎨 그림 도구 저장 시작:', { layoutId, chartId, drawingsCount: state.sources?.size || 0 });

        try {
            const drawings = state.sources;
            if (!drawings) {
                console.warn('⚠️ 저장할 그림 데이터가 없습니다');
                return;
            }

            // 각 그림에 대해 심볼별로 저장
            for (let [drawingId, drawingState] of drawings) {
                const symbolCheckKey = `${layoutId}/${chartId}/${drawingId}`;
                
                if (drawingState === null) {
                    // 그림 삭제
                    const symbol = this.drawingSourceSymbols[symbolCheckKey];
                    if (symbol && this.drawings[symbol]) {
                        delete this.drawings[symbol][drawingId];
                        delete this.drawingSourceSymbols[symbolCheckKey];
                        console.log(`🗑️ 그림 삭제: ${drawingId} (심볼: ${symbol})`);
                        
                        // 심볼에 더 이상 그림이 없으면 심볼 자체 삭제
                        if (Object.keys(this.drawings[symbol]).length === 0) {
                            delete this.drawings[symbol];
                        }
                    }
                } else {
                    // 그림 저장/업데이트
                    const symbol = drawingState.symbol || this.drawingSourceSymbols[symbolCheckKey];
                    
                    if (symbol) {
                        if (!this.drawings[symbol]) {
                            this.drawings[symbol] = {};
                        }
                        
                        this.drawings[symbol][drawingId] = drawingState;
                        this.drawingSourceSymbols[symbolCheckKey] = symbol;
                        console.log(`💾 그림 저장: ${drawingId} (심볼: ${symbol})`);
                    } else {
                        console.warn(`⚠️ 그림 ${drawingId}의 심볼을 찾을 수 없습니다`);
                    }
                }
            }

            // 그룹 처리 (있는 경우)
            if (state.groups) {
                console.log('📁 그룹 처리:', state.groups.size, '개 그룹');
                // 그룹 처리 로직은 필요에 따라 구현
            }

            // 저장 스케줄링
            this.scheduleSave();
            
        } catch (error) {
            console.error('❌ 그림 도구 저장 실패:', error);
        }
    }

    // 🔥 그림 도구 및 그룹 로드 (TradingView 공식 메서드)
    async loadLineToolsAndGroups(layoutId, chartId, requestType, requestContext) {
        if (!this.initialized) {
            console.warn('⚠️ Drawings Storage가 초기화되지 않았습니다. 사용자 ID:', this.userId);
            // 초기화되지 않았어도 메모리에서 로드 시도
            const symbol = requestContext?.symbol || 'BINANCE:BTCUSDT'; // 기본 심볼 설정
            if (!symbol || !this.drawings[symbol]) {
                return {
                    sources: new Map(),
                    groups: new Map()
                };
            }
            
            const sources = new Map();
            for (let [drawingId, drawingState] of Object.entries(this.drawings[symbol])) {
                sources.set(drawingId, drawingState);
            }
            
            return {
                sources,
                groups: new Map()
            };
        }

        console.log('🎨 그림 도구 로드 시작:', { layoutId, chartId, requestType, symbol: requestContext?.symbol });

        try {
            // 심볼 기반 로드 (TradingView 공식 권장)
            const symbol = requestContext?.symbol || 'BINANCE:BTCUSDT'; // 기본 심볼 설정
            if (!symbol) {
                console.warn('⚠️ 로드할 심볼이 지정되지 않았습니다 - 기본 심볼 사용');
                return {
                    sources: new Map(),
                    groups: new Map()
                };
            }

            const rawSources = this.drawings[symbol];
            if (!rawSources) {
                console.log(`📝 심볼 ${symbol}에 저장된 그림이 없습니다`);
                return {
                    sources: new Map(),
                    groups: new Map()
                };
            }

            // Map 객체로 변환
            const sources = new Map();
            for (let [drawingId, drawingState] of Object.entries(rawSources)) {
                sources.set(drawingId, drawingState);
            }

            console.log(`✅ 그림 로드 완료: ${sources.size}개 그림 (심볼: ${symbol})`);

            return {
                sources,
                groups: new Map() // 그룹은 필요에 따라 구현
            };
            
        } catch (error) {
            console.error('❌ 그림 도구 로드 실패:', error);
            return {
                sources: new Map(),
                groups: new Map()
            };
        }
    }

    // 🔥 특정 심볼의 그림 개수 반환
    getDrawingCount(symbol) {
        if (!symbol || !this.drawings[symbol]) {
            return 0;
        }
        return Object.keys(this.drawings[symbol]).length;
    }

    // 🔥 모든 심볼의 그림 통계 반환
    getDrawingStats() {
        const stats = {};
        let totalDrawings = 0;
        
        for (const [symbol, drawings] of Object.entries(this.drawings)) {
            const count = Object.keys(drawings).length;
            stats[symbol] = count;
            totalDrawings += count;
        }
        
        return {
            bySymbol: stats,
            totalDrawings,
            totalSymbols: Object.keys(this.drawings).length
        };
    }

    // 🔥 특정 심볼의 모든 그림 삭제
    clearDrawingsForSymbol(symbol) {
        if (!symbol || !this.drawings[symbol]) {
            return;
        }

        const drawingCount = Object.keys(this.drawings[symbol]).length;
        delete this.drawings[symbol];
        
        // 관련 심볼 매핑도 삭제
        for (const [key, mappedSymbol] of Object.entries(this.drawingSourceSymbols)) {
            if (mappedSymbol === symbol) {
                delete this.drawingSourceSymbols[key];
            }
        }
        
        this.scheduleSave();
        console.log(`🗑️ 심볼 ${symbol}의 ${drawingCount}개 그림 삭제 완료`);
    }

    // 🔥 모든 그림 삭제
    clearAllDrawings() {
        const stats = this.getDrawingStats();
        this.drawings = {};
        this.drawingSourceSymbols = {};
        this.scheduleSave();
        console.log(`🗑️ 모든 그림 삭제 완료 (${stats.totalDrawings}개 그림, ${stats.totalSymbols}개 심볼)`);
    }

    // 🔥 그림 데이터 내보내기
    exportDrawings() {
        return {
            version: '1.0',
            timestamp: new Date().toISOString(),
            drawings: this.drawings,
            drawingSourceSymbols: this.drawingSourceSymbols,
            stats: this.getDrawingStats()
        };
    }

    // 🔥 그림 데이터 가져오기
    async importDrawings(drawingsData) {
        if (!drawingsData || !drawingsData.drawings) {
            throw new Error('잘못된 그림 데이터입니다');
        }

        this.drawings = drawingsData.drawings;
        this.drawingSourceSymbols = drawingsData.drawingSourceSymbols || {};
        
        await this.saveUserDrawings();
        console.log('✅ 그림 데이터를 가져왔습니다');
    }

    // 🔥 저장 스케줄링 (디바운스)
    scheduleSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = setTimeout(() => {
            this.saveUserDrawings();
        }, this.SAVE_DELAY);
    }

    // 🔥 동기화 상태 확인
    isSynchronized() {
        return this.initialized && this.userId && window.db;
    }

    // 🔥 정리 함수
    cleanup() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        
        // 마지막 저장 시도
        if (this.initialized && this.userId) {
            this.saveUserDrawings();
        }
        
        console.log('🧹 Drawings Storage 정리 완료');
    }
}

// 🔥 전역 인스턴스 생성
window.drawingsStorage = new DrawingsStorage();

// 🔥 모듈 내보내기
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DrawingsStorage;
} 