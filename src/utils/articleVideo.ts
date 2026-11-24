const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);
const YOUTUBE_VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;

export function getYouTubeVideoId(value?: string): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null;

    const parts = url.pathname.split('/').filter(Boolean);
    const candidate = url.hostname.toLowerCase() === 'youtu.be'
      ? parts[0]
      : ['embed', 'shorts', 'live'].includes(parts[0] || '')
        ? parts[1]
        : url.searchParams.get('v');

    return candidate && YOUTUBE_VIDEO_ID.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export function getYouTubeEmbedUrl(value?: string): string | null {
  const videoId = getYouTubeVideoId(value);
  return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null;
}

export function isHttpUrl(value?: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
