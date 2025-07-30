// 커뮤니티 페이지용 실시간 채팅 기능
class CommunityChat {
    constructor() {
        this.messagesContainer = document.getElementById('chat-messages');
        this.messageForm = document.getElementById('chat-form');
        this.messageInput = document.getElementById('message-input');
        this.usersCountElement = document.getElementById('chat-users-count');
        this.messagesUnsubscribe = null;
        this.usersUnsubscribe = null;
        this.isChatFormInitialized = false;
        this.MESSAGES_PER_PAGE = 50; // 커뮤니티에서는 더 많은 메시지 로드
        
        this.init();
    }

    async init() {
        console.log('CommunityChat 초기화 시작');
        console.log('Firebase 서비스 상태:', {
            db: !!window.db,
            usersCountElement: !!this.usersCountElement
        });
        console.log('사용자 수 엘리먼트:', this.usersCountElement);

        if (!window.db) {
            console.warn('Firestore 서비스 대기 중...');
            setTimeout(() => this.init(), 1000);
            return;
        }

        console.log('CommunityChat 설정 시작');
        this.setupChatForm();
        this.loadMessages();
        this.setupUserCount();
    }

    // 메시지 렌더링 함수
    renderMessage(msg) {
        // 시스템 알람 메시지인지 확인
        const isSystemAlert = msg.data.isSystemAlert || msg.data.uid === 'system-alert';
        const isBreakingNews = msg.data.isBreakingNews || msg.data.uid === 'system-breaking-news';
        
        if (isSystemAlert) {
            // 시스템 알람 메시지
            const alertClass = isBreakingNews ? 'system-alert breaking-news' : 'system-alert';
            const clickable = isBreakingNews && msg.data.newsLink ? 'clickable' : '';
            
            return `
                <div class="message-item ${alertClass} ${clickable}" id="${msg.id}" data-uid="${msg.data.uid}" ${isBreakingNews && msg.data.newsLink ? `data-news-link="${msg.data.newsLink}"` : ''}>
                    <div class="message-content">
                        <div class="message-sender">
                            <strong>${msg.data.displayName}</strong>
                        </div>
                        <div class="message-text">${msg.data.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
                    </div>
                </div>
            `;
        }
        
        const profileImg = msg.data.photoThumbURL || msg.data.photoURL || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM2Mjc0OGEiLz4KPHBhdGggZD0iTTIwIDEwQzIyLjIwOTEgMTAgMjQgMTEuNzkwOSAyNCAxNEMyNCAxNi4yMDkxIDIyLjIwOTEgMTggMjAgMThDMTcuNzkwOSAxOCAxNiAxNi4yMDkxIDE2IDE0QzE2IDExLjc5MDkgMTcuNzkwOSAxMCAyMCAxMFoiIGZpbGw9IiNmZmZmZmYiLz4KPHBhdGggZD0iTTI4IDI4QzI4IDI0LjY4NjMgMjQuNDE4MyAyMiAyMCAyMkMxNS41ODE3IDIyIDEyIDI0LjY4NjMgMTIgMjhIMjhaIiBmaWxsPSIjZmZmZmZmIi8+Cjwvc3ZnPgo=';
        
        let isMyMessage = false;
        if (window.currentUser && msg.data.uid === window.currentUser.uid) {
            isMyMessage = true;
        } else if (!window.currentUser) {
            const guestNumber = localStorage.getItem('guestNumber');
            if (guestNumber && msg.data.uid === 'guest-' + guestNumber) {
                isMyMessage = true;
            }
        }
        const myMessageClass = isMyMessage ? 'my-message' : '';

        return `
            <div class="message-item ${myMessageClass}" id="${msg.id}" data-uid="${msg.data.uid}">
                <div class="chat-profile-pic-wrap">
                    <img class="chat-profile-pic" src="${profileImg}" alt="프로필" loading="lazy" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM2Mjc0OGEiLz4KPHBhdGggZD0iTTIwIDEwQzIyLjIwOTEgMTAgMjQgMTEuNzkwOSAyNCAxNEMyNCAxNi4yMDkxIDIyLjIwOTEgMTggMjAgMThDMTcuNzkwOSAxOCAxNiAxNi4yMDkxIDE2IDE0QzE2IDExLjc5MDkgMTcuNzkwOSAxMCAyMCAxMFoiIGZpbGw9IiNmZmZmZmYiLz4KPHBhdGggZD0iTTI4IDI4QzI4IDI0LjY4NjMgMjQuNDE4MyAyMiAyMCAyMkMxNS41ODE3IDIyIDEyIDI0LjY4NjMgMTIgMjhIMjhaIiBmaWxsPSIjZmZmZmZmIi8+Cjwvc3ZnPgo='" />
                </div>
                <div class="message-content">
                    <div class="message-sender">
                        <strong>${msg.data.displayName}</strong>
                    </div>
                    <div class="message-text">${msg.data.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
                </div>
            </div>
        `;
    }

