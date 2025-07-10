// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
});

// 전역 변수 추가
let currentDisplayCount = 10; // 현재 표시된 뉴스 개수
const loadMoreCount = 10; // 한 번에 더 로드할 개수
let isLoading = false; // 로딩 중 여부
let hasMoreNews = true; // 더 불러올 뉴스가 있는지

function initializePage() {
    initializeNewsUI();
    initializeInfiniteScroll();
    loadNewsFeeds();
}

// 무한스크롤 초기화
function initializeInfiniteScroll() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !isLoading && hasMoreNews) {
                loadMoreNews();
            }
        });
    }, {
        root: null,
        rootMargin: '100px',
        threshold: 0.1
    });

    // 로딩 트리거 요소 생성
    const loadingTrigger = document.createElement('div');
    loadingTrigger.id = 'loading-trigger';
    loadingTrigger.style.height = '20px';
    loadingTrigger.style.margin = '20px 0';
    
    // 뉴스 그리드 뒤에 추가
    const newsGrid = document.getElementById('newsGrid');
    if (newsGrid && newsGrid.parentNode) {
        newsGrid.parentNode.insertBefore(loadingTrigger, newsGrid.nextSibling);
        observer.observe(loadingTrigger);
    }
}

// 더 많은 뉴스 로드
function loadMoreNews() {
    if (isLoading || !hasMoreNews || !window.newsItems) return;
    
    isLoading = true;
    
    // 로딩 인디케이터 표시
    showLoadingIndicator();
    
    // 약간의 지연 후 뉴스 추가 (실제 로딩 시뮬레이션)
    setTimeout(() => {
        const totalNews = window.newsItems.length;
        const newDisplayCount = Math.min(currentDisplayCount + loadMoreCount, totalNews);
        
        if (newDisplayCount > currentDisplayCount) {
            currentDisplayCount = newDisplayCount;
            displayNews(window.newsItems, false); // 기존 뉴스 유지하면서 추가
            
            // 더 불러올 뉴스가 있는지 확인
            hasMoreNews = currentDisplayCount < totalNews;
        } else {
            hasMoreNews = false;
        }
        
        hideLoadingIndicator();
        isLoading = false;
        
        console.log(`📰 추가 로드: ${currentDisplayCount}/${totalNews} 뉴스 표시`);
    }, 500);
}

