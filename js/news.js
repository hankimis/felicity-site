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
    const CACHE_DURATION_MS = 10 * 60 * 1000; // 10분

    // 1. 캐시 확인
    try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
            console.log('캐시에서 뉴스 로드');
            window.newsItems = cached.data;
            displayNews(cached.data);
            return;
        }
    } catch (e) {
        console.error("캐시 로드 실패:", e);
    }
    
    newsGrid.innerHTML = '<div class="loading">최신 뉴스를 불러오는 중...</div>';

    // 2. 피드 동시 로드
    try {
        const feeds = [
            { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'coindesk' },
            { url: 'https://cointelegraph.com/rss', source: 'cointelegraph' }
        ];

        const feedPromises = feeds.map(feed => fetchAndParseFeed(feed));
        const results = await Promise.allSettled(feedPromises);

        let allNews = [];
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value.length > 0) {
                allNews.push(...result.value);
            }
        });

        if (allNews.length === 0) {
            throw new Error('모든 뉴스 피드를 가져오는데 실패했습니다.');
        }

        allNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        
        // 3. 캐시 저장
        try {
            const cacheData = {
                timestamp: Date.now(),
                data: allNews
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        } catch(e) {
            console.error("캐시 저장 실패:", e);
        }

        window.newsItems = allNews;
        displayNews(allNews);

    } catch (error) {
        console.error('Error fetching news:', error);
        newsGrid.innerHTML = `
            <div class="loading">
                뉴스를 불러오는데 실패했습니다.<br>
                <small>${error.message}</small>
            </div>
        `;
    }
}

async function fetchAndParseFeed({ url, source }) {
    const proxies = [
        'https://api.allorigins.win/raw?url=',
        'https://cors-anywhere.herokuapp.com/',
        'https://thingproxy.freeboard.io/fetch/'
    ];

    const fetchPromises = proxies.map(proxy => 
        fetch(proxy + encodeURIComponent(url), { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
            .then(response => {
                if (!response.ok) throw new Error(`Proxy ${proxy} failed for ${url} with status ${response.status}`);
                return response.text();
            })
    );

    try {
        const xmlString = await Promise.any(fetchPromises);
        const parsedFeed = parseRSSFeed(xmlString);
        return parsedFeed.map(item => ({ ...item, source }));
    } catch (error) {
        console.error(`모든 프록시에서 ${source} 피드 가져오기 실패.`, error);
        return []; // 개별 피드 실패 시 빈 배열 반환
    }
}

// RSS 피드 파싱
function parseRSSFeed(xmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    const items = Array.from(doc.querySelectorAll('item'));
    
    return items.map(item => ({
        title: item.querySelector('title')?.textContent || '',
        link: item.querySelector('link')?.textContent || '',
        pubDate: item.querySelector('pubDate')?.textContent || '',
        content: item.querySelector('description')?.textContent || '',
        contentSnippet: item.querySelector('description')?.textContent?.replace(/<[^>]+>/g, '').substring(0, 150) || '',
        image: findImageInItem(item)
    }));
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
        const sourceName = item.source === 'coindesk' ? 'CoinDesk' : 'Cointelegraph';
        return `
          <a href="${item.link}" target="_blank" rel="noopener" class="news-item" data-source="${item.source}">
            <img src="${item.image}" alt="" class="news-thumb" loading="lazy" onerror="this.src='assets/default-news.jpg';this.onerror=null;">
            <div class="news-body">
              <div class="news-meta"><img src="assets/${item.source==='coindesk'?'coindesk.jpg':'cointele.jpg'}" alt="logo" class="news-logo"> ${sourceName} · ${formattedDate}</div>
              <div class="news-title">${item.title}</div>
              <div class="news-desc">${item.contentSnippet}...</div>
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