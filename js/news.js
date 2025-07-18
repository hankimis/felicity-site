// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
});

// 뉴스 중요도 시스템 전역 변수
let newsImportanceData = {}; // 뉴스 중요도 데이터 캐시
const IMPORTANCE_CACHE_KEY = 'newsImportanceCache';
const IMPORTANCE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24시간

// 전역 변수 추가
let currentDisplayCount = 10; // 현재 표시된 뉴스 개수
const loadMoreCount = 10; // 한 번에 더 로드할 개수
let isLoading = false; // 로딩 중 여부
let hasMoreNews = true; // 더 불러올 뉴스가 있는지

function initializePage() {
    initializeNewsUI();
    initializeInfiniteScroll();
    loadNewsImportanceData();
    loadNewsFeeds();
    
    // 기본 탭을 뉴스로 설정
    switchTab('news');
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

    // 뉴스 그리드용 로딩 트리거 요소 생성
    const newsLoadingTrigger = document.createElement('div');
    newsLoadingTrigger.id = 'news-loading-trigger';
    newsLoadingTrigger.style.height = '20px';
    newsLoadingTrigger.style.margin = '20px 0';
    
    // 속보 그리드용 로딩 트리거 요소 생성
    const breakingLoadingTrigger = document.createElement('div');
    breakingLoadingTrigger.id = 'breaking-loading-trigger';
    breakingLoadingTrigger.style.height = '20px';
    breakingLoadingTrigger.style.margin = '20px 0';
    
    // 뉴스 그리드 뒤에 추가
    const newsGrid = document.getElementById('newsGrid');
    if (newsGrid && newsGrid.parentNode) {
        newsGrid.parentNode.insertBefore(newsLoadingTrigger, newsGrid.nextSibling);
        observer.observe(newsLoadingTrigger);
    }
    
    // 속보 그리드 뒤에 추가
    const breakingGrid = document.getElementById('breakingGrid');
    if (breakingGrid && breakingGrid.parentNode) {
        breakingGrid.parentNode.insertBefore(breakingLoadingTrigger, breakingGrid.nextSibling);
        observer.observe(breakingLoadingTrigger);
    }
}

// 더 많은 뉴스 로드
function loadMoreNews() {
    if (isLoading || !hasMoreNews || !window.newsItems) return;
    
    isLoading = true;
    
    // 현재 활성 탭 확인
    const activeTabBtn = document.querySelector('.tab-btn.active');
    const currentTab = activeTabBtn?.getAttribute('data-tab') || 'news';
    
    // 현재 활성 필터 확인
    const activeTabContent = document.querySelector('.tab-content:not([style*="display: none"])');
    const activeFilter = activeTabContent?.querySelector('.filter-btn.active');
    const source = activeFilter?.getAttribute('data-source') || 'all';
    
    // 로딩 인디케이터 표시
    showLoadingIndicator();
    
    // 약간의 지연 후 뉴스 추가 (실제 로딩 시뮬레이션)
    setTimeout(() => {
        // 현재 탭에 맞는 필터링된 뉴스 가져오기
        let filteredNews;
        if (currentTab === 'breaking') {
            filteredNews = window.newsItems.filter(item => {
                const importance = getNewsImportance(item);
                const sourceMatch = source === 'all' || item.source === source;
                return importance === 5 && sourceMatch;
            });
        } else {
            if (source === 'all') {
                filteredNews = window.newsItems;
            } else {
                filteredNews = window.newsItems.filter(item => item.source === source);
            }
        }
        
        const totalNews = filteredNews.length;
        const newDisplayCount = Math.min(currentDisplayCount + loadMoreCount, totalNews);
        
        if (newDisplayCount > currentDisplayCount) {
            currentDisplayCount = newDisplayCount;
            displayNews(filteredNews, false, currentTab); // 기존 뉴스 유지하면서 추가
            
            // 더 불러올 뉴스가 있는지 확인
            hasMoreNews = currentDisplayCount < totalNews;
        } else {
            hasMoreNews = false;
        }
        
        hideLoadingIndicator();
        isLoading = false;
        
        const tabLabel = currentTab === 'breaking' ? '속보' : '뉴스';
        console.log(`📰 ${tabLabel} 추가 로드: ${currentDisplayCount}/${totalNews} 표시`);
    }, 500);
}

