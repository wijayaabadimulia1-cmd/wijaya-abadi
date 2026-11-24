(() => {
  const script = document.currentScript;
  const slug = script && script.dataset.articleSlug;
  if (!slug || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) return;

  try {
    const sessionKey = 'hwa-visitor-session';
    let sessionId = sessionStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `visit_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(sessionKey, sessionId);
    }

    const source = document.referrer
      ? /google\.|bing\.|yahoo\.|duckduckgo\./i.test(new URL(document.referrer).hostname)
        ? 'Organik Search'
        : /facebook\.|instagram\.|tiktok\.|youtube\.|x\.com$|twitter\.|linkedin\./i.test(new URL(document.referrer).hostname)
          ? 'Social Media'
          : 'Referral'
      : 'Direct';
    const requestHeaders = { 'Content-Type': 'application/json' };
    const visitRequest = fetch('/api/analytics/visit', {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({ sessionId, path: window.location.pathname, source }),
      keepalive: true,
    });
    const articleRequest = fetch('/api/analytics/article-view', {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({ sessionId, slug }),
      keepalive: true,
    });

    Promise.all([visitRequest, articleRequest]).then((responses) => {
      responses.forEach((response) => {
        if (!response.ok) console.error('Article analytics request failed:', response.status);
      });
    }).catch((error) => console.error('Article analytics could not be recorded:', error));
  } catch (error) {
    console.error('Article analytics could not be initialized:', error);
  }
})();
