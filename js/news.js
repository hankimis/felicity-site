// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', function() {
    // 메인페이지의 속보뉴스 카드를 위한 뉴스 데이터 로드
    const breakingNewsCard = document.querySelector('.breaking-news-card');
    if (breakingNewsCard) {
        loadNewsForMainPage();
    }
    
    // 뉴스 페이지인 경우에만 전체 초기화
    const newsGrid = document.getElementById('newsGrid');
    if (newsGrid) {
        initializePage();
    }
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
    // 뉴스 페이지인지 확인
    const newsGrid = document.getElementById('newsGrid');
    if (!newsGrid) {
        return;
    }
    
    initializeNewsUI();
    initializeInfiniteScroll();
    loadNewsImportanceData();
    loadNewsFeeds();
    initializeEconomicCalendar();
    
    // 기본 탭을 뉴스로 설정
    switchTab('news');
}

// 무한스크롤 초기화
function initializeInfiniteScroll() {
    // 뉴스 페이지인지 확인
    const newsGrid = document.getElementById('newsGrid');
    if (!newsGrid) {
        return;
    }
    
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
                return importance >= 4 && sourceMatch;
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
        
        // 속보 탭에서는 모든 뉴스를 표시했을 때 완료 메시지 표시
        if (currentTab === 'breaking' && !hasMoreNews) {
            const breakingGrid = document.getElementById('breakingGrid');
            if (breakingGrid) {
                const completeMessage = document.createElement('div');
                completeMessage.className = 'loading';
                completeMessage.innerHTML = `총 ${totalNews}개의 속보를 모두 불러왔습니다.`;
                breakingGrid.appendChild(completeMessage);
            }
        }
        
        hideLoadingIndicator();
        isLoading = false;
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
    // 뉴스 페이지인지 확인
    const newsGrid = document.getElementById('newsGrid');
    if (!newsGrid) {
        return;
    }
    
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
    // 현재 활성 탭 확인
    const activeTabBtn = document.querySelector('.tab-btn.active');
    const currentTab = activeTabBtn?.getAttribute('data-tab') || 'news';
    
    // 속보 탭에서는 더 많은 뉴스를 표시하도록 설정
    if (currentTab === 'breaking') {
        currentDisplayCount = 20; // 속보는 더 많은 뉴스 표시
    } else {
        currentDisplayCount = 10; // 일반 뉴스는 10개씩
    }
    
    hasMoreNews = true;
    isLoading = false;
    hideLoadingIndicator();
}

