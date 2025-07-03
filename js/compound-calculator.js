export class CompoundCalculator {
    constructor() {
        this.init();
    }

    init() {
        console.log('💰 Compound Calculator initializing...');
        this.setupEventListeners();
        this.setupModal();
    }

    setupEventListeners() {
        // 계산하기 버튼
        const calculateBtn = document.getElementById('calculate-btn');
        if (calculateBtn) {
            calculateBtn.addEventListener('click', () => this.showCalculationModal());
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
                        <button class="btn-secondary-compound" onclick="window.compoundCalculator.closeModal()">공유하기</button>
                        <button class="btn-primary-compound" onclick="window.compoundCalculator.downloadResult()">저장</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
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

    downloadResult() {
        // 결과 다운로드 기능 (간단한 구현)
        const results = this.getLastCalculationResults();
        if (results) {
            const dataStr = JSON.stringify(results, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = '복리계산결과.json';
            link.click();
            URL.revokeObjectURL(url);
        }
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