    // 시간 포맷팅
    formatTime(timestamp) {
        if (!timestamp) return '';
        
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) { // 1분 이내
            return '방금 전';
        } else if (diff < 3600000) { // 1시간 이내
            return `${Math.floor(diff / 60000)}분 전`;
        } else if (diff < 86400000) { // 24시간 이내
            return `${Math.floor(diff / 3600000)}시간 전`;
        } else {
            return date.toLocaleDateString('ko-KR', { 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }

    // 메시지 로드
    async loadMessages() {
        try {
            console.log('Loading chat messages for community...');
            if (!window.db) throw new Error('Firestore (window.db) not initialized');
            
            const messagesQuery = window.db.collection('community-chat')
                .orderBy('timestamp', 'desc')
                .limit(this.MESSAGES_PER_PAGE);
            
            const snapshot = await messagesQuery.get();
            const messages = [];
            snapshot.forEach((doc) => {
                messages.push({ id: doc.id, data: doc.data() });
            });
            messages.reverse(); // 시간순으로 표시하기 위해 배열을 뒤집음
            
            if (this.messagesContainer) {
                const messagesHTML = messages.map(msg => this.renderMessage(msg)).join('');
                this.messagesContainer.innerHTML = messagesHTML;
                
                setTimeout(() => {
                    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
                }, 100);
            }
            
            this.setupRealtimeListener();
            console.log(`${messages.length} chat messages loaded for community`);
        } catch (error) {
            console.error('채팅 메시지 로드 실패:', error);
            if (this.messagesContainer) {
                this.messagesContainer.innerHTML = '<div class="chat-notice">메시지를 불러올 수 없습니다.</div>';
            }
        }
    }

    // 실시간 리스너 설정
    setupRealtimeListener() {
        if (this.messagesUnsubscribe) {
            this.messagesUnsubscribe();
        }
        
        if (!window.db) return;
        
        const messagesQuery = window.db.collection('community-chat')
            .where('timestamp', '>', new Date());
        
        this.messagesUnsubscribe = messagesQuery.onSnapshot((snapshot) => {
            if (!this.messagesContainer) return;

            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const msg = { id: change.doc.id, data: change.doc.data() };
                    if (!document.getElementById(msg.id)) {
                        const messageHTML = this.renderMessage(msg);
                        this.messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
                        
                        // 속보 뉴스 메시지 클릭 이벤트 추가
                        const messageElement = document.getElementById(msg.id);
                        if (messageElement && msg.data.isBreakingNews && msg.data.newsLink) {
                            messageElement.addEventListener('click', () => {
                                window.open(msg.data.newsLink, '_blank', 'noopener,noreferrer');
                            });
                        }
                    }
                }
            });
            
            // 새 메시지 수신 시 스크롤 조정
            const isScrolledToBottom = this.messagesContainer.scrollHeight - this.messagesContainer.clientHeight <= this.messagesContainer.scrollTop + 100;
            if (isScrolledToBottom) {
                this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
            }
        }, (error) => {
            console.error('실시간 메시지 리스너 오류:', error);
        });
    }

    // 사용자 메시지 스타일 업데이트
    updateUserMessageStyles() {
        if (!this.messagesContainer) return;

        const messages = this.messagesContainer.querySelectorAll('.message-item');
        const guestNumber = localStorage.getItem('guestNumber');

        messages.forEach(msgElement => {
            const msgUid = msgElement.dataset.uid;
            let isMyMessage = false;

            if (window.currentUser && msgUid === window.currentUser.uid) {
                isMyMessage = true;
            } else if (!window.currentUser && guestNumber && msgUid === 'guest-' + guestNumber) {
                isMyMessage = true;
            }

            if (isMyMessage) {
                msgElement.classList.add('my-message');
            } else {
                msgElement.classList.remove('my-message');
            }
        });
    }

    // 채팅 폼 설정
    setupChatForm() {
        console.log('채팅 폼 설정:', {
            messageForm: !!this.messageForm,
            messageInput: !!this.messageInput,
            initialized: this.isChatFormInitialized
        });

        if (!this.messageForm) return;

        // 기존 리스너 제거 (혹시라도 중복 방지)
        if (this._submitHandler) {
            this.messageForm.removeEventListener('submit', this._submitHandler);
            this._submitHandler = null;
        }

        if (!this.isChatFormInitialized) {
            // 전송 중 상태 플래그 추가
            this.isSubmitting = false;
            
            this._submitHandler = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // 이미 전송 중이면 무시
                if (this.isSubmitting) {
                    console.log('이미 메시지 전송 중입니다.');
                    return;
                }
                
                if (!this.messageInput.value.trim()) return;

                // 전송 시작
                this.isSubmitting = true;
                const originalText = this.messageInput.value.trim();
                
                // 즉시 입력창 비우기 (중복 전송 방지)
                this.messageInput.value = '';
                this.messageInput.disabled = true;

                try {
                    // 게스트 번호 처리
                    let guestNumber = localStorage.getItem('guestNumber');
                    if (!guestNumber) {
                        guestNumber = Math.floor(Math.random() * 10000).toString();
                        localStorage.setItem('guestNumber', guestNumber);
                    }

                    const messageData = {
                        text: originalText,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        uid: window.currentUser ? window.currentUser.uid : 'guest-' + guestNumber,
                        displayName: window.currentUser ? (window.currentUser.displayName || window.currentUser.email) : '게스트' + guestNumber,
                        photoURL: window.currentUser ? window.currentUser.photoURL : null
                    };

                    if (window.db) {
                        await window.db.collection('community-chat').add(messageData);
                        console.log('메시지 전송 성공');
                    }
                } catch (error) {
                    console.error('메시지 전송 실패:', error);
                    alert('메시지 전송에 실패했습니다. 다시 시도해주세요.');
                    // 실패 시 텍스트 복원
                    this.messageInput.value = originalText;
                } finally {
                    // 전송 완료 후 상태 복원
                    this.isSubmitting = false;
                    this.messageInput.disabled = false;
                    this.messageInput.focus();
                }
            };
            
            this.messageForm.addEventListener('submit', this._submitHandler);
            this.isChatFormInitialized = true;
            
            console.log('✅ 채팅 폼 이벤트 리스너 등록 완료');
        }
    }

    // 사용자 수 설정
    setupUserCount() {
        console.log('사용자 수 설정 시작');
        console.log('Firebase 상태:', {
            db: !!window.db,
            usersCountElement: !!this.usersCountElement
        });
        
        if (!this.usersCountElement) {
            console.warn('사용자 수 표시 엘리먼트를 찾을 수 없음 - ID: chat-users-count');
            // 엘리먼트를 다시 찾아보기
            this.usersCountElement = document.getElementById('chat-users-count');
            if (!this.usersCountElement) {
                console.error('chat-users-count 엘리먼트를 찾을 수 없습니다');
                return;
            }
        }
        
        // 먼저 기본값 설정
        this.usersCountElement.textContent = '1';
        console.log('기본 사용자 수 1로 설정');
        
        // Firestore만 사용하도록 변경 (권한 문제 해결)
        if (!window.db) {
            console.warn('Firestore 사용 불가능');
            return;
        }
        
        console.log('Firestore를 사용한 사용자 수 관리 시작');
        this.setupUserCountWithFirestore();
    }
    
    // Firestore를 사용한 사용자 수 관리 (대체 방법)
    setupUserCountWithFirestore() {
        console.log('Firestore를 사용한 사용자 수 관리 시작');
        if (!window.db) {
            console.warn('Firestore도 사용 불가능');
            return;
        }
        try {
            let guestNumber = localStorage.getItem('guestNumber');
            if (!guestNumber) {
                guestNumber = Math.floor(Math.random() * 10000).toString();
                localStorage.setItem('guestNumber', guestNumber);
            }
            const userId = window.currentUser ? window.currentUser.uid : 'guest-' + guestNumber;
            const userDisplayName = window.currentUser ? 
                (window.currentUser.displayName || window.currentUser.email) : 
                '게스트' + guestNumber;
            const userDoc = window.db.collection('online-users').doc(userId);

            // 1. 온라인 등록
            userDoc.set({
                displayName: userDisplayName,
                lastSeen: window.firebase.firestore.FieldValue.serverTimestamp(),
                online: true,
                page: 'community'
            }, { merge: true });

            // 2. 30초마다 lastSeen 갱신
            if (this._lastSeenInterval) clearInterval(this._lastSeenInterval);
            this._lastSeenInterval = setInterval(() => {
                userDoc.update({
                    lastSeen: window.firebase.firestore.FieldValue.serverTimestamp()
                });
            }, 30000);

            // 3. 3분 이상 오래된 사용자 정리
            if (this._cleanupInterval) clearInterval(this._cleanupInterval);
            this._cleanupInterval = setInterval(() => {
                const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
                window.db.collection('online-users')
                    .where('lastSeen', '<', threeMinutesAgo)
                    .get()
                    .then((snapshot) => {
                        snapshot.forEach((doc) => doc.ref.delete());
                    });
            }, 60000);

            // 4. 실시간 카운팅 (3분 이내 활동자만)
            if (this.usersUnsubscribe) this.usersUnsubscribe();
            const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
            this.usersUnsubscribe = window.db.collection('online-users')
                .where('page', '==', 'community')
                .where('lastSeen', '>=', threeMinutesAgo)
                .onSnapshot((snapshot) => {
                    const count = snapshot.size || 0;
                    if (this.usersCountElement) {
                        this.usersCountElement.textContent = String(Math.max(1, count));
                    }
                });

            // 5. 언로드 시 문서 삭제 및 interval 정리
            const handleBeforeUnload = () => {
                userDoc.delete();
                if (this._lastSeenInterval) clearInterval(this._lastSeenInterval);
                if (this._cleanupInterval) clearInterval(this._cleanupInterval);
            };
            window.addEventListener('beforeunload', handleBeforeUnload);
            window.addEventListener('pagehide', handleBeforeUnload);

        } catch (error) {
            if (this.usersCountElement) this.usersCountElement.textContent = '1';
        }
    }

    // 정리 함수
    cleanup() {
        console.log('CommunityChat 정리 시작');
        
        if (this.messagesUnsubscribe) {
            this.messagesUnsubscribe();
            this.messagesUnsubscribe = null;
        }
        
        if (this.usersUnsubscribe) {
            this.usersUnsubscribe();
            this.usersUnsubscribe = null;
        }
        
        // Firestore 사용자 정보 제거
        if (window.db) {
            try {
                const guestNumber = localStorage.getItem('guestNumber');
                const userId = window.currentUser ? window.currentUser.uid : 'guest-' + guestNumber;
                window.db.collection('online-users').doc(userId).delete()
                    .then(() => {
                        console.log('Firestore 사용자 정보 제거됨');
                    })
                    .catch((error) => {
                        console.error('Firestore 사용자 정보 제거 실패:', error);
                    });
            } catch (error) {
                console.error('Firestore 사용자 정보 제거 중 오류:', error);
            }
        }
        
        console.log('CommunityChat 정리 완료');
    }
}