// 로딩 인디케이터 표시
function showLoadingIndicator() {
    // 현재 활성 탭 확인
    const activeTabBtn = document.querySelector('.tab-btn.active');
    const currentTab = activeTabBtn?.getAttribute('data-tab') || 'news';
    
    const indicatorId = currentTab === 'breaking' ? 'breaking-loading-more-indicator' : 'news-loading-more-indicator';
    const triggerSelector = currentTab === 'breaking' ? '#breaking-loading-trigger' : '#news-loading-trigger';
    
    let indicator = document.getElementById(indicatorId);
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = indicatorId;
        const contentType = currentTab === 'breaking' ? '속보' : '뉴스';
        indicator.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-color-secondary);">
                <i class="fas fa-spinner fa-spin"></i> 더 많은 ${contentType}를 불러오는 중...
            </div>
        `;
        
        const loadingTrigger = document.querySelector(triggerSelector);
        if (loadingTrigger) {
            loadingTrigger.parentNode.insertBefore(indicator, loadingTrigger);
        }
    }
    indicator.style.display = 'block';
}

// 로딩 인디케이터 숨기기
function hideLoadingIndicator() {
    // 모든 로딩 인디케이터 숨기기
    const newsIndicator = document.getElementById('news-loading-more-indicator');
    const breakingIndicator = document.getElementById('breaking-loading-more-indicator');
    
    if (newsIndicator) {
        newsIndicator.style.display = 'none';
    }
    if (breakingIndicator) {
        breakingIndicator.style.display = 'none';
    }
}

// 뉴스 페이지 UI 초기화
function initializeNewsUI() {
    // 모든 탭 버튼 초기화 (통합 관리)
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    // 뉴스 필터 버튼 (모든 탭에서 공통 사용)
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 현재 활성 탭의 필터 버튼만 변경
            const currentTab = document.querySelector('.tab-content:not([style*="display: none"])');
            if (currentTab) {
                const currentTabFilters = currentTab.querySelectorAll('.filter-btn');
                currentTabFilters.forEach(btn => btn.classList.remove('active'));
                
                // 같은 탭 내의 해당 버튼 활성화
                const targetButton = currentTab.querySelector(`[data-source="${button.getAttribute('data-source')}"]`);
                if (targetButton) {
                    targetButton.classList.add('active');
                }
            }

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
    const CACHE_DURATION_MS = 3 * 60 * 1000; // 3분 캐시 (더 자주 업데이트)

    // 1. 캐시 확인 및 즉시 표시 (빠른 로딩)
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const cacheData = JSON.parse(cached);
            const age = Date.now() - cacheData.timestamp;
            
            // 캐시가 있으면 즉시 표시 (만료되어도 일단 표시)
            if (cacheData.data && cacheData.data.length > 0) {
                console.log('📰 캐시된 뉴스 즉시 표시');
                window.newsItems = cacheData.data;
                resetInfiniteScroll();
                displayNews(cacheData.data);
                
                // 캐시가 만료되었으면 백그라운드에서 새 데이터 가져오기
                if (age >= CACHE_DURATION_MS) {
                    console.log('📰 캐시 만료, 백그라운드에서 새 데이터 로딩');
                    setTimeout(() => loadFreshNews(true), 100);
                }
                return;
            }
        }
    } catch (e) {
        console.warn('캐시 읽기 실패:', e);
    }
    
    // 캐시가 없으면 로딩 메시지 표시하고 새 데이터 로드
    newsGrid.innerHTML = `
        <div class="loading">
            <div style="text-align: center; padding: 2rem;">
                <div class="loading-spinner" style="width: 40px; height: 40px; border: 3px solid var(--border-color); border-top: 3px solid var(--primary-color); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
                <p style="color: var(--text-color-secondary); margin: 0;">최신 뉴스를 불러오는 중...</p>
                <p style="color: var(--text-color-tertiary); font-size: 0.9rem; margin: 0.5rem 0 0 0;">잠시만 기다려주세요</p>
            </div>
        </div>
    `;
    await loadFreshNews(false);
}

async function loadFreshNews(isBackgroundUpdate = false) {
    const newsGrid = document.getElementById('newsGrid');
    const CACHE_KEY = 'newsFeedsCache';
    
    try {
        const feeds = [
            // 한국 암호화폐 뉴스 소스 (우선순위 순 - 빠른 소스 우선)
            { url: 'https://kr.cointelegraph.com/rss', source: 'cointelegraph' },
            { url: 'https://www.tokenpost.kr/rss', source: 'tokenpost' },
            { url: 'https://www.blockmedia.co.kr/feed', source: 'blockmedia' },
            { url: 'https://bloomingbit.io/rss.xml', source: 'bloomingbit' },
            { url: 'https://kr.investing.com/rss/news.rss', source: 'investing' },
            { url: 'https://www.blockstreet.co.kr/feed', source: 'blockstreet' },
            { url: 'https://cryptonews.com/kr/feed/', source: 'cryptonews' },
            { url: 'https://cryptodnes.bg/kr/feed/', source: 'cryptodnes' },
            { url: 'https://zdnet.co.kr/feed', source: 'zdnet' }
        ];

        // 빠른 로딩을 위한 단계별 처리
        const fastFeeds = feeds.slice(0, 4); // 빠른 피드 4개
        const slowFeeds = feeds.slice(4); // 나머지 피드

        // 1단계: 빠른 피드들 먼저 로드 (2초 타임아웃)
        const fastPromises = fastFeeds.map(feed => 
            Promise.race([
                fetchAndParseFeed(feed),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 5000)
                )
            ]).catch(error => {
                console.warn(`${feed.source} 피드 로딩 실패:`, error.message);
                return []; // 실패한 피드는 빈 배열 반환
            })
        );

        const fastResults = await Promise.all(fastPromises);
        
        let allNews = [];
        let successCount = 0;
        
        // 빠른 피드 결과 처리
        fastResults.forEach((result, index) => {
            const feedName = fastFeeds[index].source;
            if (result && result.length > 0) {
                allNews.push(...result);
                successCount++;
                console.log(`✅ ${feedName}: ${result.length}개 뉴스 로드`);
            }
        });

        // 빠른 피드 결과가 있으면 즉시 표시 (백그라운드 업데이트가 아닌 경우)
        if (allNews.length > 0 && !isBackgroundUpdate) {
            // 중복 제거 및 정렬
            const uniqueNews = removeDuplicateNews(allNews);
            uniqueNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            
            // 캐시 저장
            const cacheData = {
                timestamp: Date.now(),
                data: uniqueNews
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
            
            window.newsItems = uniqueNews;
            resetInfiniteScroll();
            displayNews(uniqueNews);
            
            // 속보 뉴스 카드 업데이트 (index.html의 카드가 있을 때)
            setTimeout(() => triggerBreakingNewsUpdate(), 500);
            
            console.log(`📰 빠른 로딩 완료: ${successCount}개 소스에서 ${uniqueNews.length}개 뉴스`);
        }

        // 2단계: 나머지 피드들 백그라운드에서 로드 (5초 타임아웃)
        const slowPromises = slowFeeds.map(feed => 
            Promise.race([
                fetchAndParseFeed(feed),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 5000)
                )
            ]).catch(error => {
                console.warn(`${feed.source} 피드 로딩 실패:`, error.message);
                return [];
            })
        );

        const slowResults = await Promise.all(slowPromises);
        
        // 나머지 피드 결과 처리
        slowResults.forEach((result, index) => {
            const feedName = slowFeeds[index].source;
            if (result && result.length > 0) {
                allNews.push(...result);
                successCount++;
                console.log(`✅ ${feedName}: ${result.length}개 뉴스 로드`);
            }
        });

        // 최종 결과 처리
        if (allNews.length === 0) {
            throw new Error('모든 뉴스 피드를 가져오는데 실패했습니다.');
        }

        // 중복 제거 및 정렬
        const uniqueNews = removeDuplicateNews(allNews);
        uniqueNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        
        // 캐시 저장
        const cacheData = {
            timestamp: Date.now(),
            data: uniqueNews
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));

        // 백그라운드 업데이트가 아닌 경우에만 UI 업데이트
        if (!isBackgroundUpdate) {
            window.newsItems = uniqueNews;
            resetInfiniteScroll();
            displayNews(uniqueNews);
            
            // 속보 뉴스 카드 업데이트
            setTimeout(() => triggerBreakingNewsUpdate(), 500);
        } else {
            // 백그라운드 업데이트인 경우 새 데이터로 교체
            window.newsItems = uniqueNews;
            
            // 백그라운드 업데이트에서도 속보 카드 업데이트
            setTimeout(() => triggerBreakingNewsUpdate(), 500);
            
            console.log(`📰 백그라운드 업데이트 완료: ${uniqueNews.length}개 뉴스`);
        }
        
        console.log(`📰 뉴스 로딩 완료: ${successCount}/${feeds.length} 소스 성공, ${uniqueNews.length}개 뉴스`);

    } catch (error) {
        console.error('뉴스 로딩 실패:', error);
        if (!isBackgroundUpdate) {
            newsGrid.innerHTML = `
                <div class="loading">
                    <div style="text-align: center; padding: 2rem;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: #f59e0b; margin-bottom: 1rem;"></i>
                        <p style="color: var(--text-color-secondary); margin: 0;">뉴스를 불러오는데 실패했습니다.</p>
                        <p style="color: var(--text-color-tertiary); font-size: 0.9rem; margin: 0.5rem 0 0 0;">잠시 후 다시 시도해주세요.</p>
                        <button onclick="loadNewsFeeds()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: var(--primary-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                            다시 시도
                        </button>
                    </div>
                </div>
            `;
        }
    }
}

// 중복 뉴스 제거 함수
function removeDuplicateNews(newsArray) {
    const uniqueNewsMap = new Map();
    newsArray.forEach(item => {
        if (item.link && !uniqueNewsMap.has(item.link)) {
            uniqueNewsMap.set(item.link, item);
        }
    });
    return Array.from(uniqueNewsMap.values());
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
function displayNews(news, isInitialLoad = true, currentTab = 'news') {
    const gridId = currentTab === 'breaking' ? 'breakingGrid' : 'newsGrid';
    const newsGrid = document.getElementById(gridId);
    
    if (!newsGrid || !news || news.length === 0) {
        if (newsGrid) {
            const message = currentTab === 'breaking' ? '속보가 없습니다.' : '뉴스를 불러올 수 없습니다.';
            newsGrid.innerHTML = `<div class="loading">${message}</div>`;
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
        
        // 뉴스 중요도 자동 분석 및 별 아이콘 생성
        const starRating = createStarRating(item);
        const importance = getNewsImportance(item);
        
        // 이미지가 있는지 확인
        const hasImage = item.image && item.image !== '/img/default-news.jpg' && item.image.startsWith('http');
        
        const newsItem = document.createElement('div');
        newsItem.className = `news-item ${hasImage ? 'has-image' : 'no-image'} importance-${importance}`;
        
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
                    <span class="news-time">
                        ${relativeTime}
                        ${starRating}
                    </span>
                </div>
                <h3 class="news-title">${item.title}</h3>
                <p class="news-desc">${item.contentSnippet}</p>
            </div>
        `;
        
        // 뉴스 아이템 클릭 이벤트 추가 (별 아이콘은 클릭 불가)
        newsItem.addEventListener('click', (event) => {
            // 별 아이콘 영역은 클릭 무시
            if (!event.target.closest('.news-importance')) {
                if (item.link) {
                    window.open(item.link, '_blank', 'noopener,noreferrer');
                }
            }
        });
        
        fragment.appendChild(newsItem);
    });
    
    newsGrid.appendChild(fragment);
    
    // 더 불러올 뉴스가 없으면 완료 메시지 표시
    if (!hasMoreNews && isInitialLoad) {
        const completeMessage = document.createElement('div');
        completeMessage.className = 'loading';
        const contentType = currentTab === 'breaking' ? '속보' : '뉴스';
        completeMessage.innerHTML = `총 ${news.length}개의 ${contentType}를 모두 불러왔습니다.`;
        newsGrid.appendChild(completeMessage);
    }
}

