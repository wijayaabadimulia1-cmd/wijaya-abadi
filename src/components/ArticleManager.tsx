import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock3,
  Edit2,
  Eye,
  FileText,
  LayoutDashboard,
  Loader2,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import type { Article, ArticleAnalytics, ArticleTemplate, ArticleVideo } from '../types';
import { api } from '../services/api';
import { MAX_MOTOR_IMAGES } from '../constants';
import {
  CATALOG_ANIMATION_OPTIONS,
  DEFAULT_CATALOG_ANIMATION,
  DEFAULT_CATALOG_ANIMATION_SPEED,
  normalizeCatalogAnimationSpeed,
} from '../catalogAnimation';
import { getYouTubeEmbedUrl, getYouTubeVideoId, isHttpUrl } from '../utils/articleVideo';

const ARTICLE_TEMPLATES: Array<{ value: ArticleTemplate; label: string; category: string }> = [
  { value: 'blog', label: 'Blog', category: 'Artikel' },
  { value: 'news', label: 'Berita', category: 'Berita Honda' },
  { value: 'guide', label: 'Panduan', category: 'Panduan' },
  { value: 'review', label: 'Review', category: 'Review Motor' },
  { value: 'promotion', label: 'Promo', category: 'Promo Honda' },
  { value: 'faq', label: 'FAQ', category: 'FAQ' },
  { value: 'listicle', label: 'Listicle', category: 'Tips Berkendara' },
  { value: 'video', label: 'Video Article', category: 'Video Honda' },
];

const inputClass = 'w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10';
const labelClass = 'block space-y-1.5 text-sm font-semibold text-stone-700';
const emptyAnalytics: ArticleAnalytics = { totalReaders: 0, readersBySlug: {} };

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
  return images.length ? images : article.image ? [article.image] : [];
}

function getTemplateLabel(template?: string) {
  return ARTICLE_TEMPLATES.find((item) => item.value === template)?.label || 'Blog';
}

