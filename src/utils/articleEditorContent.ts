export interface ArticleEditorSection {
  id: string;
  heading: string;
  body: string;
}

export interface ParsedArticleContent {
  intro: string;
  sections: ArticleEditorSection[];
}

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    '#39': "'",
    nbsp: ' ',
  };

  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|#39|nbsp);/gi, (entity, name: string) => {
    if (name[0] !== '#') return namedEntities[name.toLowerCase()] || entity;
    const codePoint = name[1].toLowerCase() === 'x'
      ? Number.parseInt(name.slice(2), 16)
      : Number.parseInt(name.slice(1), 10);
    return Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : entity;
  });
}

function toPlainText(value: string) {
  return decodeHtmlEntities(value.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')).trim();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}

function renderSectionBody(body: string) {
  return body.trim().split(/\n\s*\n/).map((paragraph) => {
    const lines = paragraph.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return '';

    if (lines.every((line) => /^[-*•]\s+/.test(line))) {
      return `<ul>${lines.map((line) => `<li>${escapeHtml(line.replace(/^[-*•]\s+/, ''))}</li>`).join('')}</ul>`;
    }

    return `<p>${escapeHtml(lines.join(' '))}</p>`;
  }).join('');
}

export function parseArticleContent(content: string): ParsedArticleContent {
  const parsed: ParsedArticleContent = { intro: '', sections: [] };
  let currentSection: ArticleEditorSection | undefined;
  const blocks = content.match(/<(p|h2|ul|ol|blockquote)\b[^>]*>[\s\S]*?<\/\1\s*>/gi) || [];
  if (!blocks.length) {
    parsed.intro = toPlainText(content);
    parsed.sections.push({ id: 'section-1', heading: '', body: '' });
    return parsed;
  }

  const ensureSection = () => {
    if (!currentSection) {
      currentSection = { id: `section-${parsed.sections.length + 1}`, heading: '', body: '' };
      parsed.sections.push(currentSection);
    }
    return currentSection;
  };

  for (const block of blocks) {
    const openingTag = block.match(/^<([a-z0-9]+)\b([^>]*)>/i);
    if (!openingTag) continue;
    const tag = openingTag[1].toLowerCase();
    const innerHtml = block.slice(openingTag[0].length, block.lastIndexOf('</'));

    if (tag === 'h2') {
      currentSection = {
        id: `section-${parsed.sections.length + 1}`,
        heading: toPlainText(innerHtml),
        body: '',
      };
      parsed.sections.push(currentSection);
      continue;
    }

    if (tag === 'p') {
      const text = toPlainText(innerHtml);
      if (!text) continue;
      const isLead = /\bclass\s*=\s*(['"])lead\1/i.test(openingTag[2]);
      if (isLead || (!parsed.intro && !currentSection)) parsed.intro = parsed.intro ? `${parsed.intro}\n\n${text}` : text;
      else {
        const section = ensureSection();
        section.body = section.body ? `${section.body}\n\n${text}` : text;
      }
      continue;
    }

    if (tag === 'ul' || tag === 'ol') {
      const listItems = [...innerHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
        .map((match) => toPlainText(match[1]))
        .filter(Boolean);
      if (!listItems.length) continue;
      const section = ensureSection();
      const listText = listItems.map((item) => `- ${item}`).join('\n');
      section.body = section.body ? `${section.body}\n\n${listText}` : listText;
      continue;
    }

    const text = toPlainText(innerHtml);
    if (text) {
      const section = ensureSection();
      section.body = section.body ? `${section.body}\n\n${text}` : text;
    }
  }

  if (!parsed.sections.length) parsed.sections.push({ id: 'section-1', heading: '', body: '' });
  return parsed;
}

export function serializeArticleContent(intro: string, sections: ArticleEditorSection[]) {
  const blocks = intro.trim() ? `<p class="lead">${escapeHtml(intro.trim())}</p>` : '';
  return blocks + sections.map((section) => {
    const heading = section.heading.trim() ? `<h2>${escapeHtml(section.heading.trim())}</h2>` : '';
    return heading + renderSectionBody(section.body);
  }).join('');
}
