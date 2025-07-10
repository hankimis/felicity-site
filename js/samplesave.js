            // 🚀 간소화된 안정적인 차트 자동 저장 시스템
            let saveTimeout = null;
            let lastSaveTime = 0;
            const SAVE_COOLDOWN = 3000; // 3초 쿨다운

            const saveChartLayout = async (layoutData) => {
                if (!window.currentUser || !layoutData) return;

                const now = Date.now();
                if (now - lastSaveTime < SAVE_COOLDOWN) return;

                try {
                    // TradingView 데이터를 JSON 문자열로 직렬화
                    let serializedData;
                    try {
                        serializedData = JSON.stringify(layoutData);
                    } catch (jsonError) {
                        console.error('JSON 직렬화 실패:', jsonError);
                        return;
                    }

                    const saveData = {
                        content: serializedData, // JSON 문자열로 저장
                        timestamp: new Date(),
                        updatedAt: now,
                        userId: window.currentUser.uid,
                        symbol: widget.activeChart()?.symbol() || 'BTCUSDT',
                        interval: widget.activeChart()?.resolution() || '1h'
                    };

                    await window.db.collection('chartStates').doc(window.currentUser.uid).set(saveData);
                    lastSaveTime = now;

                    // 간단한 저장 알림
                    const notification = document.createElement('div');
                    notification.style.cssText = `
                        position: fixed; top: 20px; right: 20px; z-index: 10000;
                        background: #22c55e; color: white; padding: 6px 10px;
                        border-radius: 4px; font-size: 11px; opacity: 0.9;
                    `;
                    notification.textContent = '💾 저장됨';
                    document.body.appendChild(notification);

                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.parentNode.removeChild(notification);
                        }
                    }, 1500);

                    console.log('✅ 차트 저장 완료 (크기:', serializedData.length, 'bytes)');
                } catch (error) {
                    console.error('❌ 차트 저장 실패:', error);
                }
            };

            // 디바운스된 자동 저장 함수
            const debouncedAutoSave = () => {
                if (saveTimeout) clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => {
                    widget.save((layoutData) => {
                        if (layoutData) {
                            saveChartLayout(layoutData);
                        }
                    });
                }, 2000); // 2초 디바운스
            };

            // 차트 이벤트 구독 (TradingView 공식 방법)
            try {
                // onAutoSaveNeeded 이벤트 구독 (TradingView 권장)
                if (widget.onAutoSaveNeeded) {
                    widget.onAutoSaveNeeded.subscribe(null, () => {
                        console.log('📊 TradingView onAutoSaveNeeded 이벤트');
                        debouncedAutoSave();
                    });
                    console.log('✅ onAutoSaveNeeded 이벤트 구독 완료');
                }

                // 차트 변경 이벤트 구독 (백업)
                const chart = widget.activeChart();
                chart.onSymbolChanged().subscribe(null, () => {
                    console.log('📊 심볼 변경');
                    debouncedAutoSave();
                });
                chart.onIntervalChanged().subscribe(null, () => {
                    console.log('📊 간격 변경');
                    debouncedAutoSave();
                });

                console.log('✅ 차트 이벤트 구독 완료');
            } catch (error) {
                console.error('❌ 차트 이벤트 구독 실패:', error);
            }

            // 사용자 상호작용 감지 (차트 컨테이너에서) - 향상된 버전
            const chartContainer = document.getElementById('tradingview_chart');
            if (chartContainer) {
                // 마우스 이벤트
                ['mouseup', 'touchend', 'click'].forEach(eventType => {
                    chartContainer.addEventListener(eventType, debouncedAutoSave);
                });

                // 키보드 이벤트 (드로잉 도구 사용 시)
                document.addEventListener('keyup', (e) => {
                    // Delete, Backspace, Escape 키 감지 (드로잉 삭제/취소)
                    if (['Delete', 'Backspace', 'Escape'].includes(e.key)) {
                        debouncedAutoSave();
                    }
                });

                console.log('✅ 향상된 상호작용 이벤트 구독 완료');
            }

            // 차트 복원 함수 (안정화)
            // 차트 복원 상태 관리
            let chartRestored = false;

            const restoreChart = async () => {
                if (!window.currentUser) {
                    console.log('❌ 사용자 미로그인 - 차트 복원 건너뜀');
                    return;
                }

                // 이미 복원되었다면 건너뜀
                if (chartRestored) {
                    console.log('ℹ️ 차트가 이미 복원됨 - 로그인 후 복원 건너뜀');
                    return;
                }

                try {
                    const userId = window.currentUser.uid;
                    console.log('🔄 차트 복원 시작...', userId);

                    // 1차: 자동 저장된 차트 확인
                    const chartDoc = await window.db.collection('chartStates').doc(userId).get();
                    if (chartDoc.exists) {
                        const data = chartDoc.data();
                        if (data.content) {
                            try {
                                // JSON 문자열을 객체로 파싱
                                const layoutData = typeof data.content === 'string' 
                                    ? JSON.parse(data.content) 
                                    : data.content;

                                widget.load(layoutData);
                                chartRestored = true; // 복원 완료 플래그 설정
                                showNotification('차트가 복원되었습니다', 'success');
                                console.log('✅ 로그인 후 자동 저장 차트 복원 완료');
                                return;
                            } catch (parseError) {
                                console.error('차트 데이터 파싱 실패:', parseError);
                            }
                        }
                    }

                    // 2차: 수동 저장된 차트 확인 (인덱스 오류 방지)
                    const layoutSnapshot = await window.db.collection('chartLayouts')
                        .where('userId', '==', userId)
                        .get();

                    if (!layoutSnapshot.empty) {
                        // 최신 데이터 찾기
                        let latestDoc = null;
                        let latestTime = 0;

                        layoutSnapshot.docs.forEach(doc => {
                            const data = doc.data();
                            const timestamp = data.timestamp?.toDate()?.getTime() || 0;
                            if (timestamp > latestTime) {
                                latestTime = timestamp;
                                latestDoc = doc;
                            }
                        });

                        if (latestDoc && latestDoc.data().content) {
                            try {
                                // JSON 문자열을 객체로 파싱
                                const layoutData = typeof latestDoc.data().content === 'string' 
                                    ? JSON.parse(latestDoc.data().content) 
                                    : latestDoc.data().content;

                                widget.load(layoutData);
                                chartRestored = true; // 복원 완료 플래그 설정
                                showNotification('차트가 복원되었습니다', 'success');
                                console.log('✅ 로그인 후 수동 저장 차트 복원 완료');
                                return;
                            } catch (parseError) {
                                console.error('수동 저장 차트 데이터 파싱 실패:', parseError);
                            }
                        }
                    }

                    console.log('ℹ️ 로그인 후 복원할 차트 없음');
                } catch (error) {
                    console.error('❌ 차트 복원 실패:', error);
                }
            };

            // 차트 완전 로드 후 복원 (초기 시도 후 백업으로 한 번 더)
            setTimeout(restoreChart, 100);
            setTimeout(() => {
                if (!chartRestored) {
                    console.log('🔄 백업 차트 복원 시도');
                    restoreChart();
                }
            }, 3000);

            // 주기적 백업 저장 (1분마다)
            setInterval(() => {
                if (window.currentUser) {
                    console.log('⏰ 주기적 백업 저장');
                    debouncedAutoSave();
                }
            }, 60000);

            // 페이지 종료 시 최종 저장
            const handlePageExit = () => {
                if (window.currentUser) {
                    widget.save((layoutData) => {
                        if (layoutData) {
                            try {
                                // JSON 직렬화
                                const serializedData = JSON.stringify(layoutData);

                                // 즉시 저장
                                window.db.collection('chartStates')
                                    .doc(window.currentUser.uid)
                                    .set({
                                        content: serializedData,
                                        timestamp: new Date(),
                                        updatedAt: Date.now(),
                                        userId: window.currentUser.uid
                                    });
                                console.log('🚪 페이지 종료 시 차트 저장 완료');
                            } catch (error) {
                                console.error('페이지 종료 시 저장 실패:', error);
                            }
                        }
                    });
                }
            };

            window.addEventListener('beforeunload', handlePageExit);
            window.addEventListener('pagehide', handlePageExit);
        });

    } catch (error) {
        console.error('TradingView 위젯 초기화 실패:', error);
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }

        // 차트 컨테이너에 오류 메시지 표시
        chartContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-color);">
                <div style="text-align: center;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px; color: var(--warning-color);"></i>
                    <p>차트를 불러올 수 없습니다.</p>
                    <button onclick="initializeTradingViewChart()" style="padding: 8px 16px; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer;">다시 시도</button>
                </div>
            </div>
        `;
    }
}

