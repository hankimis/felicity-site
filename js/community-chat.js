// 커뮤니티 페이지용 실시간 채팅 기능
class CommunityChat {
    constructor(options = {}) {
        // 채널 모드 지원
        this.channelId = CommunityChat.resolveChannelId(options.channelId);
        this.mode = 'channel'; // 단일 채널(onbit)로 통일

        this.messagesContainer = document.getElementById('chat-messages');
        this.messageForm = document.getElementById('chat-form');
        this.messageInput = document.getElementById('message-input');
        this.usersCountElement = document.getElementById('chat-users-count');
        this.messagesUnsubscribe = null;
        this.usersUnsubscribe = null;
        this.isChatFormInitialized = false;
        this.MESSAGES_PER_PAGE = 50; // 커뮤니티에서는 더 많은 메시지 로드
        this._paginationLastDocDesc = null; // 내림차순 페이징 기준 (가장 오래된 문서 참조)
        this._isLoadingMore = false;
        this._infiniteScrollBound = false;
        this._renderedFromCache = false;
        this._cachedMessages = [];
        this._cacheSaveTimer = null;

        // 캐시 즉시 렌더 후 Firestore 로드
        this.renderCachedMessages();
        this.init();
        this.bindMessageProfileNavigation();
    }

    static resolveChannelId(initial) {
        try {
            // 우선순위: 인자 → data-* → URL → localStorage
            let cid = (initial || '').toString();
            if (!cid) {
                const el = document.querySelector('[data-chat-channel]');
                if (el && el.getAttribute('data-chat-channel')) cid = el.getAttribute('data-chat-channel');
            }
            if (!cid) {
                const url = new URL(location.href);
                cid = url.searchParams.get('channel') || '';
            }
            if (!cid) {
                try { cid = localStorage.getItem('chat.selectedChannel') || ''; } catch(_) {}
            }
            cid = (cid || '').toLowerCase().trim();
            if (cid && /^[a-z0-9_-]{1,64}$/.test(cid)) return cid;
            // 기본 채널을 onbit로 강제 사용 (로컬/도메인 동일 경로)
            return 'onbit';
        } catch(_) {
            return '';
        }
    }

    get collectionRef() {
        if (!window.db) return null;
        return window.db.collection('channels').doc(this.channelId || 'onbit').collection('messages');
    }

    async init() {
        console.log('CommunityChat 초기화 시작');
        console.log('Firebase 서비스 상태:', {
            db: !!window.db,
            usersCountElement: !!this.usersCountElement
        });
        console.log('사용자 수 엘리먼트:', this.usersCountElement);

        if (!window.db) {
            console.warn('Firestore 서비스 대기 중... (캐시로 먼저 렌더됨)');
            setTimeout(() => this.init(), 600);
            return;
        }

        console.log('CommunityChat 설정 시작', { mode: this.mode, channelId: this.channelId });
        this.setupChatForm();
        this.loadMessages();
        this.setupUserCount();
    }

    // HTML 이스케이프 유틸
    escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // URL 자동 링크화 (http/https만 허용)
    linkify(escapedText) {
        if (!escapedText) return '';
        const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
        return escapedText.replace(urlRegex, (url) => {
            try {
                const u = new URL(url);
                if (u.protocol === 'http:' || u.protocol === 'https:') {
                    const safeUrl = this.escapeHtml(url);
                    return `<a href="${safeUrl}" target="_blank" rel="nofollow noopener noreferrer">${safeUrl}</a>`;
                }
                return url;
            } catch (_) {
                return url;
            }
        });
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
            const safeName = this.escapeHtml(msg.data.displayName);
            const safeText = this.escapeHtml(msg.data.text);
            const linkedText = this.linkify(safeText);
            
            return `
                <div class="message-item ${alertClass} ${clickable}" id="${msg.id}" data-uid="${msg.data.uid}">
                    <div class="message-content">
                        <div class="message-sender">
                            <strong>${safeName}</strong>
                        </div>
                        <div class="message-text">${linkedText}</div>
                    </div>
                </div>
            `;
        }
        
        const profileImg = msg.data.photoThumbURL || msg.data.photoURL || '/assets/icon/profileicon.png';
        const safeName = this.escapeHtml(msg.data.displayName);
        const safeText = this.escapeHtml(msg.data.text);
        const linkedText = this.linkify(safeText);
        
