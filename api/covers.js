/**
 * /api/covers  — YouTube Data API v3 프록시
 *
 * 환경변수: YOUTUBE_API_KEY
 * 반환: [{ id, title }, ...]
 *
 * ?debug=1  → 필터 없이 첫 페이지 전체 반환 (제목 확인용)
 */

const CHANNEL_ID = 'UCEDXalKckJ-JqVCjusmHm3g'; // 주현미 TV (@jootv.official)
const PAGE_SIZE  = 50;
const MAX_PAGES  = 10;   // 최대 500개
const CACHE_SEC  = 60 * 60 * 6;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'YOUTUBE_API_KEY 환경변수 없음' });
  }

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
        return res.status(502).json({
          error: data.error?.message || 'YouTube API 오류',
          status: r.status,
        });
      }

      allItems  = allItems.concat(data.items || []);
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }

    // debug=1 이면 필터 없이 제목 목록만 반환
    if (debug) {
      return res.status(200).json(
        allItems.map(v => ({ id: v.id?.videoId, title: v.snippet?.title }))
      );
    }

    // 실제 필터: "주현미 -"  또는  "주현미-"
    // 채널 영상 제목이 다른 형식이면 아래 정규식을 수정하세요
    const covers = allItems
      .filter(v => /주현미\s*[-—]/.test(v.snippet?.title || ''))
      .map(v => ({ id: v.id.videoId, title: v.snippet.title }));

    // 필터 결과가 없으면 → 전체 반환 (안전망)
    const result = covers.length > 0 ? covers : allItems.map(v => ({
      id:    v.id?.videoId,
      title: v.snippet?.title,
    }));

    res.setHeader('Cache-Control', `public, s-maxage=${CACHE_SEC}, stale-while-revalidate=3600`);
    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
