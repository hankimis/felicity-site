/**
 * Layout Manager for Dashboard Cards
 * 대시보드 카드의 드래그 앤 드롭 레이아웃 관리 및 테마 토글
 */
class LayoutManager {
    constructor() {
        this.grid = null;
        this.isEditMode = false; // 편집 모드 상태를 관리할 변수 추가
        this.init();
    }

    init() {
        console.log('Initializing stable GridStack layout manager...');
        this.grid = GridStack.init({
            float: true,
            column: 12,
            minRow: 1,
            cellHeight: 20,
            margin: 10,
            alwaysShowResizeHandle: false
        });
        this.loadLayout();
        this.setupEventListeners();
        this.grid.enableMove(false);
    }

    setupEventListeners() {
        const layoutToggle = document.getElementById('layout-toggle');
        const layoutReset = document.getElementById('layout-reset');

        if (layoutToggle) {
            layoutToggle.addEventListener('click', () => this.toggleEditMode());
        }
        if (layoutReset) {
            layoutReset.addEventListener('click', () => this.resetLayout());
        }
    }

    toggleEditMode() {
        const layoutToggle = document.getElementById('layout-toggle');
        const layoutReset = document.getElementById('layout-reset');
        const gridContainer = document.querySelector('.grid-stack');
        this.isEditMode = !this.isEditMode;
        if (this.isEditMode) {
            this.grid.enableMove(true);
            gridContainer.classList.add('edit-mode');
            layoutToggle.classList.add('active');
            layoutToggle.innerHTML = '<i class="fas fa-save"></i><span>편집 완료</span>';
            if (layoutReset) layoutReset.style.display = 'flex';
        } else {
            this.grid.enableMove(false);
            gridContainer.classList.remove('edit-mode');
            layoutToggle.classList.remove('active');
            layoutToggle.innerHTML = '<i class="fas fa-edit"></i><span>레이아웃 편집</span>';
            if (layoutReset) layoutReset.style.display = 'none';
            this.saveLayout();
        }
    }

    saveLayout() {
        const serializedData = this.grid.save();
        localStorage.setItem('dashboard-layout', JSON.stringify(serializedData));
        this.showToast('레이아웃이 저장되었습니다.', 'success');
        console.log('Layout saved.');
    }

    loadLayout() {
        const savedLayout = localStorage.getItem('dashboard-layout');
        if (savedLayout) {
            this.grid.load(JSON.parse(savedLayout));
        }
    }

    resetLayout() {
        if (confirm('현재 레이아웃을 초기 상태로 되돌리시겠습니까? 모든 변경사항이 사라집니다.')) {
            localStorage.removeItem('dashboard-layout');
            window.location.reload();
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type} show`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /**
     * 단일 차트 생성 (ChartLayoutManager 호환성)
     */
    createSingleChart() {
        console.log('🔄 단일 차트 생성 시작');
        
        // TradingView 차트 초기화 함수 호출
        if (typeof initializeSingleChart === 'function') {
            initializeSingleChart();
        } else if (typeof initializeTradingViewChart === 'function') {
            // 폴백: 전역 초기화 함수 사용
            initializeTradingViewChart();
        } else {
            console.warn('⚠️ 차트 초기화 함수를 찾을 수 없습니다');
        }
    }

    /**
     * 다중 차트 생성 (ChartLayoutManager 호환성)
     */
    createMultipleCharts(layout) {
        console.log(`🔄 ${layout}개 다중 차트 생성 시작`);
        
        // 현재는 단일 차트만 지원하므로 단일 차트로 폴백
        // 추후 다중 차트 지원 시 확장 가능
        this.createSingleChart();
        
        console.warn(`⚠️ 다중 차트(${layout}개)는 아직 구현되지 않음. 단일 차트로 폴백됨.`);
    }
}

// 전역으로 내보내기
window.LayoutManager = LayoutManager;

// 전역 인스턴스 생성 (차트 레이아웃 관리자에서 사용)
window.layoutManager = new LayoutManager(); 