function getVideoPreview(article: Partial<Article>) {
  const media = article.videoMedia;
  if (media?.source === 'youtube') {
    const url = getYouTubeEmbedUrl(media.youtubeUrl);
    return url ? { kind: 'youtube' as const, url } : null;
  }
  if (media?.source === 'upload' && media.videoUrl) return { kind: 'file' as const, url: media.videoUrl };

  const legacyVideo = article.video || '';
  const youtubeUrl = getYouTubeEmbedUrl(legacyVideo);
  if (youtubeUrl) return { kind: 'youtube' as const, url: youtubeUrl };
  if (/\.mp4(?:[?#].*)?$/i.test(legacyVideo) && (legacyVideo.startsWith('/') || isHttpUrl(legacyVideo))) {
    return { kind: 'file' as const, url: legacyVideo };
  }
  return null;
}

interface ArticleManagerProps {
  onRefreshData: () => void | Promise<void>;
}

export function ArticleManager({ onRefreshData }: ArticleManagerProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [analytics, setAnalytics] = useState<ArticleAnalytics>(emptyAnalytics);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [editingArticle, setEditingArticle] = useState<Partial<Article> | null>(null);
  const [activeView, setActiveView] = useState<'dashboard' | 'edit'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [aiSourceText, setAiSourceText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const imagesInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const loadArticles = async () => {
    setIsLoading(true);
    const [articleResult, analyticsResult, aiStatusResult] = await Promise.allSettled([
      api.getAdminArticles(),
      api.getArticleAnalytics(),
      api.getArticleAiStatus(),
    ]);

    if (articleResult.status === 'fulfilled') {
      setArticles(articleResult.value);
      setErrorMessage(null);
    } else {
      setErrorMessage(articleResult.reason instanceof Error ? articleResult.reason.message : 'Gagal mengambil daftar artikel.');
    }

    if (analyticsResult.status === 'fulfilled') {
      setAnalytics(analyticsResult.value);
      setAnalyticsError(null);
    } else {
      setAnalytics(emptyAnalytics);
      setAnalyticsError('Data pembaca artikel belum dapat dimuat.');
    }

    if (aiStatusResult.status === 'fulfilled') setAiConfigured(aiStatusResult.value.configured);
    else setAiConfigured(null);
    setIsLoading(false);
  };

  useEffect(() => {
    void loadArticles();
  }, []);

  const openNewArticle = () => {
    setErrorMessage(null);
    setIsSlugManuallyEdited(false);
    setAiSourceText('');
    setIsPreviewing(false);
    setActiveView('edit');
    setEditingArticle({
      title: '',
      slug: '',
      category: 'Artikel',
      excerpt: '',
      content: '',
      template: 'blog',
      images: [],
      animation: DEFAULT_CATALOG_ANIMATION,
      animationSpeed: DEFAULT_CATALOG_ANIMATION_SPEED,
      author: 'Honda Wijaya Abadi Mulia',
      published: false,
      readTime: 5,
    });
  };

  const openEditArticle = (article: Article) => {
    setErrorMessage(null);
    setIsSlugManuallyEdited(true);
    setAiSourceText(article.videoMedia?.transcript || '');
    setIsPreviewing(false);
    setActiveView('edit');
    setEditingArticle({ ...article, images: getArticleImages(article) });
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
      setEditingArticle((current) => current ? {
        ...current,
        images: [...getArticleImages(current), ...uploadedImages],
        image: current.image || uploadedImages[0],
      } : current);
      setNotice(`${uploadedImages.length} gambar berhasil diunggah.`);
    } catch (error) {
      setErrorMessage(`Gagal mengunggah gambar: ${error instanceof Error ? error.message : 'Kesalahan tidak diketahui.'}`);
    } finally {
      setIsUploadingImages(false);
      input.value = '';
    }
  };

  const handleUploadVideo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || !editingArticle) return;
    setIsUploadingVideo(true);
    setErrorMessage(null);
    try {
      const videoUrl = await api.uploadArticleVideo(file);
      setEditingArticle((current) => current ? {
        ...current,
        template: 'video',
        videoMedia: {
          ...current.videoMedia,
          source: 'upload',
          videoUrl,
        },
      } : current);
      setNotice('Video MP4 berhasil diunggah.');
    } catch (error) {
      setErrorMessage(`Gagal mengunggah video: ${error instanceof Error ? error.message : 'Kesalahan tidak diketahui.'}`);
    } finally {
      setIsUploadingVideo(false);
      input.value = '';
    }
  };

  const updateVideoMedia = (patch: Partial<ArticleVideo>) => {
    setEditingArticle((current) => current ? {
      ...current,
      videoMedia: {
        source: current.videoMedia?.source || 'youtube',
        ...current.videoMedia,
        ...patch,
      },
    } : current);
  };

  const handleGenerateAiDraft = async () => {
    if (!editingArticle) return;
    if (aiConfigured !== true) {
      setErrorMessage('AI Writer belum dikonfigurasi. Admin server perlu mengatur GEMINI_API_KEY.');
      return;
    }
    if (aiSourceText.trim().length < 20) {
      setErrorMessage('Masukkan transkrip atau catatan sumber minimal 20 karakter. URL YouTube saja tidak menyediakan transkrip.');
      return;
    }

    setIsGeneratingAi(true);
    setErrorMessage(null);
    try {
      const draft = await api.generateArticleDraft({
        sourceText: aiSourceText.trim(),
        template: editingArticle.template || 'blog',
        title: editingArticle.title || undefined,
      });
      setEditingArticle((current) => current ? {
        ...current,
        ...draft,
        slug: current.slug || slugifyArticle(draft.title),
      } : current);
      setNotice('Draf AI siap ditinjau dan diedit sebelum disimpan.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'AI Writer gagal membuat draf.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const saveArticle = async (published: boolean) => {
    if (!editingArticle) return;
    const articleData: Partial<Article> = {
      ...editingArticle,
      title: editingArticle.title?.trim(),
      slug: slugifyArticle(editingArticle.slug || editingArticle.title || ''),
      excerpt: editingArticle.excerpt?.trim(),
      content: editingArticle.content?.trim(),
      images: getArticleImages(editingArticle),
      videoMedia: editingArticle.videoMedia ?? null,
      animation: editingArticle.animation || DEFAULT_CATALOG_ANIMATION,
      animationSpeed: normalizeCatalogAnimationSpeed(editingArticle.animationSpeed ?? DEFAULT_CATALOG_ANIMATION_SPEED),
      published,
    };

    if (!articleData.title || !articleData.slug || !articleData.excerpt || !articleData.content) {
      setErrorMessage('Judul, slug, ringkasan, dan isi artikel wajib diisi.');
      setIsPreviewing(false);
      return;
    }
    if (articleData.template === 'video') {
      const videoMedia = articleData.videoMedia;
      const hasLegacyVideo = Boolean(articleData.video && getVideoPreview(articleData));
      const validVideo = videoMedia?.source === 'youtube'
        ? Boolean(getYouTubeVideoId(videoMedia.youtubeUrl))
        : videoMedia?.source === 'upload'
          ? Boolean(videoMedia.videoUrl?.startsWith('/article-media/'))
          : hasLegacyVideo;
      if (!validVideo) {
        setErrorMessage('Tambahkan URL YouTube yang valid atau unggah video MP4 sebelum menyimpan Video Article.');
        return;
      }
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      if (articleData.id) await api.updateArticle(articleData.id, articleData);
      else await api.createArticle(articleData);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Gagal menyimpan artikel.');
      setIsSaving(false);
      return;
    }
    setIsSaving(false);
    setEditingArticle(null);
    setIsPreviewing(false);
    setNotice(published ? 'Artikel berhasil dipublikasikan.' : 'Artikel berhasil disimpan sebagai draft.');
    await loadArticles();
    try {
      await onRefreshData();
    } catch {
      setErrorMessage('Artikel tersimpan, tetapi tampilan website belum berhasil diperbarui. Muat ulang data website.');
    }
  };

  const handleDeleteArticle = async (article: Article) => {
    if (!window.confirm(`Hapus artikel "${article.title}"? Artikel yang terbit tidak lagi tampil di website.`)) return;
    try {
      await api.deleteArticle(article.id);
      setArticles((current) => current.filter((item) => item.id !== article.id));
      setNotice('Artikel berhasil dihapus.');
      await loadArticles();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Gagal menghapus artikel.');
      return;
    }
    try {
      await onRefreshData();
    } catch {
      setErrorMessage('Artikel terhapus, tetapi tampilan website belum berhasil diperbarui. Muat ulang data website.');
    }
  };

  const updateCover = (cover: string) => {
    setEditingArticle((current) => {
      if (!current) return current;
      const images = getArticleImages(current);
      return { ...current, image: cover, images: [cover, ...images.filter((image) => image !== cover)] };
    });
  };

  const removeImage = (indexToRemove: number) => {
    setEditingArticle((current) => {
      if (!current) return current;
      const images = getArticleImages(current).filter((_, index) => index !== indexToRemove);
      return { ...current, images, image: images[0] || '' };
    });
  };

  const filteredArticles = articles.filter((article) => {
    const query = searchTerm.trim().toLocaleLowerCase('id-ID');
    const matchesQuery = !query || [article.title, article.slug, article.category].some((value) => value?.toLocaleLowerCase('id-ID').includes(query));
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'published' ? article.published === true : article.published !== true);
    return matchesQuery && matchesStatus;
  });
  const publishedCount = articles.filter((article) => article.published).length;
  const draftCount = articles.length - publishedCount;
  const videoCount = articles.filter((article) => article.template === 'video').length;
  const totalReadCount = Object.values(analytics.readersBySlug).reduce((total, count) => total + count, 0);

  const articleTable = (rows: Article[]) => rows.length ? (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-left text-sm">
        <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
          <tr>
            <th className="px-4 py-3 font-semibold">Judul artikel</th>
            <th className="px-4 py-3 font-semibold">Jenis</th>
            <th className="px-4 py-3 font-semibold">Pembaca</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 text-right font-semibold">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((article) => (
            <tr key={article.id} className="transition hover:bg-red-50/40">
              <td className="max-w-[360px] px-4 py-4">
                <p className="truncate font-semibold text-stone-900">{article.title || 'Tanpa judul'}</p>
                <p className="mt-1 truncate text-xs text-stone-500">/{article.slug}</p>
              </td>
              <td className="px-4 py-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
                  {article.template === 'video' ? <Video className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
                  {getTemplateLabel(article.template)}
                </span>
              </td>
              <td className="px-4 py-4 tabular-nums text-stone-600">{analyticsError ? '—' : analytics.readersBySlug[article.slug] || 0}</td>
              <td className="px-4 py-4">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${article.published ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {article.published ? 'Publish' : 'Draft'}
                </span>
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center justify-end gap-3">
                  {article.published && (
                    <a href={`/artikel/${encodeURIComponent(article.slug)}/`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-red-700" aria-label={`Lihat ${article.title}`}>
                      <Eye className="h-3.5 w-3.5" /> Lihat
                    </a>
                  )}
                  <button type="button" onClick={() => openEditArticle(article)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-900" aria-label={`Edit ${article.title}`}>
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button type="button" onClick={() => void handleDeleteArticle(article)} className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-red-700" aria-label={`Hapus ${article.title}`}>
                    <Trash2 className="h-3.5 w-3.5" /> Hapus
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="px-5 py-12 text-center">
      <FileText className="mx-auto h-9 w-9 text-stone-300" />
      <p className="mt-3 text-sm font-semibold text-stone-700">{articles.length ? 'Tidak ada artikel sesuai filter.' : 'Belum ada artikel di website ini.'}</p>
      <p className="mt-1 text-xs text-stone-500">Buat artikel untuk menampilkan dan mengelola konten domain ini.</p>
    </div>
  );

  return (
    <div className="article-management-studio space-y-6 text-stone-800">
      <header className="flex flex-col gap-5 rounded-3xl bg-gradient-to-r from-red-800 via-red-700 to-red-600 p-6 text-white shadow-lg shadow-red-900/10 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-100">Honda Wijaya Abadi Mulia</p>
          <h2 className="mt-2 font-serif text-2xl font-semibold sm:text-3xl">Honda Article Management Studio</h2>
          <p className="mt-2 text-sm text-red-50">CMS Artikel · Kelola konten khusus untuk website yang sedang dibuka.</p>
        </div>
        <button type="button" onClick={openNewArticle} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-red-800 shadow-sm transition hover:bg-red-50">
          <Plus className="h-4 w-4" /> Tulis Artikel
        </button>
      </header>

      {(errorMessage || notice) && (
        <div role="status" className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${errorMessage ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          <span>{errorMessage || notice}</span>
          <button type="button" onClick={() => { setErrorMessage(null); setNotice(null); }} className="grid h-7 w-7 shrink-0 place-items-center rounded text-current/70 hover:bg-white/70" aria-label="Tutup pemberitahuan"><X className="h-4 w-4" /></button>
        </div>
      )}

      <nav className="flex flex-wrap gap-2 rounded-2xl border border-stone-200 bg-white p-2 shadow-sm" aria-label="Menu Article Management Studio">
        <button type="button" onClick={() => setActiveView('dashboard')} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${activeView === 'dashboard' ? 'bg-red-700 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100'}`}>
          <LayoutDashboard className="h-4 w-4" /> Dashboard
        </button>
        <button type="button" onClick={() => setActiveView('edit')} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${activeView === 'edit' ? 'bg-red-700 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100'}`}>
          <Edit2 className="h-4 w-4" /> Edit Artikel
        </button>
      </nav>

      {isLoading ? (
        <div className="flex min-h-48 items-center justify-center gap-3 rounded-2xl border border-stone-200 bg-white text-sm text-stone-500">
          <Loader2 className="h-5 w-5 animate-spin text-red-700" /> Memuat data artikel...
        </div>
      ) : (
        <>
          {activeView === 'dashboard' && (
            <section className="space-y-6">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                {[
                  { title: 'Semua artikel', value: articles.length, icon: FileText, color: 'text-stone-700', bg: 'bg-stone-100' },
                  { title: 'Published', value: publishedCount, icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                  { title: 'Draft', value: draftCount, icon: Clock3, color: 'text-amber-700', bg: 'bg-amber-50' },
                  { title: 'Video Article', value: videoCount, icon: Video, color: 'text-blue-700', bg: 'bg-blue-50' },
                  { title: 'Pembaca artikel', value: analyticsError ? '—' : totalReadCount, icon: BarChart3, color: 'text-red-700', bg: 'bg-red-50' },
                ].map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <article key={stat.title} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
                      <div className={`grid h-10 w-10 place-items-center rounded-xl ${stat.bg} ${stat.color}`}><Icon className="h-5 w-5" /></div>
                      <p className="mt-4 text-2xl font-bold tabular-nums text-stone-950">{stat.value}</p>
                      <p className="mt-1 text-xs font-medium text-stone-500">{stat.title}</p>
                    </article>
                  );
                })}
              </div>

              <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-stone-200 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-stone-950">Kelola Artikel</h3>
                    <p className="mt-1 text-sm text-stone-500">Daftar dan status artikel · Terintegrasi API</p>
                  </div>
                  <button type="button" onClick={() => setActiveView('edit')} className="text-left text-sm font-semibold text-red-700 hover:text-red-900">Buka menu edit →</button>
                </div>
                {articleTable(articles)}
              </section>
              {analyticsError && <p role="status" className="text-xs text-amber-800">{analyticsError}</p>}

              <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                <h3 className="font-bold text-stone-950">Template Artikel</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {ARTICLE_TEMPLATES.map((template) => (
                    <button key={template.value} type="button" onClick={() => { openNewArticle(); setEditingArticle((current) => current ? { ...current, template: template.value, category: template.category } : current); }} className="article-studio-template rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-800">
                      {template.label}
                    </button>
                  ))}
                </div>
              </section>
            </section>
          )}

          {activeView === 'edit' && (
            <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-stone-200 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-stone-950">Edit Artikel</h3>
                  <p className="mt-1 text-sm text-stone-500">Cari, edit, atau hapus artikel pada website aktif.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                    <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="w-full rounded-xl border border-stone-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-red-500 sm:w-64" placeholder="Cari artikel..." aria-label="Cari artikel" />
                  </label>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-700 outline-none focus:border-red-500" aria-label="Filter status artikel">
                    <option value="all">Semua status</option>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>
              {articleTable(filteredArticles)}
            </section>
          )}
        </>
      )}

      {editingArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/75 p-2 backdrop-blur-sm sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingArticle(null); }}>
          <section className="max-h-[96vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-[#fffefa] shadow-2xl">
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-[#fffefa]/95 px-5 py-4 backdrop-blur sm:px-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-700">Article Management Studio</p>
                <h3 className="mt-1 text-xl font-bold text-stone-950">{editingArticle.id ? 'Edit Artikel' : 'Artikel Baru'}</h3>
              </div>
              <button type="button" onClick={() => setEditingArticle(null)} className="grid h-10 w-10 place-items-center rounded-full text-stone-500 hover:bg-stone-100" aria-label="Tutup editor"><X className="h-5 w-5" /></button>
            </header>

            <form onSubmit={(event) => { event.preventDefault(); void saveArticle(false); }} className="space-y-6 p-5 sm:p-8">
              {isPreviewing ? (
                <section className="mx-auto max-w-3xl rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8" aria-label="Preview artikel">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-stone-500">
                    <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">{getTemplateLabel(editingArticle.template)}</span>
                    <span>{editingArticle.category}</span>
                    <span>·</span>
                    <span>{editingArticle.readTime || 5} menit baca</span>
                  </div>
                  {getArticleImages(editingArticle)[0] && <img src={getArticleImages(editingArticle)[0]} alt="" className="mt-5 aspect-video w-full rounded-xl object-cover" />}
                  <h1 className="mt-6 font-serif text-3xl font-bold leading-tight text-stone-950 sm:text-4xl">{editingArticle.title || 'Judul artikel'}</h1>
                  <p className="mt-4 border-l-4 border-red-600 pl-4 text-base leading-7 text-stone-600">{editingArticle.excerpt || 'Ringkasan artikel akan tampil di sini.'}</p>
                  {editingArticle.motorModel && <p className="mt-4 rounded-lg bg-stone-100 p-3 text-sm text-stone-700"><strong>Model:</strong> {editingArticle.motorModel}</p>}
                  {editingArticle.productFacts && <p className="mt-3 whitespace-pre-line rounded-lg bg-stone-50 p-3 text-sm leading-6 text-stone-700">{editingArticle.productFacts}</p>}
                  {editingArticle.promoPeriod && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800"><strong>Periode promo:</strong> {editingArticle.promoPeriod}</p>}
                  {editingArticle.faqItems && <p className="mt-3 whitespace-pre-line rounded-lg border border-stone-200 p-3 text-sm leading-6 text-stone-700">{editingArticle.faqItems}</p>}
                  <div className="mt-6 space-y-4 text-sm leading-7 text-stone-700">
                    {(editingArticle.content || '').split(/\n{2,}/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                  </div>
                  {getVideoPreview(editingArticle) && (
                    <section className="mt-8 border-t border-stone-200 pt-6">
                      <h2 className="mb-3 text-lg font-bold text-stone-950">Video artikel</h2>
                      {getVideoPreview(editingArticle)?.kind === 'youtube' ? (
                        <div className="relative aspect-video overflow-hidden rounded-xl bg-stone-950">
                          <iframe src={getVideoPreview(editingArticle)?.url} title={`Video: ${editingArticle.title || 'artikel'}`} className="absolute inset-0 h-full w-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
                        </div>
                      ) : <video src={getVideoPreview(editingArticle)?.url} controls playsInline preload="metadata" className="max-h-96 w-full rounded-xl bg-stone-950" />}
                    </section>
                  )}
                  {editingArticle.whatsappCta && <p className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">{editingArticle.whatsappCta}</p>}
                </section>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-stone-800">Jenis konten</p>
                    <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Jenis konten artikel">
                      <button
                        type="button"
                        aria-pressed={editingArticle.template !== 'video'}
                        onClick={() => setEditingArticle((current) => current?.template === 'video'
                          ? { ...current, template: 'blog', category: 'Artikel' }
                          : current)}
                        className={`article-studio-choice inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${editingArticle.template !== 'video' ? 'border-red-700 bg-red-700 text-white shadow-sm' : 'border-stone-200 bg-white text-stone-800 hover:bg-stone-50'}`}
                      >
                        <FileText className="h-4 w-4" /> Artikel Teks
                      </button>
                      <button
                        type="button"
                        aria-pressed={editingArticle.template === 'video'}
                        onClick={() => setEditingArticle((current) => current ? {
                          ...current,
                          template: 'video',
                          category: current.template === 'video' ? current.category : 'Video Honda',
                          videoMedia: current.videoMedia || { source: 'youtube' },
                        } : current)}
                        className={`article-studio-choice inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${editingArticle.template === 'video' ? 'border-red-700 bg-red-700 text-white shadow-sm' : 'border-stone-200 bg-white text-stone-800 hover:bg-stone-50'}`}
                      >
                        <Video className="h-4 w-4" /> Video Article
                      </button>
                    </div>
                    <p className="text-xs leading-5 text-stone-600">Di Video Article, tempel tautan YouTube atau unggah file MP4.</p>
                  </div>
                  <div className="grid gap-5 lg:grid-cols-2">
                    <label className={labelClass}>Judul artikel *
                      <input required value={editingArticle.title || ''} onChange={(event) => setEditingArticle({ ...editingArticle, title: event.target.value, ...(!isSlugManuallyEdited ? { slug: slugifyArticle(event.target.value) } : {}) })} className={inputClass} placeholder="Contoh: Review Honda Vario 160 Terbaru" />
                    </label>
                    <label className={labelClass}>Template artikel
                      <select value={editingArticle.template || 'blog'} onChange={(event) => {
                        const selected = ARTICLE_TEMPLATES.find((item) => item.value === event.target.value) || ARTICLE_TEMPLATES[0];
                        setEditingArticle({ ...editingArticle, template: selected.value, category: selected.category });
                      }} className={inputClass}>
                        {ARTICLE_TEMPLATES.map((template) => <option key={template.value} value={template.value}>{template.label}</option>)}
                      </select>
                    </label>
                    <label className={labelClass}>Slug URL *
                      <input required value={editingArticle.slug || ''} onChange={(event) => { setIsSlugManuallyEdited(true); setEditingArticle({ ...editingArticle, slug: slugifyArticle(event.target.value) }); }} className={inputClass} />
                    </label>
                    <label className={labelClass}>Kategori
                      <input value={editingArticle.category || ''} onChange={(event) => setEditingArticle({ ...editingArticle, category: event.target.value })} className={inputClass} placeholder="Panduan Honda" />
                    </label>
                  </div>

                  <label className={labelClass}>Ringkasan artikel *
                    <textarea required rows={3} maxLength={500} value={editingArticle.excerpt || ''} onChange={(event) => setEditingArticle({ ...editingArticle, excerpt: event.target.value })} className={`${inputClass} resize-y`} placeholder="Ringkasan yang menjelaskan isi artikel kepada pembaca." />
                  </label>
                  <label className={labelClass}>Isi artikel *
                    <textarea required rows={9} value={editingArticle.content || ''} onChange={(event) => setEditingArticle({ ...editingArticle, content: event.target.value })} className={`${inputClass} resize-y leading-7`} placeholder={'Tulis isi artikel di sini.\n\nPisahkan paragraf dengan satu baris kosong.'} />
                  </label>

                  {(editingArticle.template === 'review' || editingArticle.template === 'video') && (
                    <label className={labelClass}>Model motor yang diulas
                      <input value={editingArticle.motorModel || ''} onChange={(event) => setEditingArticle({ ...editingArticle, motorModel: event.target.value })} className={inputClass} placeholder="Honda Vario 160" />
                    </label>
                  )}
                  {(editingArticle.template === 'review' || editingArticle.template === 'video') && (
                    <label className={labelClass}>Spesifikasi dan informasi harga (fakta terverifikasi)
                      <textarea rows={3} value={editingArticle.productFacts || ''} onChange={(event) => setEditingArticle({ ...editingArticle, productFacts: event.target.value })} className={`${inputClass} resize-y`} placeholder="Masukkan spesifikasi atau harga hanya jika sudah dikonfirmasi." />
                    </label>
                  )}
                  {editingArticle.template === 'promotion' && (
                    <label className={labelClass}>Periode promo
                      <input value={editingArticle.promoPeriod || ''} onChange={(event) => setEditingArticle({ ...editingArticle, promoPeriod: event.target.value })} className={inputClass} placeholder="Masukkan periode yang benar-benar berlaku" />
                    </label>
                  )}
                  {(editingArticle.template === 'faq' || editingArticle.template === 'video') && (
                    <label className={labelClass}>Pertanyaan dan jawaban FAQ
                      <textarea rows={5} value={editingArticle.faqItems || ''} onChange={(event) => setEditingArticle({ ...editingArticle, faqItems: event.target.value })} className={`${inputClass} resize-y`} placeholder="Tulis setiap pertanyaan dan jawaban dengan jelas." />
                    </label>
                  )}

                  {editingArticle.template === 'video' && (
                    <section className="space-y-5 rounded-2xl border border-red-100 bg-red-50/50 p-4 sm:p-6">
                      <div className="flex items-start gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700"><Video className="h-5 w-5" /></span>
                        <div><h4 className="font-bold text-stone-950">Video Article Studio</h4><p className="mt-1 text-xs leading-5 text-stone-600">Tempel tautan YouTube atau unggah MP4. Video dipisahkan dari galeri foto artikel.</p></div>
                      </div>
                      <div className="space-y-2">
                        <p className={labelClass}>Pilih sumber video</p>
                        <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Pilih sumber video">
                          <button
                            type="button"
                            aria-pressed={(editingArticle.videoMedia?.source || 'youtube') === 'youtube'}
                            onClick={() => updateVideoMedia({ source: 'youtube' })}
                            className={`article-studio-choice inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${(editingArticle.videoMedia?.source || 'youtube') === 'youtube' ? 'border-red-700 bg-red-700 text-white shadow-sm' : 'border-stone-200 bg-white text-stone-800 hover:bg-stone-50'}`}
                          >
                            Tempel link YouTube
                          </button>
                          <button
                            type="button"
                            aria-pressed={editingArticle.videoMedia?.source === 'upload'}
                            onClick={() => updateVideoMedia({ source: 'upload' })}
                            className={`article-studio-choice inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${editingArticle.videoMedia?.source === 'upload' ? 'border-red-700 bg-red-700 text-white shadow-sm' : 'border-stone-200 bg-white text-stone-800 hover:bg-stone-50'}`}
                          >
                            <Upload className="h-4 w-4" /> Unggah MP4
                          </button>
                        </div>
                      </div>
                      {(editingArticle.videoMedia?.source || 'youtube') === 'youtube' ? (
                        <label className={labelClass}>YouTube URL
                          <input type="url" value={editingArticle.videoMedia?.youtubeUrl || ''} onChange={(event) => updateVideoMedia({ source: 'youtube', youtubeUrl: event.target.value })} className={inputClass} placeholder="Tempel tautan YouTube, Shorts, atau youtu.be" />
                        </label>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <button type="button" disabled={isUploadingVideo} onClick={() => videoInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-800 disabled:opacity-50">
                              {isUploadingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                              {isUploadingVideo ? 'Mengunggah video...' : 'Pilih file video MP4'}
                            </button>
                            <input ref={videoInputRef} type="file" accept="video/mp4,.mp4" className="hidden" onChange={handleUploadVideo} />
                            <span className="text-xs text-stone-600">Maksimal 250 MB, diunggah secara streaming.</span>
                          </div>
                          {editingArticle.videoMedia?.videoUrl && (
                            <div className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-3">
                              <span className="truncate text-xs font-medium text-stone-700">Video MP4 tersimpan</span>
                              <button type="button" onClick={() => {
                                if (!window.confirm('Lepas video ini dari artikel? File akan dihapus setelah perubahan artikel disimpan jika tidak dipakai artikel lain.')) return;
                                setEditingArticle((current) => current ? { ...current, template: 'blog', category: 'Artikel', videoMedia: null, video: '' } : current);
                              }} className="shrink-0 text-xs font-semibold text-red-700 hover:underline">Lepas video</button>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className={labelClass}>Thumbnail video (URL)
                            <input type="text" value={editingArticle.videoMedia?.thumbnailUrl || ''} onChange={(event) => updateVideoMedia({ thumbnailUrl: event.target.value })} className={inputClass} placeholder="URL gambar atau /uploads/nama-gambar.jpg" />
                        </label>
                        <label className={labelClass}>Durasi video (detik)
                          <input type="number" min="1" max="86400" value={editingArticle.videoMedia?.duration || ''} onChange={(event) => updateVideoMedia({ duration: Number(event.target.value) || undefined })} className={inputClass} placeholder="Contoh: 185" />
                        </label>
                      </div>
                      <label className={labelClass}>Transkrip video / catatan sumber
                        <textarea rows={5} value={editingArticle.videoMedia?.transcript || ''} onChange={(event) => {
                          const value = event.target.value;
                          updateVideoMedia({ transcript: value });
                          setAiSourceText(value);
                        }} className={`${inputClass} resize-y`} placeholder="Tempel transkrip atau catatan. Tautan YouTube tidak otomatis menyediakan transkrip." />
                      </label>
                    </section>
                  )}

                  <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div><h4 className="font-bold text-stone-950">Foto Artikel ({getArticleImages(editingArticle).length}/{MAX_MOTOR_IMAGES})</h4><p className="mt-1 text-xs text-stone-500">Bisa unggah beberapa foto sekaligus. Foto pertama menjadi sampul.</p></div>
                      <button type="button" disabled={isUploadingImages || getArticleImages(editingArticle).length >= MAX_MOTOR_IMAGES} onClick={() => imagesInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-50">
                        <Upload className="h-4 w-4" /> {isUploadingImages ? 'Mengunggah...' : 'Unggah foto'}
                      </button>
                      <input ref={imagesInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUploadImages} />
                    </div>
                    {getArticleImages(editingArticle).length ? (
                      <div className="flex flex-wrap gap-3">
                        {getArticleImages(editingArticle).map((image, index) => (
                          <div key={`${image}-${index}`} className="relative w-full max-w-[15rem] overflow-hidden rounded-xl border border-stone-200">
                            <img src={image} alt={`Foto artikel ${index + 1}`} className="aspect-[4/3] w-full bg-stone-50 object-contain" />
                            <button type="button" onClick={() => updateCover(image)} className="absolute bottom-2 left-2 rounded-lg bg-black/75 px-2 py-1 text-[10px] font-bold text-white">{index === 0 ? 'Sampul' : 'Jadikan sampul'}</button>
                            <button type="button" onClick={() => removeImage(index)} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/75 text-white hover:bg-red-700" aria-label={`Hapus foto ${index + 1}`}><X className="h-3.5 w-3.5" /></button>
                          </div>
                        ))}
                      </div>
                    ) : <p className="rounded-xl border border-dashed border-stone-300 px-4 py-6 text-center text-xs text-stone-500">Belum ada foto artikel.</p>}
                    {editingArticle.template === 'video' && (
                      <button type="button" onClick={() => updateVideoMedia({ thumbnailUrl: editingArticle.image || getArticleImages(editingArticle)[0] || '' })} disabled={!editingArticle.image && !getArticleImages(editingArticle).length} className="text-xs font-semibold text-red-700 hover:underline disabled:text-stone-400">
                        Gunakan sampul artikel sebagai thumbnail video
                      </button>
                    )}
                  </section>

                  <section className="space-y-4 rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:p-5">
                    <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-red-700" /><h4 className="font-bold text-stone-950">AI Article Writer</h4></div>
                    <p className="text-xs leading-5 text-stone-600">AI menyusun draf hanya dari transkrip atau catatan yang Anda berikan. AI tidak mengambil video dari YouTube dan tidak menambahkan harga atau spesifikasi yang tidak ada di sumber.</p>
                    {aiConfigured === false ? (
                      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">AI belum dikonfigurasi. Admin server perlu mengatur GEMINI_API_KEY; artikel tetap bisa dibuat dan diedit manual.</p>
                    ) : aiConfigured === null ? (
                      <p className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600">Status konfigurasi AI belum dapat diperiksa. Coba muat ulang atau hubungi admin.</p>
                    ) : (
                      <>
                        <label className={labelClass}>Sumber teks untuk AI
                          <textarea rows={4} value={aiSourceText} onChange={(event) => setAiSourceText(event.target.value)} className={`${inputClass} resize-y`} placeholder="Tempel transkrip atau catatan fakta di sini." />
                        </label>
                        <button type="button" disabled={isGeneratingAi || aiSourceText.trim().length < 20} onClick={() => void handleGenerateAiDraft()} className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50">
                          {isGeneratingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                          {isGeneratingAi ? 'Menyusun draf...' : 'Buat draf artikel dengan AI'}
                        </button>
                      </>
                    )}
                  </section>

                  <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
                    <div><h4 className="font-bold text-stone-950">Form SEO Artikel</h4><p className="mt-1 text-xs text-stone-500">Metadata digunakan pada halaman artikel dan hasil pencarian Google.</p></div>
                    <label className={labelClass}>Meta Title
                      <input maxLength={200} value={editingArticle.metaTitle || ''} onChange={(event) => setEditingArticle({ ...editingArticle, metaTitle: event.target.value })} className={inputClass} placeholder="Judul SEO artikel Honda..." />
                    </label>
                    <label className={labelClass}>Meta Description
                      <textarea maxLength={160} rows={3} value={editingArticle.metaDescription || ''} onChange={(event) => setEditingArticle({ ...editingArticle, metaDescription: event.target.value })} className={`${inputClass} resize-y`} placeholder="Deskripsi artikel untuk hasil pencarian Google..." />
                      <span className="text-xs font-normal text-stone-400">{(editingArticle.metaDescription || '').length}/160 karakter</span>
                    </label>
                    <label className={labelClass}>Keywords
                      <input maxLength={500} value={editingArticle.metaKeywords || ''} onChange={(event) => setEditingArticle({ ...editingArticle, metaKeywords: event.target.value })} className={inputClass} placeholder="kredit motor honda, promo motor honda" />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className={labelClass}>Link sumber artikel (opsional)
                        <input type="url" value={editingArticle.sourceUrl || ''} onChange={(event) => setEditingArticle({ ...editingArticle, sourceUrl: event.target.value })} className={inputClass} placeholder="https://situs-pemilik-artikel.id/..." />
                      </label>
                      <label className={labelClass}>CTA WhatsApp (teks)
                        <input value={editingArticle.whatsappCta || ''} onChange={(event) => setEditingArticle({ ...editingArticle, whatsappCta: event.target.value })} className={inputClass} placeholder="Tanyakan promo dan ketersediaan unit kepada tim kami." />
                      </label>
                    </div>
                  </section>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className={labelClass}>Penulis
                      <input value={editingArticle.author || ''} onChange={(event) => setEditingArticle({ ...editingArticle, author: event.target.value })} className={inputClass} />
                    </label>
                    <label className={labelClass}>Waktu baca (menit)
                      <input type="number" min="1" max="60" value={editingArticle.readTime || 5} onChange={(event) => setEditingArticle({ ...editingArticle, readTime: Number(event.target.value) })} className={inputClass} />
                    </label>
                    <label className={labelClass}>Animasi sampul
                      <select value={editingArticle.animation || DEFAULT_CATALOG_ANIMATION} onChange={(event) => setEditingArticle({ ...editingArticle, animation: event.target.value as Article['animation'] })} className={inputClass}>
                        {CATALOG_ANIMATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                  </div>
                </>
              )}

              <footer className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-stone-200 bg-[#fffefa]/95 pt-4 backdrop-blur sm:flex-row sm:justify-between">
                <button type="button" onClick={() => { setEditingArticle(null); setIsPreviewing(false); }} className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-100">Batal</button>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {isPreviewing ? (
                    <button type="button" onClick={() => setIsPreviewing(false)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-100"><Edit2 className="h-4 w-4" /> Kembali ke edit</button>
                  ) : (
                    <button type="button" onClick={() => setIsPreviewing(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-100"><Eye className="h-4 w-4" /> Preview</button>
                  )}
                  <button type="submit" disabled={isSaving || isUploadingImages || isUploadingVideo || isGeneratingAi} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-800 hover:bg-red-50 disabled:opacity-50"><Save className="h-4 w-4" />{isSaving ? 'Menyimpan...' : 'Simpan Draft'}</button>
                  <button type="button" disabled={isSaving || isUploadingImages || isUploadingVideo || isGeneratingAi} onClick={() => void saveArticle(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />Publish</button>
                </div>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
