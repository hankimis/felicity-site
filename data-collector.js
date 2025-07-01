// data-collector.js
// 24시간 바이낸스 데이터 수집 서버

const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
const cron = require('node-cron');
const path = require('path');

class BinanceDataCollector {
    constructor() {
        this.ws = null;
        this.db = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 5000;
        
        // 데이터 수집 통계
        this.stats = {
            trades: 0,
            orderbook: 0,
            openInterest: 0,
            fundingRate: 0,
            longShortRatio: 0,
            lastUpdate: null
        };
        
        this.initDatabase();
    }

    // SQLite 데이터베이스 초기화
    initDatabase() {
        const dbPath = path.join(__dirname, 'binance_data.db');
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('데이터베이스 연결 실패:', err);
                return;
            }
            console.log('SQLite 데이터베이스 연결됨');
            this.createTables();
        });
    }

    // 테이블 생성
    createTables() {
        const tables = [
            `CREATE TABLE IF NOT EXISTS trades (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                price REAL NOT NULL,
                quantity REAL NOT NULL,
                time INTEGER NOT NULL,
                isBuyerMaker BOOLEAN,
                timestamp INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE TABLE IF NOT EXISTS orderbook (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bids TEXT NOT NULL,
                asks TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE TABLE IF NOT EXISTS open_interest (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                open_interest REAL NOT NULL,
                open_interest_value REAL NOT NULL,
                timestamp INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE TABLE IF NOT EXISTS funding_rate (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                funding_rate REAL NOT NULL,
                funding_time INTEGER NOT NULL,
                timestamp INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE TABLE IF NOT EXISTS long_short_ratio (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                long_account REAL NOT NULL,
                short_account REAL NOT NULL,
                long_short_ratio REAL NOT NULL,
                timestamp INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE TABLE IF NOT EXISTS liquidation_predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                current_price REAL NOT NULL,
                prediction_data TEXT NOT NULL,
                metadata TEXT,
                timestamp INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        tables.forEach((sql, index) => {
            this.db.run(sql, (err) => {
                if (err) {
                    console.error(`테이블 생성 실패 (${index}):`, err);
                } else {
                    console.log(`테이블 생성 완료 (${index})`);
                }
            });
        });
    }

    // 웹소켓 연결
    connect() {
        try {
            const streams = [
                'btcusdt@trade',
                'btcusdt@depth20@100ms',
                'btcusdt@openInterest',
                'btcusdt@fundingRate',
                'btcusdt@longShortRatio'
            ];
            
            const wsUrl = `wss://stream.binance.com:9443/ws/${streams.join('/')}`;
            this.ws = new WebSocket(wsUrl);

            this.ws.on('open', () => {
                console.log('바이낸스 웹소켓 연결됨');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.stats.lastUpdate = new Date();
            });

            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleMessage(message);
                } catch (error) {
                    console.error('메시지 파싱 오류:', error);
                }
            });

            this.ws.on('close', () => {
                console.log('바이낸스 웹소켓 연결 끊어짐');
                this.isConnected = false;
                this.handleReconnect();
            });

            this.ws.on('error', (error) => {
                console.error('웹소켓 오류:', error);
            });

        } catch (error) {
            console.error('웹소켓 연결 실패:', error);
            this.handleReconnect();
        }
    }

    // 메시지 처리
    handleMessage(data) {
        if (data.stream) {
            const stream = data.stream;
            const dataObj = data.data;

            switch (stream) {
                case 'btcusdt@trade':
                    this.handleTrade(dataObj);
                    break;
                case 'btcusdt@depth20@100ms':
                    this.handleOrderBook(dataObj);
                    break;
                case 'btcusdt@openInterest':
                    this.handleOpenInterest(dataObj);
                    break;
                case 'btcusdt@fundingRate':
                    this.handleFundingRate(dataObj);
                    break;
                case 'btcusdt@longShortRatio':
                    this.handleLongShortRatio(dataObj);
                    break;
            }
        }
    }

    // 거래 데이터 처리
    handleTrade(tradeData) {
        const trade = {
            price: parseFloat(tradeData.p),
            quantity: parseFloat(tradeData.q),
            time: tradeData.T,
            isBuyerMaker: tradeData.m ? 1 : 0,
            timestamp: Date.now()
        };

        this.db.run(
            'INSERT INTO trades (price, quantity, time, isBuyerMaker, timestamp) VALUES (?, ?, ?, ?, ?)',
            [trade.price, trade.quantity, trade.time, trade.isBuyerMaker, trade.timestamp],
            (err) => {
                if (err) {
                    console.error('거래 데이터 저장 실패:', err);
                } else {
                    this.stats.trades++;
                }
            }
        );
    }

    // 오더북 데이터 처리
    handleOrderBook(orderBookData) {
        const orderBook = {
            bids: JSON.stringify(orderBookData.bids),
            asks: JSON.stringify(orderBookData.asks),
            timestamp: Date.now()
        };

        this.db.run(
            'INSERT INTO orderbook (bids, asks, timestamp) VALUES (?, ?, ?)',
            [orderBook.bids, orderBook.asks, orderBook.timestamp],
            (err) => {
                if (err) {
                    console.error('오더북 데이터 저장 실패:', err);
                } else {
                    this.stats.orderbook++;
                }
            }
        );
    }

    // 미결제 약정 처리
    handleOpenInterest(oiData) {
        const oi = {
            symbol: oiData.s,
            openInterest: parseFloat(oiData.o),
            openInterestValue: parseFloat(oiData.c),
            timestamp: Date.now()
        };

        this.db.run(
            'INSERT INTO open_interest (symbol, open_interest, open_interest_value, timestamp) VALUES (?, ?, ?, ?)',
            [oi.symbol, oi.openInterest, oi.openInterestValue, oi.timestamp],
            (err) => {
                if (err) {
                    console.error('미결제 약정 데이터 저장 실패:', err);
                } else {
                    this.stats.openInterest++;
                }
            }
        );
    }

    // 자금조달률 처리
    handleFundingRate(frData) {
        const fr = {
            symbol: frData.s,
            fundingRate: parseFloat(frData.r),
            fundingTime: frData.T,
            timestamp: Date.now()
        };

        this.db.run(
            'INSERT INTO funding_rate (symbol, funding_rate, funding_time, timestamp) VALUES (?, ?, ?, ?)',
            [fr.symbol, fr.fundingRate, fr.fundingTime, fr.timestamp],
            (err) => {
                if (err) {
                    console.error('자금조달률 데이터 저장 실패:', err);
                } else {
                    this.stats.fundingRate++;
                }
            }
        );
    }

    // 롱숏 비율 처리
    handleLongShortRatio(lsData) {
        const ls = {
            symbol: lsData.s,
            longAccount: parseFloat(lsData.longAccount),
            shortAccount: parseFloat(lsData.shortAccount),
            longShortRatio: parseFloat(lsData.longShortRatio),
            timestamp: Date.now()
        };

        this.db.run(
            'INSERT INTO long_short_ratio (symbol, long_account, short_account, long_short_ratio, timestamp) VALUES (?, ?, ?, ?, ?)',
            [ls.symbol, ls.longAccount, ls.shortAccount, ls.longShortRatio, ls.timestamp],
            (err) => {
                if (err) {
                    console.error('롱숏 비율 데이터 저장 실패:', err);
                } else {
                    this.stats.longShortRatio++;
                }
            }
        );
    }

    // 재연결 처리
    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`재연결 시도 ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
            
            setTimeout(() => {
                this.connect();
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            console.error('최대 재연결 시도 횟수 초과');
        }
    }

    // 통계 출력
    printStats() {
        console.log('\n=== 데이터 수집 통계 ===');
        console.log(`거래 데이터: ${this.stats.trades.toLocaleString()}`);
        console.log(`오더북 데이터: ${this.stats.orderbook.toLocaleString()}`);
        console.log(`미결제 약정: ${this.stats.openInterest.toLocaleString()}`);
        console.log(`자금조달률: ${this.stats.fundingRate.toLocaleString()}`);
        console.log(`롱숏 비율: ${this.stats.longShortRatio.toLocaleString()}`);
        console.log(`마지막 업데이트: ${this.stats.lastUpdate}`);
        console.log('========================\n');
    }

    // 데이터 정리 (오래된 데이터 삭제)
    cleanupOldData() {
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

        const cleanupQueries = [
            { table: 'trades', timestamp: oneDayAgo },
            { table: 'orderbook', timestamp: oneDayAgo },
            { table: 'open_interest', timestamp: oneWeekAgo },
            { table: 'funding_rate', timestamp: oneWeekAgo },
            { table: 'long_short_ratio', timestamp: oneWeekAgo },
            { table: 'liquidation_predictions', timestamp: oneDayAgo }
        ];

        cleanupQueries.forEach(({ table, timestamp }) => {
            this.db.run(
                `DELETE FROM ${table} WHERE timestamp < ?`,
                [timestamp],
                (err) => {
                    if (err) {
                        console.error(`${table} 정리 실패:`, err);
                    } else {
                        console.log(`${table} 오래된 데이터 정리 완료`);
                    }
                }
            );
        });
    }

    // 데이터베이스 연결 종료
    close() {
        if (this.ws) {
            this.ws.close();
        }
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('데이터베이스 종료 오류:', err);
                } else {
                    console.log('데이터베이스 연결 종료');
                }
            });
        }
    }
}

// 메인 실행
function main() {
    console.log('바이낸스 데이터 수집기 시작...');
    
    const collector = new BinanceDataCollector();
    
    // 웹소켓 연결
    collector.connect();
    
    // 매시간 통계 출력
    cron.schedule('0 * * * *', () => {
        collector.printStats();
    });
    
    // 매일 자정 데이터 정리
    cron.schedule('0 0 * * *', () => {
        console.log('오래된 데이터 정리 시작...');
        collector.cleanupOldData();
    });
    
    // 프로세스 종료 시 정리
    process.on('SIGINT', () => {
        console.log('\n프로그램 종료 중...');
        collector.printStats();
        collector.close();
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log('\n프로그램 종료 중...');
        collector.printStats();
        collector.close();
        process.exit(0);
    });
}

// 스크립트가 직접 실행될 때만 main 함수 호출
if (require.main === module) {
    main();
}

module.exports = BinanceDataCollector; 