// 간단한 사용자 수 시뮬레이션 (Firebase 실패 시 대체)
function setupSimpleUserCount() {
    const usersCountElement = document.getElementById('chat-users-count');
    if (!usersCountElement) {
        console.warn('사용자 수 엘리먼트를 찾을 수 없음');
        return;
    }
    
    // 랜덤한 온라인 사용자 수 시뮬레이션 (1-10명)
    const baseCount = Math.floor(Math.random() * 9) + 1; // 1-10
    usersCountElement.textContent = baseCount.toString();
    console.log('간단한 사용자 수 설정:', baseCount);
    
    // 30초마다 약간씩 변경 (±1명)
    setInterval(() => {
        const currentCount = parseInt(usersCountElement.textContent) || 1;
        const change = Math.random() > 0.5 ? 1 : -1;
        const newCount = Math.max(1, Math.min(15, currentCount + change));
        usersCountElement.textContent = newCount.toString();
        console.log('사용자 수 업데이트:', newCount);
    }, 30000);
}

// 페이지 로드 시 단 한 번만 인스턴스 생성
document.addEventListener('DOMContentLoaded', () => {
    if (!window.communityChat) {
        window.communityChat = new CommunityChat();
    }
});

// 페이지 표시될 때마다 사용자 수 재설정
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        console.log('페이지가 다시 표시됨');
        
        // 사용자 수 엘리먼트 확인 및 복구
        const usersCountElement = document.getElementById('chat-users-count');
        if (usersCountElement && usersCountElement.textContent === '0') {
            console.log('사용자 수가 0으로 리셋됨, 복구 중');
            usersCountElement.textContent = '1';
        }
        
        if (window.communityChat) {
            setTimeout(() => {
                if (window.communityChat) {
                    window.communityChat.setupUserCount();
                }
            }, 1000);
        } else {
            // 채팅 인스턴스가 없으면 간단한 사용자 수 사용
            setTimeout(setupSimpleUserCount, 1000);
        }
    }
});

// 5초마다 사용자 수 체크 및 복구 (안전장치)
setInterval(() => {
    const usersCountElement = document.getElementById('chat-users-count');
    if (usersCountElement) {
        const currentCount = parseInt(usersCountElement.textContent) || 0;
        if (currentCount === 0) {
            console.log('사용자 수가 0으로 발견됨, 자동 복구');
            usersCountElement.textContent = '1';
        }
    }
}, 5000);

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
    if (window.communityChat) {
        window.communityChat.cleanup();
    }
}); 