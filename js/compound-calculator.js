export class CompoundCalculator {
    constructor() {
        this.init();
    }
    
    // 전역으로 노출
    static {
        window.CompoundCalculator = CompoundCalculator;
    }

    init() {
        console.log('💰 Compound Calculator initializing...');
        
        // DOM이 완전히 로드된 후 이벤트 리스너 설정
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupEventListeners();
                this.setupModal();
            });
        } else {
            this.setupEventListeners();
            this.setupModal();
        }
    }

    setupEventListeners() {
        console.log('💰 이벤트 리스너 설정 중...');
        
        // 계산하기 버튼
        const calculateBtn = document.getElementById('calculate-btn');
        if (calculateBtn) {
            console.log('💰 계산하기 버튼 찾음');
            calculateBtn.addEventListener('click', () => {
                console.log('💰 계산하기 버튼 클릭됨');
                this.showCalculationModal();
            });
        } else {
            console.warn('💰 계산하기 버튼을 찾을 수 없습니다');
        }

        // 입력 필드 포맷팅
        const initialAmountInput = document.getElementById('initial-amount');
        if (initialAmountInput) {
            initialAmountInput.addEventListener('input', (e) => this.formatNumberInput(e.target));
            initialAmountInput.addEventListener('blur', (e) => this.formatNumberInput(e.target));
        }

        const annualReturnInput = document.getElementById('annual-return');
        if (annualReturnInput) {
            annualReturnInput.addEventListener('input', (e) => this.formatPercentInput(e.target));
            annualReturnInput.addEventListener('blur', (e) => this.formatPercentInput(e.target));
        }
        
        console.log('💰 이벤트 리스너 설정 완료');
    }

    setupModal() {
        // 모달 HTML 생성
        const modalHTML = `
            <div class="compound-result-modal" id="compound-result-modal">
                <div class="modal-content-compound">
                    <button class="modal-close-compound" onclick="window.compoundCalculator.closeModal()">×</button>
                    <div class="result-summary">
                        <div class="total-profit" id="modal-total-profit">₩1,653,298</div>
                        <div class="final-amount" id="modal-final-amount">최종 금액</div>
                    </div>
                    <table class="result-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>수익 (₩)</th>
                                <th>총액 (₩)</th>
                                <th>수익률</th>
                            </tr>
                        </thead>
                        <tbody id="result-table-body">
                            <!-- 계산 결과가 여기에 동적으로 추가됩니다 -->
                        </tbody>
                    </table>
                    <div class="modal-actions">
                        <button class="btn-secondary-compound" onclick="window.compoundCalculator.shareResult()">공유하기</button>
                        <button class="btn-primary-compound" onclick="window.compoundCalculator.downloadResult()">저장</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // 모달 스타일 추가 (이미지 캡처 최적화)
        const style = document.createElement('style');
        style.textContent = `
            .compound-result-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
            }
            
            .compound-result-modal.show {
                opacity: 1;
                visibility: visible;
            }
            
            .modal-content-compound {
                background: white;
                border-radius: 12px;
                padding: 24px;
                max-width: 600px;
                width: 90%;
                max-height: 85vh;
                overflow-y: auto;
                position: relative;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
                margin: 20px;
            }
            
            .modal-close-compound {
                position: absolute;
                top: 12px;
                right: 16px;
                background: rgba(255, 255, 255, 0.9);
                border: 1px solid #ddd;
                border-radius: 50%;
                width: 32px;
                height: 32px;
                font-size: 18px;
                cursor: pointer;
                color: #666;
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
            }
            
            .modal-close-compound:hover {
                color: #333;
                background: rgba(255, 255, 255, 1);
                border-color: #999;
            }
            
            .result-summary {
                text-align: center;
                margin-bottom: 24px;
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 8px;
                color: white;
            }
            
            .total-profit {
                font-size: 32px;
                font-weight: bold;
                margin-bottom: 8px;
            }
            
            .final-amount {
                font-size: 16px;
                opacity: 0.9;
            }
            
            .result-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 24px;
                background: white;
            }
            
            .result-table th,
            .result-table td {
                padding: 12px;
                text-align: center;
                border-bottom: 1px solid #eee;
            }
            
            .result-table th {
                background: #f8f9fa;
                font-weight: 600;
                color: #333;
            }
            
            .result-table td {
                color: #666;
            }
            
            .profit-cell {
                color: #22c55e !important;
                font-weight: 600;
            }
            
            .amount-cell {
                font-weight: 600;
            }
            
            .percent-cell {
                color: #3b82f6 !important;
                font-weight: 600;
            }
            
            .modal-actions {
                display: flex;
                gap: 12px;
                justify-content: center;
            }
            
            .btn-secondary-compound,
            .btn-primary-compound {
                padding: 12px 24px;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .btn-secondary-compound {
                background: #f1f5f9;
                color: #475569;
            }
            
            .btn-secondary-compound:hover {
                background: #e2e8f0;
            }
            
            .btn-primary-compound {
                background: #3b82f6;
                color: white;
            }
            
            .btn-primary-compound:hover {
                background: #2563eb;
            }
            
            .btn-secondary-compound:disabled,
            .btn-primary-compound:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
        `;
        document.head.appendChild(style);
    }

    formatNumberInput(input) {
        let value = input.value.replace(/[^0-9]/g, '');
        if (value) {
            value = parseInt(value).toLocaleString();
        }
        input.value = value;
    }

    formatPercentInput(input) {
        let value = input.value.replace(/[^0-9.]/g, '');
        if (value && !value.endsWith('%')) {
            input.value = value + '%';
        }
    }

    parseNumberInput(value) {
        return parseInt(value.replace(/[^0-9]/g, '')) || 0;
    }

    parsePercentInput(value) {
        return parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
    }

    showCalculationModal() {
        try {
            // 입력값 가져오기
            const initialAmount = this.parseNumberInput(document.getElementById('initial-amount').value);
            const annualReturn = this.parsePercentInput(document.getElementById('annual-return').value);
            const investmentYears = parseInt(document.getElementById('investment-years').value) || 0;

            // 유효성 검사
            if (initialAmount <= 0 || annualReturn <= 0 || investmentYears <= 0) {
                alert('모든 값을 올바르게 입력해주세요.');
                return;
            }

            // 복리 계산
            const results = this.calculateCompoundInterest(initialAmount, annualReturn, investmentYears);
            
            // 모달에 결과 표시
            this.displayResults(results, initialAmount);
            
            // 모달 열기
            const modal = document.getElementById('compound-result-modal');
            if (modal) {
                modal.classList.add('show');
            }

        } catch (error) {
            console.error('복리 계산 중 오류:', error);
            alert('계산 중 오류가 발생했습니다.');
        }
    }

    calculateCompoundInterest(principal, rate, years) {
        const results = [];
        let currentAmount = principal;
        
        for (let year = 1; year <= years; year++) {
            const previousAmount = currentAmount;
            currentAmount = currentAmount * (1 + rate / 100);
            const yearlyProfit = currentAmount - previousAmount;
            const totalProfit = currentAmount - principal;
            const profitRate = ((currentAmount - principal) / principal) * 100;
            
            results.push({
                year: year,
                yearlyProfit: yearlyProfit,
                totalAmount: currentAmount,
                profitRate: profitRate
            });
        }
        
        return results;
    }

    displayResults(results, initialAmount) {
        const lastResult = results[results.length - 1];
        const totalProfit = lastResult.totalAmount - initialAmount;
        
        // 상단 요약 정보 업데이트
        const totalProfitElement = document.getElementById('modal-total-profit');
        const finalAmountElement = document.getElementById('modal-final-amount');
        
        if (totalProfitElement) {
            totalProfitElement.textContent = this.formatWon(totalProfit);
        }
        
        if (finalAmountElement) {
            finalAmountElement.textContent = `최종 금액 ${this.formatWon(lastResult.totalAmount)}`;
        }
        
        // 테이블 생성
        const tableBody = document.getElementById('result-table-body');
        if (tableBody) {
            tableBody.innerHTML = '';
            
            results.forEach(result => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${result.year}</td>
                    <td class="profit-cell">+${this.formatWon(result.yearlyProfit)}</td>
                    <td class="amount-cell">${this.formatWon(result.totalAmount)}</td>
                    <td class="percent-cell">${result.profitRate.toFixed(2)}%</td>
                `;
                tableBody.appendChild(row);
            });
        }
    }

    formatWon(amount) {
        return '₩' + Math.round(amount).toLocaleString();
    }

    closeModal() {
        const modal = document.getElementById('compound-result-modal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    async downloadResult() {
        try {
            const modal = document.getElementById('compound-result-modal');
            if (!modal) {
                console.error('모달을 찾을 수 없습니다');
                return;
            }

            // 모달이 보이는 상태인지 확인
            if (!modal.classList.contains('show')) {
                console.error('모달이 열려있지 않습니다');
                return;
            }

            // 로딩 표시
            const saveBtn = document.querySelector('.btn-primary-compound');
            let originalText = '';
            if (saveBtn) {
                originalText = saveBtn.textContent;
                saveBtn.textContent = '저장 중...';
                saveBtn.disabled = true;
            }

            // 모달 내용만 캡처하기 위해 컨텐츠 영역 선택
            const modalContent = modal.querySelector('.modal-content-compound');
            if (!modalContent) {
                throw new Error('모달 컨텐츠를 찾을 수 없습니다');
            }

            // 스크롤을 맨 위로 이동하여 전체 내용이 보이도록 함
            modalContent.scrollTop = 0;
            // 잠시 대기하여 스크롤이 완료되도록 함
            await new Promise(resolve => setTimeout(resolve, 100));

            // html2canvas를 사용하여 모달 캡처
            const canvas = await html2canvas(modalContent, {
                backgroundColor: '#ffffff',
                scale: 2, // 고해상도
                useCORS: true,
                allowTaint: false, // 보안상 안전하게
                logging: true,
                scrollX: 0,
                scrollY: 0,
                width: modalContent.scrollWidth,
                height: modalContent.scrollHeight,
                foreignObjectRendering: false
            });

            // 캡처된 이미지를 다운로드
            let imageUrl;
            try {
                imageUrl = canvas.toDataURL('image/png');
            } catch (e) {
                console.error('canvas.toDataURL() 오류:', e);
                alert('이미지 저장 권한 또는 CORS 문제로 저장이 불가합니다.');
                if (saveBtn) {
                    saveBtn.textContent = originalText;
                    saveBtn.disabled = false;
                }
                return;
            }
            const link = document.createElement('a');
            link.download = `복리계산결과_${new Date().toISOString().slice(0, 10)}.png`;
            link.href = imageUrl;
            link.click();

            // 버튼 상태 복원
            if (saveBtn) {
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            }

            console.log('복리 계산 결과 이미지 저장 완료');
        } catch (error) {
            console.error('이미지 저장 중 오류(전체):', error);
            alert('이미지 저장 중 오류가 발생했습니다. 콘솔을 확인해주세요.');
            // 버튼 상태 복원
            const saveBtn = document.querySelector('.btn-primary-compound');
            if (saveBtn) {
                saveBtn.textContent = '저장';
                saveBtn.disabled = false;
            }
        }
    }

    async shareResult() {
        try {
            const modal = document.getElementById('compound-result-modal');
            if (!modal) {
                console.error('모달을 찾을 수 없습니다');
                return;
            }

            // 모달이 보이는 상태인지 확인
            if (!modal.classList.contains('show')) {
                console.error('모달이 열려있지 않습니다');
                return;
            }

            // 로딩 표시
            const shareBtn = document.querySelector('.btn-secondary-compound');
            if (shareBtn) {
                const originalText = shareBtn.textContent;
                shareBtn.textContent = '공유 중...';
                shareBtn.disabled = true;
            }

            // 모달 내용만 캡처하기 위해 컨텐츠 영역 선택
            const modalContent = modal.querySelector('.modal-content-compound');
            if (!modalContent) {
                throw new Error('모달 컨텐츠를 찾을 수 없습니다');
            }

            // 스크롤을 맨 위로 이동하여 전체 내용이 보이도록 함
            modalContent.scrollTop = 0;
            // 잠시 대기하여 스크롤이 완료되도록 함
            await new Promise(resolve => setTimeout(resolve, 100));
            // html2canvas를 사용하여 모달 캡처
            const canvas = await html2canvas(modalContent, {
                backgroundColor: '#ffffff',
                scale: 2, // 고해상도
                useCORS: true,
                allowTaint: true,
                logging: false,
                scrollX: 0,
                scrollY: 0,
                width: modalContent.scrollWidth,
                height: modalContent.scrollHeight,
                foreignObjectRendering: false
            });

            // 캡처된 이미지를 Blob으로 변환
            canvas.toBlob(async (blob) => {
                try {
                    // Web Share API 지원 확인
                    if (navigator.share && navigator.canShare) {
                        const file = new File([blob], `복리계산결과_${new Date().toISOString().slice(0, 10)}.png`, {
                            type: 'image/png'
                        });

                        await navigator.share({
                            title: '복리 계산 결과',
                            text: '복리 계산 결과를 확인해보세요!',
                            files: [file]
                        });
                    } else {
                        // Web Share API를 지원하지 않는 경우 클립보드에 복사
                        await this.copyToClipboard(canvas);
                        alert('이미지가 클립보드에 복사되었습니다!');
                    }
                } catch (shareError) {
                    console.error('공유 중 오류:', shareError);
                    // 공유 실패 시 클립보드 복사로 대체
                    try {
                        await this.copyToClipboard(canvas);
                        alert('이미지가 클립보드에 복사되었습니다!');
                    } catch (clipboardError) {
                        console.error('클립보드 복사 중 오류:', clipboardError);
                        alert('공유 기능을 사용할 수 없습니다. 저장 기능을 사용해주세요.');
                    }
                }

                // 버튼 상태 복원
                if (shareBtn) {
                    shareBtn.textContent = originalText;
                    shareBtn.disabled = false;
                }
            }, 'image/png');

        } catch (error) {
            console.error('이미지 공유 중 오류:', error);
            alert('이미지 공유 중 오류가 발생했습니다.');
            
            // 버튼 상태 복원
            const shareBtn = document.querySelector('.btn-secondary-compound');
            if (shareBtn) {
                shareBtn.textContent = '공유하기';
                shareBtn.disabled = false;
            }
        }
    }

    async copyToClipboard(canvas) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(async (blob) => {
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({
                            'image/png': blob
                        })
                    ]);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            }, 'image/png');
        });
    }

    getLastCalculationResults() {
        // 마지막 계산 결과를 반환 (간단한 구현)
        const tableBody = document.getElementById('result-table-body');
        if (tableBody && tableBody.children.length > 0) {
            return {
                timestamp: new Date().toISOString(),
                results: Array.from(tableBody.children).map(row => ({
                    year: row.children[0].textContent,
                    profit: row.children[1].textContent,
                    total: row.children[2].textContent,
                    rate: row.children[3].textContent
                }))
            };
        }
        return null;
    }

    // 외부에서 접근 가능한 메서드들
    getCalculationResult() {
        const initialAmount = this.parseNumberInput(document.getElementById('initial-amount').value);
        const annualReturn = this.parsePercentInput(document.getElementById('annual-return').value);
        const investmentYears = parseInt(document.getElementById('investment-years').value) || 0;

        return {
            initialAmount,
            annualReturn,
            investmentYears
        };
    }
}

// 전역 객체로 내보내기
window.CompoundCalculator = CompoundCalculator; 