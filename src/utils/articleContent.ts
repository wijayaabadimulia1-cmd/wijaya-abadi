const ARTICLE_TAGS = new Set([
  'p',
  'h2',
  'ul',
  'ol',
  'li',
  'blockquote',
  'strong',
  'em',
  'br',
]);

export function sanitizeArticleContent(content: string) {
  const withoutUnsafeContent = content
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|svg|math|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');

  return withoutUnsafeContent.replace(/<(\/?)([a-z][a-z0-9-]*)\b[^>]*>/gi, (markup, closing: string, rawTag: string) => {
    const tag = rawTag.toLowerCase();
    if (!ARTICLE_TAGS.has(tag)) return '';
    if (closing) return `</${tag}>`;
    if (tag === 'p' && /\bclass\s*=\s*(['"])lead\1/i.test(markup)) return '<p class="lead">';
    return `<${tag}>`;
  });
}
