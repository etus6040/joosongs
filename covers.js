/**
 * /api/covers  — YouTube playlistItems API 프록시
 *
 * search.list 대신 playlistItems.list 사용
 *  - search.list  : 100유닛/호출 (기존)
 *  - playlistItems: 3유닛/호출  (33배 절약!)
 *
 * 채널의 "업로드 전체" 재생목록 ID = 채널ID의 UC → UU 치환
 * UCEDXalKckJ-JqVCjusmHm3g → UUEDXalKckJ-JqVCjusmHm3g
 *
 * 500개 수집 시 유닛:
 *  - 기존 search.list  : 100 × 10페이지 = 1,000유닛
 *  - playlistItems      :   3 × 10페이지 =    30유닛 (33배 절약)
 *
 * 환경변수: YOUTUBE_API_KEY
 * 캐시: 24시간
 */

const UPLOAD_PLAYLIST_ID = 'UUEDXalKckJ-JqVCjusmHm3g'; // UC→UU
const PAGE_SIZE  = 50;
const MAX_PAGES  = 10;            // 최대 500개
const CACHE_SEC  = 60 * 60 * 24; // 24시간

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'YOUTUBE_API_KEY 없음' });

  const debug = req.query?.debug === '1';

  try {
    let allItems  = [];
    let pageToken = undefined;
    const pages   = debug ? 1 : MAX_PAGES;

    for (let i = 0; i < pages; i++) {
      const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
      url.searchParams.set('key',        apiKey);
      url.searchParams.set('playlistId', UPLOAD_PLAYLIST_ID);
      url.searchParams.set('part',       'snippet');
      url.searchParams.set('maxResults', PAGE_SIZE);
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const r    = await fetch(url.toString());
      const data = await r.json();

      if (!r.ok) {
        // 할당량 초과 등 — 지금까지 모은 것으로 응답
        if (r.status === 403) break;
        return res.status(502).json({ error: data.error?.message || 'YouTube API 오류' });
      }

      allItems  = allItems.concat(data.items || []);
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }

    if (debug) {
      return res.status(200).json(
        allItems.map(v => ({
          id:    v.snippet?.resourceId?.videoId,
          title: v.snippet?.title,
        }))
      );
    }

    // "주현미 -" 또는 "주현미-" 필터
    const covers = allItems
      .filter(v => /주현미\s*[-—]/.test(v.snippet?.title || ''))
      .map(v => ({
        id:    v.snippet.resourceId.videoId,
        title: v.snippet.title,
      }));

    // 필터 결과 없으면 전체 반환 (안전망)
    const result = covers.length > 0 ? covers : allItems.map(v => ({
      id:    v.snippet?.resourceId?.videoId,
      title: v.snippet?.title,
    }));

    res.setHeader('Cache-Control', `public, s-maxage=${CACHE_SEC}, stale-while-revalidate=3600`);
    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
