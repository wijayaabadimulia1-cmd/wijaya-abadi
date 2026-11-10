import React, { useState } from 'react';
import { ArrowRight, BookOpen, CalendarDays, ChevronLeft, ChevronRight, Clock3, X } from 'lucide-react';
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
    : date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getImageStyle(article: Article): React.CSSProperties {
  return {
    '--catalog-animation-duration': `${Math.min((article.animationSpeed || DEFAULT_CATALOG_ANIMATION_SPEED) * 0.3, 3)}s`,
  } as React.CSSProperties;
}

export function ArticleSection({ articles }: ArticleSectionProps) {
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const visibleArticles = articles.filter((article) => article.published);

  if (!visibleArticles.length) return null;

  return (
    <>
      <section id="artikel" className="relative border-y border-white/10 bg-zinc-950 py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 border-b border-white/10 pb-7 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase text-red-400">
                <BookOpen className="h-4 w-4" />
                Wawasan &amp; Panduan
              </div>
              <h2 className="text-3xl font-black text-white sm:text-4xl">Artikel seputar Honda</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">Panduan memilih motor, memahami pembelian, dan merawat kendaraan untuk perjalanan sehari-hari.</p>
            </div>
            <span className="text-sm font-semibold text-zinc-400">{visibleArticles.length} artikel</span>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visibleArticles.map((article, index) => {
              const coverImage = getArticleImages(article)[0];
              return (
                <article key={article.id} className={`group flex min-w-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-zinc-900/60 ${index === 0 ? 'md:col-span-2 lg:row-span-2' : ''}`}>
                  <button type="button" onClick={() => { setSelectedArticle(article); setSelectedImageIndex(0); }} className="flex h-full flex-col text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500" aria-label={`Baca artikel ${article.title}`}>
                    {coverImage ? (
                      <div className={`overflow-hidden bg-black ${index === 0 ? 'aspect-[16/8]' : 'aspect-[16/9]'}`}>
                        <img src={coverImage} alt={article.title} loading="lazy" decoding="async" className="catalog-photo-animation h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" data-catalog-animation={article.animation || DEFAULT_CATALOG_ANIMATION} style={getImageStyle(article)} />
                      </div>
                    ) : (
                      <div className={`flex items-end justify-between bg-gradient-to-br from-red-950 via-zinc-900 to-zinc-950 p-5 ${index === 0 ? 'aspect-[16/8]' : 'aspect-[16/9]'}`}>
                        <span className="text-5xl font-black text-white/10">{String(index + 1).padStart(2, '0')}</span>
                        <BookOpen className="h-8 w-8 text-red-500/70" aria-hidden="true" />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-5 sm:p-6">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-semibold text-zinc-400">
                        <span className="text-red-400">{article.category || 'Panduan'}</span>
                        <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(article.created_at)}</span>
                        <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{getReadingMinutes(article.content)} menit</span>
                      </div>
                      <h3 className={`mt-3 font-bold leading-snug text-white group-hover:text-red-400 ${index === 0 ? 'text-2xl sm:text-3xl' : 'text-lg'}`}>{article.title}</h3>
                      <p className={`mt-2 text-sm leading-6 text-zinc-400 ${index === 0 ? 'line-clamp-4' : 'line-clamp-3'}`}>{article.excerpt}</p>
                      <span className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-red-400">Baca artikel <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
                    </div>
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {selectedArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedArticle(null); }}>
          <article className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-white/10 bg-zinc-950 text-zinc-100 shadow-2xl">
            <button type="button" onClick={() => setSelectedArticle(null)} className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/70 text-white hover:bg-black" aria-label="Tutup artikel"><X className="h-5 w-5" /></button>
            {getArticleImages(selectedArticle).length > 0 && (
              <div className="relative aspect-[16/9] max-h-80 overflow-hidden bg-black">
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
