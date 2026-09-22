import { Motor, Promo, Testimonial, DealerSettings, ManifestoItem, LeadInterest } from '../types';

export const api = {
  // Settings
  async getSettings(): Promise<DealerSettings> {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error('Gagal mengambil pengaturan dealer');
    return res.json();
  },

  async updateSettings(data: Partial<DealerSettings>): Promise<DealerSettings> {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Gagal memperbarui pengaturan dealer');
    return res.json();
  },

  // Motors
  async getMotors(): Promise<Motor[]> {
    const res = await fetch('/api/motors');
    if (!res.ok) throw new Error('Gagal mengambil katalog motor');
    return res.json();
  },

  async createMotor(data: Partial<Motor>): Promise<Motor> {
    const res = await fetch('/api/motors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Gagal menambah motor');
    return res.json();
  },

  async updateMotor(id: string, data: Partial<Motor>): Promise<Motor> {
    const res = await fetch(`/api/motors/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Gagal mengubah data motor');
    return res.json();
  },

  async deleteMotor(id: string): Promise<boolean> {
    const res = await fetch(`/api/motors/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Gagal menghapus motor');
    return true;
  },

  // Promos
  async getPromos(): Promise<Promo[]> {
    const res = await fetch('/api/promos');
    if (!res.ok) throw new Error('Gagal mengambil promo');
    return res.json();
  },

  async createPromo(data: Partial<Promo>): Promise<Promo> {
    const res = await fetch('/api/promos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Gagal menambah promo');
    return res.json();
  },

  async updatePromo(id: string, data: Partial<Promo>): Promise<Promo> {
    const res = await fetch(`/api/promos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Gagal memperbarui promo');
    return res.json();
  },

  async deletePromo(id: string): Promise<boolean> {
    const res = await fetch(`/api/promos/${id}`, {
      method: 'DELETE',
    });
    return res.ok;
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteTestimonial(id: string): Promise<boolean> {
    const res = await fetch(`/api/testimonials/${id}`, {
      method: 'DELETE',
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return res.json();
  },

  async deleteInterest(id: string): Promise<boolean> {
    const res = await fetch(`/api/interests/${id}`, {
      method: 'DELETE',
    });
    return res.ok;
  },

  // Analytics
  async getAnalytics(): Promise<any> {
    const res = await fetch('/api/analytics');
    if (!res.ok) throw new Error('Gagal mengambil data analitik');
    return res.json();
  },

  // Upload image
  async uploadImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              base64Data,
            }),
          });
          const json = await res.json();
          if (json.url) {
            resolve(json.url);
          } else {
            reject(new Error(json.error || 'Upload gagal'));
          }
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  },

  // Export / Download all data
  getExportAllUrl(): string {
    return '/api/export/all';
  },

  getExportCsvUrl(type: 'interests' | 'motors' | 'promos' | 'testimonials'): string {
    return `/api/export/csv/${type}`;
  },

  downloadAllBackup(): void {
    window.location.href = '/api/export/all';
  },

  downloadCsv(type: 'interests' | 'motors' | 'promos' | 'testimonials'): void {
    window.location.href = `/api/export/csv/${type}`;
  },

  async importDatabase(jsonData: any): Promise<any> {
    const res = await fetch('/api/import/all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