// 통합 탭 전환 함수
function switchTab(tabName) {
    // 모든 탭 버튼 비활성화
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    
    // 모든 탭 컨텐츠 숨기기
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => content.style.display = 'none');
    
    // 선택된 탭 활성화
    const selectedTabBtn = document.querySelector(`[data-tab="${tabName}"]`);
    const selectedTabContent = document.getElementById(`${tabName}Tab`);
    
    if (selectedTabBtn) selectedTabBtn.classList.add('active');
    if (selectedTabContent) selectedTabContent.style.display = 'block';
    
    // 탭별 특별 처리
    if (tabName === 'news' || tabName === 'breaking') {
        // 뉴스 관련 탭
        if (window.newsItems) {
            // 현재 활성 필터 가져오기
            const activeFilter = selectedTabContent?.querySelector('.filter-btn.active');
            const source = activeFilter?.getAttribute('data-source') || 'all';
            
            resetInfiniteScroll();
            filterNews(source, tabName);
        }
    } else if (tabName === 'economic-calendar') {
        // 경제 캘린더 탭 - 약간의 지연 후 로드
        setTimeout(() => {
            loadEconomicCalendar();
        }, 100);
    }
    
    console.log(`📑 탭 전환: ${tabName}`);
}

// 경제 캘린더 로드 함수 - 직접 로드 방식으로 변경
function loadEconomicCalendar() {
    console.log('📊 경제 캘린더 로드 시작');
    
    // 경제 캘린더가 이미 로드되었는지 확인
    if (window.isEconomicCalendarLoaded) {
        console.log('📊 경제 캘린더 이미 로드됨');
        return;
    }

    // TabNavigation 클래스 사용 시도
    if (window.tabNavigation && typeof window.tabNavigation.loadTradingViewCalendar === 'function') {
        console.log('📊 TabNavigation으로 경제 캘린더 로드');
        window.tabNavigation.loadTradingViewCalendar();
        window.isEconomicCalendarLoaded = true;
        return;
    }

    // TabNavigation이 없으면 직접 로드
    console.log('📊 TabNavigation 없음 - 직접 로드');
    loadTradingViewCalendar();
}

