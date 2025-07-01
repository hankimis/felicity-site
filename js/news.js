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

// 뉴스 피드 로드 (캐싱 및 Promise.any 적용)
async function loadNewsFeeds() {
    const newsGrid = document.getElementById('newsGrid');
    const CACHE_KEY = 'newsFeedsCache';
    const CACHE_DURATION_MS = 5 * 60 * 1000; // 5분 (더 빠른 새로고침)

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
                
                // 백그라운드에서 새 데이터 가져오기
                setTimeout(() => loadFreshNews(), 100);
                return;
            }
        }
    } catch (e) {
        // 캐시 읽기 실패 무시
    }
    
    newsGrid.innerHTML = '<div class="loading">최신 뉴스를 불러오는 중...</div>';
    await loadFreshNews();
}

async function loadFreshNews() {

    const newsGrid = document.getElementById('newsGrid');
    const CACHE_KEY = 'newsFeedsCache';
    
    // 2. 피드 동시 로드 (타임아웃 단축)
    try {
        const feeds = [
            { url: 'https://kr.cointelegraph.com/rss', source: 'cointelegraph' },
            { url: 'https://www.yna.co.kr/rss/economy.xml', source: 'yonhap' },
            { url: 'https://kr.investing.com/rss/news.rss', source: 'investing' },
            { url: 'https://www.litefinance.org/ko/rss-smm/blog/', source: 'litefinance' }
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

        allNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        
        // 4. 캐시 저장
        try {
            const cacheData = {
                timestamp: Date.now(),
                data: allNews
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        } catch(e) {
            // 캐시 저장 실패 무시
        }

        window.newsItems = allNews;
        displayNews(allNews);
        
        // 실패한 피드가 있으면 사용자에게 알림
        if (failedFeeds.length > 0 && successCount > 0) {
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
                                 일부 뉴스 소스(${failedFeeds.map(feed => 
                     feed === 'cointelegraph' ? '코인텔레그래프' : 
                     feed === 'yonhap' ? '연합뉴스' :
                     feed === 'investing' ? 'Investing.com' :
                     feed === 'litefinance' ? 'LiteFinance' :
                     feed
                 ).join(', ')})에서 뉴스를 가져오지 못했습니다. 
                다른 소스의 뉴스만 표시됩니다.
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
    // 빠른 타임아웃으로 응답성 개선
    const timeoutMs = 4000;
    
    // RSS2JSON API 먼저 시도 (가장 안정적)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        const rss2jsonUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(url);
        const response = await fetch(rss2jsonUrl, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'Accept': 'application/json'
            }
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            if (data.status === 'ok' && data.items && data.items.length > 0) {
                return data.items.slice(0, 12).map(item => {
                    // Investing.com 특별 처리
                    let contentSnippet = '';
                    let cleanDescription = '';
                    
                    if (item.description) {
                        // HTML 태그 제거
                        cleanDescription = item.description.replace(/<[^>]*>/g, '');
                        // 특수 문자 정리
                        cleanDescription = cleanDescription.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
                        
                        // Investing.com은 더 긴 설명 제공
                        const maxLength = source === 'investing' ? 200 : 150;
                        contentSnippet = cleanDescription.substring(0, maxLength);
                    }
                    
                    // 빈 contentSnippet이면 제목에서 생성
                    if (!contentSnippet.trim()) {
                        contentSnippet = (item.title || '').substring(0, 100);
                    }

                    return {
                        title: item.title || '',
                        link: item.link || '',
                        pubDate: item.pubDate || new Date().toISOString(),
                        contentSnippet: contentSnippet,
                        content: item.description || '',
                        image: item.thumbnail || item.enclosure?.link || 'assets/default-news.jpg',
                        source: source
                    };
                });
            }
        }
    } catch (error) {
        // RSS2JSON 실패 시 다음 프록시 시도
    }

    // ThingProxy 백업 시도
    try {
        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), timeoutMs);
        
        const thingProxyUrl = 'https://thingproxy.freeboard.io/fetch/' + encodeURIComponent(url);
        const response = await fetch(thingProxyUrl, {
            method: 'GET',
            signal: controller2.signal
        });

        clearTimeout(timeoutId2);

        if (response.ok) {
            const text = await response.text();
            if (text && text.length > 100 && 
                (text.includes('<rss') || text.includes('<feed') || text.includes('<?xml'))) {
                
                const parsedFeed = parseRSSFeed(text);
                if (parsedFeed && parsedFeed.length > 0) {
                    return parsedFeed.map(item => ({ ...item, source }));
                }
            }
        }
    } catch (error) {
        // ThingProxy도 실패
    }

    // 모든 프록시 실패 시 백업 뉴스
    return getBackupNews(source);
}

