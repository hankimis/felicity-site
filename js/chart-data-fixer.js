// 🔥 Firebase 차트 데이터 정리 및 수정 스크립트
class ChartDataFixer {
    constructor() {
        this.fixedCount = 0;
        this.deletedCount = 0;
        this.errorCount = 0;
    }

    // 🔥 모든 사용자의 차트 데이터 정리
    async fixAllUserChartData() {
        console.log('🔧 모든 사용자 차트 데이터 정리 시작...');
        
        try {
            // 모든 chartStates 문서 가져오기
            const chartStatesSnapshot = await window.db.collection('chartStates').get();
            
            console.log(`📊 총 ${chartStatesSnapshot.size}개의 차트 상태 문서 발견`);
            
            for (const doc of chartStatesSnapshot.docs) {
                await this.fixUserChartState(doc.id, doc.data());
            }
            
            console.log('✅ 차트 데이터 정리 완료:', {
                fixed: this.fixedCount,
                deleted: this.deletedCount,
                errors: this.errorCount
            });
            
        } catch (error) {
            console.error('❌ 차트 데이터 정리 실패:', error);
        }
    }

    // 🔥 개별 사용자 차트 상태 수정
    async fixUserChartState(userId, data) {
        try {
            console.log(`🔧 사용자 ${userId} 차트 상태 확인 중...`);
            
            if (!data || !data.content) {
                console.warn(`⚠️ 사용자 ${userId}: 차트 콘텐츠 없음`);
                await this.deleteCorruptedChartState(userId);
                return;
            }

            const chartContent = data.content;
            
            // 데이터 구조 검증
            if (!this.isValidChartData(chartContent)) {
                console.warn(`⚠️ 사용자 ${userId}: 잘못된 차트 데이터 구조 감지`);
                
                // 자동 수정 시도
                const fixedData = this.createValidChartData(chartContent);
                
                if (this.isValidChartData(fixedData)) {
                    await this.updateChartState(userId, {
                        ...data,
                        content: fixedData,
                        timestamp: Date.now(),
                        fixed: true,
                        fixedAt: Date.now()
                    });
                    
                    console.log(`✅ 사용자 ${userId}: 차트 데이터 자동 수정 완료`);
                    this.fixedCount++;
                } else {
                    console.error(`❌ 사용자 ${userId}: 차트 데이터 자동 수정 실패`);
                    await this.deleteCorruptedChartState(userId);
                }
            } else {
                console.log(`✅ 사용자 ${userId}: 차트 데이터 정상`);
            }
            
        } catch (error) {
            console.error(`❌ 사용자 ${userId} 차트 상태 수정 실패:`, error);
            this.errorCount++;
        }
    }

    // 🔥 차트 데이터 유효성 검증 (강화된 버전)
    isValidChartData(data) {
        if (!data || typeof data !== 'object') {
            return false;
        }

        // 새로운 검증기 사용
        if (window.chartDataValidator) {
            const integrity = window.chartDataValidator.checkDataIntegrity(data);
            return integrity.isValid;
        }

        // 기존 검증 로직 (백업용)
        // 필수 필드 확인
        if (!data.layout || !data.charts) {
            return false;
        }

        // charts 배열 확인
        if (!Array.isArray(data.charts)) {
            return false;
        }

        // 각 차트 구조 확인
        for (const chart of data.charts) {
            if (!chart || typeof chart !== 'object') {
                return false;
            }

            if (!chart.panes || !Array.isArray(chart.panes)) {
                return false;
            }

            // 각 pane 확인
            for (const pane of chart.panes) {
                if (!pane || typeof pane !== 'object') {
                    return false;
                }

                if (!pane.sources || !Array.isArray(pane.sources)) {
                    return false;
                }

                // 🔥 PriceScale 속성 확인
                if (!pane.leftAxisState || !pane.leftAxisState.priceScaleSelectionStrategyName) {
                    return false;
                }

                if (!pane.rightAxisState || !pane.rightAxisState.priceScaleSelectionStrategyName) {
                    return false;
                }
            }
        }

        return true;
    }