// 간단한 캘린더 표시 함수
function showSimpleCalendar() {
    console.log('📊 간단한 경제 캘린더 표시');
    
    const widgetContainer = document.querySelector('#tradingview-economic-calendar');
    if (!widgetContainer) {
        console.error('위젯 컨테이너를 찾을 수 없습니다.');
        return;
    }

    widgetContainer.innerHTML = `
        <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 600px;
            text-align: center;
            padding: 20px;
            background: #fff;
            border-radius: 8px;
        ">
            <i class="fas fa-calendar-alt" style="font-size: 3rem; margin-bottom: 1rem; color: #2962ff;"></i>
            <h3 style="margin: 0 0 1rem 0; color: #333;">경제 캘린더 로드 중...</h3>
            <p style="margin: 0 0 1rem 0; line-height: 1.5; color: #666;">
                economic-calendar.js 파일이 로드되면 자동으로 TradingView 캘린더가 표시됩니다.
            </p>
            <a href="https://kr.tradingview.com/economic-calendar/" 
               target="_blank" 
               style="
                   display: inline-block;
                   padding: 10px 20px;
                   background: #2962ff;
                   color: white;
                   text-decoration: none;
                   border-radius: 5px;
                   font-size: 0.9rem;
               ">TradingView 사이트에서 보기</a>
        </div>
    `;
}

// TradingView 경제 캘린더 로드 (직접 iframe 방식)
function loadTradingViewCalendar() {
    const widgetContainer = document.querySelector('#tradingview-economic-calendar');
    if (!widgetContainer) {
        console.error('TradingView 위젯 컨테이너를 찾을 수 없습니다.');
        return;
    }

    console.log('📊 TradingView 경제 캘린더 iframe 로드');

    try {
        // 직접 iframe으로 TradingView 경제 캘린더 로드
        widgetContainer.innerHTML = `
            <div style="height: 600px; width: 100%; background: #fff; border-radius: 8px; overflow: hidden;">
                <iframe 
                    src="https://www.tradingview.com/embed-widget/events/?locale=ko&importanceFilter=-1%2C0%2C1&countryFilter=us%2Ceu%2Cjp%2Ccn%2Ckr%2Cgb%2Cca%2Cau%2Cde%2Cfr%2Cit%2Ces%2Cbr%2Cin%2Cru%2Cmx%2Cza%2Ctr%2Csg%2Chk%2Ctw%2Cth%2Cmy%2Cid%2Cph%2Cvn&currencyFilter=USD%2CEUR%2CJPY%2CGBP%2CCHF%2CAUD%2CCAD%2CNZD%2CCNY%2CKRW%2CBTC%2CETH&utm_source=&utm_medium=widget&utm_campaign=events&utm_term="
                    width="100%"
                    height="600"
                    frameborder="0"
                    scrolling="no"
                    allowfullscreen="true"
                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                    referrerpolicy="no-referrer-when-downgrade"
                    style="
                        border: none;
                        width: 100%;
                        height: 600px;
                        background: #fff;
                        border-radius: 8px;
                    "
                    loading="lazy">
                </iframe>
            </div>
        `;

        window.isEconomicCalendarLoaded = true;
        console.log('📊 TradingView 경제 캘린더 iframe 설정 완료');

        // 5초 후 로드 상태 확인
        setTimeout(() => {
            checkCalendarLoad();
        }, 5000);

    } catch (error) {
        console.error('TradingView 경제 캘린더 로드 중 오류:', error);
        loadFallbackCalendar();
    }
}

// 캘린더 로드 상태 확인
function checkCalendarLoad() {
    const iframe = document.querySelector('#tradingview-economic-calendar iframe');
    if (!iframe) {
        console.log('iframe이 없어서 대체 캘린더 로드');
        loadFallbackCalendar();
        return;
    }

    // iframe이 정상적으로 로드되었는지 확인
    const rect = iframe.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
        console.log('📊 TradingView 경제 캘린더 정상 작동 중');
    } else {
        console.log('캘린더 로드 실패, 대체 캘린더 로드');
        loadFallbackCalendar();
    }
}

