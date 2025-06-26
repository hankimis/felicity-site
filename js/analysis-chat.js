// 분석 대시보드용 실시간 채팅 기능
class AnalysisChat {
    constructor() {
        this.messagesContainer = document.getElementById('chat-messages');
        this.messageForm = document.getElementById('chat-form');
        this.messageInput = document.getElementById('message-input');
        this.usersCountElement = document.getElementById('chat-users-count');
        this.messagesUnsubscribe = null;
        this.isChatFormInitialized = false;
        this.MESSAGES_PER_PAGE = 40; // 컴팩트한 디자인으로 더 많은 메시지 표시
        
        this.init();
    }

    async init() {
        if (!window.db) {
            console.warn('Firestore not initialized, waiting...');
            setTimeout(() => this.init(), 1000);
            return;
        }

        this.setupChatForm();
        this.loadMessages();
        this.setupUserCount();
    }

    // 메시지 렌더링 함수
    renderMessage(msg) {
        const profileImg = msg.data.photoThumbURL || msg.data.photoURL || 'default-profile.png';
        
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
                    <img class="chat-profile-pic" src="${profileImg}" alt="프로필" loading="lazy" />
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

    // 메시지 로드
    async loadMessages() {
        try {
            console.log('Loading chat messages for analysis dashboard...');
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
                }, 50);
            }
            
            this.setupRealtimeListener();
            console.log(`${messages.length} chat messages loaded for analysis dashboard`);
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
                    }
                }
            });
            
            // 새 메시지 수신 시 스크롤 조정
            const isScrolledToBottom = this.messagesContainer.scrollHeight - this.messagesContainer.clientHeight <= this.messagesContainer.scrollTop + 50;
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
        if (this.messageForm && !this.isChatFormInitialized) {
            this.messageForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!this.messageInput.value.trim()) return;

                try {
                    // 게스트 번호 처리
                    let guestNumber = localStorage.getItem('guestNumber');
                    if (!guestNumber) {
                        guestNumber = Math.floor(Math.random() * 10000).toString();
                        localStorage.setItem('guestNumber', guestNumber);
                    }

                    const messageData = {
                        text: this.messageInput.value.trim(),
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        uid: window.currentUser ? window.currentUser.uid : 'guest-' + guestNumber,
                        displayName: window.currentUser ? (window.currentUser.displayName || window.currentUser.email) : '게스트' + guestNumber,
                        photoURL: window.currentUser ? window.currentUser.photoURL : null
                    };

                    if (window.db) await window.db.collection('community-chat').add(messageData);
                    this.messageInput.value = '';
                } catch (error) {
                    console.error('메시지 전송 실패:', error);
                    // 대시보드에서는 조용한 에러 처리
                }
            });
            this.isChatFormInitialized = true;
        }
    }

    // 사용자 수 설정
    setupUserCount() {
        if (!window.db || !window.database) return;
        
        // 연결된 사용자 수를 추적
        const connectedUsersRef = window.database.ref('connected-users');
        
        // 현재 사용자 연결 상태 관리
        const guestNumber = localStorage.getItem('guestNumber') || Math.floor(Math.random() * 10000).toString();
        if (!localStorage.getItem('guestNumber')) {
            localStorage.setItem('guestNumber', guestNumber);
        }
        
        const myConnectionRef = connectedUsersRef.child(window.currentUser ? window.currentUser.uid : 'guest-' + guestNumber);
        
        // 연결 상태 모니터링
        window.database.ref('.info/connected').on('value', (snapshot) => {
            if (snapshot.val() === true) {
                myConnectionRef.set({
                    connected: true,
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    displayName: window.currentUser ? (window.currentUser.displayName || window.currentUser.email) : '게스트' + guestNumber
                });
                
                // 연결 해제 시 자동으로 제거
                myConnectionRef.onDisconnect().remove();
            }
        });

        // 연결된 사용자 수 업데이트
        connectedUsersRef.on('value', (snapshot) => {
            if (this.usersCountElement) {
                this.usersCountElement.textContent = snapshot.numChildren() || 0;
            }
        });
    }

    // 정리 함수
    cleanup() {
        if (this.messagesUnsubscribe) {
            this.messagesUnsubscribe();
        }
    }
}

// 분석 대시보드에서 채팅 초기화
document.addEventListener('DOMContentLoaded', () => {
    // 인증 상태 변경 시 채팅 스타일 업데이트
    if (window.auth) {
        window.auth.onAuthStateChanged((user) => {
            if (window.analysisChat) {
                window.analysisChat.updateUserMessageStyles();
            }
        });
    }
    
    // 채팅 인스턴스 생성
    window.analysisChat = new AnalysisChat();
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
    if (window.analysisChat) {
        window.analysisChat.cleanup();
    }
}); 