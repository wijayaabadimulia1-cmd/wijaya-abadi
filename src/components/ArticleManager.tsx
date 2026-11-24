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

interface ArticleManagerProps {
  onRefreshData: () => void | Promise<void>;
}

export function ArticleManager({ onRefreshData }: ArticleManagerProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [editingArticle, setEditingArticle] = useState<Partial<Article> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const imagesInputRef = useRef<HTMLInputElement>(null);

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
      content: '',
      images: [],
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

  const handleSaveArticle = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingArticle) return;

    const articleData = {
      ...editingArticle,
      slug: slugifyArticle(editingArticle.slug || editingArticle.title || ''),
      images: getArticleImages(editingArticle),
      animation: editingArticle.animation || DEFAULT_CATALOG_ANIMATION,
      animationSpeed: normalizeCatalogAnimationSpeed(editingArticle.animationSpeed ?? DEFAULT_CATALOG_ANIMATION_SPEED),
    };
    if (!articleData.title?.trim() || !articleData.slug || !articleData.excerpt?.trim() || !articleData.content?.trim()) {
      setErrorMessage('Judul, slug, ringkasan, dan isi artikel wajib diisi.');
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

  return (
    <div className="space-y-6 animate-in fade-in duration-300 text-stone-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-stone-950">Artikel &amp; Cerita</h2>
          <p className="mt-1 text-sm text-stone-500">Ruang editorial untuk mengelola cerita dan panduan website. Post SEO tetap terpisah.</p>
        </div>
        <button type="button" onClick={openNewArticle} className="inline-flex items-center gap-2 rounded-full bg-red-700 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-red-900/10 transition hover:bg-red-800">
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
        <div className="py-16 text-center text-sm text-stone-500">Memuat artikel...</div>
      ) : articles.length ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {articles.map((article) => (
            <article key={article.id} className="flex min-w-0 gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_6px_24px_rgba(41,37,36,0.04)] transition hover:border-red-200 hover:shadow-md sm:p-5">
              {getArticleImages(article)[0] ? <img src={getArticleImages(article)[0]} alt="" className="h-24 w-28 shrink-0 rounded-xl bg-stone-100 object-cover" /> : <div className="grid h-20 w-24 shrink-0 place-items-center rounded-md bg-red-950/50 text-red-400"><FileText className="h-6 w-6" /></div>}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${article.published ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>{article.published ? 'Terbit' : 'Draf'}</span>
                  <span className="text-[10px] font-medium text-stone-500">{article.category}</span>
                  <span className="text-[10px] text-stone-500">/{article.slug}</span>
                </div>
                <h3 className="mt-2 truncate text-base font-semibold text-stone-900">{article.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-stone-600">{article.excerpt}</p>
                <div className="mt-3 flex items-center justify-end gap-3">
                  <button type="button" onClick={() => { setErrorMessage(null); setIsSlugManuallyEdited(true); setEditingArticle({ ...article, images: getArticleImages(article) }); }} className="inline-flex items-center gap-1 text-xs font-semibold text-stone-700 hover:text-red-700" aria-label={`Edit ${article.title}`}><Edit2 className="h-3.5 w-3.5" /> Edit</button>
                  <button type="button" onClick={() => void handleDeleteArticle(article)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-300" aria-label={`Hapus ${article.title}`}><Trash2 className="h-3.5 w-3.5" /> Hapus</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-stone-300 px-5 py-12 text-center rounded-2xl bg-white">
          <FileText className="mx-auto h-8 w-8 text-stone-500" />
          <p className="mt-3 text-sm font-semibold text-stone-700">Belum ada artikel</p>
          <p className="mt-1 text-xs text-stone-500">Artikel terbit akan tampil di website. Post SEO tidak masuk ke daftar ini.</p>
        </div>
      )}

      {editingArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-5">
          <div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-[1.5rem] border border-stone-200 bg-[#fffefa] p-5 text-xs text-stone-800 shadow-2xl sm:p-8">
            <div className="mb-5 flex items-center justify-between border-b border-stone-200 pb-4">
              <div>
                <h3 className="font-serif text-xl font-semibold text-stone-950">{editingArticle.id ? 'Edit Artikel' : 'Tulis Artikel'}</h3>
                <p className="mt-1 text-xs text-stone-500">Artikel ini tersimpan terpisah dari SEO Post.</p>
              </div>
              <button type="button" onClick={() => setEditingArticle(null)} className="grid h-9 w-9 place-items-center rounded-lg text-stone-500 hover:bg-zinc-900 hover:text-white" aria-label="Tutup formulir"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSaveArticle} className="space-y-4">
              <label className="block space-y-1.5 font-semibold text-stone-700">
                Judul artikel *
                <input required value={editingArticle.title || ''} onChange={(event) => setEditingArticle({ ...editingArticle, title: event.target.value, ...(!isSlugManuallyEdited ? { slug: slugifyArticle(event.target.value) } : {}) })} className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10" placeholder="Contoh: Panduan memilih motor untuk kebutuhan harian" />
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5 font-semibold text-stone-700">Slug URL *<input required value={editingArticle.slug || ''} onChange={(event) => { setIsSlugManuallyEdited(true); setEditingArticle({ ...editingArticle, slug: slugifyArticle(event.target.value) }); }} className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10" /></label>
                <label className="block space-y-1.5 font-semibold text-stone-700">Kategori<input value={editingArticle.category || ''} onChange={(event) => setEditingArticle({ ...editingArticle, category: event.target.value })} className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10" placeholder="Tips Berkendara" /></label>
              </div>
              <label className="block space-y-1.5 font-semibold text-stone-700">Ringkasan *<textarea required rows={2} maxLength={240} value={editingArticle.excerpt || ''} onChange={(event) => setEditingArticle({ ...editingArticle, excerpt: event.target.value })} className="w-full resize-y rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10" /></label>
              <label className="block space-y-1.5 font-semibold text-stone-700">Isi artikel *<textarea required rows={10} value={editingArticle.content || ''} onChange={(event) => setEditingArticle({ ...editingArticle, content: event.target.value })} className="w-full resize-y rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm leading-7 text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10" placeholder={'Tulis isi artikel di sini.\n\nPisahkan paragraf dengan satu baris kosong.'} /></label>

              <section className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h4 className="font-bold text-white">Galeri artikel</h4><p className="mt-1 text-[11px] text-stone-500">Unggah hingga {MAX_MOTOR_IMAGES} gambar; gambar pertama menjadi sampul.</p></div>
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
                ) : <p className="border border-dashed border-white/15 px-3 py-5 text-center text-xs text-stone-500">Belum ada gambar yang diunggah.</p>}
              </section>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5 font-semibold text-stone-700">Penulis<input value={editingArticle.author || ''} onChange={(event) => setEditingArticle({ ...editingArticle, author: event.target.value })} className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10" /></label>
                <label className="block space-y-1.5 font-semibold text-stone-700">Animasi gambar<select value={editingArticle.animation || DEFAULT_CATALOG_ANIMATION} onChange={(event) => setEditingArticle({ ...editingArticle, animation: event.target.value as Article['animation'] })} className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10">{CATALOG_ANIMATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              </div>
              <label className="block space-y-1.5 font-semibold text-stone-700">Kecepatan animasi<span className="flex items-center gap-3 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5"><input type="range" min={MIN_CATALOG_ANIMATION_SPEED} max={MAX_CATALOG_ANIMATION_SPEED} step={1} value={normalizeCatalogAnimationSpeed(editingArticle.animationSpeed ?? DEFAULT_CATALOG_ANIMATION_SPEED)} onChange={(event) => setEditingArticle({ ...editingArticle, animationSpeed: Number(event.target.value) })} className="min-w-0 flex-1 accent-red-600" /><output className="w-12 text-right tabular-nums text-white">{normalizeCatalogAnimationSpeed(editingArticle.animationSpeed ?? DEFAULT_CATALOG_ANIMATION_SPEED)} dtk</output></span></label>
              <label className="flex items-center gap-2.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-3 font-semibold text-zinc-200"><input type="checkbox" checked={editingArticle.published === true} onChange={(event) => setEditingArticle({ ...editingArticle, published: event.target.checked })} className="h-4 w-4 accent-red-600" />Terbitkan artikel di website</label>
              <div className="flex justify-end gap-2 border-t border-stone-200 pt-5">
                <button type="button" onClick={() => setEditingArticle(null)} className="rounded-lg border border-white/10 px-4 py-2.5 font-semibold text-stone-700 hover:bg-zinc-900">Batal</button>
                <button type="submit" disabled={isSaving || isUploadingImages} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 font-bold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-4 w-4" />{isSaving ? 'Menyimpan...' : 'Simpan Artikel'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
