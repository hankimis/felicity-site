// 🔇 Chart Storage Disabled Stub - preserves API without side effects
class ChartStorage {
    constructor() {
        this.clientId = 'felicity-site';
        this.chartStorageApiVersion = '1.1';
        this.userId = null;
    }

    setUserId(userId) { this.userId = userId || null; }

    // Layout APIs (no-op)
    async saveChartLayout() { return null; }
    async loadChartLayout() { return null; }
    async getLastChartState() { return null; }
    async clearLastChartState() { return true; }

    // Auto-save (no-op)
    async updateAutoSaveState() { /* no-op */ }
    scheduleAutoSave() { /* no-op */ }

    // Drawings/Groups (no-op)
    async saveLineToolsAndGroups() { /* no-op */ }
    async loadLineToolsAndGroups() { return null; }

    // Helpers (kept for compatibility)
    hasDrawings() { return false; }
    hasStudies() { return false; }
    hasTemplates() { return false; }

    // TradingView External Save/Load Adapter (no-op implementation)
    createTradingViewAdapter() {
        return {
            getAllCharts: async () => [],
            saveChart: async () => null,
            getChart: async () => null,
            removeChart: async () => true,
            getChartContent: async () => null,
            getLastChart: async () => null,
            getChartsCount: async () => 0,
            renameChart: async () => true,
            saveLineToolsAndGroups: async () => { /* no-op */ },
            loadLineToolsAndGroups: async () => null,
            getAllChartTemplates: async () => [],
            saveChartTemplate: async () => null,
            getChartTemplate: async () => null,
            removeChartTemplate: async () => true,
            getAllStudyTemplates: async () => [],
            removeStudyTemplate: async () => true,
            saveStudyTemplate: async () => null,
            getStudyTemplate: async () => null,
            getAllDrawingTemplates: async () => [],
            saveDrawingTemplate: async () => null,
            getDrawingTemplate: async () => null,
            removeDrawingTemplate: async () => true,
        };
    }
}

// 🔥 전역으로 내보내기 (호출부 호환)
window.ChartStorage = ChartStorage; 