export const ARTICLE_THEMES = [
  { id: 'honda-racing', name: '1. Honda Racing Editorial (Merah-Putih Klasik)', wrapper: 'bg-slate-50 text-slate-800', card: 'bg-white border-slate-200', layout: 'sidebar-right' },
  { id: 'split-magazine', name: '2. Split-Screen Magazine Hero', wrapper: 'bg-white text-slate-800', card: 'bg-white border-transparent', layout: 'split-hero' },
  { id: 'bento-grid', name: '3. Bento Grid Summary + Article', wrapper: 'bg-slate-100 text-slate-800', card: 'bg-white border-slate-200', layout: 'bento-top' },
  { id: 'checklist-guide', name: '4. Interactive Checklist Guide', wrapper: 'bg-red-50/30 text-slate-800', card: 'bg-white border-red-100', layout: 'checklist' },
  { id: 'tiktok-reels', name: '5. TikTok / Reels Mobile Story Layout', wrapper: 'bg-zinc-950 text-zinc-100', card: 'bg-zinc-900 border-zinc-800 max-w-md mx-auto', layout: 'mobile-story' },
  { id: 'dual-sidebar', name: '6. Sticky Dual-Sidebar Conversion', wrapper: 'bg-slate-50 text-slate-800', card: 'bg-white border-slate-200', layout: 'dual-sidebar' },
  { id: 'dark-carbon', name: '7. Dark Sporty Carbon Mode', wrapper: 'bg-slate-950 text-slate-100 dark-article', card: 'bg-slate-900 border-slate-800', layout: 'sidebar-right' },
  { id: 'timeline-vertical', name: '8. Step-by-Step Timeline Vertical', wrapper: 'bg-slate-50 text-slate-800', card: 'bg-white border-slate-200', layout: 'timeline' },
  { id: 'clean-medium', name: '9. Clean Minimalist Reader (Single Column)', wrapper: 'bg-white text-slate-800', card: 'bg-white border-transparent max-w-2xl mx-auto', layout: 'single-column' },
  { id: 'infographic-deck', name: '10. Infographic Card Deck', wrapper: 'bg-slate-100 text-slate-800', card: 'bg-transparent border-transparent', layout: 'card-deck' },
  { id: 'myth-vs-fact', name: '11. Before-After / Myth vs Fact Split', wrapper: 'bg-slate-50 text-slate-800', card: 'bg-white border-slate-200', layout: 'comparison' },
  { id: 'floating-bottom', name: '12. Floating Bottom Action Bar (Mobile-First)', wrapper: 'bg-slate-50 text-slate-800 pb-20', card: 'bg-white border-slate-200', layout: 'floating-cta' },
  { id: 'video-theater', name: '13. Video-First Theater Header', wrapper: 'bg-slate-900 text-slate-100 dark-article', card: 'bg-slate-800 border-slate-700', layout: 'theater-top' },
  { id: 'faq-accordion', name: '14. FAQ Accordion Interactive', wrapper: 'bg-slate-50 text-slate-800', card: 'bg-white border-slate-200', layout: 'accordion' },
  { id: 'parallax-hero', name: '15. Parallax Full-Width Hero Banner', wrapper: 'bg-slate-50 text-slate-800', card: 'bg-white border-slate-200 -mt-16 relative z-10', layout: 'parallax' },
  { id: 'callout-heavy', name: '16. Highlight Quote & Promo Callout Heavy', wrapper: 'bg-red-50/40 text-slate-800', card: 'bg-white border-red-200', layout: 'callout-focus' },
  { id: 'tabbed-section', name: '17. Tabbed Section Article (Ringkasan/Isi/Kredit)', wrapper: 'bg-slate-50 text-slate-800', card: 'bg-white border-slate-200', layout: 'tabbed' },
  { id: 'glassmorphism', name: '18. Glassmorphism Modern Gen-Z UI', wrapper: 'bg-gradient-to-br from-red-50 via-white to-slate-100 text-slate-800', card: 'bg-white/75 backdrop-blur-md border-white/60 shadow-lg', layout: 'sidebar-right' },
  { id: 'gallery-lightbox', name: '19. Gallery Grid + Story', wrapper: 'bg-slate-50 text-slate-800', card: 'bg-white border-slate-200', layout: 'gallery' },
  { id: 'gamified-quiz', name: '20. Gamified Self-Check + Article', wrapper: 'bg-slate-50 text-slate-800', card: 'bg-white border-slate-200', layout: 'quiz-embed' },
] as const;

export type ArticleThemeId = (typeof ARTICLE_THEMES)[number]['id'];

export const DEFAULT_ARTICLE_THEME: ArticleThemeId = 'honda-racing';

export function getArticleTheme(value?: string) {
  return ARTICLE_THEMES.find((theme) => theme.id === value) || ARTICLE_THEMES[0];
}

export function isArticleThemeId(value: unknown): value is ArticleThemeId {
  return typeof value === 'string' && ARTICLE_THEMES.some((theme) => theme.id === value);
}
