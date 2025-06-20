/**
 * Layout Manager for Dashboard Cards
 * 대시보드 카드의 드래그 앤 드롭 레이아웃 관리 및 테마 토글
 */
class LayoutManager {
    constructor() {
        this.grid = null;
        this.init();
    }

    init() {
        console.log('Initializing 12-column GridStack layout manager...');
        this.grid = GridStack.init({
            column: 12, // 12-column 그리드 시스템
            cellHeight: 'auto', // 자동으로 정사각형 셀 생성
            float: false, // 카드가 아래로만 쌓이도록 하여 겹침 방지
            minRow: 1,
            disableDrag: true, 
            disableResize: true,
            handle: '.card-header', // 카드 헤더를 드래그 핸들로 사용
            resizable: {
                handles: 'e,se,s,sw,w,nw,n,ne', // 모든 방향에서 리사이즈 가능
                autoHide: true, // 편집 모드가 아닐 때는 핸들 숨김
                start: function(event, ui) {
                    // 리사이즈 시작 시 그리드에 맞춰 스냅
                    ui.element.addClass('resizing');
                },
                stop: function(event, ui) {
                    // 리사이즈 종료 시 그리드에 맞춰 정렬
                    ui.element.removeClass('resizing');
                    this.grid.compact();
                }.bind(this)
            }
        });
        
        this.grid.on('resizestop', (event, el) => {
            const canvas = el.querySelector('canvas');
            if (canvas && canvas.chart) {
                canvas.chart.resize();
            }
        });
        
        this.setupEventListeners();
        this.loadLayout();
        this.hideGridBackground(); // 초기에는 그리드 숨김
        this.setupSquareGrid(); // 정사각형 그리드 설정
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
        const isEnabled = !this.grid.opts.disableDrag;

        if (isEnabled) { // 편집 모드 종료
            this.grid.enableMove(false);
            this.grid.enableResize(false);
            layoutToggle.classList.remove('active');
            layoutToggle.innerHTML = '<i class="fas fa-edit"></i><span>레이아웃 편집</span>';
            if (layoutReset) layoutReset.style.display = 'none';
            this.hideGridBackground();
            this.saveLayout();
        } else { // 편집 모드 시작
            this.grid.enableMove(true);
            this.grid.enableResize(true);
            layoutToggle.classList.add('active');
            layoutToggle.innerHTML = '<i class="fas fa-save"></i><span>레이아웃 저장</span>';
            if (layoutReset) layoutReset.style.display = 'flex';
            this.showGridBackground();
        }
    }

    showGridBackground() {
        const gridElement = document.getElementById('dashboard-grid');
        if (gridElement) {
            gridElement.classList.add('grid-background');
        }
    }

    hideGridBackground() {
        const gridElement = document.getElementById('dashboard-grid');
        if (gridElement) {
            gridElement.classList.remove('grid-background');
        }
    }

    saveLayout() {
        const serializedData = this.grid.save();
        localStorage.setItem('dashboard-layout', JSON.stringify(serializedData));
        this.showToast('레이아웃이 저장되었습니다.', 'success');
    }

    loadLayout() {
        const savedLayout = localStorage.getItem('dashboard-layout');
        if (savedLayout) {
            this.grid.load(JSON.parse(savedLayout));
        }
    }

    resetLayout() {
        if (confirm('현재 레이아웃을 초기 상태로 되돌리시겠습니까?')) {
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

    setupSquareGrid() {
        // 그리드 컨테이너의 너비를 기준으로 정사각형 셀 크기 계산
        const gridElement = document.getElementById('dashboard-grid');
        if (gridElement) {
            const updateGridSize = () => {
                const containerWidth = gridElement.offsetWidth;
                const cellSize = containerWidth / 12; // 12-column 기준
                
                // GridStack의 cellHeight를 동적으로 설정
                this.grid.cellHeight(cellSize);
                
                // CSS 변수로 셀 크기 전달
                document.documentElement.style.setProperty('--grid-cell-size', `${cellSize}px`);
            };
            
            // 초기 설정 및 리사이즈 이벤트 리스너
            updateGridSize();
            window.addEventListener('resize', updateGridSize);
        }
    }
}

// 전역으로 내보내기
window.LayoutManager = LayoutManager; 