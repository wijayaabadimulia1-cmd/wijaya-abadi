import React, { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, CalendarDays, ChevronLeft, ChevronRight, Clock3, Share2, X } from 'lucide-react';
import type { Article } from '../types';
import { DEFAULT_CATALOG_ANIMATION, DEFAULT_CATALOG_ANIMATION_SPEED } from '../catalogAnimation';

interface ArticleSectionProps {
  articles: Article[];
}

function getArticleImages(article: Article) {
  const images = article.images?.filter(Boolean) || [];
  return images.length ? images : article.image ? [article.image] : [];
}

function getReadingMinutes(content: string) {
  return Math.max(1, Math.ceil(content.trim().split(/\s+/).filter(Boolean).length / 200));
}

function formatDate(value?: string) {
  if (!value) return 'Artikel terbaru';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Artikel terbaru'
    : date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getImageStyle(article: Article): React.CSSProperties {
  return {
    '--catalog-animation-duration': `${Math.min((article.animationSpeed || DEFAULT_CATALOG_ANIMATION_SPEED) * 0.3, 3)}s`,
  } as React.CSSProperties;
}

export function ArticleSection({ articles }: ArticleSectionProps) {
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [shareMessage, setShareMessage] = useState('');
  const visibleArticles = articles.filter((article) => article.published);

  useEffect(() => {
    const syncArticleRoute = () => {
      const pathMatch = window.location.pathname.match(/^\/artikel\/([^/]+)\/?$/);
      const hashMatch = window.location.hash.match(/^#artikel-(.+)$/);
      const match = pathMatch || hashMatch;
      if (!match) {
        setSelectedArticle(null);
        return;
      }
      let slug = match[1];
      try {
        slug = decodeURIComponent(slug);
      } catch {
        return;
      }
      const article = visibleArticles.find((item) => item.slug === slug);
      if (article) {
        setSelectedArticle(article);
        setSelectedImageIndex(0);
      }
    };

    syncArticleRoute();
    window.addEventListener('hashchange', syncArticleRoute);
    window.addEventListener('popstate', syncArticleRoute);
    return () => {
      window.removeEventListener('hashchange', syncArticleRoute);
      window.removeEventListener('popstate', syncArticleRoute);
    };
  }, [articles]);

  const closeArticle = () => {
    setSelectedArticle(null);
    if (window.location.pathname.startsWith('/artikel/') || window.location.hash.startsWith('#artikel-')) {
      window.history.replaceState({}, '', `${window.location.origin}/#artikel`);
    }
  };

  const shareArticle = async (article: Article) => {
    const articleUrl = new URL(window.location.href);
    articleUrl.pathname = `/artikel/${encodeURIComponent(article.slug)}/`;
    articleUrl.hash = '';
    const shareData = { title: article.title, text: article.excerpt, url: articleUrl.href };
    try {
      const shareNavigator = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
      if (shareNavigator.share) {
        await shareNavigator.share(shareData);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(articleUrl.href);
        setShareMessage('Tautan artikel disalin.');
      } else {
        setShareMessage(articleUrl.href);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setShareMessage('Tautan artikel tidak dapat dibagikan.');
    }
  };

  if (!visibleArticles.length) return null;

  return (
    <>
      <section id="artikel" className="relative border-y border-zinc-200 bg-white py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 border-b border-zinc-200 pb-7 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase text-red-600">
                <BookOpen className="h-4 w-4" />
                Wawasan &amp; Panduan
              </div>
              <h2 className="text-3xl font-black text-zinc-950 sm:text-4xl">Artikel seputar Honda</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-600">Panduan memilih motor, memahami pembelian, dan merawat kendaraan untuk perjalanan sehari-hari.</p>
            </div>
            <span className="text-sm font-semibold text-zinc-600">{visibleArticles.length} artikel</span>
          </div>

          <div className="mt-7 grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 lg:grid-cols-3">
            {visibleArticles.map((article) => {
              const coverImage = getArticleImages(article)[0];
              return (
                <article id={`artikel-${article.slug}`} key={article.id} className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
                    {coverImage ? (
                      <div className="aspect-[16/9] overflow-hidden bg-zinc-100">
                        <img src={coverImage} alt={article.title} loading="lazy" decoding="async" className="catalog-photo-animation h-full w-full object-contain" data-catalog-animation={article.animation || DEFAULT_CATALOG_ANIMATION} style={getImageStyle(article)} />
                      </div>
                    ) : (
                      <div className="flex aspect-[16/9] items-end justify-between bg-zinc-100 p-5">
                        <BookOpen className="h-8 w-8 text-red-500/70" aria-hidden="true" />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-4 sm:p-5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600"><CalendarDays className="h-4 w-4" />{formatDate(article.created_at)}</span>
                        <button type="button" onClick={() => void shareArticle(article)} title={`Bagikan artikel ${article.title}`} aria-label={`Bagikan artikel ${article.title}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-zinc-200 text-zinc-600 transition hover:border-red-300 hover:text-red-600">
                          <Share2 className="h-4 w-4" />
                        </button>
                      </div>
                      <h3 className="mt-2 break-words text-lg font-bold leading-snug text-zinc-950">{article.title}</h3>
                      {article.excerpt && <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-zinc-600">{article.excerpt}</p>}
                      <div className="mt-auto pt-5">
                        <a href={`/artikel/${encodeURIComponent(article.slug)}/`} className="inline-flex items-center gap-3 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:border-red-500 hover:text-red-700" aria-label={`Selengkapnya: ${article.title}`}>
                          Selengkapnya <ArrowRight className="h-4 w-4 text-red-600" />
                        </a>
                      </div>
                    </div>
                </article>
              );
            })}
          </div>
          {shareMessage && <p className="mt-3 text-xs text-zinc-600" role="status" aria-live="polite">{shareMessage}</p>}
        </div>
      </section>

      {selectedArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) closeArticle(); }}>
          <article className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-white/10 bg-zinc-950 text-zinc-100 shadow-2xl">
            <button type="button" onClick={closeArticle} className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/70 text-white hover:bg-black" aria-label="Tutup artikel"><X className="h-5 w-5" /></button>
            {getArticleImages(selectedArticle).length > 0 && (
              <div className="relative aspect-[16/9] max-h-80 overflow-hidden bg-zinc-100">
                <img key={getArticleImages(selectedArticle)[selectedImageIndex]} src={getArticleImages(selectedArticle)[selectedImageIndex]} alt={`${selectedArticle.title}, gambar ${selectedImageIndex + 1}`} className="catalog-photo-animation absolute inset-0 h-full w-full object-contain" data-catalog-animation={selectedArticle.animation || DEFAULT_CATALOG_ANIMATION} style={getImageStyle(selectedArticle)} />
                {getArticleImages(selectedArticle).length > 1 && (
                  <>
                    <button type="button" onClick={() => setSelectedImageIndex((index) => (index - 1 + getArticleImages(selectedArticle).length) % getArticleImages(selectedArticle).length)} className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/70 text-white hover:bg-black" aria-label="Gambar sebelumnya"><ChevronLeft className="h-5 w-5" /></button>
                    <button type="button" onClick={() => setSelectedImageIndex((index) => (index + 1) % getArticleImages(selectedArticle).length)} className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/70 text-white hover:bg-black" aria-label="Gambar berikutnya"><ChevronRight className="h-5 w-5" /></button>
                    <span className="absolute bottom-3 right-3 rounded bg-black/70 px-2 py-1 text-xs font-semibold text-white">{selectedImageIndex + 1} / {getArticleImages(selectedArticle).length}</span>
                  </>
                )}
              </div>
            )}
            <div className="px-5 py-7 sm:px-10 sm:py-10">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-zinc-400">
                <span className="text-red-400">{selectedArticle.category}</span>
                <span>{formatDate(selectedArticle.created_at)}</span>
                <span>{getReadingMinutes(selectedArticle.content)} menit membaca</span>
              </div>
              <h2 className="mt-4 text-2xl font-black leading-tight text-white sm:text-4xl">{selectedArticle.title}</h2>
              <p className="mt-4 border-l-2 border-red-600 pl-4 text-base leading-7 text-zinc-300">{selectedArticle.excerpt}</p>
              <div className="mt-7 space-y-5 text-sm leading-7 text-zinc-300 sm:text-base">
                {selectedArticle.content.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => <p key={`${selectedArticle.id}-${index}`}>{paragraph}</p>)}
              </div>
              <p className="mt-8 border-t border-white/10 pt-5 text-xs font-semibold text-zinc-500">Ditulis oleh {selectedArticle.author}</p>
            </div>
          </article>
        </div>
      )}
    </>
  );
}
