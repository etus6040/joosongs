/**
 * /api/covers
 * Vercel 서버리스 함수 — YouTube Data API v3 프록시
 *
 * 환경변수 설정 (Vercel 대시보드 → Settings → Environment Variables):
 *   YOUTUBE_API_KEY = 발급받은 YouTube Data API v3 키
 *
 * 반환 형식:
 *   [{ id, title }, ...]
 */

const CHANNEL_ID = 'UCe8SFe2MNpnLnJEBNhCOhxg'; // @jootv.official 채널 ID
const MAX_RESULTS = 50;
const CACHE_SECONDS = 60 * 60 * 6; // 6시간 캐시

export default async function handler(req, res) {
  // CORS — 어디서든 접근 허용 (본인 도메인으로 제한하려면 변경)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'YOUTUBE_API_KEY 환경변수가 설정되지 않았습니다.' });
  }

  try {
    // YouTube Search API — 채널의 최신 영상 목록
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('channelId', CHANNEL_ID);
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('type', 'video');
    url.searchParams.set('maxResults', MAX_RESULTS);
    url.searchParams.set('order', 'date');

    const response = await fetch(url.toString());
    if (!response.ok) {
      const err = await response.json();
      return res.status(502).json({ error: err.error?.message || 'YouTube API 오류' });
    }

    const data = await response.json();

    // "주현미 -" 패턴 필터링
    const covers = (data.items || [])
      .filter(item => /주현미\s*[-—]/.test(item.snippet.title))
      .map(item => ({
        id: item.id.videoId,
        title: item.snippet.title,
        publishedAt: item.snippet.publishedAt,
      }));

    // 6시간 캐시 (Vercel Edge Cache)
    res.setHeader('Cache-Control', `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=3600`);
    return res.status(200).json(covers);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
