/**
 * /api/today-video?q=검색어
 * 오늘의 추천 곡 YouTube 영상 ID 반환
 * 환경변수: YOUTUBE_API_KEY
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API 키 없음' });

  const q = req.query?.q;
  if (!q) return res.status(400).json({ error: '검색어(q) 필요' });

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('q', q);
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('type', 'video');
    url.searchParams.set('maxResults', '1');
    url.searchParams.set('relevanceLanguage', 'ko');

    const r    = await fetch(url.toString());
    const data = await r.json();

    if (!r.ok) return res.status(502).json({ error: data.error?.message });

    const item = data.items?.[0];
    if (!item) return res.status(404).json({ error: '영상 없음' });

    // 1시간 캐시 (같은 검색어는 자주 안 바뀜)
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600');
    return res.status(200).json({
      id:    item.id.videoId,
      title: item.snippet.title,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