// 대체 캘린더 로드
function loadFallbackCalendar() {
    const widgetContainer = document.querySelector('#tradingview-economic-calendar');
    if (!widgetContainer) {
        console.error('위젯 컨테이너를 찾을 수 없습니다.');
        return;
    }

    console.log('📊 대체 경제 캘린더 로드');

    // 한국 투자 정보 사이트의 경제 캘린더
    widgetContainer.innerHTML = `
        <div style="height: 600px; width: 100%; background: #fff; border-radius: 8px; overflow: hidden; position: relative;">
            <div style="
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 15px;
                text-align: center;
                font-weight: bold;
                z-index: 10;
                font-size: 1.1rem;
            ">
                📊 경제 캘린더 - 주요 경제 지표 및 이벤트
            </div>
            <iframe 
                src="https://kr.investing.com/economic-calendar/"
                width="100%"
                height="560"
                frameborder="0"
                scrolling="yes"
                allowfullscreen="true"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                referrerpolicy="no-referrer-when-downgrade"
                style="
                    border: none;
                    width: 100%;
                    height: 560px;
                    background: #fff;
                    margin-top: 40px;
                "
                loading="lazy">
            </iframe>
        </div>
    `;

    console.log('📊 대체 경제 캘린더 설정 완료');

    // 10초 후에도 로드되지 않으면 정적 캘린더 표시
    setTimeout(() => {
        checkFallbackCalendarLoad();
    }, 10000);
}

// 대체 캘린더 로드 상태 확인
function checkFallbackCalendarLoad() {
    const iframe = document.querySelector('#tradingview-economic-calendar iframe');
    if (!iframe) {
        console.log('대체 캘린더도 없어서 정적 캘린더 표시');
        showStaticCalendar();
        return;
    }

    // iframe이 정상적으로 로드되었는지 확인
    const rect = iframe.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
        console.log('📊 대체 경제 캘린더 정상 작동 중');
    } else {
        console.log('대체 캘린더 로드 실패, 정적 캘린더 표시');
        showStaticCalendar();
    }
}

// 정적 경제 캘린더 표시
function showStaticCalendar() {
    const widgetContainer = document.querySelector('#tradingview-economic-calendar');
    if (!widgetContainer) return;

    const today = new Date();
    const todayStr = today.toLocaleDateString('ko-KR', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        weekday: 'long'
    });

    widgetContainer.innerHTML = `
        <div style="
            height: 600px;
            width: 100%;
            background: #fff;
            border-radius: 8px;
            padding: 20px;
            box-sizing: border-box;
            overflow-y: auto;
        ">
            <div style="
                text-align: center;
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 2px solid #e9ecef;
            ">
                <h2 style="
                    color: #2962ff;
                    margin: 0 0 10px 0;
                    font-size: 1.8rem;
                ">📊 경제 캘린더</h2>
                <p style="
                    color: #666;
                    margin: 0;
                    font-size: 1.1rem;
                ">${todayStr}</p>
            </div>

            <div style="margin-bottom: 30px;">
                <h3 style="
                    color: #333;
                    margin: 0 0 15px 0;
                    font-size: 1.3rem;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                ">
                    <span style="color: #ff6b6b;">🔴</span>
                    주요 경제 지표
                </h3>
                <div style="
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 15px;
                ">
                    <div style="
                        background: #f8f9fa;
                        padding: 15px;
                        border-radius: 8px;
                        border-left: 4px solid #ff6b6b;
                    ">
                        <h4 style="margin: 0 0 5px 0; color: #333;">🇺🇸 미국 CPI</h4>
                        <p style="margin: 0; color: #666; font-size: 0.9rem;">소비자물가지수</p>
                    </div>
                    <div style="
                        background: #f8f9fa;
                        padding: 15px;
                        border-radius: 8px;
                        border-left: 4px solid #ffa500;
                    ">
                        <h4 style="margin: 0 0 5px 0; color: #333;">🇺🇸 FOMC</h4>
                        <p style="margin: 0; color: #666; font-size: 0.9rem;">연방공개시장위원회</p>
                    </div>
                    <div style="
                        background: #f8f9fa;
                        padding: 15px;
                        border-radius: 8px;
                        border-left: 4px solid #28a745;
                    ">
                        <h4 style="margin: 0 0 5px 0; color: #333;">🇰🇷 한국 기준금리</h4>
                        <p style="margin: 0; color: #666; font-size: 0.9rem;">한국은행 금통위</p>
                    </div>
                    <div style="
                        background: #f8f9fa;
                        padding: 15px;
                        border-radius: 8px;
                        border-left: 4px solid #007bff;
                    ">
                        <h4 style="margin: 0 0 5px 0; color: #333;">🇪🇺 ECB 정책금리</h4>
                        <p style="margin: 0; color: #666; font-size: 0.9rem;">유럽중앙은행</p>
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 30px;">
                <h3 style="
                    color: #333;
                    margin: 0 0 15px 0;
                    font-size: 1.3rem;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                ">
                    <span style="color: #2962ff;">💼</span>
                    암호화폐 관련 이벤트
                </h3>
                <div style="
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    border: 1px solid #e9ecef;
                ">
                    <p style="
                        margin: 0 0 10px 0;
                        color: #333;
                        font-weight: bold;
                    ">🚀 주요 암호화폐 이벤트</p>
                    <ul style="
                        margin: 0;
                        padding-left: 20px;
                        color: #666;
                    ">
                        <li>비트코인 ETF 승인 관련 소식</li>
                        <li>주요 거래소 상장/상폐 공지</li>
                        <li>메이저 프로젝트 업데이트</li>
                        <li>규제 관련 발표</li>
                    </ul>
                </div>
            </div>

            <div style="
                text-align: center;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 8px;
                border: 1px solid #e9ecef;
            ">
                <p style="
                    margin: 0 0 15px 0;
                    color: #666;
                    font-size: 0.9rem;
                ">더 자세한 경제 캘린더는 아래 링크에서 확인하세요</p>
                <div style="
                    display: flex;
                    gap: 10px;
                    justify-content: center;
                    flex-wrap: wrap;
                ">
                    <a href="https://kr.tradingview.com/economic-calendar/" 
                       target="_blank" 
                       style="
                           display: inline-block;
                           padding: 10px 20px;
                           background: #2962ff;
                           color: white;
                           text-decoration: none;
                           border-radius: 5px;
                           font-size: 0.9rem;
                           margin: 5px;
                       ">TradingView 캘린더</a>
                    <a href="https://kr.investing.com/economic-calendar/" 
                       target="_blank" 
                       style="
                           display: inline-block;
                           padding: 10px 20px;
                           background: #28a745;
                           color: white;
                           text-decoration: none;
                           border-radius: 5px;
                           font-size: 0.9rem;
                           margin: 5px;
                       ">Investing.com 캘린더</a>
                    <button onclick="loadEconomicCalendar()" style="
                        padding: 10px 20px;
                        background: #007bff;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 0.9rem;
                        margin: 5px;
                    ">캘린더 다시 로드</button>
                </div>
            </div>
        </div>
    `;

    console.log('📊 정적 경제 캘린더 표시 완료');
}

