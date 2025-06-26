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
            database: !!window.database,
            auth: !!window.auth
        });
        console.log('사용자 수 엘리먼트:', this.usersCountElement);

        if (!window.db || !window.database) {
            console.warn('Firebase 서비스 대기 중...');
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
        const profileImg = msg.data.photoThumbURL || msg.data.photoURL || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNFNUU3RUIiLz4KPHBhdGggZD0iTTIwIDEwQzIyLjIwOTEgMTAgMjQgMTEuNzkwOSAyNCAxNEMyNCAxNi4yMDkxIDIyLjIwOTEgMTggMjAgMThDMTcuNzkwOSAxOCAxNiAxNi4yMDkxIDE2IDE0QzE2IDExLjc5MDkgMTcuNzkwOSAxMCAyMCAxMFoiIGZpbGw9IiM5Q0EzQUYiLz4KPHBhdGggZD0iTTI4IDI4QzI4IDI0LjY4NjMgMjQuNDE4MyAyMiAyMCAyMkMxNS41ODE3IDIyIDEyIDI0LjY4NjMgMTIgMjhIMjhaIiBmaWxsPSIjOUNBM0FGIi8+Cjwvc3ZnPgo=';
        
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
                    <img class="chat-profile-pic" src="${profileImg}" alt="프로필" loading="lazy" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNFNUU3RUIiLz4KPHBhdGggZD0iTTIwIDEwQzIyLjIwOTEgMTAgMjQgMTEuNzkwOSAyNCAxNEMyNCAxNi4yMDkxIDIyLjIwOTEgMTggMjAgMThDMTcuNzkwOSAxOCAxNiAxNi4yMDkxIDE2IDE0QzE2IDExLjc5MDkgMTcuNzkwOSAxMCAyMCAxMFoiIGZpbGw9IiM5Q0EzQUYiLz4KPHBhdGggZD0iTTI4IDI4QzI4IDI0LjY4NjMgMjQuNDE4MyAyMiAyMCAyMkMxNS41ODE3IDIyIDEyIDI0LjY4NjMgMTIgMjhIMjhaIiBmaWxsPSIjOUNBM0FGIi8+Cjwvc3ZnPgo='" />
                </div>
                <div class="message-content">
                    <div class="message-sender">
                        <strong>${msg.data.displayName}</strong>
                        <span class="message-time">${this.formatTime(msg.data.timestamp)}</span>
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
                    alert('메시지 전송에 실패했습니다. 다시 시도해주세요.');
                }
            });
            this.isChatFormInitialized = true;
        }
    }

    // 사용자 수 설정
    setupUserCount() {
        console.log('사용자 수 설정 시작');
        console.log('Firebase 상태:', {
            db: !!window.db,
            database: !!window.database,
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
        
        // Firebase Realtime Database 사용 불가능한 경우 Firestore로 대체
        if (!window.database) {
            console.warn('Firebase Realtime Database 사용 불가능, Firestore로 대체');
            this.setupUserCountWithFirestore();
            return;
        }
        
        try {
            // 연결된 사용자 수를 추적
            const connectedUsersRef = window.database.ref('community-chat-users');
            
            // 현재 사용자 연결 상태 관리
            let guestNumber = localStorage.getItem('guestNumber');
            if (!guestNumber) {
                guestNumber = Math.floor(Math.random() * 10000).toString();
                localStorage.setItem('guestNumber', guestNumber);
            }
            
            const userId = window.currentUser ? window.currentUser.uid : 'guest-' + guestNumber;
            const myConnectionRef = connectedUsersRef.child(userId);
            
            console.log('사용자 ID:', userId);
            
            // 연결 상태 모니터링
            const connectedRef = window.database.ref('.info/connected');
            connectedRef.on('value', (snapshot) => {
                console.log('Firebase 연결 상태:', snapshot.val());
                if (snapshot.val() === true) {
                    const userData = {
                        connected: true,
                        timestamp: firebase.database.ServerValue.TIMESTAMP,
                        displayName: window.currentUser ? 
                            (window.currentUser.displayName || window.currentUser.email) : 
                            '게스트' + guestNumber,
                        lastSeen: firebase.database.ServerValue.TIMESTAMP
                    };
                    
                    console.log('사용자 데이터 설정:', userData);
                    myConnectionRef.set(userData).then(() => {
                        console.log('사용자 데이터 저장 성공');
                    }).catch((error) => {
                        console.error('사용자 데이터 저장 실패:', error);
                    });
                    
                    // 연결 해제 시 자동으로 제거
                    myConnectionRef.onDisconnect().remove().then(() => {
                        console.log('연결 해제 핸들러 설정 완료');
                    }).catch((error) => {
                        console.error('연결 해제 핸들러 설정 실패:', error);
                    });
                }
            }, (error) => {
                console.error('연결 상태 모니터링 오류:', error);
            });

            // 연결된 사용자 수 업데이트
            this.usersUnsubscribe = connectedUsersRef.on('value', (snapshot) => {
                const count = snapshot.numChildren() || 0;
                console.log('현재 접속자 수:', count, '데이터:', snapshot.val());
                
                if (this.usersCountElement) {
                    // 최소 1명은 표시 (본인)
                    const displayCount = Math.max(1, count);
                    this.usersCountElement.textContent = displayCount;
                    console.log('사용자 수 업데이트됨:', displayCount);
                } else {
                    console.warn('사용자 수 엘리먼트가 없음');
                }
            }, (error) => {
                console.error('사용자 수 리스너 오류:', error);
                // 오류 발생 시 기본값 유지
                if (this.usersCountElement) {
                    this.usersCountElement.textContent = '1';
                }
            });
            
        } catch (error) {
            console.error('사용자 수 설정 중 오류:', error);
            // 오류 발생 시 Firestore로 대체
            this.setupUserCountWithFirestore();
        }
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
            
            // 현재 사용자를 온라인 목록에 추가
            const userDoc = window.db.collection('online-users').doc(userId);
            userDoc.set({
                displayName: window.currentUser ? 
                    (window.currentUser.displayName || window.currentUser.email) : 
                    '게스트' + guestNumber,
                lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                online: true
            }).then(() => {
                console.log('Firestore 사용자 정보 저장 완료');
            }).catch((error) => {
                console.error('Firestore 사용자 정보 저장 실패:', error);
            });
            
            // 5분 이상 오래된 사용자 제거 (주기적으로)
            setInterval(() => {
                const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                window.db.collection('online-users')
                    .where('lastSeen', '<', fiveMinutesAgo)
                    .get()
                    .then((snapshot) => {
                        snapshot.forEach((doc) => {
                            doc.ref.delete();
                        });
                    });
            }, 60000); // 1분마다 정리
            
            // 온라인 사용자 수 실시간 업데이트
            window.db.collection('online-users').onSnapshot((snapshot) => {
                const count = snapshot.size || 0;
                console.log('Firestore 현재 접속자 수:', count);
                
                if (this.usersCountElement) {
                    const displayCount = Math.max(1, count);
                    this.usersCountElement.textContent = displayCount;
                    console.log('Firestore 사용자 수 업데이트됨:', displayCount);
                }
            }, (error) => {
                console.error('Firestore 사용자 수 리스너 오류:', error);
            });
            
            // 페이지 언로드 시 사용자 제거
            window.addEventListener('beforeunload', () => {
                userDoc.delete();
            });
            
        } catch (error) {
            console.error('Firestore 사용자 수 설정 중 오류:', error);
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
        
        // 사용자 연결 정보 제거
        if (window.database) {
            try {
                const guestNumber = localStorage.getItem('guestNumber');
                const userId = window.currentUser ? window.currentUser.uid : 'guest-' + guestNumber;
                if (userId) {
                    window.database.ref('community-chat-users').child(userId).remove();
                    console.log('사용자 연결 정보 제거됨:', userId);
                }
            } catch (error) {
                console.error('사용자 연결 정보 제거 실패:', error);
            }
        }
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

// 커뮤니티 페이지에서 채팅 초기화
function initializeCommunityChat() {
    console.log('커뮤니티 채팅 초기화 시도');
    
    // DOM 요소가 있는지 확인
    const chatMessages = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const usersCount = document.getElementById('chat-users-count');
    
    console.log('DOM 요소 확인:', {
        chatMessages: !!chatMessages,
        chatForm: !!chatForm,
        usersCount: !!usersCount
    });
    
    if (!chatMessages || !chatForm) {
        console.warn('필수 DOM 요소가 없어 채팅 초기화 지연');
        setTimeout(initializeCommunityChat, 500);
        return;
    }
    
    // 사용자 수 엘리먼트가 없으면 간단한 방법 사용
    if (!usersCount) {
        console.warn('사용자 수 엘리먼트가 없어서 나중에 시도');
        setTimeout(() => {
            const retryUsersCount = document.getElementById('chat-users-count');
            if (retryUsersCount) {
                setupSimpleUserCount();
            }
        }, 1000);
    } else {
        // 일단 기본값 설정
        usersCount.textContent = '1';
    }
    
    // Firebase 준비 여부와 관계없이 채팅 기능은 초기화
    let retryCount = 0;
    const maxRetries = 5;
    
    function tryInitializeChat() {
        if ((!window.database && !window.db) && retryCount < maxRetries) {
            console.warn(`Firebase가 준비되지 않음 (시도 ${retryCount + 1}/${maxRetries})`);
            retryCount++;
            setTimeout(tryInitializeChat, 1000);
            return;
        }
        
        // 기존 인스턴스가 있으면 정리
        if (window.communityChat) {
            window.communityChat.cleanup();
        }
        
        // 채팅 인스턴스 생성
        window.communityChat = new CommunityChat();
        console.log('커뮤니티 채팅 초기화 완료');
        
        // Firebase가 준비되지 않았으면 간단한 사용자 수 사용
        if (!window.database && !window.db) {
            console.log('Firebase 없이 간단한 사용자 수 사용');
            setTimeout(setupSimpleUserCount, 1000);
        }
    }
    
    tryInitializeChat();
    
    // 인증 상태 변경 시 채팅 스타일 업데이트
    if (window.auth) {
        window.auth.onAuthStateChanged((user) => {
            console.log('인증 상태 변경:', !!user);
            if (window.communityChat) {
                window.communityChat.updateUserMessageStyles();
                // 사용자 수 다시 설정 (인증 상태가 바뀌었으므로)
                setTimeout(() => {
                    if (window.communityChat) {
                        window.communityChat.setupUserCount();
                    }
                }, 1000);
            }
        });
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM 로드 완료, 커뮤니티 채팅 초기화 시작');
    
    // 사용자 수 엘리먼트 먼저 확인하고 기본값 설정
    setTimeout(() => {
        const usersCountElement = document.getElementById('chat-users-count');
        if (usersCountElement) {
            usersCountElement.textContent = '1';
            console.log('사용자 수 기본값 설정 완료');
        } else {
            console.warn('chat-users-count 엘리먼트를 찾을 수 없습니다');
        }
    }, 100);
    
    initializeCommunityChat();
    
    // CommunityChat 클래스를 전역으로 노출 (community.js 호환성을 위해)
    window.CommunityChat = {
        setupAuthListener: () => {
            console.log('CommunityChat auth listener setup');
        },
        setupModalListeners: () => {
            console.log('CommunityChat modal listeners setup');
        }
    };
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