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
            // 안정적인 레이아웃을 위한 핵심 설정
            float: true, // true로 설정하여 카드를 자유롭게 배치하고 겹침을 방지
            column: 12,
            minRow: 1,
            cellHeight: 20, // 정사각형 강제 대신 고정된 최소 단위 높이 사용
            margin: 10,
            
            // 핸들은 CSS로 제어하므로 alwaysShow를 사용하지 않음
            alwaysShowResizeHandle: false, 
            
            // 리사이즈 핸들 기본 설정
            resizable: {
                handles: 'all'
            }
        });
        
        // 차트 리사이즈 이벤트 리스너
        this.grid.on('resizestop', (event, el) => {
            // 모든 차트 라이브러리에 대응하기 위한 일반적인 리사이즈
            const eventResize = new Event('resize');
            window.dispatchEvent(eventResize);

            // 기술 지표 카드의 경우, 안정적인 재렌더링을 위해 render 함수 직접 호출
            if (el.id === 'indicators-card-item' && window.analysisDashboard && window.analysisDashboard.modules.technicalIndicators) {
                window.analysisDashboard.modules.technicalIndicators.render();
            }
        });

        this.loadLayout();
        this.setupEventListeners();

        // 초기에는 편집 비활성화 상태로 시작
        this.grid.enableMove(false);
        this.grid.enableResize(false);
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
        
        this.isEditMode = !this.isEditMode; // 내부 상태를 기준으로 토글

        if (this.isEditMode) { // 편집 모드 시작
            this.grid.enableMove(true);
            this.grid.enableResize(true);
            gridContainer.classList.add('edit-mode');
            layoutToggle.classList.add('active');
            layoutToggle.innerHTML = '<i class="fas fa-save"></i><span>편집 완료</span>';
            if (layoutReset) layoutReset.style.display = 'flex';
        } else { // 편집 모드 종료
            this.grid.enableMove(false);
            this.grid.enableResize(false);
            gridContainer.classList.remove('edit-mode');
            layoutToggle.classList.remove('active');
            layoutToggle.innerHTML = '<i class="fas fa-edit"></i><span>레이아웃 편집</span>';
            if (layoutReset) layoutReset.style.display = 'none';
            this.saveLayout(); // 편집 완료 시에만 저장
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