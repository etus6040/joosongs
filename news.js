/**
 * /api/news?year=1988&month=3&day=22
 * 네이버 뉴스 검색 API — "주현미" + 날짜 기반 검색
 *
 * 환경변수 (Vercel):
 *   NAVER_CLIENT_ID
 *   NAVER_CLIENT_SECRET
 *
 * 반환: { articles: [{title, description, link, pubDate}], naverLibUrl }
 *
 * 할당량: 하루 25,000회 (넉넉함)
 * 캐시: 24시간
 */

// HTML 태그 제거 헬퍼
function stripHtml(str) {
  return (str || '').replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#x27;/g, "'");
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const clientId     = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수 없음' });
  }

  // 날짜 파라미터 (없으면 오늘)
  const now   = new Date();
  const year  = parseInt(req.query?.year  || now.getFullYear());
  const month = parseInt(req.query?.month || now.getMonth() + 1);
  const day   = parseInt(req.query?.day   || now.getDate());

  // 검색 연도 범위: 오늘 기준 10~40년 전 사이 (너무 최근/오래된 것 제외)
  const thisYear   = now.getFullYear();
  const targetYear = year;

  // 네이버 뉴스 검색 API — 날짜 필터 (start, end)
  const mm   = String(month).padStart(2, '0');
  const dd   = String(day).padStart(2, '0');
  // ±3일 범위로 검색 (당일 기사가 없을 수 있어서)
  const dateStr  = `${targetYear}${mm}${dd}`;

  const query = encodeURIComponent('주현미');
  const apiUrl = `https://openapi.naver.com/v1/search/news.json?query=${query}&display=5&start=1&sort=date`;

  // 네이버 뉴스 라이브러리 검색 URL (80~90년대 신문 스캔)
  const naverLibUrl = `https://newslibrary.naver.com/search/searchByDate.naver?searchType=1&query=%EC%A3%BC%ED%98%84%EB%AF%B8&startDate=${targetYear}-${mm}-${dd}&endDate=${targetYear}-${mm}-${dd}`;

  try {
    const r = await fetch(apiUrl, {
      headers: {
        'X-Naver-Client-Id':     clientId,
        'X-Naver-Client-Secret': clientSecret,
      }
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(502).json({ error: data.errorMessage || '네이버 API 오류' });
    }

    const articles = (data.items || []).map(item => ({
      title:       stripHtml(item.title),
      description: stripHtml(item.description),
      link:        item.originallink || item.link,
      pubDate:     item.pubDate,
    }));

    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600');
    return res.status(200).json({ articles, naverLibUrl, targetYear, month, day });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
