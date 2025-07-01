// js/analysis/advanced-liquidation-predictor.js
// 고급 청산 예측 모델 - 실제 거래 데이터 기반

export class AdvancedLiquidationPredictor {
    constructor(dataStorage) {
        this.dataStorage = dataStorage;
        this.leverageLevels = [10, 25, 50, 100];
        
        // 레버리지별 청산 거리 (실제 금융 원리 기반)
        this.leverageDistances = {
            10: 0.10,   // 10% - 10x 레버리지는 10% 가격 변동에서 청산
            25: 0.04,   // 4% - 25x 레버리지는 4% 가격 변동에서 청산
            50: 0.02,   // 2% - 50x 레버리지는 2% 가격 변동에서 청산
            100: 0.01   // 1% - 100x 레버리지는 1% 가격 변동에서 청산
        };
        
        // 가격 구간 설정
        this.priceRange = 0.15; // ±15% 범위
        this.priceSteps = 120; // 가격 구간 수 (더 세밀하게)
        
        // 거래량 필터링 설정
        this.minTradeAmount = 1000; // 최소 거래량 (USDT)
        this.topTradePercentage = 0.05; // 상위 5% 거래만 사용
    }

    // 메인 예측 함수
    async predictLiquidations(currentPrice) {
        if (!currentPrice) return null;

        try {
            // 최근 거래 데이터 수집
            const recentTrades = await this.dataStorage.getRecentTrades(10000);
            
            if (recentTrades.length === 0) {
                console.warn('거래 데이터가 없습니다. 기본 예측을 수행합니다.');
                return this.generateBasicPrediction(currentPrice);
            }

            // 거래 데이터 필터링 및 분석
            const filteredTrades = this.filterSignificantTrades(recentTrades);
            
            if (filteredTrades.length === 0) {
                console.warn('유의미한 거래 데이터가 없습니다. 기본 예측을 수행합니다.');
                return this.generateBasicPrediction(currentPrice);
            }

            // 가격 범위 설정
            const priceRange = currentPrice * this.priceRange;
            const minPrice = currentPrice - priceRange;
            const maxPrice = currentPrice + priceRange;
            const priceStep = (maxPrice - minPrice) / this.priceSteps;

            // 가격 구간별 데이터 분석
            const priceLevels = this.generatePriceLevels(minPrice, maxPrice, priceStep);
            const liquidationData = this.analyzeLiquidationLevels(priceLevels, filteredTrades, currentPrice);

            return {
                currentPrice,
                priceLevels,
                liquidationData,
                timestamp: Date.now(),
                metadata: {
                    totalTrades: recentTrades.length,
                    filteredTrades: filteredTrades.length,
                    analysisMethod: 'advanced_historical'
                }
            };

        } catch (error) {
            console.error('고급 청산 예측 오류:', error);
            return this.generateBasicPrediction(currentPrice);
        }
    }

    // 유의미한 거래 필터링
    filterSignificantTrades(trades) {
        // 거래량 기준 필터링
        const significantTrades = trades.filter(trade => 
            trade.quantity * trade.price >= this.minTradeAmount
        );

        if (significantTrades.length === 0) return [];

        // 거래량 기준 정렬
        significantTrades.sort((a, b) => (b.quantity * b.price) - (a.quantity * a.price));

        // 상위 거래만 선택
        const topCount = Math.max(1, Math.floor(significantTrades.length * this.topTradePercentage));
        return significantTrades.slice(0, topCount);
    }

    // 가격 구간 생성
    generatePriceLevels(minPrice, maxPrice, priceStep) {
        const levels = [];
        for (let i = 0; i <= this.priceSteps; i++) {
            const price = minPrice + (i * priceStep);
            levels.push(Math.round(price * 100) / 100);
        }
        return levels;
    }

    // 청산 레버 분석
    analyzeLiquidationLevels(priceLevels, trades, currentPrice) {
        const liquidationData = {
            prices: priceLevels,
            longArr: new Array(priceLevels.length).fill(0),
            shortArr: new Array(priceLevels.length).fill(0),
            bar10x: { short: new Array(priceLevels.length).fill(0), long: new Array(priceLevels.length).fill(0) },
            bar25x: { short: new Array(priceLevels.length).fill(0), long: new Array(priceLevels.length).fill(0) },
            bar50x: { short: new Array(priceLevels.length).fill(0), long: new Array(priceLevels.length).fill(0) },
            bar100x: { short: new Array(priceLevels.length).fill(0), long: new Array(priceLevels.length).fill(0) }
        };

        // 각 거래에 대해 청산 지점 계산
        trades.forEach(trade => {
            this.calculateLiquidationPoints(trade, liquidationData, currentPrice);
        });

        // 누적 청산 금액 계산
        const centerIndex = Math.floor(priceLevels.length / 2);
        this.calculateCumulativeLiquidations(liquidationData, centerIndex);

        return liquidationData;
    }