        let isMyMessage = !!(window.currentUser && msg.data.uid === window.currentUser.uid);
        const myMessageClass = isMyMessage ? 'my-message' : '';

        return `
            <div class="message-item ${myMessageClass}" id="${msg.id}" data-uid="${msg.data.uid}">
                <div class="chat-profile-pic-wrap">
                    <img class="chat-profile-pic" src="${profileImg}" alt="프로필" loading="lazy" onerror="this.src='/assets/icon/profileicon.png'" />
                </div>
                <div class="message-content">
                    <div class="message-sender"><strong>${safeName}</strong></div>
                    <div class="message-text">${linkedText}</div>
                </div>
            </div>
        `;
    }

    // ===== 캐시 유틸 =====
    getCacheKey() {
        const key = this.mode === 'channel' ? `chat.cache.channel.${this.channelId}` : 'chat.cache.community';
        return key;
    }
    readCache() {
        try {
            const raw = localStorage.getItem(this.getCacheKey());
            if (!raw) return [];
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return [];
            return arr;
        } catch(_) { return []; }
    }
    writeCache(messages) {
        try {
            const trimmed = (messages || []).slice(-this.MESSAGES_PER_PAGE);
            localStorage.setItem(this.getCacheKey(), JSON.stringify(trimmed));
        } catch(_) {}
    }
    debounceSaveCache() {
        clearTimeout(this._cacheSaveTimer);
        this._cacheSaveTimer = setTimeout(() => {
            this.writeCache(this._cachedMessages);
        }, 200);
    }
    renderCachedMessages() {
        try {
            if (!this.messagesContainer) return;
            const cached = this.readCache();
            if (!cached.length) return;
            // 이미 렌더된 경우 중복 회피
            if (this.messagesContainer.children && this.messagesContainer.children.length > 0) return;
            const html = cached.map((m) => this.renderMessage({ id: m.id, data: m.data })).join('');
            this.messagesContainer.innerHTML = html;
            this._renderedFromCache = true;
            this._cachedMessages = cached.slice();
            // 하단 고정
            setTimeout(() => {
                try { this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight; } catch(_) {}
            }, 0);
        } catch(_) {}
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

    // 본문 메시지에서 아바타/닉네임 클릭 시 프로필 이동
    bindMessageProfileNavigation() {
        if (!this.messagesContainer || this._profileNavBound) return;
        this._profileNavBound = true;
        this.messagesContainer.addEventListener('click', (e) => {
            try {
                const target = e.target;
                if (!target) return;
                const clickable = target.closest && target.closest('.chat-profile-pic, .message-sender, .message-sender strong');
                if (!clickable) return;
                const item = target.closest('.message-item');
                if (!item) return;
                const uid = item.getAttribute('data-uid') || '';
                if (!uid || uid === 'system-alert' || uid === 'system-breaking-news') return;
                window.location.href = `/feed/profile.html?uid=${encodeURIComponent(uid)}`;
            } catch(_) {}
        });
    }

    // 메시지 로드
    async loadMessages() {
        try {
            console.log('Loading chat messages for community...');
            if (!window.db) throw new Error('Firestore (window.db) not initialized');
            const col = this.collectionRef;
            if (!col) throw new Error('collectionRef not available');
            
            const messagesQuery = col
                .orderBy('timestamp', 'desc')
                .limit(this.MESSAGES_PER_PAGE);
            
            const snapshot = await messagesQuery.get();
            const messages = [];
            snapshot.forEach((doc) => {
                messages.push({ id: doc.id, data: doc.data() });
            });
            messages.reverse(); // 시간순으로 표시
            
            if (this.messagesContainer) {
                const messagesHTML = messages.map(msg => this.renderMessage(msg)).join('');
                // 캐시로 먼저 그려졌더라도 서버 결과로 동기화
                this.messagesContainer.innerHTML = messagesHTML;
                
                setTimeout(() => {
                    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
                }, 100);
            }

            // 캐시 저장
            this._cachedMessages = messages.slice();
            this.writeCache(this._cachedMessages);
            
            // 초기 로드 기준 마지막 문서(가장 최근)
            this._lastRealtimeDoc = snapshot.empty ? null : snapshot.docs[snapshot.docs.length - 1];
            this.setupRealtimeListener();
            console.log(`${messages.length} chat messages loaded for community`);

            // 페이지네이션 기준 문서(내림차순 마지막 = 가장 오래된)
            this._paginationLastDocDesc = snapshot.empty ? null : snapshot.docs[snapshot.docs.length - 1];
            this.setupInfiniteScroll();
        } catch (error) {
            console.error('채팅 메시지 로드 실패:', error);
            if (this.messagesContainer) {
                this.messagesContainer.innerHTML = '<div class="chat-notice">메시지를 불러올 수 없습니다.</div>';
            }
            // 실패 시에도 캐시가 있으면 유지
        }
    }

    // 위로 스크롤 시 이전 메시지 로드
    setupInfiniteScroll() {
        if (!this.messagesContainer || this._infiniteScrollBound) return;
        this._infiniteScrollBound = true;
        this.messagesContainer.addEventListener('scroll', async () => {
            try {
                if (this._isLoadingMore) return;
                if (!this._paginationLastDocDesc) return;
                if (this.messagesContainer.scrollTop <= 20) {
                    this._isLoadingMore = true;
                    const prevHeight = this.messagesContainer.scrollHeight;
                    await this.loadOlderMessages();
                    const newHeight = this.messagesContainer.scrollHeight;
                    // 기존 위치 유지
                    this.messagesContainer.scrollTop = newHeight - prevHeight + this.messagesContainer.scrollTop;
                    this._isLoadingMore = false;
                }
            } catch (_) {
                this._isLoadingMore = false;
            }
        });
    }

    async loadOlderMessages() {
        if (!window.db || !this._paginationLastDocDesc) return;
        const col = this.collectionRef; if (!col) return;
        const queryRef = col
            .orderBy('timestamp', 'desc')
            .startAfter(this._paginationLastDocDesc)
            .limit(this.MESSAGES_PER_PAGE);
        const snapshot = await queryRef.get();
        if (snapshot.empty) {
            this._paginationLastDocDesc = null;
            return;
        }
        // 다음 페이지 기준 (desc의 마지막이 가장 오래된 문서)
        this._paginationLastDocDesc = snapshot.docs[snapshot.docs.length - 1];

        const older = [];
        snapshot.forEach((doc) => older.push({ id: doc.id, data: doc.data() }));
        older.reverse();

        // 컨테이너 상단에 prepend
        if (this.messagesContainer) {
            const fragment = document.createDocumentFragment();
            older.forEach((m) => {
                const div = document.createElement('div');
                div.innerHTML = this.renderMessage(m);
                while (div.firstChild) fragment.appendChild(div.firstChild);
            });
            this.messagesContainer.insertBefore(fragment, this.messagesContainer.firstChild);
        }
    }

    // 실시간 리스너 설정
    setupRealtimeListener() {
        if (this.messagesUnsubscribe) {
            this.messagesUnsubscribe();
        }
        
        if (!window.db) return;
        const col = this.collectionRef; if (!col) return;
        
        // 마지막 로드 문서 이후 asc로 수신
        let queryRef = col.orderBy('timestamp', 'asc');
        if (this._lastRealtimeDoc) {
            queryRef = queryRef.startAfter(this._lastRealtimeDoc);
        }

        this.messagesUnsubscribe = queryRef.onSnapshot((snapshot) => {
            if (!this.messagesContainer) return;
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const msg = { id: change.doc.id, data: change.doc.data() };
                    if (!document.getElementById(msg.id)) {
                        const messageHTML = this.renderMessage(msg);
                        this.messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
                        // 캐시 최신화
                        this._cachedMessages.push(msg);
                        if (this._cachedMessages.length > this.MESSAGES_PER_PAGE) {
                            this._cachedMessages = this._cachedMessages.slice(-this.MESSAGES_PER_PAGE);
                        }
                        this.debounceSaveCache();
                    }
                }
            });
            // 최신 anchor 업데이트
            if (!snapshot.empty) {
                this._lastRealtimeDoc = snapshot.docs[snapshot.docs.length - 1];
            }
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

        messages.forEach(msgElement => {
            const msgUid = msgElement.dataset.uid;
            let isMyMessage = !!(window.currentUser && msgUid === window.currentUser.uid);

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
                // 비로그인 차단
                if (!window.currentUser) {
                    alert('로그인이 필요합니다.');
                    return;
                }
                
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
                    const displayName = window.currentUser.displayName || window.currentUser.email || '사용자';
                    const photoURL = window.currentUser.photoURL || null;
                    const payload = { text: originalText, displayName, photoURL, channelId: (this.channelId||'onbit') };
                    let sent = false;
                    try {
                        if (firebase && firebase.app && firebase.app().functions) {
                            const postFn = firebase.app().functions('asia-northeast3').httpsCallable('postChannelMessage');
                            await postFn(payload);
                            sent = true;
                        }
                    } catch(err) {
                        // functions 실패 시 Firestore로 직접 기록 (로컬/도메인 동일 경로)
                        sent = false;
                    }
                    if (!sent) {
                        try {
                            const col = this.collectionRef;
                            const ts = (window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue && window.firebase.firestore.FieldValue.serverTimestamp) ? window.firebase.firestore.FieldValue.serverTimestamp() : new Date();
                            await col.add({
                                text: originalText,
                                displayName,
                                photoURL,
                                uid: window.currentUser.uid,
                                timestamp: ts
                            });
                            sent = true;
                        } catch(e) {
                            throw e;
                        }
                    }
                } catch (error) {
                    console.error('메시지 전송 실패:', error);
                    try {
                        const code = (error && error.code) || (error && error.details && error.details.code) || '';
                        if (code.includes('already-exists')) {
                            alert('같은 메시지를 너무 빨리 반복해서 보낼 수 없습니다. 잠시 후 다시 시도해주세요.');
                        } else if (code.includes('resource-exhausted')) {
                            alert('메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 시도해주세요.');
                        } else if (code.includes('invalid-argument')) {
                            alert('메시지 형식이 올바르지 않습니다.');
                        } else if (code.includes('unauthenticated')) {
                            alert('로그인이 필요합니다.');
                        } else {
                            alert('메시지 전송에 실패했습니다. 다시 시도해주세요.');
                        }
                    } catch(_) {
                        alert('메시지 전송에 실패했습니다. 다시 시도해주세요.');
                    }
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
            const isAuthed = !!(window.currentUser && window.currentUser.uid);
            const pageTag = this.mode === 'channel' ? `channel:${this.channelId}` : 'community';

            // 인증된 사용자만 본인 온라인 상태 등록/갱신
            if (isAuthed) {
                const userId = window.currentUser.uid;
                const userDisplayName = window.currentUser.displayName || window.currentUser.email || '사용자';
                const userDoc = window.db.collection('online-users').doc(userId);

                // 온라인 등록
                userDoc.set({
                    displayName: userDisplayName,
                    lastSeen: window.firebase.firestore.FieldValue.serverTimestamp(),
                    online: true,
                    page: pageTag
                }, { merge: true });

                // 30초마다 lastSeen 갱신
                if (this._lastSeenInterval) clearInterval(this._lastSeenInterval);
                this._lastSeenInterval = setInterval(() => {
                    userDoc.update({
                        lastSeen: window.firebase.firestore.FieldValue.serverTimestamp(),
                        online: true
                    });
                }, 30000);

                // 언로드 시 online=false로 표시 및 인터벌 정리 (삭제 금지)
                const handleBeforeUnload = () => {
                    userDoc.set({
                        lastSeen: window.firebase.firestore.FieldValue.serverTimestamp(),
                        online: false
                    }, { merge: true });
                    if (this._lastSeenInterval) clearInterval(this._lastSeenInterval);
                };
                window.addEventListener('beforeunload', handleBeforeUnload);
                window.addEventListener('pagehide', handleBeforeUnload);
            }

            // 실시간 카운팅 (3분 이내 활동자만)
            if (this.usersUnsubscribe) this.usersUnsubscribe();
            const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
            this.usersUnsubscribe = window.db.collection('online-users')
                .where('page', '==', pageTag)
                .where('lastSeen', '>=', threeMinutesAgo)
                .onSnapshot((snapshot) => {
                    const count = snapshot.size || 0;
                    if (this.usersCountElement) {
                        this.usersCountElement.textContent = String(Math.max(1, count));
                    }
                });

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
        
        // 온라인 상태는 삭제하지 않고 offline만 표시 (set in setupUserCountWithFirestore unload handler)
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
    // 채팅 전용 페이지에서 수동 제어 시 자동 초기화 방지
    if (window.CHAT_PAGE_CONTROLLED) return;
    if (!window.communityChat) {
        // URL ?channel=abc 또는 data-chat-channel 속성을 읽어 채널 모드 자동 적용
        const url = new URL(location.href);
        const channelId = url.searchParams.get('channel') || '';
        window.communityChat = new CommunityChat({ channelId });
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