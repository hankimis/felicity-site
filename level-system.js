import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, setDoc, collection, addDoc, serverTimestamp, increment } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 레벨 경험치 시스템
class LevelSystem {
    constructor() {
        this.pointsConfig = {
            attendance: 10,      // 출석체크 시 포인트
            comment: 5,          // 댓글 작성 시 포인트
            like_received: 3,    // 좋아요 받을 시 포인트
            post_created: 15,    // 게시글 작성 시 포인트
            daily_login: 2       // 일일 로그인 시 포인트
        };
        
        this.levelThresholds = [
            { level: "새싹", minExp: 0, maxExp: 99, name: "새싹", color: "#22c55e", gradient: "linear-gradient(135deg, #22c55e, #16a34a)" },
            { level: "초보", minExp: 100, maxExp: 249, name: "초보", color: "#3b82f6", gradient: "linear-gradient(135deg, #3b82f6, #2563eb)" },
            { level: "일반", minExp: 250, maxExp: 499, name: "일반", color: "#8b5cf6", gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)" },
            { level: "숙련", minExp: 500, maxExp: 999, name: "숙련", color: "#f59e0b", gradient: "linear-gradient(135deg, #f59e0b, #d97706)" },
            { level: "전문가", minExp: 1000, maxExp: 1999, name: "전문가", color: "#ef4444", gradient: "linear-gradient(135deg, #ef4444, #dc2626)" },
            { level: "고수", minExp: 2000, maxExp: 3999, name: "고수", color: "#ec4899", gradient: "linear-gradient(135deg, #ec4899, #db2777)" },
            { level: "달인", minExp: 4000, maxExp: 7999, name: "달인", color: "#06b6d4", gradient: "linear-gradient(135deg, #06b6d4, #0891b2)" },
            { level: "마스터", minExp: 8000, maxExp: 15999, name: "마스터", color: "#84cc16", gradient: "linear-gradient(135deg, #84cc16, #65a30d)" },
            { level: "그랜드마스터", minExp: 16000, maxExp: 31999, name: "그랜드마스터", color: "#f97316", gradient: "linear-gradient(135deg, #f97316, #ea580c)" },
            { level: "레전드", minExp: 32000, maxExp: 99999, name: "레전드", color: "#dc2626", gradient: "linear-gradient(135deg, #dc2626, #b91c1c)" }
        ];
    }

    // 경험치로 레벨 계산
    calculateLevel(experience) {
        for (let i = this.levelThresholds.length - 1; i >= 0; i--) {
            const threshold = this.levelThresholds[i];
            if (experience >= threshold.minExp) {
                return {
                    level: threshold.level,
                    name: threshold.name,
                    color: threshold.color,
                    gradient: threshold.gradient,
                    currentExp: experience,
                    minExp: threshold.minExp,
                    maxExp: threshold.maxExp,
                    progress: threshold.maxExp === 99999 ? 100 : ((experience - threshold.minExp) / (threshold.maxExp - threshold.minExp)) * 100
                };
            }
        }
        return {
            ...this.levelThresholds[0],
            currentExp: experience,
            progress: (experience / this.levelThresholds[0].maxExp) * 100
        };
    }

    // 다음 레벨 정보 가져오기
    getNextLevel(experience) {
        const currentLevel = this.calculateLevel(experience);
        const currentIndex = this.levelThresholds.findIndex(level => level.name === currentLevel.name);
        
        if (currentIndex < this.levelThresholds.length - 1) {
            return this.levelThresholds[currentIndex + 1];
        }
        return null; // 최고 레벨
    }