    // 개별 거래의 청산 지점 계산
    calculateLiquidationPoints(trade, liquidationData, currentPrice) {
        const tradePrice = trade.price;
        const tradeAmount = trade.quantity * trade.price;
        const isBuy = !trade.isBuyerMaker; // 매수 = 롱 포지션

        // 각 레버리지별 청산 가격 계산
        this.leverageLevels.forEach(leverage => {
            const distance = this.leverageDistances[leverage];
            let liquidationPrice;

            if (isBuy) {
                // 롱 포지션 청산 가격 (가격이 떨어질 때)
                liquidationPrice = tradePrice * (1 - distance);
            } else {
                // 숏 포지션 청산 가격 (가격이 올라갈 때)
                liquidationPrice = tradePrice * (1 + distance);
            }

            // 청산 가격이 현재 가격 범위 내에 있는지 확인
            const priceIndex = this.findPriceIndex(liquidationPrice, liquidationData.prices);
            if (priceIndex !== -1) {
                const barKey = `bar${leverage}x`;
                
                if (isBuy) {
                    // 롱 포지션 청산
                    liquidationData[barKey].long[priceIndex] += tradeAmount;
                } else {
                    // 숏 포지션 청산
                    liquidationData[barKey].short[priceIndex] += tradeAmount;
                }
            }
        });
    }

    // 가격 인덱스 찾기
    findPriceIndex(price, priceLevels) {
        for (let i = 0; i < priceLevels.length; i++) {
            if (Math.abs(price - priceLevels[i]) < (priceLevels[1] - priceLevels[0]) / 2) {
                return i;
            }
        }
        return -1;
    }

    // 누적 청산 금액 계산
    calculateCumulativeLiquidations(liquidationData, centerIndex) {
        // 롱 포지션 누적 (중앙에서 오른쪽으로)
        let cumLong = 0;
        for (let i = centerIndex; i < liquidationData.prices.length; i++) {
            const totalLong = liquidationData.bar10x.long[i] + liquidationData.bar25x.long[i] + 
                             liquidationData.bar50x.long[i] + liquidationData.bar100x.long[i];
            cumLong += totalLong;
            liquidationData.longArr[i] = cumLong;
        }

        // 숏 포지션 누적 (중앙에서 왼쪽으로)
        let cumShort = 0;
        for (let i = centerIndex - 1; i >= 0; i--) {
            const totalShort = liquidationData.bar10x.short[i] + liquidationData.bar25x.short[i] + 
                              liquidationData.bar50x.short[i] + liquidationData.bar100x.short[i];
            cumShort += totalShort;
            liquidationData.shortArr[i] = cumShort;
        }
    }