// 로딩 인디케이터 표시
function showLoadingIndicator() {
    let indicator = document.getElementById('loading-more-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'loading-more-indicator';
        indicator.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-color-secondary);">
                <i class="fas fa-spinner fa-spin"></i> 더 많은 뉴스를 불러오는 중...
            </div>
        `;
        
        const loadingTrigger = document.getElementById('loading-trigger');
        if (loadingTrigger) {
            loadingTrigger.parentNode.insertBefore(indicator, loadingTrigger);
        }
    }
    indicator.style.display = 'block';
}

// 로딩 인디케이터 숨기기
function hideLoadingIndicator() {
    const indicator = document.getElementById('loading-more-indicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
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

            // 뉴스 필터링 (무한스크롤 리셋)
            const source = button.getAttribute('data-source');
            resetInfiniteScroll();
            filterNews(source);
        });
    });
}

// 무한스크롤 상태 리셋
function resetInfiniteScroll() {
    currentDisplayCount = 10;
    hasMoreNews = true;
    isLoading = false;
    hideLoadingIndicator();
}

// 뉴스 피드 로드 (캐싱 및 최적화)
async function loadNewsFeeds() {
    const newsGrid = document.getElementById('newsGrid');
    const CACHE_KEY = 'newsFeedsCache';
    const CACHE_DURATION_MS = 5 * 60 * 1000; // 5분 캐시

    // 1. 캐시 확인 및 즉시 표시 (빠른 로딩)
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const cacheData = JSON.parse(cached);
            const age = Date.now() - cacheData.timestamp;
            
            if (age < CACHE_DURATION_MS && cacheData.data && cacheData.data.length > 0) {
                // 캐시된 데이터 즉시 표시
                window.newsItems = cacheData.data;
                resetInfiniteScroll();
                displayNews(cacheData.data);
                
                // 백그라운드에서 새 데이터 가져오기 (비동기)
                setTimeout(() => loadFreshNews(), 100);
                return;
            }
        }
    } catch (e) {
        console.warn('캐시 읽기 실패:', e);
    }
    
    // 로딩 메시지 표시
    newsGrid.innerHTML = '<div class="loading">최신 뉴스를 불러오는 중...</div>';
    await loadFreshNews();
}

async function loadFreshNews() {
    const newsGrid = document.getElementById('newsGrid');
    const CACHE_KEY = 'newsFeedsCache';
    
    try {
        const feeds = [
            // 한국 암호화폐 뉴스 소스 (우선순위 순)
            { url: 'https://kr.cointelegraph.com/rss', source: 'cointelegraph' },
            { url: 'https://www.tokenpost.kr/rss', source: 'tokenpost' },
            { url: 'https://www.blockmedia.co.kr/feed', source: 'blockmedia' },
            { url: 'https://www.blockstreet.co.kr/feed', source: 'blockstreet' },
            { url: 'https://cryptonews.com/kr/feed/', source: 'cryptonews' },
            { url: 'https://cryptodnes.bg/kr/feed/', source: 'cryptodnes' },
            { url: 'https://bloomingbit.io/rss.xml', source: 'bloomingbit' },
            { url: 'https://kr.investing.com/rss/news.rss', source: 'investing' },
            { url: 'https://zdnet.co.kr/feed', source: 'zdnet' }
        ];

        // 병렬 처리로 모든 피드 동시 요청
        const feedPromises = feeds.map(feed => 
            fetchAndParseFeed(feed).catch(error => {
                console.warn(`${feed.source} 피드 로딩 실패:`, error);
                return []; // 실패한 피드는 빈 배열 반환
            })
        );

        // Promise.allSettled 대신 Promise.all 사용 (더 빠름)
        const results = await Promise.all(feedPromises);

        let allNews = [];
        let successCount = 0;
        
        results.forEach((result, index) => {
            const feedName = feeds[index].source;
            if (result && result.length > 0) {
                allNews.push(...result);
                successCount++;
                console.log(`✅ ${feedName}: ${result.length}개 뉴스 로드`);
            }
        });

        // 최소 하나의 피드라도 성공하면 표시
        if (allNews.length === 0) {
            throw new Error('모든 뉴스 피드를 가져오는데 실패했습니다.');
        }

        // 중복 제거 최적화 (Map 사용)
        const uniqueNewsMap = new Map();
        allNews.forEach(item => {
            if (item.link && !uniqueNewsMap.has(item.link)) {
                uniqueNewsMap.set(item.link, item);
            }
        });
        
        const uniqueNews = Array.from(uniqueNewsMap.values());

        // 최신순 정렬
        uniqueNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        
        // 캐시 저장 (비동기)
        setTimeout(() => {
            try {
                const cacheData = {
                    timestamp: Date.now(),
                    data: uniqueNews
                };
                localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
            } catch(e) {
                console.warn('캐시 저장 실패:', e);
            }
        }, 0);

        window.newsItems = uniqueNews;
        resetInfiniteScroll();
        displayNews(uniqueNews);
        
        console.log(`📰 뉴스 로딩 완료: ${successCount}/${feeds.length} 소스 성공, ${uniqueNews.length}개 뉴스`);

    } catch (error) {
        console.error('뉴스 로딩 실패:', error);
        newsGrid.innerHTML = `
            <div class="loading">
                뉴스를 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.
            </div>
        `;
    }
}


async function fetchAndParseFeed({ url, source }) {
    const timeoutMs = 6000; // 6초 타임아웃 (단축)
    const maxRetries = 2; // 재시도 횟수 단축
    
    // 빠른 CORS 프록시 서비스들 (속도 순)
    const proxyServices = [
        `https://corsproxy.io/?${encodeURIComponent(url)}`,
        `https://cors-proxy.htmldriven.com/?url=${encodeURIComponent(url)}`,
        `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(url)}`
    ];
    
    for (let retry = 0; retry <= maxRetries; retry++) {
        const proxyUrl = proxyServices[retry % proxyServices.length];
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            
            const response = await fetch(proxyUrl, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const xmlText = await response.text();
                
                // 빈 응답 체크
                if (!xmlText || xmlText.trim().length === 0) {
                    throw new Error('빈 응답');
                }
                
                // RSS XML 파싱
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
                
                // 파싱 에러 체크
                const parserError = xmlDoc.querySelector('parsererror');
                if (parserError) {
                    throw new Error('XML 파싱 에러');
                }
                
                // RSS 아이템 추출
                let items = Array.from(xmlDoc.querySelectorAll('item'));
                if (items.length === 0) {
                    items = Array.from(xmlDoc.querySelectorAll('entry')); // Atom 지원
                }
                
                if (items.length > 0) {
                    // 처리할 아이템 개수 제한 (성능 향상)
                    const processedItems = items.slice(0, 20).map(item => {
                        // 필수 데이터만 추출
                        const title = item.querySelector('title')?.textContent?.trim() || '';
                        
                        // 링크 추출
                        let link = '';
                        const linkElement = item.querySelector('link');
                        if (linkElement) {
                            link = linkElement.textContent?.trim() || linkElement.getAttribute('href') || '';
                        }
                        
                        // 발행일 추출
                        const pubDate = item.querySelector('pubDate')?.textContent?.trim() || 
                                       item.querySelector('published')?.textContent?.trim() ||
                                       item.querySelector('updated')?.textContent?.trim() ||
                                       new Date().toISOString();
                        
                        // 설명 추출 (간소화)
                        let description = '';
                        const descElement = item.querySelector('description') || 
                                          item.querySelector('content') ||
                                          item.querySelector('summary');
                        
                        if (descElement) {
                            description = descElement.textContent || descElement.innerHTML || '';
                        }
                        
                        // 텍스트 정리 (최적화)
                        let contentSnippet = '';
                        if (description) {
                            contentSnippet = description
                                .replace(/<[^>]*>/g, '')
                                .replace(/&[^;]+;/g, ' ')
                                .replace(/\s+/g, ' ')
                                .trim()
                                .substring(0, 150); // 길이 단축
                        }
                        
                        if (!contentSnippet.trim()) {
                            contentSnippet = title.substring(0, 80);
                        }
                        
                        // 이미지 추출 (간소화)
                        let imageUrl = '/img/default-news.jpg';
                        
                        // 기본적인 이미지 소스만 확인
                        const enclosure = item.querySelector('enclosure');
                        if (enclosure && enclosure.getAttribute('url') && 
                            enclosure.getAttribute('type')?.startsWith('image/')) {
                            imageUrl = enclosure.getAttribute('url');
                        } else {
                            // description에서 첫 번째 이미지만 추출
                            const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i);
                            if (imgMatch && imgMatch[1] && imgMatch[1].startsWith('http')) {
                                imageUrl = imgMatch[1];
                            }
                        }
                        
                        return {
                            title,
                            link,
                            pubDate,
                            contentSnippet,
                            image: imageUrl,
                            source
                        };
                    });
                    
                    return processedItems;
                }
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            if (retry === maxRetries) {
                console.warn(`❌ ${source}: 최종 실패 - ${error.message}`);
            }
            
            // 빠른 재시도 (대기 시간 단축)
            if (retry < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 500 * (retry + 1)));
            }
        }
    }
    
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
function displayNews(news, isInitialLoad = true) {
    const newsGrid = document.getElementById('newsGrid');
    
    if (!newsGrid || !news || news.length === 0) {
        if (newsGrid) {
            newsGrid.innerHTML = '<div class="loading">뉴스를 불러올 수 없습니다.</div>';
        }
        return;
    }
    
    // 초기 로드 시 전체 초기화
    if (isInitialLoad) {
        newsGrid.innerHTML = '';
        currentDisplayCount = Math.min(10, news.length);
        hasMoreNews = news.length > currentDisplayCount;
    }
    
    const fragment = document.createDocumentFragment();
    
    // 표시할 뉴스 범위 결정
    let itemsToDisplay;
    if (isInitialLoad) {
        itemsToDisplay = news.slice(0, currentDisplayCount);
    } else {
        // 추가 로드 시 새로운 항목만 추가
        const startIndex = currentDisplayCount - loadMoreCount;
        itemsToDisplay = news.slice(startIndex, currentDisplayCount);
    }

    itemsToDisplay.forEach(item => {
        const relativeTime = getRelativeTime(item.pubDate);
        const sourceName = getSourceDisplayName(item.source);
        
        // 이미지가 있는지 확인
        const hasImage = item.image && item.image !== '/img/default-news.jpg' && item.image.startsWith('http');
        
        const newsItem = document.createElement('div');
        newsItem.className = `news-item ${hasImage ? 'has-image' : 'no-image'}`;
        
        // 이미지 HTML 생성 (이미지가 있을 때만)
        const imageHtml = hasImage ? `
            <div class="news-thumb">
                <img src="${item.image}" alt="${item.title}" loading="lazy" decoding="async" onerror="this.parentNode.style.display='none'">
            </div>
        ` : '';
        
        newsItem.innerHTML = `
            ${imageHtml}
            <div class="news-body">
                <div class="news-meta">
                    <span class="news-source">${sourceName}</span>
                    <span class="news-time">${relativeTime}</span>
                </div>
                <h3 class="news-title">${item.title}</h3>
                <p class="news-desc">${item.contentSnippet}</p>
            </div>
        `;
        
        // 클릭 이벤트 추가
        newsItem.addEventListener('click', () => {
            if (item.link) {
                window.open(item.link, '_blank', 'noopener,noreferrer');
            }
        });
        
        fragment.appendChild(newsItem);
    });
    
    newsGrid.appendChild(fragment);
    
    // 더 불러올 뉴스가 없으면 완료 메시지 표시
    if (!hasMoreNews && isInitialLoad) {
        const completeMessage = document.createElement('div');
        completeMessage.className = 'loading';
        completeMessage.innerHTML = `총 ${news.length}개의 뉴스를 모두 불러왔습니다.`;
        newsGrid.appendChild(completeMessage);
    }
}

// 뉴스 필터링
function filterNews(source) {
    if (!window.newsItems) return;
    
    let filteredNews;
    if (source === 'all') {
        filteredNews = window.newsItems;
    } else {
        filteredNews = window.newsItems.filter(item => item.source === source);
    }
    
    // 무한스크롤 상태 리셋
    resetInfiniteScroll();
    
    // 필터링된 뉴스 표시
    displayNews(filteredNews, true);
    
    console.log(`🔍 필터링 완료: ${source} (${filteredNews.length}개 뉴스)`);
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
        'bloomingbit': '블루밍비트',
        'investing': 'Investing.com',
        'zdnet': 'ZDNet Korea',
        'blockstreet': '블록스트리트',
        'cryptonews': 'Cryptonews Korea',
        'cryptodnes': 'Cryptodnes'
    };
    
    return sourceNames[source] || source;
} 