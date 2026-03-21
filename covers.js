/**
 * /api/covers  — YouTube Data API v3 프록시
 * 환경변수: YOUTUBE_API_KEY
 * 반환: [{ id, title }, ...]
 *
 * 할당량 절약 전략:
 *  - Vercel Edge 캐시 24시간 (하루 최대 1회 API 호출)
 *  - ?debug=1 → 첫 페이지만 반환 (할당량 100유닛만 사용)
 */

const CHANNEL_ID = 'UCEDXalKckJ-JqVCjusmHm3g'; // 주현미 TV (@jootv.official)
const PAGE_SIZE  = 50;
const MAX_PAGES  = 10;           // 최대 500개 (할당량: 100×10 = 1000유닛)
const CACHE_SEC  = 60 * 60 * 24; // 24시간 — 하루 1회만 API 호출

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'YOUTUBE_API_KEY 환경변수 없음' });

  const debug = req.query?.debug === '1';

  try {
    let allItems  = [];
    let pageToken = undefined;
    const pages   = debug ? 1 : MAX_PAGES;

    for (let i = 0; i < pages; i++) {
      const url = new URL('https://www.googleapis.com/youtube/v3/search');
      url.searchParams.set('key',        apiKey);
      url.searchParams.set('channelId',  CHANNEL_ID);
      url.searchParams.set('part',       'snippet');
      url.searchParams.set('type',       'video');
      url.searchParams.set('maxResults', PAGE_SIZE);
      url.searchParams.set('order',      'date');
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const r    = await fetch(url.toString());
      const data = await r.json();

      if (!r.ok) {
        // 할당량 초과 시 지금까지 모은 것으로 응답
        if (r.status === 403) break;
        return res.status(502).json({ error: data.error?.message || 'YouTube API 오류' });
      }

      allItems  = allItems.concat(data.items || []);
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }

    if (debug) {
      return res.status(200).json(
        allItems.map(v => ({ id: v.id?.videoId, title: v.snippet?.title }))
      );
    }

    const covers = allItems
      .filter(v => /주현미\s*[-—]/.test(v.snippet?.title || ''))
      .map(v => ({ id: v.id.videoId, title: v.snippet.title }));

    const result = covers.length > 0 ? covers : allItems.map(v => ({
      id: v.id?.videoId, title: v.snippet?.title,
    }));

    // 24시간 캐시 — 하루 1회만 실제 API 호출됨
    res.setHeader('Cache-Control', `public, s-maxage=${CACHE_SEC}, stale-while-revalidate=3600`);
    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
