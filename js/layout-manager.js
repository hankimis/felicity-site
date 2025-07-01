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
}

// 전역으로 내보내기
window.LayoutManager = LayoutManager; 