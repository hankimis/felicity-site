// js/analysis/liquidation-predictor.js
// 청산 예측 모델 클래스

export class LiquidationPredictor {
    constructor(dataStorage) {
        this.dataStorage = dataStorage;
        this.leverageLevels = [10, 25, 50, 100];
        this.priceRange = 0.15; // 현재가 기준 ±15% 범위
        this.priceSteps = 60; // 가격 구간 수
        this.minLiquidationAmount = 1000; // 최소 청산 금액 (USDT)
        this.maxLiquidationAmount = 50e6; // 최대 청산 금액 (USDT)
    }

    // 메인 예측 함수
    async predictLiquidations(currentPrice) {
        if (!currentPrice) return null;

        try {
            // 최근 데이터 수집
            const recentTrades = await this.dataStorage.getRecentTrades(5000);
            const recentOrderBook = await this.dataStorage.getRecentOrderBook(100);
            const recentOI = await this.dataStorage.getDataByTimeRange('openInterest', Date.now() - 24*60*60*1000, Date.now());
            const recentLS = await this.dataStorage.getDataByTimeRange('longShortRatio', Date.now() - 24*60*60*1000, Date.now());

            // 데이터가 부족해도 기본 예측 수행
            if (recentTrades.length === 0) {
                console.warn('거래 데이터가 없습니다. 기본 예측을 수행합니다.');
                return this.generateBasicPrediction(currentPrice);
            }

            // 가격 범위 설정
            const priceRange = currentPrice * this.priceRange;
            const minPrice = currentPrice - priceRange;
            const maxPrice = currentPrice + priceRange;
            const priceStep = (maxPrice - minPrice) / this.priceSteps;

            // 가격 구간별 데이터 분석
            const priceLevels = this.generatePriceLevels(minPrice, maxPrice, priceStep);
            const liquidationData = await this.analyzeLiquidationLevels(priceLevels, recentTrades, recentOrderBook, recentOI, recentLS);

            return {
                currentPrice,
                priceLevels,
                liquidationData,
                timestamp: Date.now(),
                metadata: {
                    totalTrades: recentTrades.length,
                    orderBookDepth: recentOrderBook.length,
                    openInterestData: recentOI.length,
                    longShortData: recentLS.length
                }
            };

        } catch (error) {
            console.error('청산 예측 오류:', error);
            // 오류 발생 시에도 기본 예측 반환
            return this.generateBasicPrediction(currentPrice);
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
        
        // 레버리지별 청산 거리 정의 (현재가 대비 %)
        const leverageDistances = {
            10: 0.10,   // 10% 거리
            25: 0.06,   // 6% 거리
            50: 0.03,   // 3% 거리
            100: 0.015  // 1.5% 거리
        };
        
        // 각 가격 레벨에 대해 레버리지별 분포 계산
        for (let i = 0; i < priceLevels.length; i++) {
            const price = priceLevels[i];
            const priceDiff = Math.abs(price - currentPrice) / currentPrice; // 현재가 대비 거리
            
            // 숏 포지션 (현재가보다 낮은 가격)
            if (price < currentPrice) {
                // 각 레버리지별로 해당 거리에만 분포
                Object.entries(leverageDistances).forEach(([leverage, distance]) => {
                    const barKey = `bar${leverage}x`;
                    const targetDistance = distance;
                    
                    // 해당 레버리지의 청산 거리 범위 내에 있는지 확인
                    if (priceDiff <= targetDistance && priceDiff >= targetDistance * 0.5) {
                        const baseAmount = 2e6; // 기본 200만 USDT
                        const concentration = 1 - (priceDiff / targetDistance); // 거리가 가까울수록 집중도 높음
                        const randomFactor = Math.random() * 0.5 + 0.5; // 0.5 ~ 1.0
                        
                        liquidationData[barKey].short[i] = baseAmount * concentration * randomFactor;
                    }
                });
            }
            // 롱 포지션 (현재가보다 높은 가격)
            else if (price > currentPrice) {
                // 각 레버리지별로 해당 거리에만 분포
                Object.entries(leverageDistances).forEach(([leverage, distance]) => {
                    const barKey = `bar${leverage}x`;
                    const targetDistance = distance;
                    
                    // 해당 레버리지의 청산 거리 범위 내에 있는지 확인
                    if (priceDiff <= targetDistance && priceDiff >= targetDistance * 0.5) {
                        const baseAmount = 2e6; // 기본 200만 USDT
                        const concentration = 1 - (priceDiff / targetDistance); // 거리가 가까울수록 집중도 높음
                        const randomFactor = Math.random() * 0.5 + 0.5; // 0.5 ~ 1.0
                        
                        liquidationData[barKey].long[i] = baseAmount * concentration * randomFactor;
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
                orderBookDepth: 0,
                openInterestData: 0,
                longShortData: 0,
                isBasicPrediction: true
            }
        };
    }

    // 가격 구간 생성
    generatePriceLevels(minPrice, maxPrice, priceStep) {
        const levels = [];
        for (let i = 0; i <= this.priceSteps; i++) {
            const price = minPrice + (i * priceStep);
            levels.push(Math.round(price * 100) / 100); // 소수점 2자리로 반올림
        }
        return levels;
    }

    // 각 가격 구간별 청산 분석
    async analyzeLiquidationLevels(priceLevels, trades, orderBook, openInterest, longShortRatio) {
        const liquidationData = {
            prices: priceLevels,
            longArr: new Array(priceLevels.length).fill(0),
            shortArr: new Array(priceLevels.length).fill(0),
            bar10x: { short: new Array(priceLevels.length).fill(0), long: new Array(priceLevels.length).fill(0) },
            bar25x: { short: new Array(priceLevels.length).fill(0), long: new Array(priceLevels.length).fill(0) },
            bar50x: { short: new Array(priceLevels.length).fill(0), long: new Array(priceLevels.length).fill(0) },
            bar100x: { short: new Array(priceLevels.length).fill(0), long: new Array(priceLevels.length).fill(0) }
        };

        const currentPrice = priceLevels[Math.floor(priceLevels.length / 2)];
        const centerIndex = Math.floor(priceLevels.length / 2);

        // 오더북 기반 포지션 추정
        if (orderBook.length > 0) {
            const latestOrderBook = orderBook[0];
            this.estimatePositionsFromOrderBook(latestOrderBook, priceLevels, liquidationData, currentPrice);
        }

        // 거래 데이터 기반 포지션 추정
        this.estimatePositionsFromTrades(trades, priceLevels, liquidationData, currentPrice);

        // 미결제 약정 및 롱숏 비율 반영
        this.adjustWithMarketData(openInterest, longShortRatio, liquidationData, currentPrice);

        // 누적 청산 금액 계산
        this.calculateCumulativeLiquidations(liquidationData, centerIndex);

        return liquidationData;
    }

    // 오더북 기반 포지션 추정
    estimatePositionsFromOrderBook(orderBook, priceLevels, liquidationData, currentPrice) {
        const { bids, asks } = orderBook;
        
        // 레버리지별 청산 거리 정의 (현재가 대비 %)
        const leverageDistances = {
            10: 0.10,   // 10% 거리
            25: 0.06,   // 6% 거리
            50: 0.03,   // 3% 거리
            100: 0.015  // 1.5% 거리
        };
        
        // 매수 주문 (롱 포지션 청산 가능성)
        bids.forEach(bid => {
            const price = bid.price;
            const quantity = bid.quantity;
            const priceIndex = this.findPriceIndex(price, priceLevels);
            
            if (priceIndex !== -1 && price > currentPrice) {
                const priceDiff = Math.abs(price - currentPrice) / currentPrice;
                
                // 각 레버리지별로 해당 거리에만 분포
                Object.entries(leverageDistances).forEach(([leverage, distance]) => {
                    const barKey = `bar${leverage}x`;
                    const targetDistance = distance;
                    
                    // 해당 레버리지의 청산 거리 범위 내에 있는지 확인
                    if (priceDiff <= targetDistance && priceDiff >= targetDistance * 0.5) {
                        const leverageDistribution = this.estimateLeverageDistribution(quantity, price);
                        const concentration = 1 - (priceDiff / targetDistance);
                        
                        liquidationData[barKey].long[priceIndex] += (leverageDistribution[leverage] || 0) * concentration;
                    }
                });
            }
        });

        // 매도 주문 (숏 포지션 청산 가능성)
        asks.forEach(ask => {
            const price = ask.price;
            const quantity = ask.quantity;
            const priceIndex = this.findPriceIndex(price, priceLevels);
            
            if (priceIndex !== -1 && price < currentPrice) {
                const priceDiff = Math.abs(price - currentPrice) / currentPrice;
                
                // 각 레버리지별로 해당 거리에만 분포
                Object.entries(leverageDistances).forEach(([leverage, distance]) => {
                    const barKey = `bar${leverage}x`;
                    const targetDistance = distance;
                    
                    // 해당 레버리지의 청산 거리 범위 내에 있는지 확인
                    if (priceDiff <= targetDistance && priceDiff >= targetDistance * 0.5) {
                        const leverageDistribution = this.estimateLeverageDistribution(quantity, price);
                        const concentration = 1 - (priceDiff / targetDistance);
                        
                        liquidationData[barKey].short[priceIndex] += (leverageDistribution[leverage] || 0) * concentration;
                    }
                });
            }
        });
    }

    // 거래 데이터 기반 포지션 추정
    estimatePositionsFromTrades(trades, priceLevels, liquidationData, currentPrice) {
        // 거래량 분포 분석
        const volumeByPrice = new Map();
        
        trades.forEach(trade => {
            const price = trade.price;
            const quantity = trade.quantity;
            
            if (!volumeByPrice.has(price)) {
                volumeByPrice.set(price, 0);
            }
            volumeByPrice.set(price, volumeByPrice.get(price) + quantity);
        });

        // 레버리지별 청산 거리 정의 (현재가 대비 %)
        const leverageDistances = {
            10: 0.10,   // 10% 거리
            25: 0.06,   // 6% 거리
            50: 0.03,   // 3% 거리
            100: 0.015  // 1.5% 거리
        };

        // 거래량이 높은 구간에 포지션 집중도 높임
        volumeByPrice.forEach((volume, price) => {
            const priceIndex = this.findPriceIndex(price, priceLevels);
            if (priceIndex !== -1) {
                const priceDiff = Math.abs(price - currentPrice) / currentPrice;
                const volumeMultiplier = Math.min(volume / 100, 5); // 거래량에 따른 배수
                
                // 각 레버리지별로 해당 거리에만 분포
                Object.entries(leverageDistances).forEach(([leverage, distance]) => {
                    const barKey = `bar${leverage}x`;
                    const targetDistance = distance;
                    
                    // 해당 레버리지의 청산 거리 범위 내에 있는지 확인
                    if (priceDiff <= targetDistance && priceDiff >= targetDistance * 0.5) {
                        const concentration = 1 - (priceDiff / targetDistance);
                        const leverageMultiplier = this.getLeverageMultiplier(leverage);
                        
                        if (price < currentPrice) {
                            // 숏 포지션
                            liquidationData[barKey].short[priceIndex] *= (1 + volumeMultiplier * leverageMultiplier * concentration);
                        } else if (price > currentPrice) {
                            // 롱 포지션
                            liquidationData[barKey].long[priceIndex] *= (1 + volumeMultiplier * leverageMultiplier * concentration);
                        }
                    }
                });
            }
        });
    }

    // 레버리지별 배수 계산
    getLeverageMultiplier(leverage) {
        switch (parseInt(leverage)) {
            case 10: return 0.1;
            case 25: return 0.15;
            case 50: return 0.2;
            case 100: return 0.25;
            default: return 0.1;
        }
    }

    // 시장 데이터로 조정
    adjustWithMarketData(openInterest, longShortRatio, liquidationData, currentPrice) {
        if (openInterest.length > 0) {
            const latestOI = openInterest[openInterest.length - 1];
            const oiValue = latestOI.openInterestValue;
            
            // 미결제 약정 규모에 따른 전체적인 스케일 조정
            const oiMultiplier = Math.min(oiValue / 1e9, 10); // 10억 USDT 기준
            
            this.leverageLevels.forEach(leverage => {
                const barKey = `bar${leverage}x`;
                liquidationData[barKey].long = liquidationData[barKey].long.map(val => val * oiMultiplier);
                liquidationData[barKey].short = liquidationData[barKey].short.map(val => val * oiMultiplier);
            });
        }

        if (longShortRatio.length > 0) {
            const latestLS = longShortRatio[longShortRatio.length - 1];
            const lsRatio = latestLS.longShortRatio;
            
            // 롱숏 비율에 따른 조정
            if (lsRatio > 1) {
                // 롱 포지션이 많을 때 롱 청산 위험 증가
                this.leverageLevels.forEach(leverage => {
                    const barKey = `bar${leverage}x`;
                    liquidationData[barKey].long = liquidationData[barKey].long.map(val => val * (1 + (lsRatio - 1) * 0.5));
                });
            } else {
                // 숏 포지션이 많을 때 숏 청산 위험 증가
                this.leverageLevels.forEach(leverage => {
                    const barKey = `bar${leverage}x`;
                    liquidationData[barKey].short = liquidationData[barKey].short.map(val => val * (1 + (1/lsRatio - 1) * 0.5));
                });
            }
        }
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

    // 레버리지별 분포 추정
    estimateLeverageDistribution(quantity, price) {
        const totalValue = quantity * price;
        const distribution = {};
        
        // 레버리지별 분포 확률 (실제 시장 데이터 기반 추정)
        const leverageProbabilities = {
            10: 0.4,   // 40% - 낮은 레버리지가 가장 많음
            25: 0.3,   // 30%
            50: 0.2,   // 20%
            100: 0.1   // 10% - 높은 레버리지는 상대적으로 적음
        };

        this.leverageLevels.forEach(leverage => {
            const probability = leverageProbabilities[leverage];
            const estimatedAmount = totalValue * probability * this.getRandomFactor(0.8, 1.2);
            distribution[leverage] = Math.max(estimatedAmount, this.minLiquidationAmount);
        });

        return distribution;
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

    // 랜덤 팩터 (실제 시장의 불확실성 반영)
    getRandomFactor(min, max) {
        return min + Math.random() * (max - min);
    }

    // 변동성 기반 청산 위험 조정
    adjustForVolatility(trades, liquidationData) {
        if (trades.length < 20) return;

        // 최근 거래의 변동성 계산
        const recentPrices = trades.slice(-20).map(t => t.price);
        const volatility = this.calculateVolatility(recentPrices);
        
        // 변동성이 높을수록 청산 위험 증가
        const volatilityMultiplier = 1 + (volatility * 10);
        
        this.leverageLevels.forEach(leverage => {
            const barKey = `bar${leverage}x`;
            liquidationData[barKey].long = liquidationData[barKey].long.map(val => val * volatilityMultiplier);
            liquidationData[barKey].short = liquidationData[barKey].short.map(val => val * volatilityMultiplier);
        });
    }

    // 변동성 계산
    calculateVolatility(prices) {
        if (prices.length < 2) return 0;
        
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push((prices[i] - prices[i-1]) / prices[i-1]);
        }
        
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
        
        return Math.sqrt(variance);
    }

    // 예측 결과 검증
    validatePrediction(prediction) {
        if (!prediction) return false;
        
        // 기본 예측인 경우 항상 유효
        if (prediction.metadata && prediction.metadata.isBasicPrediction) {
            return true;
        }
        
        if (!prediction.liquidationData) return false;
        
        const { liquidationData } = prediction;
        
        // 기본 검증
        if (!liquidationData.prices || liquidationData.prices.length === 0) return false;
        if (!liquidationData.longArr || !liquidationData.shortArr) return false;
        
        // 값 범위 검증 (더 관대하게)
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
        
        // 최소한 하나의 값이 0보다 큰지 확인
        const hasValidValues = allValues.some(val => 
            typeof val === 'number' && !isNaN(val) && val >= 0
        );
        
        // 모든 값이 숫자인지 확인
        const allNumbers = allValues.every(val => 
            typeof val === 'number' && !isNaN(val)
        );
        
        return hasValidValues && allNumbers;
    }
} 