    // 🔥 유효한 차트 데이터 생성 (안전성 강화)
    createValidChartData(originalData) {
        // 새로운 검증기 사용
        if (window.chartDataValidator) {
            return window.chartDataValidator.validateAndFix(originalData);
        }

        // 기존 로직 (백업용)
        const defaultChartData = {
            layout: "s",
            charts: [{
                panes: [{
                    sources: [{
                        type: "MainSeries",
                        id: "main_series",
                        state: {
                            style: 1,
                            esdShowDividends: true,
                            esdShowSplits: true,
                            esdShowEarnings: true,
                            esdShowBreaks: false,
                            esdFlagSize: 2,
                            showCountdown: false,
                            showInDataWindow: true,
                            visible: true,
                            showPriceLine: true,
                            priceLineWidth: 1,
                            priceLineColor: "",
                            baseLineColor: "#B2B5BE",
                            showPrevClose: false,
                            minTick: "default",
                            priceFormat: {
                                type: "price",
                                precision: 2,
                                minMove: 0.01
                            }
                        }
                    }],
                    leftAxisState: {
                        priceScaleSelectionStrategyName: 'auto',
                        mode: 0,
                        autoScale: true,
                        invertScale: false,
                        alignLabels: true,
                        scaleMargins: { top: 0.2, bottom: 0.2 },
                        borderVisible: true,
                        borderColor: '#2962FF',
                        textColor: '#787B86',
                        fontSize: 11,
                        visible: false
                    },
                    rightAxisState: {
                        priceScaleSelectionStrategyName: 'auto',
                        mode: 0,
                        autoScale: true,
                        invertScale: false,
                        alignLabels: true,
                        scaleMargins: { top: 0.2, bottom: 0.2 },
                        borderVisible: true,
                        borderColor: '#2962FF',
                        textColor: '#787B86',
                        fontSize: 11,
                        visible: true
                    }
                }]
            }]
        };

        // 원본 데이터에서 복구 가능한 부분 추출
        if (originalData && typeof originalData === 'object') {
            // layout 복구
            if (originalData.layout) {
                defaultChartData.layout = originalData.layout;
            }

            // charts 배열 복구 시도
            if (originalData.charts && Array.isArray(originalData.charts)) {
                const validCharts = [];
                
                for (const chart of originalData.charts) {
                    if (chart && typeof chart === 'object') {
                        const validChart = { panes: [] };
                        
                        // panes 복구 시도
                        if (chart.panes && Array.isArray(chart.panes)) {
                            for (const pane of chart.panes) {
                                if (pane && typeof pane === 'object') {
                                    const validPane = { 
                                        sources: [],
                                        leftAxisState: defaultChartData.charts[0].panes[0].leftAxisState,
                                        rightAxisState: defaultChartData.charts[0].panes[0].rightAxisState
                                    };
                                    
                                    // sources 복구 시도
                                    if (pane.sources && Array.isArray(pane.sources)) {
                                        validPane.sources = pane.sources.filter(source => 
                                            source && typeof source === 'object'
                                        );
                                    }
                                    
                                    // 빈 sources 배열인 경우 기본 source 추가
                                    if (validPane.sources.length === 0) {
                                        validPane.sources = defaultChartData.charts[0].panes[0].sources;
                                    }

                                    // 🔥 PriceScale 상태 복구 (안전성 보장)
                                    if (pane.leftAxisState && typeof pane.leftAxisState === 'object') {
                                        validPane.leftAxisState = {
                                            ...defaultChartData.charts[0].panes[0].leftAxisState,
                                            ...pane.leftAxisState,
                                            priceScaleSelectionStrategyName: pane.leftAxisState.priceScaleSelectionStrategyName || 'auto'
                                        };
                                    }

                                    if (pane.rightAxisState && typeof pane.rightAxisState === 'object') {
                                        validPane.rightAxisState = {
                                            ...defaultChartData.charts[0].panes[0].rightAxisState,
                                            ...pane.rightAxisState,
                                            priceScaleSelectionStrategyName: pane.rightAxisState.priceScaleSelectionStrategyName || 'auto'
                                        };
                                    }
                                    
                                    validChart.panes.push(validPane);
                                }
                            }
                        }
                        
                        // 빈 panes 배열인 경우 기본 pane 추가
                        if (validChart.panes.length === 0) {
                            validChart.panes = defaultChartData.charts[0].panes;
                        }
                        
                        validCharts.push(validChart);
                    }
                }
                
                // 유효한 차트가 있으면 사용
                if (validCharts.length > 0) {
                    defaultChartData.charts = validCharts;
                }
            }
        }

        return defaultChartData;
    }

