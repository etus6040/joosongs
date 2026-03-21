/**
 * /api/covers
 * Vercel 서버리스 함수 — YouTube Data API v3 프록시
 *
 * 환경변수 (Vercel 대시보드 → Settings → Environment Variables):
 *   YOUTUBE_API_KEY = YouTube Data API v3 키
 *
 * 반환: [{ id, title }, ...]
 *
 * 동작:
 *  1. 채널 ID로 직접 검색 (forHandle API는 일부 프로젝트에서 차단됨)
 *  2. nextPageToken 페이지네이션으로 최대 500개 수집 (10페이지 × 50개)
 *  3. 제목이 "주현미 -" / "주현미-" 패턴인 것만 필터
 *  4. 6시간 캐시
 */

// 주현미 TV 공식 채널 ID (@jootv.official)
// 출처: playboard.co/en/channel/UCEDXalKckJ-JqVCjusmHm3g
const CHANNEL_ID = 'UCEDXalKckJ-JqVCjusmHm3g';
const PAGE_SIZE  = 50;           // YouTube API 최대값
const MAX_PAGES  = 10;           // 10 × 50 = 500개 상한
const CACHE_SEC  = 60 * 60 * 6; // 6시간 Vercel Edge 캐시

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'YOUTUBE_API_KEY 환경변수가 설정되지 않았습니다.' });
  }

  try {
    let allItems  = [];
    let pageToken = undefined;

    for (let i = 0; i < MAX_PAGES; i++) {
      const url = new URL('https://www.googleapis.com/youtube/v3/search');
      url.searchParams.set('key',       apiKey);
      url.searchParams.set('channelId', CHANNEL_ID);
      url.searchParams.set('part',      'snippet');
      url.searchParams.set('type',      'video');
      url.searchParams.set('maxResults', PAGE_SIZE);
      url.searchParams.set('order',     'date');
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const pageRes  = await fetch(url.toString());
      const pageData = await pageRes.json();

      if (!pageRes.ok) {
        // 중간 실패(할당량 초과 등) — 지금까지 모은 것으로 응답
        console.warn(`페이지 ${i + 1} 실패:`, pageData.error?.message);
        break;
      }

      allItems  = allItems.concat(pageData.items || []);
      pageToken = pageData.nextPageToken;
      if (!pageToken) break; // 마지막 페이지
    }

    // "주현미 -" 또는 "주현미-" 제목 필터
    const covers = allItems
      .filter(v => /주현미\s*[-—]/.test(v.snippet?.title || ''))
      .map(v => ({
        id:    v.id.videoId,
        title: v.snippet.title,
      }));

    res.setHeader('Cache-Control', `public, s-maxage=${CACHE_SEC}, stale-while-revalidate=3600`);
    return res.status(200).json(covers);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
