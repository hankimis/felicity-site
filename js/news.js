// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
});

function initializePage() {
    initializeNewsUI();
    loadNewsFeeds();
}

// 뉴스 페이지 UI 초기화
function initializeNewsUI() {
    // 뉴스 필터 버튼
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 활성 버튼 변경
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // 뉴스 필터링
            const source = button.getAttribute('data-source');
            filterNews(source);
        });
    });
}

// 뉴스 피드 로드 (캐싱 및 최적화)
async function loadNewsFeeds() {
    const newsGrid = document.getElementById('newsGrid');
    const CACHE_KEY = 'newsFeedsCache';
    const CACHE_DURATION_MS = 2 * 60 * 1000; // 2분 (빠른 새로고침)

    // 1. 캐시 확인 및 즉시 표시 (빠른 로딩)
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const cacheData = JSON.parse(cached);
            const age = Date.now() - cacheData.timestamp;
            
            if (age < CACHE_DURATION_MS && cacheData.data && cacheData.data.length > 0) {
                // 캐시된 데이터 즉시 표시
                window.newsItems = cacheData.data;
                displayNews(cacheData.data);
                
                // 백그라운드에서 새 데이터 가져오기 (지연 없음)
                loadFreshNews();
                return;
            }
        }
    } catch (e) {
        // 캐시 읽기 실패 무시
    }
    
    // 로딩 메시지 표시
    newsGrid.innerHTML = '<div class="loading">최신 뉴스를 불러오는 중...</div>';
    await loadFreshNews();
}

