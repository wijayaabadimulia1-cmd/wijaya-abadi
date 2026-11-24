import React, { useEffect, useRef, useState } from 'react';
import { Edit2, FileText, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import type { Article } from '../types';
import { api } from '../services/api';
import { MAX_MOTOR_IMAGES } from '../constants';
import {
  CATALOG_ANIMATION_OPTIONS,
  DEFAULT_CATALOG_ANIMATION,
  DEFAULT_CATALOG_ANIMATION_SPEED,
  MAX_CATALOG_ANIMATION_SPEED,
  MIN_CATALOG_ANIMATION_SPEED,
  normalizeCatalogAnimationSpeed,
} from '../catalogAnimation';
import { ARTICLE_THEMES, DEFAULT_ARTICLE_THEME, getArticleTheme, isArticleThemeId } from '../data/articleThemes';

function slugifyArticle(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('id-ID')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/g, '');
}

function getArticleImages(article: Partial<Article>) {
  const images = article.images?.filter(Boolean) || [];
  const thumbnail = article.thumbnail || article.image;
  return images.length ? images : thumbnail ? [thumbnail] : [];
}

function getTodayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getEstimatedReadTime(content: string) {
  const wordCount = content.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(wordCount / 200))} Menit Baca`;
}

interface ArticleManagerProps {
  onRefreshData: () => void | Promise<void>;
}

export function ArticleManager({ onRefreshData }: ArticleManagerProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [editingArticle, setEditingArticle] = useState<Partial<Article> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const imagesInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const selectedTheme = getArticleTheme(editingArticle?.theme || DEFAULT_ARTICLE_THEME);

  const loadArticles = async () => {
    setIsLoading(true);
    try {
      setArticles(await api.getAdminArticles());
      setErrorMessage(null);
    } catch (error: any) {
      setErrorMessage(error.message || 'Gagal mengambil artikel.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadArticles();
  }, []);

  const openNewArticle = () => {
    setErrorMessage(null);
    setIsSlugManuallyEdited(false);
    setEditingArticle({
      title: '',
      slug: '',
      category: 'Tips Berkendara',
      excerpt: '',
      metaDescription: '',
      content: '',
      publishedAt: getTodayDate(),
      readTime: '',
      thumbnail: '',
      image: '',
      images: [],
      video: '',
      sourceUrl: '',
      theme: DEFAULT_ARTICLE_THEME,
      animation: DEFAULT_CATALOG_ANIMATION,
      animationSpeed: DEFAULT_CATALOG_ANIMATION_SPEED,
      author: 'Honda Wijaya Abadi',
      published: true,
    });
  };

  const handleUploadImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);
    if (!editingArticle || !files.length) return;

    const currentImages = getArticleImages(editingArticle);
    const availableSlots = MAX_MOTOR_IMAGES - currentImages.length;
    if (files.length > availableSlots) {
      setErrorMessage(`Maksimal ${MAX_MOTOR_IMAGES} gambar per artikel. Tersisa ${availableSlots} slot.`);
      input.value = '';
      return;
    }
    if (files.some((file) => !file.type.startsWith('image/'))) {
      setErrorMessage('Pilih file gambar yang valid.');
      input.value = '';
      return;
    }

    setIsUploadingImages(true);
    setErrorMessage(null);
    try {
      const uploadedImages = await Promise.all(files.map((file) => api.uploadImage(file)));
      setEditingArticle((current) => current ? { ...current, images: [...getArticleImages(current), ...uploadedImages], image: current.image || uploadedImages[0] } : current);
      setNotice(`${uploadedImages.length} gambar berhasil diunggah.`);
    } catch (error: any) {
      setErrorMessage(`Gagal mengunggah gambar: ${error.message}`);
    } finally {
      setIsUploadingImages(false);
      input.value = '';
    }
  };

  const handleUploadVideo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!editingArticle || !file) return;

    setIsUploadingVideo(true);
    setErrorMessage(null);
    try {
      const video = await api.uploadArticleVideo(file);
      setEditingArticle((current) => current ? { ...current, video } : current);
      setNotice('Video artikel berhasil diunggah.');
    } catch (error: any) {
      setErrorMessage(`Gagal mengunggah video: ${error.message}`);
    } finally {
      setIsUploadingVideo(false);
      input.value = '';
    }
  };

  const handleSaveArticle = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingArticle) return;

    const articleData = {
      ...editingArticle,
      slug: slugifyArticle(editingArticle.slug || editingArticle.title || ''),
      metaDescription: String(editingArticle.metaDescription ?? editingArticle.excerpt ?? '').trim(),
      excerpt: String(editingArticle.metaDescription ?? editingArticle.excerpt ?? '').trim(),
      publishedAt: editingArticle.publishedAt || getTodayDate(),
      readTime: editingArticle.readTime?.trim() || getEstimatedReadTime(editingArticle.content || ''),
      thumbnail: editingArticle.thumbnail || editingArticle.image || getArticleImages(editingArticle)[0] || '',
      image: editingArticle.thumbnail || editingArticle.image || getArticleImages(editingArticle)[0] || '',
      images: (() => {
        const thumbnail = editingArticle.thumbnail || editingArticle.image;
        const images = getArticleImages(editingArticle);
        return thumbnail ? [thumbnail, ...images.filter((image) => image !== thumbnail)] : images;
      })(),
      animation: editingArticle.animation || DEFAULT_CATALOG_ANIMATION,
      animationSpeed: normalizeCatalogAnimationSpeed(editingArticle.animationSpeed ?? DEFAULT_CATALOG_ANIMATION_SPEED),
    };
    if (!articleData.title?.trim() || !articleData.slug || !articleData.metaDescription || !articleData.category?.trim() || !articleData.author?.trim() || !articleData.publishedAt || !articleData.readTime || !articleData.content?.trim()) {
      setErrorMessage('Judul, slug, meta description, kategori, penulis, tanggal terbit, waktu baca, dan isi artikel wajib diisi.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      if (articleData.id) await api.updateArticle(articleData.id, articleData);
      else await api.createArticle(articleData);
      setEditingArticle(null);
      setNotice('Artikel berhasil disimpan.');
      await loadArticles();
      await onRefreshData();
    } catch (error: any) {
      setErrorMessage(error.message || 'Gagal menyimpan artikel.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteArticle = async (article: Article) => {
    if (!window.confirm(`Hapus artikel "${article.title}"?`)) return;
    try {
      await api.deleteArticle(article.id);
      setArticles((current) => current.filter((item) => item.id !== article.id));
      setNotice('Artikel berhasil dihapus.');
    } catch (error: any) {
      setErrorMessage(error.message || 'Gagal menghapus artikel.');
    }
  };

  const updateCover = (cover: string) => {
    setEditingArticle((current) => {
      if (!current) return current;
      const images = getArticleImages(current);
      return { ...current, image: cover, thumbnail: cover, images: [cover, ...images.filter((image) => image !== cover)] };
    });
  };

  const removeImage = (indexToRemove: number) => {
    setEditingArticle((current) => {
      if (!current) return current;
      const images = getArticleImages(current).filter((_, index) => index !== indexToRemove);
      return { ...current, images, image: images[0] || '', thumbnail: images[0] || '' };
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Artikel</h2>
          <p className="text-xs text-zinc-400">Kelola artikel website. SEO Post tetap dikelola terpisah di menu Post SEO.</p>
        </div>
        <button type="button" onClick={openNewArticle} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500">
          <Plus className="h-4 w-4" /> Tulis Artikel
        </button>
      </div>

      {(errorMessage || notice) && (
        <div role="status" className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${errorMessage ? 'border-red-500/30 bg-red-950/30 text-red-200' : 'border-emerald-500/20 bg-emerald-950/20 text-emerald-200'}`}>
          <span>{errorMessage || notice}</span>
          <button type="button" onClick={() => { setErrorMessage(null); setNotice(null); }} className="grid h-7 w-7 shrink-0 place-items-center rounded text-current/70 hover:bg-white/10" aria-label="Tutup pemberitahuan"><X className="h-4 w-4" /></button>
        </div>
      )}

      {isLoading ? (
        <div className="py-16 text-center text-sm text-zinc-400">Memuat artikel...</div>
      ) : articles.length ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {articles.map((article) => (
            <article key={article.id} className="flex min-w-0 gap-4 rounded-lg border border-white/10 bg-zinc-900/50 p-4">
              {getArticleImages(article)[0] ? <img src={getArticleImages(article)[0]} alt="" className="h-20 w-24 shrink-0 rounded-md bg-zinc-950 object-cover" /> : <div className="grid h-20 w-24 shrink-0 place-items-center rounded-md bg-red-950/50 text-red-400"><FileText className="h-6 w-6" /></div>}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${article.published ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>{article.published ? 'Terbit' : 'Draf'}</span>
                  <span className="text-[10px] text-zinc-500">{article.category}</span>
                  <span className="text-[10px] text-zinc-500">/{article.slug}</span>
                </div>
                <h3 className="mt-2 truncate text-sm font-bold text-white">{article.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">{article.metaDescription || article.excerpt}</p>
                <div className="mt-3 flex items-center justify-end gap-3">
                  <button type="button" onClick={() => { setErrorMessage(null); setIsSlugManuallyEdited(true); setEditingArticle({ ...article, metaDescription: article.metaDescription || article.excerpt, publishedAt: article.publishedAt || article.created_at?.slice(0, 10) || getTodayDate(), thumbnail: article.thumbnail || article.image, images: getArticleImages(article) }); }} className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-300 hover:text-white" aria-label={`Edit ${article.title}`}><Edit2 className="h-3.5 w-3.5" /> Edit</button>
                  <button type="button" onClick={() => void handleDeleteArticle(article)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-300" aria-label={`Hapus ${article.title}`}><Trash2 className="h-3.5 w-3.5" /> Hapus</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-white/15 px-5 py-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-zinc-500" />
          <p className="mt-3 text-sm font-semibold text-zinc-300">Belum ada artikel</p>
          <p className="mt-1 text-xs text-zinc-500">Artikel terbit akan tampil di website. Post SEO tidak masuk ke daftar ini.</p>
        </div>
      )}

      {editingArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-5">
          <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-white/15 bg-zinc-950 p-5 text-xs shadow-2xl sm:p-7">
            <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">{editingArticle.id ? 'Edit Artikel' : 'Tulis Artikel'}</h3>
                <p className="mt-1 text-[11px] text-zinc-500">Artikel ini tersimpan terpisah dari SEO Post.</p>
              </div>
              <button type="button" onClick={() => setEditingArticle(null)} className="grid h-9 w-9 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-900 hover:text-white" aria-label="Tutup formulir"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSaveArticle} className="space-y-4">
              <label className="block space-y-1.5 font-semibold text-zinc-300">
                Judul artikel *
                <input required value={editingArticle.title || ''} onChange={(event) => setEditingArticle({ ...editingArticle, title: event.target.value, ...(!isSlugManuallyEdited ? { slug: slugifyArticle(event.target.value) } : {}) })} className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none" placeholder="Contoh: Panduan memilih motor untuk kebutuhan harian" />
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5 font-semibold text-zinc-300">Slug URL *<input required value={editingArticle.slug || ''} onChange={(event) => { setIsSlugManuallyEdited(true); setEditingArticle({ ...editingArticle, slug: slugifyArticle(event.target.value) }); }} className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none" /></label>
                <label className="block space-y-1.5 font-semibold text-zinc-300">Kategori<input value={editingArticle.category || ''} onChange={(event) => setEditingArticle({ ...editingArticle, category: event.target.value })} className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none" placeholder="Tips Berkendara" /></label>
              </div>
              <label className="block space-y-1.5 font-semibold text-zinc-300">Meta description *<textarea required rows={2} maxLength={320} value={editingArticle.metaDescription ?? editingArticle.excerpt ?? ''} onChange={(event) => setEditingArticle({ ...editingArticle, metaDescription: event.target.value, excerpt: event.target.value })} className="w-full resize-y rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none" placeholder="Deskripsi singkat yang menjelaskan isi artikel untuk Google dan media sosial." /></label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5 font-semibold text-zinc-300">Penulis *<input required value={editingArticle.author || ''} onChange={(event) => setEditingArticle({ ...editingArticle, author: event.target.value })} className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none" /></label>
                <label className="block space-y-1.5 font-semibold text-zinc-300">Tanggal terbit *<input required type="date" value={editingArticle.publishedAt || editingArticle.created_at?.slice(0, 10) || getTodayDate()} onChange={(event) => setEditingArticle({ ...editingArticle, publishedAt: event.target.value })} className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none" /></label>
                <label className="block space-y-1.5 font-semibold text-zinc-300">Waktu baca *<input value={editingArticle.readTime || ''} onChange={(event) => setEditingArticle({ ...editingArticle, readTime: event.target.value })} className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none" placeholder="4 Menit Baca (kosongkan untuk hitung otomatis)" /></label>
                <label className="block space-y-1.5 font-semibold text-zinc-300">Thumbnail / foto sampul URL<input value={editingArticle.thumbnail || editingArticle.image || ''} onChange={(event) => setEditingArticle((current) => { if (!current) return current; const thumbnail = event.target.value; return { ...current, thumbnail, image: thumbnail, images: thumbnail ? [thumbnail, ...getArticleImages(current).filter((image) => image !== thumbnail)] : getArticleImages(current) }; })} className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none" placeholder="https://domain.com/foto.jpg atau unggah dari Galeri artikel" /></label>
              </div>
              <label className="block space-y-1.5 font-semibold text-zinc-300">Isi artikel *<textarea required rows={10} value={editingArticle.content || ''} onChange={(event) => setEditingArticle({ ...editingArticle, content: event.target.value })} className="w-full resize-y rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm leading-6 text-white focus:border-red-500 focus:outline-none" placeholder={'Gunakan struktur HTML artikel: <p class="lead">...</p>, <h2>...</h2>, <p>...</p>, <ul><li>...</li></ul>.'} /></label>

              <section className="space-y-3 rounded-lg border border-white/10 bg-zinc-900/50 p-4">
                <label className="block space-y-1.5 font-semibold text-zinc-300">
                  Tema tampilan artikel
                  <select
                    value={selectedTheme.id}
                    onChange={(event) => setEditingArticle((current) => current ? {
                      ...current,
                      theme: isArticleThemeId(event.target.value) ? event.target.value : DEFAULT_ARTICLE_THEME,
                    } : current)}
                    className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none"
                  >
                    {ARTICLE_THEMES.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
                  </select>
                </label>
                <p className="text-[11px] leading-5 text-zinc-400">Tema ini diterapkan pada halaman publik artikel setelah disimpan.</p>
                <div className={`rounded-lg border p-4 ${selectedTheme.wrapper}`}>
                  <div className={`rounded-lg border p-3 text-sm shadow-sm ${selectedTheme.card}`}>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-600">{selectedTheme.name}</span>
                    <h4 className="mt-2 font-bold">{editingArticle.title || 'Judul artikel'}</h4>
                    <p className="mt-1 text-xs opacity-70">Pratinjau warna latar dan kartu tema terpilih.</p>
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-lg border border-white/10 bg-zinc-900/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h4 className="font-bold text-white">Galeri artikel</h4><p className="mt-1 text-[11px] text-zinc-400">Unggah hingga {MAX_MOTOR_IMAGES} gambar; gambar pertama menjadi thumbnail/sampul.</p></div>
                  <button type="button" disabled={isUploadingImages || getArticleImages(editingArticle).length >= MAX_MOTOR_IMAGES} onClick={() => imagesInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"><Upload className="h-4 w-4" />{isUploadingImages ? 'Mengunggah...' : 'Unggah gambar'}</button>
                  <input ref={imagesInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUploadImages} />
                </div>
                {getArticleImages(editingArticle).length ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {getArticleImages(editingArticle).map((image, index) => (
                      <div key={`${image}-${index}`} className="relative overflow-hidden rounded-md border border-white/10">
                        <img src={image} alt={`Gambar artikel ${index + 1}`} className="aspect-[4/3] w-full object-cover" />
                        <button type="button" onClick={() => updateCover(image)} className="absolute bottom-2 left-2 rounded bg-black/75 px-2 py-1 text-[10px] font-bold text-white hover:bg-black">{index === 0 ? 'Sampul' : 'Jadikan sampul'}</button>
                        <button type="button" onClick={() => removeImage(index)} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/75 text-white hover:bg-red-700" aria-label={`Hapus gambar ${index + 1}`}><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                ) : <p className="border border-dashed border-white/15 px-3 py-5 text-center text-xs text-zinc-500">Belum ada gambar yang diunggah.</p>}
              </section>

              <section className="space-y-3 rounded-lg border border-white/10 bg-zinc-900/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h4 className="font-bold text-white">Video artikel (opsional)</h4><p className="mt-1 text-[11px] text-zinc-400">Unggah satu video MP4 atau WebM, maksimal 100 MB.</p></div>
                  <button type="button" disabled={isUploadingVideo} onClick={() => videoInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"><Upload className="h-4 w-4" />{isUploadingVideo ? 'Mengunggah...' : editingArticle.video ? 'Ganti video' : 'Unggah video'}</button>
                  <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,.mp4,.webm" className="hidden" onChange={handleUploadVideo} />
                </div>
                {editingArticle.video ? (
                  <div className="space-y-2">
                    <video src={editingArticle.video} controls preload="metadata" playsInline className="max-h-80 w-full rounded-md bg-black" aria-label="Pratinjau video artikel" />
                    <button type="button" onClick={() => setEditingArticle((current) => current ? { ...current, video: '' } : current)} className="text-xs font-semibold text-red-400 hover:text-red-300">Hapus video</button>
                  </div>
                ) : <p className="border border-dashed border-white/15 px-3 py-5 text-center text-xs text-zinc-500">Belum ada video yang diunggah.</p>}
              </section>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5 font-semibold text-zinc-300">Animasi gambar<select value={editingArticle.animation || DEFAULT_CATALOG_ANIMATION} onChange={(event) => setEditingArticle({ ...editingArticle, animation: event.target.value as Article['animation'] })} className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none">{CATALOG_ANIMATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              </div>
              <label className="block space-y-1.5 font-semibold text-zinc-300">Tautan sumber asli (opsional)<input type="url" value={editingArticle.sourceUrl || ''} onChange={(event) => setEditingArticle({ ...editingArticle, sourceUrl: event.target.value })} className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none" placeholder="https://situs-pemilik-artikel.id/artikel" /></label>
              <label className="block space-y-1.5 font-semibold text-zinc-300">Kecepatan animasi<span className="flex items-center gap-3 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5"><input type="range" min={MIN_CATALOG_ANIMATION_SPEED} max={MAX_CATALOG_ANIMATION_SPEED} step={1} value={normalizeCatalogAnimationSpeed(editingArticle.animationSpeed ?? DEFAULT_CATALOG_ANIMATION_SPEED)} onChange={(event) => setEditingArticle({ ...editingArticle, animationSpeed: Number(event.target.value) })} className="min-w-0 flex-1 accent-red-600" /><output className="w-12 text-right tabular-nums text-white">{normalizeCatalogAnimationSpeed(editingArticle.animationSpeed ?? DEFAULT_CATALOG_ANIMATION_SPEED)} dtk</output></span></label>
              <label className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-zinc-900/70 px-3 py-3 font-semibold text-zinc-200"><input type="checkbox" checked={editingArticle.published === true} onChange={(event) => setEditingArticle({ ...editingArticle, published: event.target.checked })} className="h-4 w-4 accent-red-600" />Terbitkan artikel di website</label>
              <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
                <button type="button" onClick={() => setEditingArticle(null)} className="rounded-lg border border-white/10 px-4 py-2.5 font-semibold text-zinc-300 hover:bg-zinc-900">Batal</button>
                <button type="submit" disabled={isSaving || isUploadingImages || isUploadingVideo} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 font-bold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-4 w-4" />{isSaving ? 'Menyimpan...' : 'Simpan Artikel'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
