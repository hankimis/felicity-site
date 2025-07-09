// 🔥 Firebase 인덱스 설정 스크립트
// 이 스크립트는 Firebase Console에서 수동으로 인덱스를 생성하는 대신 사용할 수 있습니다.

const firebaseIndexes = {
    // chartLayouts 컬렉션에 필요한 인덱스들
    chartLayouts: [
        {
            // userId + timestamp 복합 인덱스 (차트 목록 조회용)
            fields: [
                { fieldPath: 'userId', order: 'ASCENDING' },
                { fieldPath: 'timestamp', order: 'DESCENDING' }
            ],
            queryScope: 'COLLECTION'
        },
        {
            // userId + symbol 복합 인덱스 (심볼별 차트 조회용)
            fields: [
                { fieldPath: 'userId', order: 'ASCENDING' },
                { fieldPath: 'symbol', order: 'ASCENDING' }
            ],
            queryScope: 'COLLECTION'
        },
        {
            // userId + hasDrawings 복합 인덱스 (그림 포함 차트 조회용)
            fields: [
                { fieldPath: 'userId', order: 'ASCENDING' },
                { fieldPath: 'hasDrawings', order: 'ASCENDING' }
            ],
            queryScope: 'COLLECTION'
        },
        {
            // userId + hasStudies 복합 인덱스 (지표 포함 차트 조회용)
            fields: [
                { fieldPath: 'userId', order: 'ASCENDING' },
                { fieldPath: 'hasStudies', order: 'ASCENDING' }
            ],
            queryScope: 'COLLECTION'
        }
    ],

    // chartStates 컬렉션에 필요한 인덱스들
    chartStates: [
        {
            // userId + timestamp 복합 인덱스 (자동 저장 상태 조회용)
            fields: [
                { fieldPath: 'userId', order: 'ASCENDING' },
                { fieldPath: 'timestamp', order: 'DESCENDING' }
            ],
            queryScope: 'COLLECTION'
        }
    ],

    // chartDrawings 컬렉션에 필요한 인덱스들
    chartDrawings: [
        {
            // userId + symbol 복합 인덱스 (심볼별 그림 조회용)
            fields: [
                { fieldPath: 'userId', order: 'ASCENDING' },
                { fieldPath: 'symbol', order: 'ASCENDING' }
            ],
            queryScope: 'COLLECTION'
        }
    ],

    // studyTemplates 컬렉션에 필요한 인덱스들
    studyTemplates: [
        {
            // userId + timestamp 복합 인덱스 (템플릿 목록 조회용)
            fields: [
                { fieldPath: 'userId', order: 'ASCENDING' },
                { fieldPath: 'timestamp', order: 'DESCENDING' }
            ],
            queryScope: 'COLLECTION'
        },
        {
            // userId + name 복합 인덱스 (템플릿 이름 검색용)
            fields: [
                { fieldPath: 'userId', order: 'ASCENDING' },
                { fieldPath: 'name', order: 'ASCENDING' }
            ],
            queryScope: 'COLLECTION'
        }
    ]
};

// 🔥 Firebase Console에서 인덱스 생성 URL 생성
function generateFirebaseIndexUrls() {
    const projectId = 'livechattest-35101'; // 프로젝트 ID
    const baseUrl = `https://console.firebase.google.com/v1/r/project/${projectId}/firestore/indexes`;
    
    const urls = [];
    
    // chartLayouts userId + timestamp 인덱스
    urls.push(`${baseUrl}?create_composite=CldwcmRqZWN0cy9saXZlY2hhdHRlc3QtMzUxMDEvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL2NoYXJ0TGF5b3V0cy9pbmRleGVzL18QARoKCgZ1c2VySWQQARoNCgl0aW1lc3RhbXAQAg`);
    
    console.log('🔥 Firebase 인덱스 생성 URL:');
    urls.forEach((url, index) => {
        console.log(`${index + 1}. ${url}`);
    });
    
    return urls;
}

// 🔥 인덱스 생성 안내 메시지
function showIndexCreationGuide() {
    console.log(`
🔥 Firebase 인덱스 생성 가이드

1. 아래 URL을 클릭하여 Firebase Console에서 인덱스를 생성하세요:
   https://console.firebase.google.com/v1/r/project/livechattest-35101/firestore/indexes?create_composite=CldwcmRqZWN0cy9saXZlY2hhdHRlc3QtMzUxMDEvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL2NoYXJ0TGF5b3V0cy9pbmRleGVzL18QARoKCgZ1c2VySWQQARoNCgl0aW1lc3RhbXAQAg

2. 또는 Firebase CLI를 사용하여 인덱스를 생성할 수 있습니다:
   firebase firestore:indexes

3. 인덱스가 생성되면 차트 목록 조회가 정상적으로 작동합니다.

4. 인덱스 생성 완료까지 몇 분 정도 소요될 수 있습니다.
`);
}

// 🔥 실행
if (typeof window !== 'undefined') {
    // 브라우저 환경
    window.generateFirebaseIndexUrls = generateFirebaseIndexUrls;
    window.showIndexCreationGuide = showIndexCreationGuide;
    
    // 자동 실행
    showIndexCreationGuide();
} else {
    // Node.js 환경
    module.exports = {
        firebaseIndexes,
        generateFirebaseIndexUrls,
        showIndexCreationGuide
    };
} 