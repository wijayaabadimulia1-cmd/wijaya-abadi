import { Motor, Promo, Article, Testimonial, DealerSettings, ManifestoItem, LeadInterest, AdminSession, AdminUser, AuditLog, FIFPriceList, SalesCounterSite } from '../types';

interface MotorSaveData extends Partial<Motor> {
  fifPriceListModel?: {
    name: string;
    previousName?: string;
    price: number;
    options: Record<string, number[]>;
  };
}
import { MAX_IMAGE_UPLOAD_BYTES } from '../constants';

const ADMIN_TOKEN_KEY = 'hwa-admin-token';

function adminHeaders() {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  return { 'Content-Type': 'application/json', ...(token ? { 'x-admin-token': token } : {}) };
}

async function downloadAdminFile(url: string, fallbackName: string): Promise<void> {
  const response = await fetch(url, { headers: adminHeaders() });
  if (!response.ok) throw new Error('Unduhan gagal. Periksa sesi admin Anda.');

  const blob = await response.blob();
  const contentDisposition = response.headers.get('Content-Disposition');
  const fileName = contentDisposition?.match(/filename="?([^";]+)"?/i)?.[1] || fallbackName;
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export const api = {
  async getCatalogStatus(): Promise<{ owner: boolean; canManageCatalog: boolean; adminUrl: string }> {
    const res = await fetch('/api/catalog/status', { headers: adminHeaders(), cache: 'no-store' });
    if (!res.ok) throw new Error('Gagal memeriksa panel katalog pusat');
    return res.json();
  },

  // Admin authentication
  async loginAdmin(username: string, password: string): Promise<{ token: string; user: AdminSession }> {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login admin gagal');
    localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
    return data;
  },

  async getAdminMe(): Promise<AdminSession> {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) throw new Error('Sesi admin tidak valid');
    const res = await fetch('/api/admin/me', { headers: adminHeaders() });
    if (!res.ok) {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      throw new Error('Sesi admin tidak valid');
    }
    return res.json();
  },

  async logoutAdmin(): Promise<void> {
    try {
      await fetch('/api/admin/logout', { method: 'POST', headers: adminHeaders() });
    } finally {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  },

  async getAdminUsers(): Promise<AdminUser[]> {
    const res = await fetch('/api/admin/users', { headers: adminHeaders() });
    if (!res.ok) throw new Error('Gagal mengambil daftar admin');
    return res.json();
  },

  async getSalesCounters(): Promise<SalesCounterSite[]> {
    const res = await fetch('/api/admin/sales-counters', { headers: adminHeaders(), cache: 'no-store' });
    const result = await res.json().catch(() => []);
    if (!res.ok) throw new Error(result.error || 'Gagal mengambil daftar Sales Counter');
    return result;
  },

  async createSalesCounter(data: { name: string; phone: string; username: string; password: string; subdomain: string; seoTitle?: string; seoDescription?: string; seoKeywords?: string; seoRobots?: string }): Promise<SalesCounterSite> {
    const res = await fetch('/api/admin/sales-counters', {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Gagal membuat website Sales Counter');
    return result;
  },

  async deleteSalesCounter(id: string): Promise<void> {
    const res = await fetch(`/api/admin/sales-counters/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Gagal menghapus Sales Counter');
  },

  async updateSalesCounterSeo(id: string, data: Pick<SalesCounterSite, 'seoTitle' | 'seoDescription' | 'seoKeywords' | 'seoRobots'>): Promise<Pick<SalesCounterSite, 'id' | 'seoTitle' | 'seoDescription' | 'seoKeywords' | 'seoRobots' | 'updated_at'>> {
    const res = await fetch(`/api/admin/sales-counters/${encodeURIComponent(id)}/seo`, {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Gagal menyimpan SEO Sales Counter');
    return result;
  },

  async createAdminUser(data: { username: string; password: string; role?: string; assignedSeoPageId?: string }): Promise<AdminUser> {
    const res = await fetch('/api/admin/users', { method: 'POST', headers: adminHeaders(), body: JSON.stringify(data) });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Gagal membuat admin');
    return result;
  },

  async updateAdminUser(id: string, data: { username?: string; password?: string; role?: string; assignedSeoPageId?: string }): Promise<AdminUser> {
    const res = await fetch(`/api/admin/users/${id}`, { method: 'PUT', headers: adminHeaders(), body: JSON.stringify(data) });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Gagal mengubah admin');
    return result;
  },

  async changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
    const res = await fetch('/api/admin/change-password', {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Gagal mengganti password');
  },

  async deleteAdminUser(id: string): Promise<void> {
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE', headers: adminHeaders() });
    if (!res.ok) {
      const result = await res.json();
      throw new Error(result.error || 'Gagal menghapus admin');
    }
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    const res = await fetch('/api/admin/audit', { headers: adminHeaders() });
    if (!res.ok) throw new Error('Gagal mengambil histori perubahan');
    return res.json();
  },

  async getOwnerDashboardConfig(): Promise<{ selectedHosts: string[]; dashboardUrl: string; availableSites: Array<{ host: string; label: string }> }> {
    const res = await fetch('/api/admin/owner-dashboard', { headers: adminHeaders(), cache: 'no-store' });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Gagal mengambil konfigurasi dashboard owner');
    return result;
  },

  async saveOwnerDashboardConfig(hosts: string[]): Promise<{ selectedHosts: string[]; dashboardUrl: string; availableSites: Array<{ host: string; label: string }> }> {
    const res = await fetch('/api/admin/owner-dashboard', {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify({ hosts }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Gagal menyimpan konfigurasi dashboard owner');
    return result;
  },

  async getOwnerDashboardAnalytics(
    key: string,
    startDate?: string,
    endDate?: string,
    includeAll?: { pages?: boolean; searchTerms?: boolean; leads?: boolean },
  ): Promise<any> {
    const res = await fetch('/api/owner-dashboard/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        key,
        startDate,
        endDate,
        includeAllPages: includeAll?.pages === true,
        includeAllSearchTerms: includeAll?.searchTerms === true,
        includeAllLeads: includeAll?.leads === true,
      }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Tautan dashboard tidak valid atau sudah dinonaktifkan');
    return result;
  },

  async getFifPriceList(): Promise<FIFPriceList> {
    const res = await fetch('/api/fif-price-list', { cache: 'no-store' });
    if (!res.ok) throw new Error('Gagal mengambil price list cicilan FIF');
    return res.json();
  },

  async importFifPriceList(file: File): Promise<{ success: boolean; modelCount: number; updatedAt: string }> {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    const res = await fetch('/api/fif-price-list/import', {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ...(token ? { 'x-admin-token': token } : {}),
      },
      body: file,
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Gagal mengimpor price list FIF');
    return result;
  },

  async downloadFifPriceListTemplate(): Promise<void> {
    await downloadAdminFile('/api/fif-price-list/template', `template-price-list-fif-${new Date().toISOString().slice(0, 10)}.xlsx`);
  },

  // Settings
  async getSettings(): Promise<DealerSettings> {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error('Gagal mengambil pengaturan dealer');
    return res.json();
  },

  async getAdminSettings(): Promise<DealerSettings> {
    const res = await fetch('/api/settings', { headers: adminHeaders(), cache: 'no-store' });
    if (!res.ok) throw new Error('Gagal mengambil pengaturan admin');
    return res.json();
  },

  async updateSettings(data: Partial<DealerSettings>): Promise<DealerSettings> {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify(data),
    });
    const responseText = await res.text();
    let result: Partial<DealerSettings> & { error?: string } = {};
    try {
      result = JSON.parse(responseText);
    } catch {
      if (res.ok) throw new Error(`Respons server tidak valid (HTTP ${res.status})`);
    }
    if (!res.ok) {
      const contentType = res.headers.get('content-type')?.split(';')[0] || 'unknown response type';
      throw new Error(result.error || `Gagal memperbarui pengaturan dealer (HTTP ${res.status}, ${contentType})`);
    }
    return result as DealerSettings;
  },

  async provisionSeoPageSsl(id: string): Promise<{ status: 'pending' | 'active' | 'failed'; message: string; seoPages: DealerSettings['seoPages'] }> {
    const res = await fetch(`/api/admin/seo-pages/${encodeURIComponent(id)}/provision-ssl`, {
      method: 'POST',
      headers: adminHeaders(),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Gagal mengaktifkan SSL subdomain');
    return result;
  },

  // Motors
  async getMotors(): Promise<Motor[]> {
    const res = await fetch('/api/motors', { cache: 'no-store' });
    if (!res.ok) throw new Error('Gagal mengambil katalog motor');
    return res.json();
  },

  async createMotor(data: MotorSaveData): Promise<Motor> {
    const res = await fetch('/api/motors', {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Gagal menambah motor');
    return res.json();
  },

  async updateMotor(id: string, data: MotorSaveData): Promise<Motor> {
    const res = await fetch(`/api/motors/${id}`, {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Gagal mengubah data motor');
    return res.json();
  },

  async deleteMotor(id: string): Promise<boolean> {
    const res = await fetch(`/api/motors/${id}`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });
    if (!res.ok) throw new Error('Gagal menghapus motor');
    return true;
  },

  // Promos
  async getPromos(): Promise<Promo[]> {
    const [localResponse, globalResponse] = await Promise.all([
      fetch('/api/promos', { cache: 'no-store' }),
      fetch('/api/promos/global', { cache: 'no-store' }),
    ]);
    if (!localResponse.ok) throw new Error('Gagal mengambil promo');

    const localPromos: Promo[] = await localResponse.json();
    const globalPromos: Promo[] = globalResponse.ok ? await globalResponse.json() : [];
    const globalById = new Map(globalPromos.map((promo) => [promo.id, promo]));
    const globalIds = new Set(globalPromos.map((promo) => promo.id));
    const localIds = new Set(localPromos.map((promo) => promo.id));
    const isAdminPage = window.location.pathname.replace(/\/+$/, '').endsWith('/admin');
    const currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');

    if (isAdminPage) {
      const localWithGlobalState = localPromos.map((promo) => {
        const globalPromo = globalById.get(promo.id);
        return globalPromo
          ? { ...globalPromo, ...promo, disabledHosts: globalPromo.disabledHosts, isGlobal: true, isLocal: true }
          : { ...promo, isGlobal: false, isLocal: true };
      });
      return [...localWithGlobalState, ...globalPromos.filter((promo) => !localIds.has(promo.id)).map((promo) => ({ ...promo, isGlobal: true, isLocal: false }))];
    }

    return [
      ...globalPromos.filter((promo) => !promo.disabledHosts?.includes(currentHost)).map((promo) => ({ ...promo, isGlobal: true, isLocal: localIds.has(promo.id) })),
      ...localPromos.filter((promo) => !globalIds.has(promo.id)).map((promo) => ({ ...promo, isGlobal: false, isLocal: true })),
    ];
  },

  async getGlobalPromoDomains(): Promise<string[]> {
    const res = await fetch('/api/admin/global-promos', { headers: adminHeaders(), cache: 'no-store' });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Gagal mengambil daftar domain promo');
    return result.availableDomains || [];
  },

  async updateGlobalPromoDomains(id: string, disabledHosts: string[]): Promise<string[]> {
    const res = await fetch(`/api/promos/global/${encodeURIComponent(id)}/domains`, {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify({ disabledHosts }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Gagal menyimpan visibilitas promo per domain');
    return result.disabledHosts || [];
  },

  async publishPromoGlobally(promo: Partial<Promo>): Promise<Promo> {
    const { isGlobal: _isGlobal, isLocal: _isLocal, ...payload } = promo;
    const res = await fetch('/api/promos/global', {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Gagal menampilkan promo di semua website');
    return result;
  },

  async unpublishPromoGlobally(id: string): Promise<void> {
    const res = await fetch(`/api/promos/global/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Gagal menarik promo dari semua website');
  },

  async createPromo(data: Partial<Promo>): Promise<Promo> {
    const res = await fetch('/api/promos', {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Gagal menambah promo');
    return res.json();
  },

  async updatePromo(id: string, data: Partial<Promo>): Promise<Promo> {
    const res = await fetch(`/api/promos/${id}`, {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Gagal memperbarui promo');
    return res.json();
  },

  async deletePromo(id: string): Promise<boolean> {
    const res = await fetch(`/api/promos/${id}`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });
    return res.ok;
  },

  async getArticles(): Promise<Article[]> {
    const res = await fetch('/api/articles', { cache: 'no-store' });
    if (!res.ok) throw new Error('Gagal mengambil artikel');
    return res.json();
  },

  async getAdminArticles(): Promise<Article[]> {
    const res = await fetch('/api/articles', { headers: adminHeaders(), cache: 'no-store' });
    if (!res.ok) throw new Error('Gagal mengambil daftar artikel');
    return res.json();
  },

  async createArticle(data: Partial<Article>): Promise<Article> {
    const res = await fetch('/api/articles', { method: 'POST', headers: adminHeaders(), body: JSON.stringify(data) });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Gagal membuat artikel');
    return result;
  },

  async updateArticle(id: string, data: Partial<Article>): Promise<Article> {
    const res = await fetch(`/api/articles/${encodeURIComponent(id)}`, { method: 'PUT', headers: adminHeaders(), body: JSON.stringify(data) });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Gagal memperbarui artikel');
    return result;
  },

  async deleteArticle(id: string): Promise<void> {
    const res = await fetch(`/api/articles/${encodeURIComponent(id)}`, { method: 'DELETE', headers: adminHeaders() });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Gagal menghapus artikel');
  },

  // Testimonials
  async getTestimonials(): Promise<Testimonial[]> {
    const res = await fetch('/api/testimonials');
    if (!res.ok) throw new Error('Gagal mengambil testimoni');
    return res.json();
  },

  async createTestimonial(data: Partial<Testimonial>): Promise<Testimonial> {
    const res = await fetch('/api/testimonials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Gagal menambah testimoni');
    return res.json();
  },

  async updateTestimonial(id: string, data: Partial<Testimonial>): Promise<Testimonial> {
    const res = await fetch(`/api/testimonials/${id}`, {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteTestimonial(id: string): Promise<boolean> {
    const res = await fetch(`/api/testimonials/${id}`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });
    return res.ok;
  },

  // Manifesto
  async getManifesto(): Promise<ManifestoItem[]> {
    const res = await fetch('/api/manifesto');
    if (!res.ok) throw new Error('Gagal mengambil manifesto');
    return res.json();
  },

  async updateManifesto(id: string, data: Partial<ManifestoItem>): Promise<ManifestoItem> {
    const res = await fetch(`/api/manifesto/${id}`, {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Interests / Leads
  async getInterests(): Promise<LeadInterest[]> {
    const res = await fetch('/api/interests');
    if (!res.ok) throw new Error('Gagal mengambil data peminat');
    return res.json();
  },

  async createInterest(data: Partial<LeadInterest>): Promise<LeadInterest> {
    const res = await fetch('/api/interests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Gagal mengirim formulir minat');
    return res.json();
  },

  async updateInterestStatus(id: string, status: LeadInterest['status']): Promise<LeadInterest> {
    const res = await fetch(`/api/interests/${id}/status`, {
      method: 'PATCH',
      headers: adminHeaders(),
      body: JSON.stringify({ status }),
    });
    return res.json();
  },

  async deleteInterest(id: string): Promise<boolean> {
    const res = await fetch(`/api/interests/${id}`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });
    return res.ok;
  },

  // Analytics
  async getAnalytics(startDate?: string, endDate?: string): Promise<any> {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const query = params.toString();
    const res = await fetch(`/api/analytics${query ? `?${query}` : ''}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Gagal mengambil data analitik');
    return res.json();
  },

  async trackVisitor(sessionId: string, path: string, source = 'Lainnya'): Promise<void> {
    const res = await fetch('/api/analytics/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, path, source }),
      keepalive: true,
    });
    if (!res.ok) throw new Error('Gagal menyimpan kunjungan website');
  },

  async trackSearch(sessionId: string, keyword: string, eventId: string): Promise<void> {
    const res = await fetch('/api/analytics/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, keyword, eventId }),
      keepalive: true,
    });
    if (!res.ok) throw new Error('Gagal menyimpan kata kunci pencarian');
  },

  async trackWhatsAppClick(sessionId: string, path: string, menu: string, eventId: string, registerSalesCounterLead = false): Promise<void> {
    const res = await fetch('/api/analytics/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, path, menu, eventId, registerSalesCounterLead }),
      keepalive: true,
    });
    if (!res.ok) throw new Error('Gagal menyimpan klik WhatsApp');
  },

  // Upload image
  async migrateExternalImages(): Promise<{ migratedCount: number; updatedReferences: number; unsupportedCount: number; failedCount: number }> {
    const res = await fetch('/api/admin/images/migrate-external', {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: '{}',
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || `Migrasi gambar gagal (HTTP ${res.status})`);
    return result;
  },

  async uploadImage(file: File, options: { sharedCatalog?: boolean } = {}): Promise<string> {
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      throw new Error('Ukuran gambar melebihi batas 100 MB. Kompres gambar lalu coba lagi.');
    }
    const contentTypeByExtension: Record<string, string> = {
      avif: 'image/avif',
      gif: 'image/gif',
      jpeg: 'image/jpeg',
      jpg: 'image/jpeg',
      png: 'image/png',
      svg: 'image/svg+xml',
      webp: 'image/webp',
    };
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    const contentType = file.type || contentTypeByExtension[extension] || 'application/octet-stream';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${file.name}`;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 120_000);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          ...adminHeaders(),
          'Content-Type': contentType,
          'X-File-Name': encodeURIComponent(uniqueName),
          ...(options.sharedCatalog ? { 'X-Catalog-Upload': 'true' } : {}),
        },
        body: file,
        signal: controller.signal,
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.url) {
        throw new Error(result.error || `Upload gagal (HTTP ${res.status})`);
      }
      return result.url;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error('Upload melewati batas 120 detik. Periksa koneksi atau gunakan foto yang lebih kecil.');
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  },

  // Export / Download all data
  getExportAllUrl(): string {
    return '/api/export/all';
  },

  getExportCsvUrl(type: 'interests' | 'motors' | 'promos' | 'testimonials'): string {
    return `/api/export/csv/${type}`;
  },

  async downloadAllBackup(): Promise<void> {
    await downloadAdminFile('/api/export/all', `honda-wijaya-abadi-backup-${new Date().toISOString().slice(0, 10)}.json`);
  },

  async downloadAdminReport(): Promise<void> {
    const res = await fetch('/api/admin/report', { headers: adminHeaders() });
    if (!res.ok) throw new Error('Gagal mengunduh laporan admin');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `laporan-admin-hwa-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  async downloadCsv(type: 'interests' | 'motors' | 'promos' | 'testimonials'): Promise<void> {
    await downloadAdminFile(`/api/export/csv/${type}`, `honda-wijaya-abadi-${type}-${new Date().toISOString().slice(0, 10)}.csv`);
  },

  async downloadMotorWorkbook(template = false): Promise<void> {
    const path = template ? '/api/motors/template.xlsx' : '/api/motors/export.xlsx';
    const fileName = template ? 'template-upload-motor.xlsx' : 'katalog-motor-honda.xlsx';
    await downloadAdminFile(path, fileName);
  },

  async importMotorsFile(file: File): Promise<{ created: number; updated: number; total: number }> {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    const extension = file.name.split('.').pop()?.toLowerCase();
    const contentType = extension === 'csv' ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const res = await fetch('/api/motors/import', {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        ...(token ? { 'x-admin-token': token } : {}),
      },
      body: file,
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Gagal mengimpor katalog motor');
    return result;
  },

  async importDatabase(jsonData: any): Promise<any> {
    const res = await fetch('/api/import/all', {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify(jsonData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Gagal memulihkan database');
    }
    return res.json();
  },
};

export function formatRupiah(value: number | string): string {
  if (typeof value === 'string' && value.toLowerCase().includes('rp')) {
    return value;
  }
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9]/g, ''));
  if (isNaN(numeric)) return 'Rp 0';
  return 'Rp ' + numeric.toLocaleString('id-ID');
}