    // 포인트 추가
    async addPoints(userId, pointType, amount = null) {
        try {
            const points = amount || this.pointsConfig[pointType];
            if (!points) return false;

            const userRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userRef);
            
            const oldPoints = userDoc.exists() ? (userDoc.data().points || 0) : 0;
            const newPoints = oldPoints + points;
            
            // 사용자 포인트 업데이트
            if (userDoc.exists()) {
                await updateDoc(userRef, {
                    points: newPoints
                });
            } else {
                await setDoc(userRef, {
                    points: newPoints,
                    displayName: 'Anonymous',
                    level: "새싹"
                });
            }

            // 포인트 히스토리 추가
            await addDoc(collection(db, 'pointHistory'), {
                userId: userId,
                action: pointType,
                points: points,
                timestamp: serverTimestamp(),
                description: this.getPointDescription(pointType)
            });

            // 레벨업 체크
            const oldLevelInfo = this.calculateLevel(oldPoints);
            const newLevelInfo = this.calculateLevel(newPoints);
            
            if (newLevelInfo.name !== oldLevelInfo.name) {
                this.showLevelUpNotification(oldLevelInfo, newLevelInfo);
                // 레벨업 보너스 포인트
                await this.addLevelUpBonus(userId, newLevelInfo);
            }

            return true;
        } catch (error) {
            console.error('포인트 추가 실패:', error);
            return false;
        }
    }

    // 레벨업 보너스
    async addLevelUpBonus(userId, levelInfo) {
        const bonusPoints = this.getLevelBonus(levelInfo.name);
        const userRef = doc(db, 'users', userId);
        
        try {
            await updateDoc(userRef, {
                points: increment(bonusPoints)
            });

            // 보너스 히스토리 추가
            await addDoc(collection(db, 'pointHistory'), {
                userId: userId,
                action: 'level_up_bonus',
                points: bonusPoints,
                timestamp: serverTimestamp(),
                description: `${levelInfo.name} 달성 보너스`
            });
        } catch (error) {
            console.error('레벨업 보너스 추가 실패:', error);
        }
    }

    // 포인트 설명
    getPointDescription(pointType) {
        const descriptions = {
            attendance: '출석체크 완료',
            comment: '댓글 작성',
            like_received: '좋아요 받음',
            post_created: '게시글 작성',
            daily_login: '일일 로그인',
            level_up_bonus: '레벨업 보너스'
        };
        return descriptions[pointType] || '포인트 획득';
    }

    // 레벨업 알림
    showLevelUpNotification(oldLevelInfo, newLevelInfo) {
        // 기존 모달이 있으면 제거
        const existingModal = document.querySelector('.level-up-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // 레벨업 모달 생성
        const modal = document.createElement('div');
        modal.className = 'level-up-modal';
        modal.innerHTML = `
            <div class="level-up-content">
                <div class="level-up-animation">🎉</div>
                <h2>레벨업!</h2>
                <p>${oldLevelInfo.name} → ${newLevelInfo.name}</p>
                <div class="new-level-badge" style="background: ${newLevelInfo.gradient || newLevelInfo.color}">
                    ⭐ ${newLevelInfo.name}
                </div>
                <p>보너스 포인트 ${this.getLevelBonus(newLevelInfo.name)}점 획득!</p>
                <button onclick="this.parentElement.parentElement.remove()">확인</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 5초 후 자동 닫기
        setTimeout(() => {
            if (modal.parentElement) {
                modal.remove();
            }
        }, 5000);
    }

    // 레벨별 보너스 포인트 계산
    getLevelBonus(levelName) {
        const bonusMap = {
            "새싹": 10,
            "초보": 20,
            "일반": 30,
            "숙련": 50,
            "전문가": 80,
            "고수": 120,
            "달인": 180,
            "마스터": 250,
            "그랜드마스터": 350,
            "레전드": 500
        };
        return bonusMap[levelName] || 10;
    }

    // 사용자 레벨 정보 가져오기
    async getUserLevel(userId) {
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (!userDoc.exists()) {
                return this.calculateLevel(0);
            }
            
            const points = userDoc.data().points || 0;
            return this.calculateLevel(points);
        } catch (error) {
            console.error('사용자 레벨 정보 가져오기 실패:', error);
            return this.calculateLevel(0);
        }
    }

    // 레벨 배지 HTML 생성
    generateLevelBadge(levelInfo) {
        return `
            <div class="level-badge" style="background: ${levelInfo.gradient || levelInfo.color}">
                <span class="level-icon">⭐</span>
                <span class="level-name">${levelInfo.name}</span>
            </div>
        `;
    }

    // 경험치 바 HTML 생성
    generateExpBar(levelInfo) {
        const nextLevel = this.getNextLevel(levelInfo.currentExp);
        const progressText = nextLevel ? 
            `${levelInfo.currentExp - levelInfo.minExp} / ${nextLevel.minExp - levelInfo.minExp} EXP` :
            `${levelInfo.currentExp} EXP (최고 레벨)`;
            
        return `
            <div class="exp-bar-container">
                <div class="exp-bar">
                    <div class="exp-progress" style="width: ${levelInfo.progress}%; background: ${levelInfo.gradient || levelInfo.color}"></div>
                </div>
                <div class="exp-text">
                    ${progressText}
                </div>
            </div>
        `;
    }
}

// 전역 레벨 시스템 인스턴스
window.levelSystem = new LevelSystem();

// 출석체크 시 포인트 추가
window.addAttendancePoints = async function(userId) {
    return await window.levelSystem.addPoints(userId, 'attendance');
}

// 댓글 작성 시 포인트 추가
window.addCommentPoints = async function(userId) {
    return await window.levelSystem.addPoints(userId, 'comment');
}

// 좋아요 받을 시 포인트 추가
window.addLikePoints = async function(userId) {
    return await window.levelSystem.addPoints(userId, 'like_received');
}

// 게시글 작성 시 포인트 추가
window.addPostPoints = async function(userId) {
    return await window.levelSystem.addPoints(userId, 'post_created');
}

// 일일 로그인 시 포인트 추가
window.addDailyLoginPoints = async function(userId) {
    return await window.levelSystem.addPoints(userId, 'daily_login');
}

// 사용자 레벨 정보 표시
window.displayUserLevel = async function(userId, containerId) {
    const levelInfo = await window.levelSystem.getUserLevel(userId);
    const container = document.getElementById(containerId);
    
    if (container) {
        container.innerHTML = `
            ${window.levelSystem.generateLevelBadge(levelInfo)}
            ${window.levelSystem.generateExpBar(levelInfo)}
        `;
    }
}

export { LevelSystem }; 