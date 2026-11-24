import React, { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, CalendarDays, ChevronLeft, ChevronRight, Clock3, Share2, X } from 'lucide-react';
import type { Article } from '../types';
import { DEFAULT_CATALOG_ANIMATION, DEFAULT_CATALOG_ANIMATION_SPEED } from '../catalogAnimation';
import { getYouTubeEmbedUrl, isHttpUrl } from '../utils/articleVideo';

interface ArticleSectionProps {
  articles: Article[];
  whatsappNumber?: string;
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

export function ArticleSection({ articles, whatsappNumber = '' }: ArticleSectionProps) {
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [shareMessage, setShareMessage] = useState('');
  const visibleArticles = articles.filter((article) => article.published);
  const isDirectArticlePage = /^\/artikel\/[^/]+\/?$/.test(window.location.pathname);

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

  const getVideoDetails = (article: Article) => {
    const media = article.videoMedia;
    if (media?.source === 'youtube') {
      const embedUrl = getYouTubeEmbedUrl(media.youtubeUrl);
      return embedUrl ? { kind: 'youtube' as const, url: embedUrl, poster: media.thumbnailUrl || article.image } : null;
    }
    if (media?.source === 'upload' && media.videoUrl?.startsWith('/article-media/')) {
      return { kind: 'file' as const, url: media.videoUrl, poster: media.thumbnailUrl || article.image };
    }

    const legacyVideo = article.video || '';
    const youtubeUrl = getYouTubeEmbedUrl(legacyVideo);
    if (youtubeUrl) return { kind: 'youtube' as const, url: youtubeUrl, poster: article.image };
    if (/\.mp4(?:[?#].*)?$/i.test(legacyVideo) && (legacyVideo.startsWith('/') || isHttpUrl(legacyVideo))) {
      return { kind: 'file' as const, url: legacyVideo, poster: article.image };
    }
    return null;
  };

  const whatsappDigits = whatsappNumber.replace(/\D/g, '');

  if (!visibleArticles.length) return null;

  return (
    <>
      <section id="artikel" className={`relative overflow-hidden border-y border-stone-200/80 bg-[#faf9f6] py-14 sm:py-20 lg:py-24 ${isDirectArticlePage ? 'hidden' : ''}`}>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 border-b border-stone-200 pb-8 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-100 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-red-700 shadow-sm">
                <BookOpen className="h-4 w-4" />
                Wawasan &amp; Panduan
              </div>
              <h2 className="font-serif text-4xl font-semibold leading-tight tracking-tight text-stone-950 sm:text-5xl">Cerita, tips &amp; inspirasi Honda</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-stone-600 sm:text-base">Temukan panduan pilihan, wawasan berkendara, dan inspirasi perawatan untuk menemani setiap perjalanan Anda.</p>
            </div>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{visibleArticles.length} artikel pilihan</span>
          </div>

          <div className="mt-9 grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
            {visibleArticles.map((article) => {
              const coverImage = getArticleImages(article)[0];
              return (
                <article id={`artikel-${article.slug}`} key={article.id} className="group flex min-w-0 flex-col overflow-hidden rounded-[1.35rem] border border-stone-200/80 bg-white shadow-[0_8px_30px_rgba(41,37,36,0.045)] transition duration-500 hover:-translate-y-1 hover:border-red-200 hover:shadow-[0_20px_48px_rgba(41,37,36,0.10)]">
                    {coverImage ? (
                      <div className="relative aspect-[16/10] overflow-hidden bg-stone-100">
                        <img src={coverImage} alt={article.title} loading="lazy" decoding="async" className="catalog-photo-animation h-full w-full object-cover transition duration-700 group-hover:scale-[1.045]" data-catalog-animation={article.animation || DEFAULT_CATALOG_ANIMATION} style={getImageStyle(article)} />
                      </div>
                    ) : (
                      <div className="flex aspect-[16/10] items-end justify-between bg-gradient-to-br from-stone-100 via-stone-50 to-red-50 p-5">
                        <BookOpen className="h-8 w-8 text-red-500/70" aria-hidden="true" />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-5 sm:p-6">
                      <div className="flex items-center justify-between gap-3 text-stone-500">
                        <span className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600"><CalendarDays className="h-4 w-4" />{formatDate(article.publishedAt || article.created_at)}</span>
                        <button type="button" onClick={() => void shareArticle(article)} title={`Bagikan artikel ${article.title}`} aria-label={`Bagikan artikel ${article.title}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-stone-200 text-stone-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700">
                          <Share2 className="h-4 w-4" />
                        </button>
                      </div>
                      <h3 className="mt-4 break-words font-serif text-xl font-semibold leading-snug text-stone-950 transition group-hover:text-red-800 sm:text-2xl">{article.title}</h3>
                      {article.excerpt && <p className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-stone-600">{article.excerpt}</p>}
                      <div className="mt-auto pt-5">
                        <a href={`/artikel/${encodeURIComponent(article.slug)}/`} className="inline-flex items-center gap-2 border-b border-stone-300 pb-1.5 text-xs font-bold uppercase tracking-[0.12em] text-stone-800 transition hover:border-red-600 hover:text-red-700" aria-label={`Selengkapnya: ${article.title}`}>
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
        <div
          className={isDirectArticlePage
            ? 'fixed inset-0 z-50 overflow-y-auto bg-[#fffefa]'
            : 'fixed inset-0 z-50 flex items-center justify-center bg-stone-950/75 p-3 backdrop-blur-md sm:p-6'}
          onMouseDown={!isDirectArticlePage ? (event) => { if (event.target === event.currentTarget) closeArticle(); } : undefined}
        >
          <article className={isDirectArticlePage
            ? 'relative mx-auto min-h-screen w-full max-w-4xl bg-[#fffefa] text-stone-900'
            : 'relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[1.5rem] border border-white/50 bg-[#fffefa] text-stone-900 shadow-[0_30px_100px_rgba(0,0,0,0.28)]'}
          >
            <button type="button" onClick={closeArticle} className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full border border-white/70 bg-stone-950/70 text-white shadow-lg backdrop-blur hover:bg-red-700" aria-label="Tutup artikel"><X className="h-5 w-5" /></button>
            {getArticleImages(selectedArticle).length > 0 && (
              <div className="relative aspect-[16/9] max-h-[18rem] overflow-hidden bg-stone-100">
                <img key={getArticleImages(selectedArticle)[selectedImageIndex]} src={getArticleImages(selectedArticle)[selectedImageIndex]} alt={`${selectedArticle.title}, gambar ${selectedImageIndex + 1}`} className="catalog-photo-animation absolute inset-0 h-full w-full object-cover" data-catalog-animation={selectedArticle.animation || DEFAULT_CATALOG_ANIMATION} style={getImageStyle(selectedArticle)} />
                {getArticleImages(selectedArticle).length > 1 && (
                  <>
                    <button type="button" onClick={() => setSelectedImageIndex((index) => (index - 1 + getArticleImages(selectedArticle).length) % getArticleImages(selectedArticle).length)} className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/70 text-white hover:bg-black" aria-label="Gambar sebelumnya"><ChevronLeft className="h-5 w-5" /></button>
                    <button type="button" onClick={() => setSelectedImageIndex((index) => (index + 1) % getArticleImages(selectedArticle).length)} className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/70 text-white hover:bg-black" aria-label="Gambar berikutnya"><ChevronRight className="h-5 w-5" /></button>
                    <span className="absolute bottom-3 right-3 rounded bg-black/70 px-2 py-1 text-xs font-semibold text-white">{selectedImageIndex + 1} / {getArticleImages(selectedArticle).length}</span>
                  </>
                )}
              </div>
            )}
            <div className="px-6 py-8 sm:px-12 sm:py-12">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-zinc-400">
                <span className="text-red-700">{selectedArticle.category}</span>
                <span>{formatDate(selectedArticle.publishedAt || selectedArticle.created_at)}</span>
                <span>{selectedArticle.readTime || getReadingMinutes(selectedArticle.content)} menit membaca</span>
              </div>
              <h2 className="mt-5 font-serif text-3xl font-semibold leading-tight tracking-tight text-stone-950 sm:text-5xl">{selectedArticle.title}</h2>
              <p className="mt-5 border-l-2 border-red-600 pl-5 text-base leading-8 text-stone-600 sm:text-lg">{selectedArticle.excerpt}</p>
              {selectedArticle.motorModel && <p className="mt-5 rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-700"><strong>Model yang diulas:</strong> {selectedArticle.motorModel}</p>}
              {selectedArticle.productFacts && <p className="mt-4 whitespace-pre-line rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-700">{selectedArticle.productFacts}</p>}
              {selectedArticle.promoPeriod && <p className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800"><strong>Periode promo:</strong> {selectedArticle.promoPeriod}</p>}
              {selectedArticle.faqItems && <section className="mt-7 rounded-2xl border border-stone-200 bg-stone-50 p-5"><h3 className="font-serif text-xl font-semibold text-stone-900">Pertanyaan yang sering diajukan</h3><div className="mt-3 space-y-2 whitespace-pre-line text-sm leading-7 text-stone-700">{selectedArticle.faqItems}</div></section>}
              <div className="mt-8 space-y-5 text-sm leading-8 text-stone-700 sm:text-base sm:leading-9">
                {selectedArticle.content.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => <p key={`${selectedArticle.id}-${index}`}>{paragraph}</p>)}
              </div>
              {getVideoDetails(selectedArticle) && (
                <section className="mt-10 border-t border-stone-200 pt-8" aria-label="Video artikel">
                  <h3 className="mb-4 font-serif text-2xl font-semibold text-stone-950">Video artikel</h3>
                  <div className="overflow-hidden rounded-2xl bg-stone-950 shadow-lg">
                    {getVideoDetails(selectedArticle)?.kind === 'youtube' ? (
                      <div className="relative aspect-video">
                        <iframe
                          src={getVideoDetails(selectedArticle)?.url}
                          title={`Video: ${selectedArticle.title}`}
                          className="absolute inset-0 h-full w-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          referrerPolicy="strict-origin-when-cross-origin"
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <video
                        src={getVideoDetails(selectedArticle)?.url}
                        poster={getVideoDetails(selectedArticle)?.poster}
                        controls
                        playsInline
                        preload="metadata"
                        className="max-h-[34rem] w-full"
                        aria-label={`Video artikel: ${selectedArticle.title}`}
                      />
                    )}
                  </div>
                  {selectedArticle.videoMedia?.transcript && (
                    <details className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
                      <summary className="cursor-pointer text-sm font-semibold text-stone-800">Baca transkrip video</summary>
                      <p className="mt-3 whitespace-pre-line text-sm leading-7 text-stone-600">{selectedArticle.videoMedia.transcript}</p>
                    </details>
                  )}
                </section>
              )}
              {selectedArticle.sourceUrl && isHttpUrl(selectedArticle.sourceUrl) && <p className="mt-6 text-xs text-stone-500">Referensi: <a href={selectedArticle.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-red-700 underline">Sumber informasi</a></p>}
              {selectedArticle.whatsappCta && (
                <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <p className="text-sm font-semibold leading-6 text-emerald-950">{selectedArticle.whatsappCta}</p>
                  {whatsappDigits.length >= 8 && whatsappDigits.length <= 15 && (
                    <a href={`https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Saya ingin bertanya tentang: ${selectedArticle.title}`)}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800">Hubungi via WhatsApp</a>
                  )}
                </div>
              )}
              <p className="mt-10 border-t border-stone-200 pt-6 text-xs font-semibold tracking-wide text-stone-500">Ditulis oleh {selectedArticle.author}</p>
            </div>
          </article>
        </div>
      )}
    </>
  );
}