// 캘린더 오류 메시지 표시
function showCalendarError() {
    const widgetContainer = document.querySelector('.tradingview-widget-container__widget');
    if (!widgetContainer) return;

    widgetContainer.innerHTML = `
        <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 600px;
            color: var(--text-color-secondary);
            text-align: center;
            padding: 20px;
            background: #fff;
            border-radius: 8px;
        ">
            <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem; color: #ff6b6b;"></i>
            <h3 style="margin: 0 0 1rem 0; color: var(--text-color);">경제 캘린더를 불러올 수 없습니다</h3>
            <p style="margin: 0 0 1rem 0; line-height: 1.5; color: var(--text-color-secondary);">
                네트워크 연결을 확인하고 다시 시도해주세요.<br>
                또는 아래 링크를 통해 직접 확인하세요.
            </p>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;">
                <button onclick="loadEconomicCalendar()" style="
                    padding: 10px 20px;
                    background: #2962ff;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 0.9rem;
                    margin: 5px;
                ">다시 시도</button>
                <a href="https://kr.tradingview.com/economic-calendar/" 
                   target="_blank" 
                   style="
                       display: inline-block;
                       padding: 10px 20px;
                       background: #007bff;
                       color: white;
                       text-decoration: none;
                       border-radius: 5px;
                       font-size: 0.9rem;
                       margin: 5px;
                   ">TradingView 사이트로</a>
            </div>
        </div>
    `;
}