    // 🔥 차트 상태 업데이트
    async updateChartState(userId, newData) {
        try {
            await window.db.collection('chartStates').doc(userId).set(newData);
            console.log(`✅ 사용자 ${userId} 차트 상태 업데이트 완료`);
        } catch (error) {
            console.error(`❌ 사용자 ${userId} 차트 상태 업데이트 실패:`, error);
            throw error;
        }
    }

    // 🔥 손상된 차트 상태 삭제
    async deleteCorruptedChartState(userId) {
        try {
            await window.db.collection('chartStates').doc(userId).delete();
            console.log(`🗑️ 사용자 ${userId} 손상된 차트 상태 삭제 완료`);
            this.deletedCount++;
        } catch (error) {
            console.error(`❌ 사용자 ${userId} 차트 상태 삭제 실패:`, error);
            this.errorCount++;
        }
    }

    // 🔥 현재 사용자 차트 데이터 수정
    async fixCurrentUserChartData() {
        if (!window.currentUser) {
            console.warn('⚠️ 로그인된 사용자가 없습니다');
            return false;
        }

        console.log(`🔧 현재 사용자 (${window.currentUser.uid}) 차트 데이터 수정 시작...`);
        
        try {
            const doc = await window.db.collection('chartStates').doc(window.currentUser.uid).get();
            
            if (!doc.exists) {
                console.log('📭 저장된 차트 상태가 없습니다');
                return true;
            }

            const data = doc.data();
            await this.fixUserChartState(window.currentUser.uid, data);
            
            console.log('✅ 현재 사용자 차트 데이터 수정 완료');
            return true;
            
        } catch (error) {
            console.error('❌ 현재 사용자 차트 데이터 수정 실패:', error);
            return false;
        }
    }

    // 🔥 차트 데이터 통계 확인
    async getChartDataStats() {
        try {
            const snapshot = await window.db.collection('chartStates').get();
            
            let validCount = 0;
            let invalidCount = 0;
            let emptyCount = 0;
            
            for (const doc of snapshot.docs) {
                const data = doc.data();
                
                if (!data || !data.content) {
                    emptyCount++;
                } else if (this.isValidChartData(data.content)) {
                    validCount++;
                } else {
                    invalidCount++;
                }
            }
            
            const stats = {
                total: snapshot.size,
                valid: validCount,
                invalid: invalidCount,
                empty: emptyCount
            };
            
            console.log('📊 차트 데이터 통계:', stats);
            return stats;
            
        } catch (error) {
            console.error('❌ 차트 데이터 통계 확인 실패:', error);
            return null;
        }
    }
}

// 🔥 전역으로 내보내기
if (typeof window !== 'undefined') {
    window.ChartDataFixer = ChartDataFixer;
    window.chartDataFixer = new ChartDataFixer();
    
    // 디버깅 함수들
    window.fixCurrentUserChart = () => window.chartDataFixer.fixCurrentUserChartData();
    window.fixAllCharts = () => window.chartDataFixer.fixAllUserChartData();
    window.getChartStats = () => window.chartDataFixer.getChartDataStats();
} else {
    module.exports = ChartDataFixer;
} 