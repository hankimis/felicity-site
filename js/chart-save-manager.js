(function(){
  // ChartSaveManager 기능 제거: 동일 API를 가진 no-op 스텁 제공
  const noop = () => {};
  const noopAsyncFalse = async () => false;
  const noopAsyncEmptyList = async () => [];

  const api = {
    initialize: noop,
    waitForWidgetReady: async () => true,
    isWidgetFullyReady: () => false,
    saveChartLayout: noopAsyncFalse,
    debouncedAutoSave: noop,
    debouncedSave: noop,
    manualSave: noopAsyncFalse,
    restoreChart: noopAsyncFalse,
    loadTempChart: noopAsyncFalse,
    loadAutoSavedChart: noopAsyncFalse,
    loadManualSavedChart: noopAsyncFalse,
    safeLoadChart: noopAsyncFalse,
    parseLayoutData: (c) => { try { return typeof c==='string'? JSON.parse(c): c; } catch(_) { return null; } },
    subscribeToEvents: noop,
    setupUserInteractionEvents: noop,
    setupDOMBasedDetection: noop,
    setupWidgetEvents: noop,
    scheduleRestore: noop,
    startPeriodicBackup: noop,
    cleanup: noop,
    quickSave: noop,
    getSavedCharts: noopAsyncEmptyList,
    deleteSavedChart: noopAsyncFalse,
    getCurrentSymbol: () => { try { return (window.symbolStore && window.symbolStore.get && window.symbolStore.get()) || 'BTCUSDT'; } catch(_) { return 'BTCUSDT'; } },
    getCurrentInterval: () => '1h',
  };

  window.chartSaveManager = api;
  console.log('✅ ChartSaveManager 기능 비활성화(스텁)');
})(); 