// 뉴스 피드 로드 (캐싱 및 최적화)
async function loadNewsFeeds() {
    const newsGrid = document.getElementById('newsGrid');
    const CACHE_KEY = 'newsFeedsCache';
    const CACHE_DURATION_MS = 3 * 60 * 1000; // 3분 캐시 (더 자주 업데이트)

    // newsGrid가 없으면 함수 종료
    if (!newsGrid) {
        return;
    }

            // 1. 캐시 확인 및 즉시 표시 (빠른 로딩)
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const cacheData = JSON.parse(cached);
                const age = Date.now() - cacheData.timestamp;
                
                // 캐시가 있으면 즉시 표시 (만료되어도 일단 표시)
                if (cacheData.data && cacheData.data.length > 0) {
                    // 캐시된 데이터의 시간 정보 검증 및 수정
                    const validatedData = validateAndFixNewsDates(cacheData.data);
                    window.newsItems = validatedData;
                    resetInfiniteScroll();
                    displayNews(validatedData);
                    
                    // 캐시가 만료되었으면 백그라운드에서 새 데이터 가져오기
                    if (age >= CACHE_DURATION_MS) {
                        setTimeout(() => loadFreshNews(true), 100);
                    }
                    return;
                }
            }
        } catch (e) {
            // 캐시 읽기 실패 시 무시
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
    
    // newsGrid가 없으면 함수 종료
    if (!newsGrid) {
        return;
    }
    
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
            }
        });

        // 빠른 피드 결과가 있으면 즉시 표시 (백그라운드 업데이트가 아닌 경우)
        if (allNews.length > 0 && !isBackgroundUpdate) {
                    // 중복 제거 및 정렬
        const uniqueNews = removeDuplicateNews(allNews);
        
        // 날짜 정보 검증 및 수정
        const validatedNews = validateAndFixNewsDates(uniqueNews);
        validatedNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        
        // 캐시 저장
        const cacheData = {
            timestamp: Date.now(),
            data: validatedNews
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        
        window.newsItems = validatedNews;
        resetInfiniteScroll();
        displayNews(validatedNews);
            
            // 속보 뉴스 카드 업데이트 (index.html의 카드가 있을 때)
            setTimeout(() => triggerBreakingNewsUpdate(), 500);
        }

        // 2단계: 나머지 피드들 백그라운드에서 로드 (5초 타임아웃)
        const slowPromises = slowFeeds.map(feed => 
            Promise.race([
                fetchAndParseFeed(feed),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 5000)
                )
            ]).catch(error => {
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
            }
        });

        // 최종 결과 처리
        if (allNews.length === 0) {
            throw new Error('뉴스 데이터를 가져올 수 없습니다.');
        }

        // 중복 제거 및 정렬
        const uniqueNews = removeDuplicateNews(allNews);
        
        // 날짜 정보 검증 및 수정
        const validatedNews = validateAndFixNewsDates(uniqueNews);
        validatedNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        
        // 캐시 저장
        const cacheData = {
            timestamp: Date.now(),
            data: validatedNews
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));

        // 백그라운드 업데이트가 아닌 경우에만 UI 업데이트
        if (!isBackgroundUpdate) {
            window.newsItems = validatedNews;
            resetInfiniteScroll();
            displayNews(validatedNews);
            
            // 속보 뉴스 카드 업데이트
            setTimeout(() => triggerBreakingNewsUpdate(), 500);
            

        } else {
            // 백그라운드 업데이트인 경우 새 데이터로 교체
            window.newsItems = validatedNews;
            
            // 백그라운드 업데이트에서도 속보 카드 업데이트
            setTimeout(() => triggerBreakingNewsUpdate(), 500);
        }

    } catch (error) {
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

// 뉴스 날짜 정보 검증 및 수정 함수
function validateAndFixNewsDates(newsArray) {
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // 1년 전
    
    return newsArray.map(item => {
        let fixedItem = { ...item };
        
        try {
            if (item.pubDate) {
                const originalDate = new Date(item.pubDate);
                
                // 잘못된 날짜인지 확인
                if (isNaN(originalDate.getTime())) {
                    fixedItem.pubDate = now.toISOString();
                } else {
                    // 미래 날짜는 그대로 유지 (최신 뉴스로 처리)
                    if (originalDate > now) {
                        // 미래 날짜도 그대로 유지
                    }
                    // 너무 오래된 날짜인지 확인 (1년 이상)
                    else if (originalDate < oneYearAgo) {
                        fixedItem.pubDate = now.toISOString();
                    }
                }
            } else {
                // pubDate가 없는 경우 현재 시간으로 설정
                fixedItem.pubDate = now.toISOString();
            }
        } catch (error) {
            fixedItem.pubDate = now.toISOString();
        }
        
        return fixedItem;
    });
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
                // 최종 실패 시 무시
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
        // 속보 탭에서는 더 많은 뉴스를 표시
        if (currentTab === 'breaking') {
            currentDisplayCount = Math.min(20, news.length); // 속보는 최대 20개 표시
            hasMoreNews = news.length > currentDisplayCount;
        } else {
            currentDisplayCount = Math.min(10, news.length);
            hasMoreNews = news.length > currentDisplayCount;
        }
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
                    <span class="news-time" data-pubdate="${item.pubDate}">
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
    
    // 실시간 시간 업데이트 시작
    if (isInitialLoad) {
        startRealTimeUpdates();
    }
}

// 실시간 시간 업데이트 함수
function startRealTimeUpdates() {
    // 기존 인터벌이 있으면 정리
    if (window.newsTimeUpdateInterval) {
        clearInterval(window.newsTimeUpdateInterval);
    }
    
    // 1분마다 시간 업데이트
    window.newsTimeUpdateInterval = setInterval(() => {
        const timeElements = document.querySelectorAll('.news-time[data-pubdate]');
        timeElements.forEach(element => {
            const pubDate = element.getAttribute('data-pubdate');
            if (pubDate) {
                const newTime = getRelativeTime(pubDate);
                const currentText = element.textContent;
                
                // 시간 부분만 업데이트 (별 아이콘은 유지)
                const starRating = element.querySelector('.news-importance');
                const starHtml = starRating ? starRating.outerHTML : '';
                
                // 시간 부분 추출 (별 아이콘 제외)
                const timeOnly = currentText.replace(starHtml, '').trim();
                if (timeOnly !== newTime) {
                    element.innerHTML = `${newTime} ${starHtml}`;
                }
            }
        });
    }, 60000); // 1분마다
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
    } else if (tabName === 'calendar') {
        // 경제 일정 탭
        
        // 잠시 후 관리자 권한 체크 (DOM 렌더링 완료 후)
        setTimeout(() => {
            checkAdminPermissions();
        }, 100);
        
        loadEconomicCalendar();
    }
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
    
    // 속보 탭인 경우 중요도 4점 이상 필터링 (더 많은 뉴스 표시)
    if (currentTab === 'breaking') {
        filteredNews = window.newsItems.filter(item => {
            const importance = getNewsImportance(item);
            const sourceMatch = source === 'all' || item.source === source;
            return importance >= 4 && sourceMatch;
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
}

// 상대적 시간 표시 함수 (개선된 버전)
function getRelativeTime(dateString) {
    if (!dateString) return '시간 정보 없음';
    
    const now = new Date();
    let date;
    
    try {
        // 다양한 날짜 형식 지원
        if (typeof dateString === 'string') {
            // ISO 형식, RFC 형식 등 다양한 형식 시도
            date = new Date(dateString);
            
            // 잘못된 날짜인지 확인
            if (isNaN(date.getTime())) {
                // 다른 형식으로 시도
                const cleanedString = dateString.replace(/[^\w\s:+-]/g, ' ').trim();
                date = new Date(cleanedString);
                
                if (isNaN(date.getTime())) {
                    return '시간 정보 없음';
                }
            }
        } else if (dateString instanceof Date) {
            date = dateString;
        } else {
            return '시간 정보 없음';
        }
        
        const diffMs = now - date;
        
        // 미래 날짜인지 확인 (최신 뉴스로 처리)
        if (diffMs < 0) {
            // 미래 날짜는 "방금 전"으로 표시 (최신 뉴스)
            return '방금 전';
        }
        
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
        
    } catch (error) {
        return '시간 정보 없음';
    }
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
    // 뉴스 페이지인지 확인
    const newsGrid = document.getElementById('newsGrid');
    if (!newsGrid) {
        return;
    }
    
    try {
        // 캐시에서 먼저 확인
        const cached = localStorage.getItem(IMPORTANCE_CACHE_KEY);
        if (cached) {
            const cacheData = JSON.parse(cached);
            const age = Date.now() - cacheData.timestamp;
            
            if (age < IMPORTANCE_CACHE_DURATION) {
                newsImportanceData = cacheData.data || {};
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
        }
    } catch (error) {
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
        }
    } catch (error) {
        // 저장 실패 시 무시
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
    
    return analysis.score;
}

// 메인페이지용 뉴스 데이터 로드 (속보 카드용)
async function loadNewsForMainPage() {
    const CACHE_KEY = 'newsFeedsCache';
    const CACHE_DURATION_MS = 3 * 60 * 1000; // 3분 캐시

    try {
        // 1. 캐시 확인
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const cacheData = JSON.parse(cached);
            const age = Date.now() - cacheData.timestamp;
            
            if (cacheData.data && cacheData.data.length > 0) {
                window.newsItems = cacheData.data;
                
                // 속보뉴스 카드 업데이트
                setTimeout(() => {
                    if (typeof window.updateBreakingNewsCard === 'function') {
                        window.updateBreakingNewsCard();
                    }
                }, 100);
                
                // 캐시가 만료되었으면 백그라운드에서 새 데이터 가져오기
                if (age >= CACHE_DURATION_MS) {
                    setTimeout(() => loadFreshNewsForMainPage(), 100);
                }
                return;
            }
        }
    } catch (e) {
        // 캐시 읽기 실패 시 무시
    }
    
    // 캐시가 없으면 새 데이터 로드
    await loadFreshNewsForMainPage();
}

// 메인페이지용 새 뉴스 데이터 로드
async function loadFreshNewsForMainPage() {
    const CACHE_KEY = 'newsFeedsCache';
    
    try {
        const feeds = [
            // 빠른 로딩을 위한 주요 피드들만 사용
            { url: 'https://kr.cointelegraph.com/rss', source: 'cointelegraph' },
            { url: 'https://www.tokenpost.kr/rss', source: 'tokenpost' },
            { url: 'https://www.blockmedia.co.kr/feed', source: 'blockmedia' },
            { url: 'https://bloomingbit.io/rss.xml', source: 'bloomingbit' }
        ];

        // 빠른 피드들 로드 (5초 타임아웃)
        const fastPromises = feeds.map(feed => 
            Promise.race([
                fetchAndParseFeed(feed),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 5000)
                )
            ]).catch(error => {
                return [];
            })
        );

        const fastResults = await Promise.all(fastPromises);
        
        let allNews = [];
        let successCount = 0;
        
        // 결과 처리
        fastResults.forEach((result, index) => {
            const feedName = feeds[index].source;
            if (result && result.length > 0) {
                allNews.push(...result);
                successCount++;
            }
        });

        if (allNews.length > 0) {
            // 중복 제거 및 정렬
            const uniqueNews = removeDuplicateNews(allNews);
            
            // 날짜 정보 검증 및 수정
            const validatedNews = validateAndFixNewsDates(uniqueNews);
            validatedNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            
            // 캐시 저장
            const cacheData = {
                timestamp: Date.now(),
                data: validatedNews
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
            
            window.newsItems = validatedNews;
            
            // 속보뉴스 카드 업데이트
            setTimeout(() => {
                if (typeof window.updateBreakingNewsCard === 'function') {
                    window.updateBreakingNewsCard();
                }
            }, 100);
        } else {
            // 뉴스 데이터를 가져올 수 없음
        }
    } catch (error) {
        // 뉴스 로딩 실패 시 무시
    }
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



// ===== 경제 일정 기능 =====

// 경제 일정 초기화
function initializeEconomicCalendar() {
    // 카테고리 필터 이벤트 설정
    setupCalendarFilters();
    
    // 관리자 이벤트 설정
    setupAdminEvents();
    
    // Firebase 인증 상태 감지
    setupAuthStateListener();
    
    // 초기 권한 체크
    setTimeout(() => {
        checkAdminPermissions();
    }, 1000);
}



// 경제 일정 카테고리 필터 설정
function setupCalendarFilters() {
    const calendarFilters = document.querySelectorAll('#calendarTab .filter-btn');
    
    calendarFilters.forEach(filter => {
        filter.addEventListener('click', (e) => {
            // 모든 필터 비활성화
            calendarFilters.forEach(f => f.classList.remove('active'));
            
            // 클릭된 필터 활성화
            e.target.classList.add('active');
            
            // 카테고리별 필터링
            const category = e.target.getAttribute('data-category');
            filterCalendarEvents(category);
        });
    });
}

// 경제 일정 로드
function loadEconomicCalendar() {
    const calendarList = document.getElementById('calendarList');
    if (!calendarList) return;
    
    // 로딩 표시
    calendarList.innerHTML = '<div class="loading">경제 일정을 불러오는 중...</div>';
    
    // Firebase에서 경제 일정 데이터 로드
    loadCalendarEventsFromFirebase();
}

// Firebase에서 경제 일정 데이터 로드
function loadCalendarEventsFromFirebase() {
    if (!window.firebase || !window.firebase.firestore) {
        console.error('Firebase가 초기화되지 않았습니다.');
        const calendarList = document.getElementById('calendarList');
        if (calendarList) {
            calendarList.innerHTML = '<div class="loading">Firebase 연결 중...</div>';
        }
        return;
    }
    
    const db = window.firebase.firestore();
    
    // 오늘 날짜 기준으로 필터링 (Firebase 쿼리에서 미리 필터링)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    db.collection('calendarEvents')
        .where('date', '>=', today.toISOString().split('T')[0]) // YYYY-MM-DD 형식으로 변환
        .orderBy('date', 'asc')
        .get()
        .then((querySnapshot) => {
            const events = [];
            querySnapshot.forEach((doc) => {
                events.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            renderCalendarEvents(events);
        })
        .catch((error) => {
            const calendarList = document.getElementById('calendarList');
            if (calendarList) {
                calendarList.innerHTML = '<div class="loading">경제 일정을 불러올 수 없습니다.</div>';
            }
        });
}

// 경제 일정 이벤트 렌더링
function renderCalendarEvents(events) {
    const calendarList = document.getElementById('calendarList');
    if (!calendarList) return;
    
    if (!events || events.length === 0) {
        calendarList.innerHTML = '<div class="loading">등록된 경제 일정이 없습니다.</div>';
        return;
    }
    
    // 오늘 날짜 기준으로 지난 일정 필터링
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 시간을 00:00:00으로 설정
    
    const futureEvents = events.filter(event => {
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0); // 시간을 00:00:00으로 설정
        return eventDate >= today; // 오늘 날짜 이상인 일정만 포함
    });
    
    if (futureEvents.length === 0) {
        calendarList.innerHTML = '<div class="loading">예정된 경제 일정이 없습니다.</div>';
        return;
    }
    
    // 날짜별로 그룹화하고 월별로 정렬
    const groupedEvents = groupEventsByMonth(futureEvents);
    
    let eventsHTML = '';
    Object.keys(groupedEvents).sort().forEach(monthKey => {
        const monthEvents = groupedEvents[monthKey];
        const [year, month] = monthKey.split('-');
        
        // 월 구분선 추가
        eventsHTML += `
            <div class="calendar-month-separator">
                <img src="/assets/icon/Date_range_duotone.svg" alt="달력 아이콘" class="calendar-icon">
                <span>${year}년${month}월</span>
            </div>
        `;
        
        // 해당 월의 이벤트들 추가
        monthEvents.forEach(event => {
            eventsHTML += createCalendarEventHTML(event);
        });
    });
    
    calendarList.innerHTML = eventsHTML;
}

// 이벤트를 월별로 그룹화하는 함수
function groupEventsByMonth(events) {
    const grouped = {};
    
    events.forEach(event => {
        const date = new Date(event.date);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
        
        if (!grouped[monthKey]) {
            grouped[monthKey] = [];
        }
        grouped[monthKey].push(event);
    });
    
    // 각 월 내에서 날짜순으로 정렬
    Object.keys(grouped).forEach(monthKey => {
        grouped[monthKey].sort((a, b) => new Date(a.date) - new Date(b.date));
    });
    
    return grouped;
}

// 경제 일정 이벤트 HTML 생성
function createCalendarEventHTML(event) {
    const date = new Date(event.date);
    const day = date.getDate();
    const weekday = getWeekdayFromDate(event.date);
    
    // 날짜별 보더 클래스 결정
    const today = new Date();
    const eventDate = new Date(event.date);
    const diffTime = eventDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let borderClass = '';
    if (diffDays === 0) {
        borderClass = 'today-border'; // 오늘
    } else if (diffDays === 1) {
        borderClass = 'tomorrow-border'; // D-1 (내일)
    }
    
    // 카테고리 이름 매핑
    const categoryNames = {
        'major-issue': '주요이슈',
        'exchange': '거래소'
    };
    
    // 관리자인 경우 수정/삭제 버튼 추가
    const isAdmin = checkIfUserIsAdmin();
    const adminButtons = isAdmin ? `
        <div class="calendar-item-actions">
            <button class="admin-btn edit-btn" onclick="editCalendarEvent('${event.id}')">
                <i class="fas fa-edit"></i>
            </button>
            <button class="admin-btn delete-btn" onclick="deleteCalendarEvent('${event.id}')">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    ` : '';
    
    return `
        <div class="calendar-item ${borderClass}" data-category="${event.category}" data-event-id="${event.id}">
            <div class="calendar-date">
                <div class="calendar-day">${day}</div>
                <div class="calendar-weekday">${weekday}</div>
            </div>
            <div class="calendar-event">
                <h3 class="calendar-title">${event.title}</h3>
                <div class="calendar-meta">
                    <span class="calendar-category ${event.category}">${categoryNames[event.category] || event.category}</span>
                </div>
            </div>
            ${adminButtons}
        </div>
    `;
}

// 경제 일정 필터링
function filterCalendarEvents(category) {
    const calendarItems = document.querySelectorAll('.calendar-item');
    
    calendarItems.forEach(item => {
        const itemCategory = item.getAttribute('data-category');
        
        if (category === 'all' || itemCategory === category) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// ===== 관리자 기능 =====

// 관리자 권한 체크
function checkIfUserIsAdmin() {
    // 하드코딩된 관리자 이메일 목록
    const adminEmails = [
        'admin@site.com',
        'admin@felicity-site.com'
    ];
    
    // 여러 방법으로 현재 사용자 확인
    let currentUser = null;
    let userEmail = null;
    
    // 방법 1: window.firebase.auth().currentUser
    if (window.firebase?.auth) {
        try {
            currentUser = window.firebase.auth().currentUser;
            userEmail = currentUser?.email;
        } catch (e) {
            console.log('방법 1 실패:', e.message);
        }
    }
    
    // 방법 2: window.currentUser (auth.js에서 설정)
    if (!currentUser && window.currentUser) {
        currentUser = window.currentUser;
        userEmail = window.currentUser.email;
        console.log('방법 2로 사용자 확인:', userEmail);
    }
    
    console.log('🔍 관리자 권한 체크:', {
        isLoggedIn: !!currentUser,
        userEmail: userEmail || 'None',
        adminEmails: adminEmails,
        isAdmin: userEmail ? adminEmails.includes(userEmail) : false,
        windowCurrentUser: !!window.currentUser,
        firebaseAuth: !!window.firebase?.auth
    });
    
    if (!currentUser || !userEmail) {
        console.log('❌ 로그인되지 않음');
        return false;
    }
    
    const isAdmin = adminEmails.includes(userEmail);
    console.log(isAdmin ? '✅ 관리자 권한 확인됨' : '❌ 관리자 권한 없음');
    return isAdmin;
}

// 관리자 권한 체크 및 UI 표시
function checkAdminPermissions() {
    const adminControls = document.getElementById('calendar-admin-controls');
    console.log('🔍 관리자 UI 요소 확인:', !!adminControls);
    
    if (!adminControls) {
        console.log('❌ calendar-admin-controls 요소를 찾을 수 없음');
        return;
    }
    
    const isAdmin = checkIfUserIsAdmin();
    console.log('🔍 관리자 여부:', isAdmin);
    
    if (isAdmin) {
        adminControls.style.display = 'flex';
        adminControls.style.visibility = 'visible';
        console.log('👑 관리자 권한 확인됨 - 경제 일정 관리 기능 활성화');
        console.log('📍 관리자 UI 표시됨:', adminControls.style.display);
    } else {
        adminControls.style.display = 'none';
        console.log('🚫 관리자 권한 없음 - 관리 기능 비활성화');
    }
}

// Firebase 인증 상태 리스너 설정
function setupAuthStateListener() {
    // 방법 1: Firebase Auth 리스너
    if (window.firebase?.auth) {
        try {
            window.firebase.auth().onAuthStateChanged((user) => {
                console.log('🔄 Firebase 인증 상태 변경됨:', {
                    isLoggedIn: !!user,
                    email: user?.email || 'None'
                });
                
                // 인증 상태 변경 시 관리자 권한 재체크
                setTimeout(() => {
                    checkAdminPermissions();
                    
                    // 일정 목록이 이미 로드된 경우 새로고침하여 관리 버튼 표시/숨김
                    const calendarList = document.getElementById('calendarList');
                    if (calendarList && calendarList.children.length > 0) {
                        loadEconomicCalendar();
                    }
                }, 500);
            });
        } catch (e) {
            console.log('Firebase Auth 리스너 설정 실패:', e.message);
        }
    }
    
    // 방법 2: window.currentUser 변경 감지 (폴백)
    let lastUserEmail = null;
    const checkUserChange = () => {
        const currentUserEmail = window.currentUser?.email;
        if (currentUserEmail !== lastUserEmail) {
            console.log('🔄 window.currentUser 변경 감지:', {
                before: lastUserEmail,
                after: currentUserEmail
            });
            lastUserEmail = currentUserEmail;
            
            setTimeout(() => {
                checkAdminPermissions();
            }, 200);
        }
    };
    
    // 1초마다 사용자 변경 체크
    setInterval(checkUserChange, 1000);
}

// 관리자 이벤트 설정
function setupAdminEvents() {
    // 일정 추가 버튼
    const addEventBtn = document.getElementById('add-calendar-event');
    if (addEventBtn) {
        addEventBtn.addEventListener('click', openAddEventModal);
    }
    
    // 모달 닫기 버튼들
    const closeModalBtn = document.getElementById('close-calendar-modal');
    const cancelBtn = document.getElementById('cancel-calendar-event');
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeCalendarModal);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeCalendarModal);
    }
    
    // 폼 제출
    const eventForm = document.getElementById('calendar-event-form');
    if (eventForm) {
        eventForm.addEventListener('submit', handleEventFormSubmit);
    }
    
    // 모달 외부 클릭 시 닫기
    const modal = document.getElementById('calendar-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeCalendarModal();
            }
        });
    }
}

// 날짜에서 요일 구하기
function getWeekdayFromDate(dateString) {
    const weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const date = new Date(dateString);
    return weekdays[date.getDay()];
}

// 일정 추가 모달 열기
function openAddEventModal() {
    const modal = document.getElementById('calendar-modal');
    const modalTitle = document.getElementById('calendar-modal-title');
    const form = document.getElementById('calendar-event-form');
    
    if (modal && modalTitle && form) {
        modalTitle.innerHTML = '<i class="fas fa-calendar-plus"></i> 경제 일정 등록';
        form.reset();
        form.removeAttribute('data-event-id');
        modal.classList.add('show');
    }
}

// 일정 수정 모달 열기
function editCalendarEvent(eventId) {
    if (!checkIfUserIsAdmin()) {
        alert('관리자만 수정할 수 있습니다.');
        return;
    }
    
    const modal = document.getElementById('calendar-modal');
    const modalTitle = document.getElementById('calendar-modal-title');
    const form = document.getElementById('calendar-event-form');
    
    if (!modal || !modalTitle || !form) return;
    
    // Firebase에서 이벤트 데이터 로드
    const db = window.firebase.firestore();
    db.collection('calendarEvents').doc(eventId).get()
        .then((doc) => {
            if (doc.exists) {
                const eventData = doc.data();
                
                // 폼에 데이터 채우기
                document.getElementById('event-title').value = eventData.title || '';
                document.getElementById('event-date').value = eventData.date || '';
                document.getElementById('event-time').value = eventData.time || '';
                document.getElementById('event-category').value = eventData.category || '';
                document.getElementById('event-importance').value = eventData.importance || '';
                document.getElementById('event-impact').value = eventData.impact || '';
                document.getElementById('event-description').value = eventData.description || '';
                
                // 수정 모드로 설정
                modalTitle.innerHTML = '<i class="fas fa-calendar-edit"></i> 경제 일정 수정';
                form.setAttribute('data-event-id', eventId);
                modal.classList.add('show');
            }
        })
        .catch((error) => {
            console.error('이벤트 데이터 로드 실패:', error);
            alert('이벤트 데이터를 불러올 수 없습니다.');
        });
}

// 일정 삭제
function deleteCalendarEvent(eventId) {
    if (!checkIfUserIsAdmin()) {
        alert('관리자만 삭제할 수 있습니다.');
        return;
    }
    
    if (!confirm('정말 이 일정을 삭제하시겠습니까?')) {
        return;
    }
    
    const db = window.firebase.firestore();
    db.collection('calendarEvents').doc(eventId).delete()
        .then(() => {
            console.log('✅ 경제 일정 삭제 완료:', eventId);
            loadEconomicCalendar(); // 목록 새로고침
        })
        .catch((error) => {
            console.error('❌ 경제 일정 삭제 실패:', error);
            alert('일정 삭제에 실패했습니다.');
        });
}

// 모달 닫기
function closeCalendarModal() {
    const modal = document.getElementById('calendar-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// 폼 제출 처리
function handleEventFormSubmit(e) {
    e.preventDefault();
    
    if (!checkIfUserIsAdmin()) {
        alert('관리자만 등록/수정할 수 있습니다.');
        return;
    }
    
    const form = e.target;
    const eventId = form.getAttribute('data-event-id');
    const isEdit = !!eventId;
    
    // 폼 데이터 수집
    const eventData = {
        title: document.getElementById('event-title').value.trim(),
        date: document.getElementById('event-date').value,
        time: document.getElementById('event-time').value,
        category: document.getElementById('event-category').value,
        importance: parseInt(document.getElementById('event-importance').value),
        impact: document.getElementById('event-impact').value,
        description: document.getElementById('event-description').value.trim(),
        updatedAt: new Date().toISOString()
    };
    
    // 필수 필드 검증
    if (!eventData.title || !eventData.date || !eventData.category || !eventData.importance || !eventData.impact) {
        alert('필수 항목을 모두 입력해주세요.');
        return;
    }
    
    // 생성일 추가 (새 이벤트인 경우)
    if (!isEdit) {
        eventData.createdAt = new Date().toISOString();
    }
    
    const db = window.firebase.firestore();
    
    if (isEdit) {
        // 수정
        db.collection('calendarEvents').doc(eventId).update(eventData)
            .then(() => {
                console.log('✅ 경제 일정 수정 완료:', eventId);
                closeCalendarModal();
                loadEconomicCalendar(); // 목록 새로고침
            })
            .catch((error) => {
                console.error('❌ 경제 일정 수정 실패:', error);
                alert('일정 수정에 실패했습니다.');
            });
    } else {
        // 새 등록
        db.collection('calendarEvents').add(eventData)
            .then((docRef) => {
                console.log('✅ 경제 일정 등록 완료:', docRef.id);
                closeCalendarModal();
                loadEconomicCalendar(); // 목록 새로고침
            })
            .catch((error) => {
                console.error('❌ 경제 일정 등록 실패:', error);
                alert('일정 등록에 실패했습니다.');
            });
    }
}

// 전역 함수로 등록 (HTML에서 호출 가능하도록)
window.editCalendarEvent = editCalendarEvent;
window.deleteCalendarEvent = deleteCalendarEvent;

// 디버깅용 전역 함수들
window.debugCalendarAdmin = function() {
    console.log('=== 경제 일정 관리자 디버깅 ===');
    console.log('1. Firebase 상태:', !!window.firebase);
    console.log('2. Firebase Auth:', !!window.firebase?.auth);
    console.log('3. Firebase currentUser:', window.firebase?.auth?.()?.currentUser);
    console.log('4. window.currentUser:', window.currentUser);
    console.log('5. 사용자 이메일 (Firebase):', window.firebase?.auth?.()?.currentUser?.email);
    console.log('6. 사용자 이메일 (window):', window.currentUser?.email);
    console.log('7. 관리자 여부:', checkIfUserIsAdmin());
    
    const adminControls = document.getElementById('calendar-admin-controls');
    console.log('8. 관리자 UI 요소:', !!adminControls);
    console.log('9. 관리자 UI 스타일:', adminControls?.style.display);
    console.log('10. 현재 탭:', document.querySelector('.tab-btn.active')?.getAttribute('data-tab'));
    
    // 강제로 관리자 권한 체크
    checkAdminPermissions();
    
    // 강제로 관리자 UI 표시 (테스트용)
    if (adminControls) {
        adminControls.style.display = 'flex';
        console.log('🔧 관리자 UI 강제 표시됨');
    }
};

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
    if (window.newsTimeUpdateInterval) {
        clearInterval(window.newsTimeUpdateInterval);
        window.newsTimeUpdateInterval = null;
    }
});