// 뉴스 필터링 (탭별 처리)
function filterNews(source, currentTab = null) {
    if (!window.newsItems) return;
    
    // 현재 탭 확인
    if (!currentTab) {
        const activeTabBtn = document.querySelector('.tab-btn.active');
        currentTab = activeTabBtn?.getAttribute('data-tab') || 'news';
    }
    
    let filteredNews;
    
    // 속보 탭인 경우 중요도 5점만 필터링
    if (currentTab === 'breaking') {
        filteredNews = window.newsItems.filter(item => {
            const importance = getNewsImportance(item);
            const sourceMatch = source === 'all' || item.source === source;
            return importance === 5 && sourceMatch;
        });
    } else {
        // 일반 뉴스 탭
        if (source === 'all') {
            filteredNews = window.newsItems;
        } else {
            filteredNews = window.newsItems.filter(item => item.source === source);
        }
    }
    
    // 무한스크롤 상태 리셋
    resetInfiniteScroll();
    
    // 필터링된 뉴스 표시
    displayNews(filteredNews, true, currentTab);
    
    const tabLabel = currentTab === 'breaking' ? '속보' : '뉴스';
    console.log(`🔍 ${tabLabel} 필터링 완료: ${source} (${filteredNews.length}개)`);
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

// ===================================================================
// 뉴스 중요도 자동 분석 시스템
// ===================================================================

// 암호화폐 시장 영향도 키워드 데이터베이스
const IMPORTANCE_KEYWORDS = {
    // 매우 높음 (5점) - 시장 전체에 큰 영향
    5: {
        keywords: ['규제', '금지', '승인', '상장', '상장폐지', 'SEC', '연준', '금리', '비트코인 ETF', 'ETF 승인', '해킹', '파산', '폐쇄', '중단', '긴급', '경고', '위험', '폭락', '급등', '사상 최고', '사상 최저', '반감기', '포크', '업그레이드', '메인넷', '런칭'],
        weight: 5,
        sources: ['SEC', 'Fed', '연준', '금융위', '정부', '청와대', '국회', '법원', '검찰']
    },
    // 높음 (4점) - 특정 코인이나 섹터에 큰 영향
    4: {
        keywords: ['투자', '펀딩', '파트너십', '제휴', '인수', '합병', '신규', '출시', '베타', '알파', '테스트넷', '로드맵', '개발', '업데이트', '보안', '취약점', '버그', '수정', '개선', '확장', '통합', '지원', '추가'],
        weight: 4,
        sources: ['거래소', '바이낸스', '코인베이스', '업비트', '빗썸', '후오비', 'FTX', 'OKX']
    },
    // 보통 (3점) - 일반적인 시장 뉴스
    3: {
        keywords: ['분석', '예측', '전망', '리포트', '보고서', '연구', '조사', '설문', '인터뷰', '발언', '의견', '코멘트', '논평', '평가', '검토', '검토', '고려', '계획', '준비', '검토중', '논의'],
        weight: 3,
        sources: ['분석가', '전문가', '애널리스트', '연구소', '기관', '은행', '투자회사']
    },
    // 낮음 (2점) - 참고 정보
    2: {
        keywords: ['이벤트', '컨퍼런스', '세미나', '워크샵', '교육', '강의', '설명', '소개', '가이드', '튜토리얼', '기본', '초보', '입문', '시작', '방법', '팁', '노하우', '경험', '후기', '리뷰'],
        weight: 2,
        sources: ['커뮤니티', '블로그', '유튜브', '트위터', '텔레그램', '디스코드']
    },
    // 매우 낮음 (1점) - 일반 정보
    1: {
        keywords: ['소식', '뉴스', '정보', '알림', '공지', '안내', '공유', '게시', '업로드', '포스팅', '글', '기사', '내용', '자료', '데이터', '통계', '수치', '지표', '차트', '그래프'],
        weight: 1,
        sources: ['뉴스', '미디어', '언론', '매체', '신문', '방송']
    }
};

// 특별 키워드 (추가 가중치)
const SPECIAL_KEYWORDS = {
    // 긍정적 영향 (+0.5점)
    positive: ['상승', '증가', '성장', '확대', '개선', '혁신', '발전', '성공', '달성', '돌파', '기록', '최고', '우수', '뛰어난', '탁월한', '혁신적'],
    // 부정적 영향 (+0.5점)
    negative: ['하락', '감소', '축소', '악화', '문제', '이슈', '우려', '위험', '실패', '좌절', '지연', '연기', '취소', '중단', '최저', '부족', '어려움'],
    // 시급성 (+0.3점)
    urgent: ['긴급', '즉시', '당장', '오늘', '내일', '이번주', '곧', '빠른', '신속', '급한', '중요', '필수', '반드시', '꼭'],
    // 대형 기업/기관 (+0.2점)
    major: ['삼성', '애플', '구글', '마이크로소프트', '테슬라', '메타', '아마존', '넷플릭스', '엔비디아', '블랙록', '피델리티', '골드만삭스', 'JP모건']
};

// 뉴스 중요도 데이터 로드
async function loadNewsImportanceData() {
    try {
        // 캐시에서 먼저 확인
        const cached = localStorage.getItem(IMPORTANCE_CACHE_KEY);
        if (cached) {
            const cacheData = JSON.parse(cached);
            const age = Date.now() - cacheData.timestamp;
            
            if (age < IMPORTANCE_CACHE_DURATION) {
                newsImportanceData = cacheData.data || {};
                console.log('📊 뉴스 중요도 데이터 캐시에서 로드됨');
                return;
            }
        }

        // Firebase에서 중요도 데이터 로드
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            const db = firebase.firestore();
            const snapshot = await db.collection('newsImportance').get();
            
            newsImportanceData = {};
            snapshot.forEach(doc => {
                newsImportanceData[doc.id] = doc.data();
            });
            
            // 캐시에 저장
            localStorage.setItem(IMPORTANCE_CACHE_KEY, JSON.stringify({
                data: newsImportanceData,
                timestamp: Date.now()
            }));
            
            console.log('📊 뉴스 중요도 데이터 Firebase에서 로드됨');
        }
    } catch (error) {
        console.warn('뉴스 중요도 데이터 로드 실패:', error);
        newsImportanceData = {};
    }
}

// 뉴스 중요도 자동 분석
function analyzeNewsImportance(newsItem) {
    const title = newsItem.title || '';
    const content = newsItem.contentSnippet || newsItem.content || '';
    const source = newsItem.source || '';
    const pubDate = newsItem.pubDate || '';
    
    // 분석할 텍스트 통합
    const fullText = `${title} ${content}`.toLowerCase();
    
    let score = 0;
    let matchedKeywords = [];
    let analysisDetails = {
        keywordMatches: [],
        sourceBonus: 0,
        timeBonus: 0,
        specialBonus: 0,
        finalScore: 0
    };
    
    // 1. 키워드 분석
    for (const [level, data] of Object.entries(IMPORTANCE_KEYWORDS)) {
        const levelScore = parseInt(level);
        let keywordMatches = 0;
        
        for (const keyword of data.keywords) {
            if (fullText.includes(keyword.toLowerCase())) {
                keywordMatches++;
                matchedKeywords.push({keyword, level: levelScore});
                analysisDetails.keywordMatches.push({keyword, level: levelScore});
            }
        }
        
        // 키워드 매칭 점수 계산 (매칭된 키워드 수에 따라 가중치 적용)
        if (keywordMatches > 0) {
            const keywordScore = Math.min(keywordMatches * 0.3, 1.0) * levelScore;
            score += keywordScore;
        }
    }
    
    // 2. 소스 신뢰도 보너스
    for (const [level, data] of Object.entries(IMPORTANCE_KEYWORDS)) {
        for (const sourceKeyword of data.sources) {
            if (fullText.includes(sourceKeyword.toLowerCase()) || source.toLowerCase().includes(sourceKeyword.toLowerCase())) {
                const sourceBonus = parseInt(level) * 0.2;
                score += sourceBonus;
                analysisDetails.sourceBonus += sourceBonus;
                break;
            }
        }
    }
    
    // 3. 특별 키워드 보너스
    for (const [type, keywords] of Object.entries(SPECIAL_KEYWORDS)) {
        for (const keyword of keywords) {
            if (fullText.includes(keyword.toLowerCase())) {
                let bonus = 0;
                switch(type) {
                    case 'positive':
                    case 'negative':
                        bonus = 0.5;
                        break;
                    case 'urgent':
                        bonus = 0.3;
                        break;
                    case 'major':
                        bonus = 0.2;
                        break;
                }
                score += bonus;
                analysisDetails.specialBonus += bonus;
                break;
            }
        }
    }
    
    // 4. 시간 가중치 (최신 뉴스일수록 높은 점수)
    if (pubDate) {
        const newsDate = new Date(pubDate);
        const now = new Date();
        const hoursDiff = (now - newsDate) / (1000 * 60 * 60);
        
        if (hoursDiff < 1) {
            score += 0.5; // 1시간 이내
            analysisDetails.timeBonus = 0.5;
        } else if (hoursDiff < 6) {
            score += 0.3; // 6시간 이내
            analysisDetails.timeBonus = 0.3;
        } else if (hoursDiff < 24) {
            score += 0.1; // 24시간 이내
            analysisDetails.timeBonus = 0.1;
        }
    }
    
    // 5. 최종 점수 정규화 (1-5점)
    const finalScore = Math.max(1, Math.min(5, Math.round(score)));
    analysisDetails.finalScore = finalScore;
    
    // 분석 결과 로그
    if (matchedKeywords.length > 0) {
        console.log(`🤖 뉴스 분석 완료: "${title.substring(0, 50)}..." = ${finalScore}점`);
        console.log(`   매칭 키워드: ${matchedKeywords.map(k => k.keyword).join(', ')}`);
    }
    
    return {
        score: finalScore,
        details: analysisDetails,
        matchedKeywords: matchedKeywords
    };
}