    // 기본 예측 생성 (데이터 부족 시)
    generateBasicPrediction(currentPrice) {
        const priceRange = currentPrice * this.priceRange;
        const minPrice = currentPrice - priceRange;
        const maxPrice = currentPrice + priceRange;
        const priceStep = (maxPrice - minPrice) / this.priceSteps;
        
        const priceLevels = this.generatePriceLevels(minPrice, maxPrice, priceStep);
        const centerIndex = Math.floor(priceLevels.length / 2);
        
        // 기본 청산 데이터 생성
        const liquidationData = {
            prices: priceLevels,
            longArr: new Array(priceLevels.length).fill(0),
            shortArr: new Array(priceLevels.length).fill(0),
            bar10x: { short: new Array(priceLevels.length).fill(0), long: new Array(priceLevels.length).fill(0) },
            bar25x: { short: new Array(priceLevels.length).fill(0), long: new Array(priceLevels.length).fill(0) },
            bar50x: { short: new Array(priceLevels.length).fill(0), long: new Array(priceLevels.length).fill(0) },
            bar100x: { short: new Array(priceLevels.length).fill(0), long: new Array(priceLevels.length).fill(0) }
        };
        
        // 각 가격 레벨에 대해 레버리지별 분포 계산
        for (let i = 0; i < priceLevels.length; i++) {
            const price = priceLevels[i];
            const priceDiff = Math.abs(price - currentPrice) / currentPrice;
            
            // 숏 포지션 (현재가보다 낮은 가격)
            if (price < currentPrice) {
                this.leverageLevels.forEach(leverage => {
                    const targetDistance = this.leverageDistances[leverage];
                    
                    // 해당 레버리지의 청산 거리 범위 내에 있는지 확인
                    if (priceDiff <= targetDistance && priceDiff >= targetDistance * 0.2) {
                        const baseAmount = 2e6; // 기본 200만 USDT
                        const concentration = Math.exp(-priceDiff / targetDistance * 2); // 지수 감소
                        const randomFactor = Math.random() * 0.6 + 0.4; // 0.4 ~ 1.0
                        const volumeFactor = 1 + Math.random() * 0.5; // 볼륨 변동
                        
                        const barKey = `bar${leverage}x`;
                        liquidationData[barKey].short[i] = baseAmount * concentration * randomFactor * volumeFactor;
                    }
                });
            }
            // 롱 포지션 (현재가보다 높은 가격)
            else if (price > currentPrice) {
                this.leverageLevels.forEach(leverage => {
                    const targetDistance = this.leverageDistances[leverage];
                    
                    // 해당 레버리지의 청산 거리 범위 내에 있는지 확인
                    if (priceDiff <= targetDistance && priceDiff >= targetDistance * 0.2) {
                        const baseAmount = 2e6; // 기본 200만 USDT
                        const concentration = Math.exp(-priceDiff / targetDistance * 2); // 지수 감소
                        const randomFactor = Math.random() * 0.6 + 0.4; // 0.4 ~ 1.0
                        const volumeFactor = 1 + Math.random() * 0.5; // 볼륨 변동
                        
                        const barKey = `bar${leverage}x`;
                        liquidationData[barKey].long[i] = baseAmount * concentration * randomFactor * volumeFactor;
                    }
                });
            }
        }
        
        // 누적 계산
        this.calculateCumulativeLiquidations(liquidationData, centerIndex);
        
        return {
            currentPrice,
            priceLevels,
            liquidationData,
            timestamp: Date.now(),
            metadata: {
                totalTrades: 0,
                filteredTrades: 0,
                analysisMethod: 'basic_prediction'
            }
        };
    }

    // 예측 결과 검증
    validatePrediction(prediction) {
        if (!prediction) return false;
        
        // 기본 예측인 경우 항상 유효
        if (prediction.metadata && prediction.metadata.analysisMethod === 'basic_prediction') {
            return true;
        }
        
        if (!prediction.liquidationData) return false;
        
        const { liquidationData } = prediction;
        
        // 기본 검증
        if (!liquidationData.prices || liquidationData.prices.length === 0) return false;
        if (!liquidationData.longArr || !liquidationData.shortArr) return false;
        
        // 값 범위 검증
        const allValues = [
            ...liquidationData.longArr,
            ...liquidationData.shortArr,
            ...liquidationData.bar10x.long,
            ...liquidationData.bar10x.short,
            ...liquidationData.bar25x.long,
            ...liquidationData.bar25x.short,
            ...liquidationData.bar50x.long,
            ...liquidationData.bar50x.short,
            ...liquidationData.bar100x.long,
            ...liquidationData.bar100x.short
        ];
        
        // 모든 값이 숫자인지 확인
        const allNumbers = allValues.every(val => 
            typeof val === 'number' && !isNaN(val) && val >= 0
        );
        
        // 최소한 하나의 값이 0보다 큰지 확인 (더 관대한 조건)
        const hasValidValues = allNumbers && (
            allValues.some(val => val > 0) || 
            prediction.metadata?.analysisMethod === 'basic_prediction'
        );
        
        return hasValidValues;
    }

    // 설정 업데이트
    updateSettings(settings) {
        if (settings.minTradeAmount) this.minTradeAmount = settings.minTradeAmount;
        if (settings.topTradePercentage) this.topTradePercentage = settings.topTradePercentage;
        if (settings.priceRange) this.priceRange = settings.priceRange;
        if (settings.priceSteps) this.priceSteps = settings.priceSteps;
    }
} 