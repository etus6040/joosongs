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
 *  1. @jootv.official 핸들 → 채널 ID 자동 변환
 *  2. 페이지네이션으로 최대 500개 영상 수집
 *  3. 제목이 "주현미 -" 또는 "주현미-"로 시작하는 것만 필터
 *  4. 6시간 캐시
 */

const HANDLE = 'jootv.official';          // @ 없이
const TARGET = 500;                        // 수집할 최대 영상 수
const PAGE_SIZE = 50;                      // 한 번에 가져올 수 (API 최대값)
const CACHE_SEC = 60 * 60 * 6;            // 6시간

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'YOUTUBE_API_KEY 환경변수가 설정되지 않았습니다.' });
  }

  try {
    // ── STEP 1: 핸들 → 채널 ID 변환 ───────────────────────────────
    const chUrl = new URL('https://www.googleapis.com/youtube/v3/channels');
    chUrl.searchParams.set('key', apiKey);
    chUrl.searchParams.set('forHandle', HANDLE);
    chUrl.searchParams.set('part', 'id');

    const chRes = await fetch(chUrl.toString());
    const chData = await chRes.json();

    if (!chRes.ok || !chData.items?.length) {
      const msg = chData.error?.message || '채널을 찾을 수 없습니다.';
      return res.status(502).json({ error: `채널 조회 실패: ${msg}` });
    }

    const channelId = chData.items[0].id;

    // ── STEP 2: 채널 영상 페이지네이션으로 최대 500개 수집 ──────────
    let allItems = [];
    let pageToken = undefined;
    const pages = Math.ceil(TARGET / PAGE_SIZE); // 최대 10페이지

    for (let i = 0; i < pages; i++) {
      const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
      searchUrl.searchParams.set('key', apiKey);
      searchUrl.searchParams.set('channelId', channelId);
      searchUrl.searchParams.set('part', 'snippet');
      searchUrl.searchParams.set('type', 'video');
      searchUrl.searchParams.set('maxResults', PAGE_SIZE);
      searchUrl.searchParams.set('order', 'date');
      if (pageToken) searchUrl.searchParams.set('pageToken', pageToken);

      const pageRes = await fetch(searchUrl.toString());
      const pageData = await pageRes.json();

      if (!pageRes.ok) {
        // 할당량 초과 등 중간 실패 시 지금까지 수집한 것만 반환
        console.warn(`페이지 ${i + 1} 실패:`, pageData.error?.message);
        break;
      }

      allItems = allItems.concat(pageData.items || []);
      pageToken = pageData.nextPageToken;

      // 다음 페이지 없으면 중단
      if (!pageToken) break;
    }

    // ── STEP 3: "주현미 -" 패턴 필터 ─────────────────────────────
    const covers = allItems
      .filter(item => /주현미\s*[-—]/.test(item.snippet?.title || ''))
      .map(item => ({
        id: item.id.videoId,
        title: item.snippet.title,
      }));

    // ── STEP 4: 6시간 캐시 후 반환 ───────────────────────────────
    res.setHeader('Cache-Control', `public, s-maxage=${CACHE_SEC}, stale-while-revalidate=3600`);
    return res.status(200).json(covers);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