async function loadFreshNews() {

    const newsGrid = document.getElementById('newsGrid');
    const CACHE_KEY = 'newsFeedsCache';
    
    // 2. 확장된 암호화폐 뉴스 피드 목록
    try {
        const feeds = [
            // 한국 암호화폐 뉴스 소스
            { url: 'https://kr.cointelegraph.com/rss', source: 'cointelegraph' },
            { url: 'https://www.tokenpost.kr/rss', source: 'tokenpost' },
            { url: 'https://www.blockmedia.co.kr/feed', source: 'blockmedia' },
            { url: 'https://coinreaders.com/rss/rss_news.php', source: 'coinreaders' },
            { url: 'https://bloomingbit.io/rss.xml', source: 'bloomingbit' },
            { url: 'https://www.yna.co.kr/rss/economy.xml', source: 'yonhap' },
            { url: 'https://kr.investing.com/rss/news.rss', source: 'investing' }
        ];

        const feedPromises = feeds.map(feed => fetchAndParseFeed(feed));
        const results = await Promise.allSettled(feedPromises);

        let allNews = [];
        let successCount = 0;
        let failedFeeds = [];
        
        results.forEach((result, index) => {
            const feedName = feeds[index].source;
            if (result.status === 'fulfilled' && result.value.length > 0) {
                allNews.push(...result.value);
                successCount++;
            } else {
                failedFeeds.push(feedName);
            }
        });

        // 최소 하나의 피드라도 성공하면 표시
        if (allNews.length === 0) {
            throw new Error('모든 뉴스 피드를 가져오는데 실패했습니다.');
        }

        // 중복 제거 (링크 기준)
        const uniqueNews = [];
        const seenLinks = new Set();
        
        allNews.forEach(item => {
            if (!seenLinks.has(item.link)) {
                seenLinks.add(item.link);
                uniqueNews.push(item);
            }
        });

        // 최신순 정렬
        uniqueNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        
        // 4. 캐시 저장
        try {
            const cacheData = {
                timestamp: Date.now(),
                data: uniqueNews
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        } catch(e) {
            // 캐시 저장 실패 무시
        }

        window.newsItems = uniqueNews;
        displayNews(uniqueNews);
        
        // 성공/실패 통계 표시
        console.log(`📰 뉴스 로딩 완료: ${successCount}/${feeds.length} 소스 성공, ${uniqueNews.length}개 뉴스`);
        
        // 실패한 피드가 있으면 사용자에게 알림 (너무 많으면 생략)
        if (failedFeeds.length > 0 && successCount > 0 && failedFeeds.length <= 5) {
            const newsGrid = document.getElementById('newsGrid');
            const warningDiv = document.createElement('div');
            warningDiv.className = 'news-warning';
            warningDiv.style.cssText = `
                background: var(--warning-bg, #fff3cd);
                color: var(--warning-text, #856404);
                padding: 12px;
                margin-bottom: 20px;
                border-radius: 8px;
                border: 1px solid var(--warning-border, #ffeaa7);
                font-size: 14px;
            `;
            warningDiv.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i> 
                일부 뉴스 소스에서 뉴스를 가져오지 못했습니다. (${failedFeeds.length}개 소스 실패)
            `;
            newsGrid.insertBefore(warningDiv, newsGrid.firstChild);
        }

    } catch (error) {
        newsGrid.innerHTML = `
            <div class="loading">
                뉴스를 불러오는데 실패했습니다.
            </div>
        `;
    }
}


async function fetchAndParseFeed({ url, source }) {
    // 더 빠른 타임아웃으로 응답성 개선
    const timeoutMs = 2500;
    
    // RSS2JSON API 먼저 시도 (가장 안정적)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        const rss2jsonUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(url);
        const response = await fetch(rss2jsonUrl, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'max-age=300' // 5분 캐시
            }
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            if (data.status === 'ok' && data.items && data.items.length > 0) {
                return data.items.slice(0, 6).map(item => { // 6개로 축소 (더 빠른 로딩)
                    // 빠른 텍스트 처리
                    let contentSnippet = '';
                    
                    if (item.description) {
                        // 간단한 HTML 태그 제거 (정규식 최적화)
                        const cleanText = item.description.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
                        contentSnippet = cleanText.substring(0, 120); // 길이 축소
                    }
                    
                    // 빈 contentSnippet이면 제목에서 생성
                    if (!contentSnippet.trim()) {
                        contentSnippet = (item.title || '').substring(0, 80);
                    }

                    // 이미지 최적화: 기본 이미지 사용으로 로딩 속도 향상
                    let imageUrl = '/assets/default-news.jpg';
                    if (item.thumbnail && item.thumbnail.startsWith('http')) {
                        imageUrl = item.thumbnail;
                    }

                    return {
                        title: item.title || '',
                        link: item.link || '',
                        pubDate: item.pubDate || new Date().toISOString(),
                        contentSnippet: contentSnippet,
                        image: imageUrl,
                        source: source
                    };
                });
            }
        }
    } catch (error) {
        // RSS2JSON 실패 시 빠른 실패
    }

    // RSS2JSON 실패 시 빈 배열 반환 (백업 뉴스 제거)
    return [];
}



// RSS 피드 파싱 (실제 데이터만 처리)
function parseRSSFeed(xmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    const items = Array.from(doc.querySelectorAll('item'));
    
    return items.map(item => {
        const link = item.querySelector('link')?.textContent || '';
        const title = item.querySelector('title')?.textContent || '';
        const description = item.querySelector('description')?.textContent || '';
        const pubDate = item.querySelector('pubDate')?.textContent || '';
        
        // 컨텐츠 스니펫 생성
        let contentSnippet = '';
        if (description) {
            contentSnippet = description.replace(/<[^>]*>/g, '')
                                       .replace(/&nbsp;/g, ' ')
                                       .replace(/&amp;/g, '&')
                                       .replace(/&lt;/g, '<')
                                       .replace(/&gt;/g, '>')
                                       .replace(/&quot;/g, '"')
                                       .trim()
                                       .substring(0, 180);
        }
        
        return {
            title: title,
            link: link,
            pubDate: pubDate,
            content: description,
            contentSnippet: contentSnippet || title.substring(0, 100),
            image: findImageInItem(item)
        };
    });
}

// 이미지 찾기 헬퍼 함수
function findImageInItem(item) {
    // media:content 시도
    const mediaContent = item.querySelector('media\\:content, content');
    if (mediaContent?.getAttribute('url')) {
        return mediaContent.getAttribute('url');
    }

    // enclosure 시도
    const enclosure = item.querySelector('enclosure');
    if (enclosure?.getAttribute('url') && enclosure?.getAttribute('type')?.startsWith('image/')) {
        return enclosure.getAttribute('url');
    }

    // 설명에서 이미지 찾기
    const description = item.querySelector('description')?.textContent || '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = description;
    const firstImage = tempDiv.querySelector('img');
    if (firstImage?.src) {
        return firstImage.src;
    }

    return '/assets/default-news.jpg';
}

// 뉴스 표시 (최적화된 이미지 로딩)
function displayNews(news) {
    const newsGrid = document.getElementById('newsGrid');
    
    if (!news || news.length === 0) {
        newsGrid.innerHTML = '<div class="loading">표시할 뉴스가 없습니다.</div>';
        return;
    }
    
    // 성능 최적화: DocumentFragment 사용
    const fragment = document.createDocumentFragment();
    
    news.forEach(item => {
        const relativeTime = getRelativeTime(item.pubDate);
        const sourceName = getSourceDisplayName(item.source);
        
        // 이미지 최적화: 기본 이미지 우선 사용
        const hasImage = item.image && item.image !== '/assets/default-news.jpg' && item.image.startsWith('http');
        
        const newsItem = document.createElement('a');
        newsItem.href = item.link;
        newsItem.target = '_blank';
        newsItem.rel = 'noopener';
        newsItem.className = `news-item ${hasImage ? 'has-image' : 'no-image'}`;
        newsItem.setAttribute('data-source', item.source);
        
        // 이미지 처리 최적화
        let imageHtml = '';
        if (hasImage) {
            imageHtml = `<img src="${item.image}" alt="" class="news-thumb" loading="lazy" decoding="async" onerror="this.style.display='none';">`;
        }
        
        newsItem.innerHTML = `
            ${imageHtml}
            <div class="news-body">
                <div class="news-meta">${sourceName} · ${relativeTime}</div>
                <div class="news-title">${item.title}</div>
                <div class="news-desc">${item.contentSnippet ? item.contentSnippet + '...' : ''}</div>
            </div>
        `;
        
        fragment.appendChild(newsItem);
    });
    
    // 한 번에 DOM 업데이트
    newsGrid.innerHTML = '';
    newsGrid.appendChild(fragment);
}

// 뉴스 필터링
function filterNews(source) {
    const newsItems = window.newsItems || [];
    let filteredNews = newsItems;

    if (source !== 'all') {
        filteredNews = newsItems.filter(item => item.source === source);
    }

    displayNews(filteredNews);
}

// 상대적 시간 표시 함수
function getRelativeTime(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
    
    return date.toLocaleDateString('ko-KR', { 
        month: 'short', 
        day: 'numeric' 
    });
}

// 소스 표시명 매핑
function getSourceDisplayName(source) {
    const sourceNames = {
        'cointelegraph': '코인텔레그래프',
        'tokenpost': '토큰포스트',
        'blockmedia': '블록미디어',
        'coinreaders': '코인리더스',
        'bloomingbit': '블루밍비트',
        'yonhap': '연합뉴스',
        'investing': 'Investing.com'
    };
    
    return sourceNames[source] || source;
} 