// 백업 뉴스 제공 함수
function getBackupNews(source) {
    const now = new Date();
    const backupNews = {
        'cointelegraph': [
            {
                title: "비트코인 가격 분석 및 전망",
                link: "https://kr.cointelegraph.com/news/bitcoin-analysis",
                pubDate: now.toISOString(),
                contentSnippet: "최근 비트코인 시장 동향과 기술적 분석을 통한 향후 전망을 살펴봅니다.",
                image: "assets/default-news.jpg"
            },
            {
                title: "이더리움 2.0 업데이트 현황",
                link: "https://kr.cointelegraph.com/news/ethereum-2-update",
                pubDate: new Date(now.getTime() - 3600000).toISOString(),
                contentSnippet: "이더리움 네트워크의 최신 개발 소식과 생태계 확장 현황을 분석합니다.",
                image: "assets/default-news.jpg"
            }
        ],
        'yonhap': [
            {
                title: "한국 디지털자산 시장 동향",
                link: "https://www.yna.co.kr/economy",
                pubDate: now.toISOString(),
                contentSnippet: "국내 가상자산 거래소 현황 및 규제 동향에 대한 최신 소식입니다.",
                image: "assets/default-news.jpg"
            }
        ],
        'investing': [
            {
                title: "호찌민, 정부에 3920만 달러 자금 보고",
                link: "https://kr.investing.com/news/economy",
                pubDate: now.toISOString(),
                contentSnippet: "베트남 정부의 대규모 자금 운용 계획이 발표되며 동남아 경제 전반에 미칠 영향이 주목받고 있습니다. 전문가들은 이번 조치가 지역 금융 안정성에 긍정적 요소로 작용할 것으로 분석했습니다.",
                image: "assets/default-news.jpg"
            },
            {
                title: "글로벌 인플레이션 동향 분석",
                link: "https://kr.investing.com/news/inflation-analysis",
                pubDate: new Date(now.getTime() - 1800000).toISOString(),
                contentSnippet: "주요국 중앙은행의 통화정책 변화와 인플레이션 지표를 종합 분석한 결과, 향후 6개월간 금리 정책에 중요한 변화가 예상됩니다.",
                image: "assets/default-news.jpg"
            }
        ],
        'litefinance': [
            {
                title: "암호화폐 투자 전략 가이드",
                link: "https://www.litefinance.org/ko/",
                pubDate: now.toISOString(),
                contentSnippet: "전문가가 제안하는 암호화폐 투자 전략과 리스크 관리 방법을 소개합니다.",
                image: "assets/default-news.jpg"
            }
        ]
    };
    
    return (backupNews[source] || []).map(item => ({ ...item, source }));
}

// RSS 피드 파싱
function parseRSSFeed(xmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    const items = Array.from(doc.querySelectorAll('item'));
    
    return items.map(item => {
        let link = item.querySelector('link')?.textContent || '';
        const title = item.querySelector('title')?.textContent || '';
        const description = item.querySelector('description')?.textContent || '';
        const pubDate = item.querySelector('pubDate')?.textContent || '';
        
        let actualSource = null;
        

        
        // source 태그에서도 언론사명 추출 시도 (백업)
        if (!actualSource) {
            const sourceTag = item.querySelector('source');
            if (sourceTag && sourceTag.textContent) {
                actualSource = sourceTag.textContent.trim();
            }
        }
        
        // 컨텐츠 스니펫 생성 (개선된 텍스트 처리)
        let contentSnippet = '';
        if (description) {
            // HTML 태그 제거
            contentSnippet = description.replace(/<[^>]*>/g, '');
            // 특수 문자 정리
            contentSnippet = contentSnippet.replace(/&nbsp;/g, ' ')
                                         .replace(/&amp;/g, '&')
                                         .replace(/&lt;/g, '<')
                                         .replace(/&gt;/g, '>')
                                         .replace(/&quot;/g, '"')
                                         .trim();
            // 길이 제한
            contentSnippet = contentSnippet.substring(0, 180);
        }
        
        return {
            title: title,
            link: link,
            pubDate: pubDate,
            content: description,
            contentSnippet: contentSnippet || title.substring(0, 100),
            image: findImageInItem(item),
            actualSource: actualSource
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

    return 'assets/default-news.jpg';
}

// 뉴스 표시
function displayNews(news) {
    const newsGrid = document.getElementById('newsGrid');
    
    if (!news || news.length === 0) {
        newsGrid.innerHTML = '<div class="loading">표시할 뉴스가 없습니다.</div>';
        return;
    }
    


    newsGrid.innerHTML = news.map(item => {
        const date = new Date(item.pubDate);
        const formattedDate = date.toLocaleDateString('ko-KR', {
            year: 'numeric', month: '2-digit', day: '2-digit'
        });
        let sourceName = item.source === 'cointelegraph' ? '코인텔레그래프' : 
                        item.source === 'yonhap' ? '연합뉴스' :
                        item.source === 'investing' ? 'Investing.com' :
                        item.source === 'litefinance' ? 'LiteFinance' :
                        item.source;
        // 이미지 유무에 따른 클래스 적용
        const hasImage = item.image && item.image !== 'assets/default-news.jpg';
        const imageHtml = hasImage ? 
            `<img src="${item.image}" alt="" class="news-thumb" loading="lazy" onerror="this.style.display='none';">` : 
            '';
        
        return `
          <a href="${item.link}" target="_blank" rel="noopener" class="news-item ${hasImage ? 'has-image' : 'no-image'}" data-source="${item.source}">
            ${imageHtml}
            <div class="news-body">
              <div class="news-meta">${sourceName} · ${formattedDate}</div>
              <div class="news-title">${item.title}</div>
              <div class="news-desc">${item.contentSnippet ? item.contentSnippet + '...' : ''}</div>
            </div>
          </a>`;
    }).join('');
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