// 뉴스 중요도 저장 (분석 결과 포함)
async function saveNewsImportance(newsId, importance, analysisDetails = null) {
    try {
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            const db = firebase.firestore();
            const data = {
                importance: importance,
                timestamp: Date.now(),
                updatedAt: new Date().toISOString(),
                isAnalyzed: true
            };
            
            // 분석 세부사항 추가
            if (analysisDetails) {
                data.analysisDetails = analysisDetails;
            }
            
            await db.collection('newsImportance').doc(newsId).set(data);
            
            // 로컬 캐시 업데이트
            newsImportanceData[newsId] = data;
            
            // 캐시 저장
            localStorage.setItem(IMPORTANCE_CACHE_KEY, JSON.stringify({
                data: newsImportanceData,
                timestamp: Date.now()
            }));
            
            console.log(`🤖 뉴스 중요도 자동 분석 저장됨: ${newsId} = ${importance}점`);
        }
    } catch (error) {
        console.error('뉴스 중요도 저장 실패:', error);
    }
}

// 뉴스 중요도 가져오기 (캐시 우선, 없으면 분석)
function getNewsImportance(newsItem) {
    const newsId = generateNewsId(newsItem);
    if (!newsId) return 1;
    
    // 캐시에서 확인
    const cached = newsImportanceData[newsId];
    if (cached && cached.importance) {
        return cached.importance;
    }
    
    // 캐시에 없으면 자동 분석
    const analysis = analyzeNewsImportance(newsItem);
    
    // 백그라운드에서 저장 (비동기)
    setTimeout(() => {
        saveNewsImportance(newsId, analysis.score, analysis.details);
    }, 100);
    
    return analysis.score;
}

// 뉴스 ID 생성 (URL 기반)
function generateNewsId(newsItem) {
    if (!newsItem.link) return null;
    
    try {
        // URL을 기반으로 고유 ID 생성
        const url = new URL(newsItem.link);
        const path = url.pathname.replace(/[^a-zA-Z0-9]/g, '');
        const source = newsItem.source || 'unknown';
        
        return `${source}_${path}`.substring(0, 100);
    } catch (error) {
        // URL 파싱 실패 시 제목 기반 ID 생성
        const title = newsItem.title || 'untitled';
        const source = newsItem.source || 'unknown';
        const cleanTitle = title.replace(/[^a-zA-Z0-9가-힣]/g, '').substring(0, 50);
        
        return `${source}_${cleanTitle}`.substring(0, 100);
    }
}

// 별 아이콘 HTML 생성 (자동 분석 결과 표시)
function createStarRating(newsItem) {
    const newsId = generateNewsId(newsItem);
    if (!newsId) return '';
    
    const importance = getNewsImportance(newsItem);
    const analysis = analyzeNewsImportance(newsItem);
    
    const stars = [];
    for (let i = 1; i <= 5; i++) {
        const filled = i <= importance ? 'filled' : '';
        stars.push(`<span class="star ${filled}">★</span>`);
    }
    
    // 분석 근거 툴팁 생성
    let tooltipText = `AI 분석: ${importance}점`;
    if (analysis.matchedKeywords.length > 0) {
        const keywords = analysis.matchedKeywords.slice(0, 3).map(k => k.keyword).join(', ');
        tooltipText += ` (${keywords})`;
    }
    
    return `
        <div class="news-importance" data-news-id="${newsId}" data-importance="${importance}" data-tooltip="${tooltipText}">
            ${stars.join('')}
        </div>
    `;
}

// 뉴스 중요도 재분석 (필요시)
async function reanalyzeNewsImportance(newsItem) {
    const newsId = generateNewsId(newsItem);
    if (!newsId) return;
    
    const analysis = analyzeNewsImportance(newsItem);
    await saveNewsImportance(newsId, analysis.score, analysis.details);
    
    console.log(`🔄 뉴스 재분석 완료: ${newsId} = ${analysis.score}점`);
    return analysis.score;
}

// 전역 스코프에 함수들 노출 (index.html의 속보 카드에서 사용)
window.getNewsImportance = getNewsImportance;
window.getRelativeTime = getRelativeTime;
window.getSourceDisplayName = getSourceDisplayName;
window.createStarRating = createStarRating;

// 속보 카드 업데이트 이벤트 발송
function triggerBreakingNewsUpdate() {
    if (typeof window.updateBreakingNewsCard === 'function') {
        window.updateBreakingNewsCard();
    } else {
        // 커스텀 이벤트 발송
        window.dispatchEvent(new CustomEvent('newsDataUpdated'));
    }
}