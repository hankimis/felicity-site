# Google Search Console 중복 페이지 문제 해결 가이드

## 🚨 중복 페이지 문제 해결 완료 사항

### ✅ 1. Canonical 태그 설정 완료
- `index.html`에 canonical 태그 추가: `https://www.onbitlabs.com/`
- Open Graph URL도 `www.onbitlabs.com`으로 통일

### ✅ 2. 내부 링크 통일 완료
- 모든 `/index.html` 링크를 `/`로 변경
- 헤더, 로고, 내비게이션 메뉴 모두 수정 완료

### ✅ 3. 사이트맵 최적화 완료
- 모든 URL을 `www.onbitlabs.com`으로 통일
- `/index.html` 엔트리 없음 (이미 `/`만 포함되어 있었음)

---

## 🔧 서버 설정 (추가 권장사항)

### Apache 서버 (.htaccess 파일)
프로젝트 루트에 생성된 `.htaccess` 파일을 서버에 업로드하세요.

```apache
# /index.html을 /로 301 리다이렉트
RewriteEngine On
RewriteCond %{THE_REQUEST} \s/+index\.html[\s?] [NC]
RewriteRule ^index\.html$ / [R=301,L]

# www 없는 도메인을 www가 있는 도메인으로 리다이렉트
RewriteCond %{HTTP_HOST} ^onbitlabs\.com$ [NC]
RewriteRule ^(.*)$ https://www.onbitlabs.com/$1 [R=301,L]
```

### Nginx 서버
```nginx
# /index.html 리다이렉트
location = /index.html {
    return 301 https://www.onbitlabs.com/;
}

# www 없는 도메인 리다이렉트
server {
    server_name onbitlabs.com;
    return 301 https://www.onbitlabs.com$request_uri;
}
```

### Firebase Hosting (firebase.json)
```json
{
  "hosting": {
    "redirects": [
      {
        "source": "/index.html",
        "destination": "/",
        "type": 301
      },
      {
        "source": "**",
        "destination": "https://www.onbitlabs.com",
        "type": 301
      }
    ]
  }
}
```

---

## 📊 Google Search Console 재검증

### 1. Search Console 접속
- [Google Search Console](https://search.google.com/search-console)
- 속성: `https://www.onbitlabs.com`

### 2. 색인 재검증 요청
1. **왼쪽 메뉴** → "페이지"
2. **"사용자가 선택한 표준이 없는 중복 페이지"** 클릭
3. 각 URL에 대해 **"검증 시작"** 클릭
4. **"실시간 테스트"**로 즉시 확인 가능

### 3. URL 검사 도구 사용
1. 상단 검색창에 `https://www.onbitlabs.com/` 입력
2. **"색인 생성 요청"** 클릭
3. `https://www.onbitlabs.com/index.html` 입력
4. "URL이 Google에 등록되어 있지 않음" 확인 (정상)

---

## ⏰ 예상 해결 시간

- **즉시 효과**: Canonical 태그, 내부 링크 수정
- **1-3일**: Search Console 재크롤링
- **1-2주**: 색인 정규화 완료
- **2-4주**: 검색 결과 완전 반영

---

## 🔍 모니터링 체크리스트

### 주간 점검 (1-2주간)
- [ ] Search Console "페이지" 섹션에서 중복 페이지 개수 감소 확인
- [ ] `site:www.onbitlabs.com` 검색으로 색인 상태 확인
- [ ] `www.onbitlabs.com/index.html` 접속 시 `/`로 리다이렉트 확인

### 추가 최적화 (선택사항)
- [ ] robots.txt에 사이트맵 추가: `Sitemap: https://www.onbitlabs.com/sitemap.xml`
- [ ] 기타 하위 페이지들도 canonical 태그 점검
- [ ] 외부 백링크에서 `/index.html` 링크 변경 요청

---

## ✅ 완료 후 기대 효과

1. **SEO 개선**: 중복 콘텐츠 제거로 검색 순위 상승
2. **크롤링 효율성**: Googlebot이 더 효율적으로 사이트 크롤링
3. **사용자 경험**: 일관된 URL 구조로 혼란 최소화
4. **분석 정확성**: Google Analytics에서 더 정확한 데이터 수집

---

> ⚠️ **중요**: 서버 리다이렉트 설정은 호스팅 환경에 따라 다를 수 있습니다. 호스팅 업체에 문의하여 적절한 방법을 확인하세요.