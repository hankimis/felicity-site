// 🔥 TradingView 차트 데이터 검증 및 수정 유틸리티 (개선된 버전)
class ChartDataValidator {
    constructor() {
        this.validationRules = {
            required: ['layout', 'charts'],
            chartRequired: ['panes'],
            paneRequired: ['sources']
        };
        
        // 🔥 TradingView 내부 속성 기본값 정의
        this.defaultPriceScaleSettings = {
            priceScaleSelectionStrategyName: 'auto',
            mode: 0,
            autoScale: true,
            invertScale: false,
            alignLabels: true,
            scaleMargins: {
                top: 0.2,
                bottom: 0.2
            },
            borderVisible: true,
            borderColor: '#2962FF',
            textColor: '#787B86',
            fontSize: 11,
            lineColor: '#2962FF',
            lineStyle: 0,
            lineWidth: 1,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
            crosshairMarkerBorderColor: '#2962FF',
            crosshairMarkerBackgroundColor: '#2962FF',
            entireTextOnly: false
        };
        
        // 🔥 안전한 기본 차트 구조
        this.safeChartStructure = {
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
                        ...this.defaultPriceScaleSettings,
                        visible: false
                    },
                    rightAxisState: {
                        ...this.defaultPriceScaleSettings,
                        visible: true
                    }
                }]
            }]
        };
    }

    // 🔥 차트 데이터 검증 및 수정 (안전성 강화)
    validateAndFix(chartData) {
        if (!chartData) {
            console.warn('⚠️ 차트 데이터가 없습니다');
            return this.createSafeChartData();
        }

        try {
            // 문자열인 경우 파싱
            if (typeof chartData === 'string') {
                try {
                    chartData = JSON.parse(chartData);
                } catch (parseError) {
                    console.error('❌ 차트 데이터 JSON 파싱 실패:', parseError);
                    return this.createSafeChartData();
                }
            }

            // 기본 구조 검증
            if (!this.validateBasicStructure(chartData)) {
                console.warn('⚠️ 기본 구조 검증 실패, 안전한 데이터로 대체');
                return this.createSafeChartData();
            }

            // 차트 배열 검증 및 수정
            if (!Array.isArray(chartData.charts)) {
                console.warn('⚠️ charts 필드가 배열이 아닙니다');
                chartData.charts = [];
            }

            // 각 차트 검증 및 수정
            chartData.charts = chartData.charts.map((chart, index) => {
                return this.validateAndFixChart(chart, index);
            }).filter(chart => chart !== null);

            // 빈 차트 배열인 경우 안전한 기본 차트 추가
            if (chartData.charts.length === 0) {
                chartData.charts = [this.createSafeChart()];
            }

            // 🔥 priceScale 관련 속성 안전성 검증
            chartData = this.fixPriceScaleProperties(chartData);

            return chartData;

        } catch (error) {
            console.error('❌ 차트 데이터 검증 중 오류:', error);
            return this.createSafeChartData();
        }
    }

    // 🔥 PriceScale 속성 안전성 수정
    fixPriceScaleProperties(chartData) {
        try {
            if (!chartData.charts || !Array.isArray(chartData.charts)) {
                return chartData;
            }

            chartData.charts.forEach((chart, chartIndex) => {
                if (!chart.panes || !Array.isArray(chart.panes)) {
                    return;
                }

                chart.panes.forEach((pane, paneIndex) => {
                    // 🔥 leftAxisState 안전성 검증
                    if (pane.leftAxisState) {
                        pane.leftAxisState = this.ensurePriceScaleProperties(pane.leftAxisState);
                    } else {
                        pane.leftAxisState = { ...this.defaultPriceScaleSettings, visible: false };
                    }

                    // 🔥 rightAxisState 안전성 검증
                    if (pane.rightAxisState) {
                        pane.rightAxisState = this.ensurePriceScaleProperties(pane.rightAxisState);
                    } else {
                        pane.rightAxisState = { ...this.defaultPriceScaleSettings, visible: true };
                    }

                    console.log(`✅ 차트 ${chartIndex}, 패인 ${paneIndex}: PriceScale 속성 안전성 확인 완료`);
                });
            });

            return chartData;
        } catch (error) {
            console.error('❌ PriceScale 속성 수정 실패:', error);
            return chartData;
        }
    }

    // 🔥 PriceScale 속성 보장
    ensurePriceScaleProperties(priceScaleState) {
        const safeState = { ...this.defaultPriceScaleSettings };
        
        // 기존 속성 복사 (안전한 것만)
        if (priceScaleState && typeof priceScaleState === 'object') {
            Object.keys(priceScaleState).forEach(key => {
                if (key in this.defaultPriceScaleSettings) {
                    safeState[key] = priceScaleState[key];
                }
            });
        }
        
        // 🔥 필수 속성 강제 설정
        safeState.priceScaleSelectionStrategyName = safeState.priceScaleSelectionStrategyName || 'auto';
        
        return safeState;
    }

    // 🔥 안전한 차트 데이터 생성
    createSafeChartData() {
        return JSON.parse(JSON.stringify(this.safeChartStructure));
    }

    // 🔥 안전한 차트 생성
    createSafeChart() {
        return JSON.parse(JSON.stringify(this.safeChartStructure.charts[0]));
    }

    // 🔥 기본 구조 검증
    validateBasicStructure(chartData) {
        if (!chartData || typeof chartData !== 'object') {
            return false;
        }

        // 필수 필드 확인
        for (const field of this.validationRules.required) {
            if (!(field in chartData)) {
                return false;
            }
        }

        return true;
    }

    // 🔥 개별 차트 검증 및 수정 (안전성 강화)
    validateAndFixChart(chart, index) {
        if (!chart || typeof chart !== 'object') {
            console.warn(`⚠️ 차트 ${index}가 유효하지 않습니다`);
            return this.createSafeChart();
        }

        // panes 배열 검증
        if (!chart.panes || !Array.isArray(chart.panes)) {
            console.warn(`⚠️ 차트 ${index}에 panes 배열이 없습니다`);
            chart.panes = [this.createSafePane()];
        }

        // 각 pane 검증
        chart.panes = chart.panes.map((pane, paneIndex) => {
            return this.validateAndFixPane(pane, index, paneIndex);
        }).filter(pane => pane !== null);

        // 빈 panes 배열인 경우 안전한 기본 pane 추가
        if (chart.panes.length === 0) {
            chart.panes = [this.createSafePane()];
        }

        return chart;
    }

    // 🔥 개별 pane 검증 및 수정 (안전성 강화)
    validateAndFixPane(pane, chartIndex, paneIndex) {
        if (!pane || typeof pane !== 'object') {
            console.warn(`⚠️ 차트 ${chartIndex}, 패인 ${paneIndex}가 유효하지 않습니다`);
            return this.createSafePane();
        }

        // sources 배열 검증
        if (!pane.sources || !Array.isArray(pane.sources)) {
            console.warn(`⚠️ 차트 ${chartIndex}, 패인 ${paneIndex}에 sources 배열이 없습니다`);
            pane.sources = [this.createSafeSource()];
        }

        // 각 source 검증
        pane.sources = pane.sources.map((source, sourceIndex) => {
            return this.validateAndFixSource(source, chartIndex, paneIndex, sourceIndex);
        }).filter(source => source !== null);

        // 빈 sources 배열인 경우 안전한 기본 source 추가
        if (pane.sources.length === 0) {
            pane.sources = [this.createSafeSource()];
        }

        // 🔥 PriceScale 상태 안전성 보장
        pane.leftAxisState = this.ensurePriceScaleProperties(pane.leftAxisState);
        pane.rightAxisState = this.ensurePriceScaleProperties(pane.rightAxisState);

        return pane;
    }

    // 🔥 안전한 pane 생성
    createSafePane() {
        return {
            sources: [this.createSafeSource()],
            leftAxisState: { ...this.defaultPriceScaleSettings, visible: false },
            rightAxisState: { ...this.defaultPriceScaleSettings, visible: true }
        };
    }

    // 🔥 개별 source 검증 및 수정
    validateAndFixSource(source, chartIndex, paneIndex, sourceIndex) {
        if (!source || typeof source !== 'object') {
            console.warn(`⚠️ 차트 ${chartIndex}, 패인 ${paneIndex}, 소스 ${sourceIndex}가 유효하지 않습니다`);
            return this.createSafeSource();
        }

        // 필수 속성 확인
        if (!source.type || !source.id) {
            console.warn(`⚠️ 차트 ${chartIndex}, 패인 ${paneIndex}, 소스 ${sourceIndex}에 필수 속성이 없습니다`);
            return this.createSafeSource();
        }

        return source;
    }

    // 🔥 안전한 source 생성
    createSafeSource() {
        return {
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
        };
    }

    // 🔥 차트 데이터 무결성 검사 (강화된 버전)
    checkDataIntegrity(chartData) {
        const issues = [];

        try {
            // 기본 구조 검사
            if (!this.validateBasicStructure(chartData)) {
                issues.push('기본 구조 검증 실패');
            }

            // 차트 배열 검사
            if (!Array.isArray(chartData.charts)) {
                issues.push('charts 필드가 배열이 아님');
            } else {
                chartData.charts.forEach((chart, index) => {
                    if (!chart.panes || !Array.isArray(chart.panes)) {
                        issues.push(`차트 ${index}: panes 배열 없음`);
                    } else {
                        chart.panes.forEach((pane, paneIndex) => {
                            // PriceScale 속성 검사
                            if (!pane.leftAxisState || !pane.leftAxisState.priceScaleSelectionStrategyName) {
                                issues.push(`차트 ${index}, 패인 ${paneIndex}: leftAxisState.priceScaleSelectionStrategyName 없음`);
                            }
                            if (!pane.rightAxisState || !pane.rightAxisState.priceScaleSelectionStrategyName) {
                                issues.push(`차트 ${index}, 패인 ${paneIndex}: rightAxisState.priceScaleSelectionStrategyName 없음`);
                            }
                        });
                    }
                });
            }

            // 데이터 크기 검사
            const size = this.getDataSize(chartData);
            if (size.isLarge) {
                issues.push(`데이터 크기가 큼: ${size.mb}MB`);
            }

            return {
                isValid: issues.length === 0,
                issues: issues,
                size: size
            };

        } catch (error) {
            console.error('❌ 데이터 무결성 검사 실패:', error);
            return {
                isValid: false,
                issues: ['무결성 검사 실패'],
                size: { bytes: 0, kb: '0', mb: '0', isLarge: false }
            };
        }
    }

    // 🔥 데이터 크기 계산
    getDataSize(data) {
        try {
            const jsonString = JSON.stringify(data);
            const bytes = new Blob([jsonString]).size;
            const kb = (bytes / 1024).toFixed(2);
            const mb = (bytes / (1024 * 1024)).toFixed(2);
            
            return {
                bytes: bytes,
                kb: kb,
                mb: mb,
                isLarge: bytes > 1024 * 1024 // 1MB 이상
            };
        } catch (error) {
            console.error('데이터 크기 계산 실패:', error);
            return { bytes: 0, kb: '0', mb: '0', isLarge: false };
        }
    }
}

// 🔥 전역 인스턴스 생성
if (typeof window !== 'undefined') {
    window.chartDataValidator = new ChartDataValidator();
    console.log('✅ 차트 데이터 검증기 초기화 완료 (안전성 강화)');
} 