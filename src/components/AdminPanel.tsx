import React, { useState, useEffect } from 'react';
import {
  Bike,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Upload,
  Search,
  CheckCircle,
  Tag,
  Star,
  Users,
  Settings as SettingsIcon,
  MessageSquare,
  ArrowLeft,
  RotateCcw,
  ExternalLink,
  Flame,
  FileText,
  DollarSign,
  TrendingUp,
  Download,
  Database,
  FileSpreadsheet,
  HardDrive,
  FileDown,
  FileJson,
} from 'lucide-react';
import { Motor, Promo, Testimonial, DealerSettings, LeadInterest, ManifestoItem } from '../types';
import { api, formatRupiah } from '../services/api';

interface AdminPanelProps {
  onBackToWebsite: () => void;
  onRefreshData: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBackToWebsite, onRefreshData }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'motors' | 'promos' | 'leads' | 'testimonials' | 'settings' | 'export'>('dashboard');

  // Local state for all dynamic data
  const [motors, setMotors] = useState<Motor[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [settings, setSettings] = useState<DealerSettings | null>(null);
  const [leads, setLeads] = useState<LeadInterest[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals for CRUD
  const [isMotorModalOpen, setIsMotorModalOpen] = useState(false);
  const [editingMotor, setEditingMotor] = useState<Partial<Motor> | null>(null);

  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Partial<Promo> | null>(null);

  const [isTestiModalOpen, setIsTestiModalOpen] = useState(false);
  const [editingTesti, setEditingTesti] = useState<Partial<Testimonial> | null>(null);

  // Search in motors
  const [motorSearch, setMotorSearch] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [motorsRes, promosRes, testiRes, settingsRes, leadsRes, analyticsRes] = await Promise.all([
        api.getMotors(),
        api.getPromos(),
        api.getTestimonials(),
        api.getSettings(),
        api.getInterests(),
        api.getAnalytics(),
      ]);

      setMotors(motorsRes);
      setPromos(promosRes);
      setTestimonials(testiRes);
      setSettings(settingsRes);
      setLeads(leadsRes);
      setAnalytics(analyticsRes);
    } catch (err) {
      console.error('Failed to load admin data:', err);
      showToast('Gagal memuat beberapa data dari database');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // --- Motor CRUD Handlers ---
  const handleOpenAddMotor = () => {
    setEditingMotor({
      name: '',
      category: 'Matic',
      price: '20.000.000',
      specs: ['110cc', 'eSP'],
      description: '',
      image: '/uploads/beat_cbs.png',
      is_bestseller: false,
    });
    setIsMotorModalOpen(true);
  };

  const handleOpenEditMotor = (motor: Motor) => {
    setEditingMotor({ ...motor });
    setIsMotorModalOpen(true);
  };

  const handleSaveMotor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMotor || !editingMotor.name) return;

    try {
      if (editingMotor.id) {
        await api.updateMotor(editingMotor.id, editingMotor);
        showToast(`Motor "${editingMotor.name}" berhasil diperbarui`);
      } else {
        await api.createMotor(editingMotor);
        showToast(`Motor baru "${editingMotor.name}" berhasil ditambahkan`);
      }
      setIsMotorModalOpen(false);
      setEditingMotor(null);
      loadAllData();
      onRefreshData();
    } catch (err: any) {
      alert('Gagal menyimpan motor: ' + err.message);
    }
  };

  const handleDeleteMotor = async (id: string, name: string) => {
    if (!window.confirm(`Hapus motor "${name}" dari katalog showroom?`)) return;
    try {
      await api.deleteMotor(id);
      showToast(`Motor "${name}" telah dihapus`);
      loadAllData();
      onRefreshData();
    } catch (err: any) {
      alert('Gagal menghapus motor: ' + err.message);
    }
  };

  const handleFileUploadMotor = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast('Mengunggah gambar...');
      const url = await api.uploadImage(file);
      setEditingMotor((prev) => (prev ? { ...prev, image: url } : null));
      showToast('Gambar berhasil diunggah!');
    } catch (err: any) {
      alert('Gagal upload gambar: ' + err.message);
    }
  };

  // --- Promo CRUD Handlers ---
  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPromo || !editingPromo.title) return;
    try {
      if (editingPromo.id) {
        await api.updatePromo(editingPromo.id, editingPromo);
        showToast('Promo berhasil diperbarui');
      } else {
        await api.createPromo(editingPromo);
        showToast('Promo baru berhasil ditambahkan');
      }
      setIsPromoModalOpen(false);
      setEditingPromo(null);
      loadAllData();
      onRefreshData();
    } catch (err: any) {
      alert('Gagal menyimpan promo: ' + err.message);
    }
  };

  const handleDeletePromo = async (id: string) => {
    if (!window.confirm('Hapus promo ini?')) return;
    await api.deletePromo(id);
    showToast('Promo dihapus');
    loadAllData();
    onRefreshData();
  };

  // --- Testimonial CRUD Handlers ---
  const handleSaveTesti = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTesti || !editingTesti.name) return;
    try {
      if (editingTesti.id) {
        await api.updateTestimonial(editingTesti.id, editingTesti);
        showToast('Testimoni diperbarui');
      } else {
        await api.createTestimonial(editingTesti);
        showToast('Testimoni baru ditambahkan');
      }
      setIsTestiModalOpen(false);
      setEditingTesti(null);
      loadAllData();
      onRefreshData();
    } catch (err: any) {
      alert('Gagal: ' + err.message);
    }
  };

  const handleDeleteTesti = async (id: string) => {
    if (!window.confirm('Hapus testimoni ini?')) return;
    await api.deleteTestimonial(id);
    showToast('Testimoni dihapus');
    loadAllData();
    onRefreshData();
  };

  // --- Leads Status Update ---
  const handleUpdateLeadStatus = async (id: string, status: LeadInterest['status']) => {
    await api.updateInterestStatus(id, status);
    showToast(`Status peminat diubah ke "${status}"`);
    loadAllData();
  };

  const handleDeleteLead = async (id: string) => {
    if (!window.confirm('Hapus data peminat ini?')) return;
    await api.deleteInterest(id);
    showToast('Data peminat dihapus');
    loadAllData();
  };

  const templateOptions: Array<{ value: DealerSettings['websiteTemplate']; label: string; accent: string; description: string }> = [
    { value: 'classic', label: 'Classic', accent: 'bg-red-600', description: 'Tampilan hitam-merah yang familiar dan tegas.' },
    { value: 'premium', label: 'Premium', accent: 'bg-amber-500', description: 'Look mewah dengan tone gelap dan gold accent.' },
    { value: 'minimal', label: 'Minimal', accent: 'bg-zinc-800', description: 'Netral, bersih, dan modern untuk brand yang simpel.' },
    { value: 'luxury', label: 'Luxury', accent: 'bg-amber-300', description: 'Elegan dengan nuansa premium dan refined.' },
    { value: 'sport', label: 'Sport', accent: 'bg-cyan-500', description: 'Tampilan dinamis dengan fokus pada energi dan aksi.' },
  ];

  const currentTemplate = templateOptions.find((item) => item.value === (settings?.websiteTemplate || 'classic')) || templateOptions[0];

  const approvedTestimonials = testimonials.filter((item) => item.approved !== false);
  const pendingTestimonials = testimonials.filter((item) => item.approved === false);
  const totalReviewRating = testimonials.reduce((sum, item) => sum + Number(item.rating || 0), 0);
  const averageReviewRating = testimonials.length ? totalReviewRating / testimonials.length : 0;

  const handleApproveAllTestimonials = async () => {
    if (pendingTestimonials.length === 0) {
      showToast('Semua review sudah disetujui');
      return;
    }

    try {
      const updated = await Promise.all(
        pendingTestimonials.map((item) => api.updateTestimonial(item.id, { approved: true }))
      );

      setTestimonials((prev) => prev.map((item) => {
        const match = updated.find((updatedItem) => updatedItem.id === item.id);
        return match ? match : item;
      }));

      showToast(`${updated.length} review berhasil disetujui`);
      loadAllData();
    } catch (err: any) {
      alert('Gagal menyetujui semua review: ' + (err?.message || 'Unknown error'));
    }
  };

  const handleTemplateChange = async (template: DealerSettings['websiteTemplate']) => {
    if (!settings) return;

    const nextSettings = { ...settings, websiteTemplate: template };
    setSettings(nextSettings);

    try {
      const saved = await api.updateSettings({ websiteTemplate: template });
      setSettings({ ...nextSettings, ...saved });
      showToast(`Template website diubah ke "${templateOptions.find((item) => item.value === template)?.label || 'Classic'}"`);
      onRefreshData();
    } catch (err: any) {
      alert('Gagal menyimpan template website: ' + err.message);
    }
  };

  // --- Settings Update ---
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      const savedSettings = await api.updateSettings(settings);
      setSettings(savedSettings);
      showToast('Pengaturan dealer berhasil disimpan ke database!');
      onRefreshData();
    } catch (err: any) {
      alert('Gagal menyimpan pengaturan: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-red-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 border border-red-400 font-medium text-xs sm:text-sm animate-in slide-in-from-bottom-5">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-black/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToWebsite}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold border border-white/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Lihat Website Showroom</span>
          </button>
          <div className="h-5 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-white hidden sm:inline">
              Database Terhubung & Sinkron
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <a
            href="/api/export/all"
            download
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl text-xs font-bold shadow-md shadow-red-950/40 transition-all border border-red-500/40"
            title="Download seluruh data showroom (JSON)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Semua Data</span>
          </a>
          <div className="h-4 w-px bg-white/10 hidden md:block" />
          <span className="text-xs text-zinc-400 hidden md:inline">
            Login: <strong className="text-white">Admin Honda Wijaya Abadi</strong>
          </span>
          <button
            onClick={loadAllData}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors"
            title="Refresh Data"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Sub-header Title */}
      <div className="bg-zinc-900/40 border-b border-white/5 px-4 sm:px-8 py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
              <span>Panel CMS Honda Wijaya Abadi Motor</span>
              <span className="bg-red-600/30 text-red-400 text-xs px-2.5 py-0.5 rounded-full border border-red-500/40">
                Database CRUD
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Kelola katalog motor, penawaran promo, prospek peminat (leads), ulasan pelanggan, dan profil dealer secara dinamis.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'dashboard', label: 'Ringkasan', icon: TrendingUp },
              { id: 'motors', label: `Motor (${motors.length})`, icon: Bike },
              { id: 'leads', label: `Peminat (${leads.length})`, icon: MessageSquare },
              { id: 'promos', label: `Promo (${promos.length})`, icon: Tag },
              { id: 'testimonials', label: `Ulasan (${testimonials.length})`, icon: Star },
              { id: 'settings', label: 'Pengaturan Dealer', icon: SettingsIcon },
              { id: 'export', label: 'Download & Backup Data', icon: Download },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-red-600 text-white shadow-lg shadow-red-900/30'
                      : 'bg-zinc-900/80 text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-8 py-8 w-full">
        {isLoading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">Memuat data showroom dari database...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: DASHBOARD */}
            {activeTab === 'dashboard' && (
              <div className="space-y-8 animate-in fade-in duration-300">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-5">
                    <div className="flex items-center justify-between text-zinc-400 mb-2">
                      <span className="text-xs font-semibold uppercase">Total Unit Motor</span>
                      <Bike className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="text-3xl font-black text-white">{motors.length}</div>
                    <p className="text-[11px] text-zinc-500 mt-1">Ready stock di showroom</p>
                  </div>

                  <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-5">
                    <div className="flex items-center justify-between text-zinc-400 mb-2">
                      <span className="text-xs font-semibold uppercase">Peminat Masuk</span>
                      <MessageSquare className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="text-3xl font-black text-white">{leads.length}</div>
                    <p className="text-[11px] text-emerald-400 mt-1">
                      {leads.filter((l) => l.status === 'Baru').length} menunggu tindak lanjut
                    </p>
                  </div>

                  <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-5">
                    <div className="flex items-center justify-between text-zinc-400 mb-2">
                      <span className="text-xs font-semibold uppercase">Promo Aktif</span>
                      <Tag className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div className="text-3xl font-black text-white">{promos.length}</div>
                    <p className="text-[11px] text-zinc-500 mt-1">Kampanye pemasaran</p>
                  </div>

                  <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-5">
                    <div className="flex items-center justify-between text-zinc-400 mb-2">
                      <span className="text-xs font-semibold uppercase">Ulasan Pembeli</span>
                      <Star className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div className="text-3xl font-black text-white">{testimonials.length}</div>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Rating total {totalReviewRating.toFixed(1)} · rata-rata {averageReviewRating.toFixed(1)}
                    </p>
                  </div>
                </div>

                {/* Recent Leads & Quick Actions */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Recent Leads */}
                  <div className="lg:col-span-8 bg-zinc-900/50 border border-white/10 rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-base font-bold text-white">Konsultasi / Peminat Terbaru</h3>
                        <p className="text-xs text-zinc-400">Pengajuan minat dari website yang perlu dihubungi</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('leads')}
                        className="text-xs text-red-400 hover:text-red-300 font-semibold"
                      >
                        Lihat Semua ({leads.length})
                      </button>
                    </div>

                    {leads.length === 0 ? (
                      <p className="text-xs text-zinc-500 py-8 text-center">Belum ada peminat baru.</p>
                    ) : (
                      <div className="divide-y divide-white/5 space-y-3 pt-2">
                        {leads.slice(0, 4).map((lead) => {
                          const cleanPhone = lead.phone.replace(/[^0-9]/g, '');
                          const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                            `Halo Kak ${lead.customer_name}, terima kasih telah menghubungi Honda Wijaya Abadi mengenai unit ${lead.motor_name}. Apakah ada yang bisa kami bantu?`
                          )}`;

                          return (
                            <div key={lead.id} className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-white">{lead.customer_name}</span>
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                      lead.status === 'Baru'
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                        : 'bg-zinc-800 text-zinc-400'
                                    }`}
                                  >
                                    {lead.status}
                                  </span>
                                </div>
                                <div className="text-xs text-zinc-400 mt-0.5">
                                  Unit: <span className="text-red-400 font-semibold">{lead.motor_name}</span> • Telp: {lead.phone} • {lead.payment_method}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span>Hubungi</span>
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Showroom Summary */}
                  <div className="lg:col-span-4 bg-zinc-900/50 border border-white/10 rounded-3xl p-6 space-y-4">
                    <h3 className="text-base font-bold text-white">Identitas Showroom</h3>
                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="text-zinc-500 block">Nama Dealer</span>
                        <span className="text-zinc-200 font-medium">{settings?.name}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Nomor WhatsApp Resmi</span>
                        <span className="text-zinc-200 font-medium">+{settings?.phone}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Alamat Showroom</span>
                        <span className="text-zinc-200 font-medium">{settings?.address}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Jam Buka</span>
                        <span className="text-zinc-200 font-medium">{settings?.workingHours}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveTab('settings')}
                      className="w-full mt-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-xl border border-white/10 transition-colors"
                    >
                      Ubah Info Showroom
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: MOTORS MANAGEMENT */}
            {activeTab === 'motors' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* Header controls */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={motorSearch}
                      onChange={(e) => setMotorSearch(e.target.value)}
                      placeholder="Cari motor di database..."
                      className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <button
                    onClick={handleOpenAddMotor}
                    className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-red-900/30 transition-all shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Motor Baru</span>
                  </button>
                </div>

                {/* Motors Table / Cards */}
                <div className="bg-zinc-900/50 border border-white/10 rounded-3xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-950/80 text-zinc-400 uppercase tracking-wider text-[11px] border-b border-white/10">
                        <tr>
                          <th className="py-3.5 px-4">Unit Motor</th>
                          <th className="py-3.5 px-4">Kategori</th>
                          <th className="py-3.5 px-4">Harga OTR</th>
                          <th className="py-3.5 px-4">Spesifikasi</th>
                          <th className="py-3.5 px-4">Bestseller</th>
                          <th className="py-3.5 px-4 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {motors
                          .filter((m) => m.name.toLowerCase().includes(motorSearch.toLowerCase()))
                          .map((m) => (
                            <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-lg bg-zinc-950 p-1 flex items-center justify-center border border-white/10 shrink-0">
                                    <img
                                      src={m.image}
                                      alt={m.name}
                                      className="max-h-full max-w-full object-contain"
                                    />
                                  </div>
                                  <div>
                                    <div className="font-bold text-white text-sm">{m.name}</div>
                                    <div className="text-[11px] text-zinc-400 line-clamp-1 max-w-xs">
                                      {m.description}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-4">
                                <span className="px-2.5 py-1 bg-zinc-800 text-zinc-300 rounded-md font-semibold text-[11px] border border-white/10">
                                  {m.category}
                                </span>
                              </td>

                              <td className="py-3 px-4 font-black text-white text-sm">
                                {formatRupiah(m.price)}
                              </td>

                              <td className="py-3 px-4">
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {m.specs &&
                                    m.specs.map((s, i) => (
                                      <span key={i} className="text-[10px] bg-zinc-800/80 text-zinc-400 px-1.5 py-0.5 rounded">
                                        {s}
                                      </span>
                                    ))}
                                </div>
                              </td>

                              <td className="py-3 px-4">
                                {m.is_bestseller ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                                    <Flame className="w-3 h-3 fill-current" />
                                    <span>Ya</span>
                                  </span>
                                ) : (
                                  <span className="text-zinc-500 text-[11px]">Tidak</span>
                                )}
                              </td>

                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleOpenEditMotor(m)}
                                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                                    title="Edit Motor"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMotor(m.id, m.name)}
                                    className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
                                    title="Hapus Motor"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: LEADS / PEMINAT */}
            {activeTab === 'leads' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">Daftar Peminat & Prospek Masuk</h2>
                    <p className="text-xs text-zinc-400">
                      Tersimpan secara dinamis setiap kali pengunjung mengklik "Saya Tertarik" atau "Ajukan Kredit"
                    </p>
                  </div>
                </div>

                <div className="bg-zinc-900/50 border border-white/10 rounded-3xl overflow-hidden shadow-xl">
                  {leads.length === 0 ? (
                    <div className="py-16 text-center text-zinc-400 text-sm">
                      Belum ada data peminat yang tersimpan di database.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-950/80 text-zinc-400 uppercase tracking-wider text-[11px] border-b border-white/10">
                          <tr>
                            <th className="py-3 px-4">Nama Pelanggan</th>
                            <th className="py-3 px-4">WhatsApp</th>
                            <th className="py-3 px-4">Unit Diminati</th>
                            <th className="py-3 px-4">Pembayaran & DP</th>
                            <th className="py-3 px-4">Catatan</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {leads.map((lead) => {
                            const cleanPhone = lead.phone.replace(/[^0-9]/g, '');
                            const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                              `Halo Kak ${lead.customer_name}, kami dari dealer resmi Honda Wijaya Abadi. Terkait pemesanan motor ${lead.motor_name}, ada yang ingin ditanyakan mengenai promo dan simulasi kredit?`
                            )}`;

                            return (
                              <tr key={lead.id} className="hover:bg-white/[0.02]">
                                <td className="py-3.5 px-4 font-bold text-white">
                                  {lead.customer_name}
                                  <div className="text-[10px] text-zinc-500 font-normal">
                                    {new Date(lead.created_at).toLocaleDateString('id-ID', {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </div>
                                </td>

                                <td className="py-3.5 px-4">
                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-400 hover:underline font-medium flex items-center gap-1"
                                  >
                                    <MessageSquare className="w-3 h-3" />
                                    <span>{lead.phone}</span>
                                  </a>
                                </td>

                                <td className="py-3.5 px-4 font-semibold text-red-400">
                                  {lead.motor_name}
                                </td>

                                <td className="py-3.5 px-4 text-zinc-300">
                                  <div className="font-medium">{lead.payment_method}</div>
                                  <div className="text-[11px] text-zinc-400">{lead.dp_estimate || '-'}</div>
                                </td>

                                <td className="py-3.5 px-4 text-zinc-400 max-w-xs truncate">
                                  {lead.note || '-'}
                                </td>

                                <td className="py-3.5 px-4">
                                  <select
                                    value={lead.status}
                                    onChange={(e) =>
                                      handleUpdateLeadStatus(lead.id, e.target.value as any)
                                    }
                                    className="bg-zinc-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-red-500 font-medium"
                                  >
                                    <option value="Baru">Baru</option>
                                    <option value="Dihubungi">Dihubungi</option>
                                    <option value="Selesai">Selesai</option>
                                    <option value="Ditolak">Ditolak</option>
                                  </select>
                                </td>

                                <td className="py-3.5 px-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <a
                                      href={waUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 rounded-lg transition-colors"
                                      title="Kirim Pesan WhatsApp"
                                    >
                                      <MessageSquare className="w-4 h-4" />
                                    </a>
                                    <button
                                      onClick={() => handleDeleteLead(lead.id)}
                                      className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
                                      title="Hapus"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: PROMOS */}
            {activeTab === 'promos' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">Kelola Kampanye Promo</h2>
                    <p className="text-xs text-zinc-400">Atur penawaran diskon, cashback, dan program cicilan</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingPromo({ title: '', description: '', terms: 'S&K Berlaku', badge: 'Promo', discountValue: '' });
                      setIsPromoModalOpen(true);
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Promo</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {promos.map((p) => (
                    <div
                      key={p.id}
                      className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] bg-red-600/20 text-red-400 font-bold px-2 py-0.5 rounded">
                            {p.badge || 'Promo'}
                          </span>
                          <span className="text-xs font-bold text-yellow-400">{p.discountValue}</span>
                        </div>
                        <h4 className="text-base font-bold text-white">{p.title}</h4>
                        <p className="text-xs text-zinc-400 mt-2">{p.description}</p>
                        <p className="text-[11px] text-zinc-500 mt-3 pt-2 border-t border-white/5">
                          {p.terms}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingPromo(p);
                            setIsPromoModalOpen(true);
                          }}
                          className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg text-xs flex items-center gap-1"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeletePromo(p.id)}
                          className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg text-xs flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: TESTIMONIALS */}
            {activeTab === 'testimonials' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">Kelola Ulasan Pelanggan</h2>
                    <p className="text-xs text-zinc-400">Testimoni nyata dari pembeli motor di showroom</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleApproveAllTestimonials}
                      className="px-4 py-2 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-xl"
                    >
                      Approve Semua Review
                    </button>
                    <button
                      onClick={() => {
                        setEditingTesti({ name: '', motor: 'Honda Vario', rating: 5, comment: '', date: 'Baru saja' });
                        setIsTestiModalOpen(true);
                      }}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambah Testimoni</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-4">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Total Rating</div>
                    <div className="mt-2 text-2xl font-black text-white">{totalReviewRating.toFixed(1)}</div>
                  </div>
                  <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-4">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Jumlah Review</div>
                    <div className="mt-2 text-2xl font-black text-white">{testimonials.length}</div>
                  </div>
                  <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-4">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Pending</div>
                    <div className="mt-2 text-2xl font-black text-white">{pendingTestimonials.length}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {testimonials.map((t) => (
                    <div
                      key={t.id}
                      className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1 text-yellow-400">
                            {[...Array(t.rating || 5)].map((_, i) => (
                              <Star key={i} className="w-3.5 h-3.5 fill-current" />
                            ))}
                          </div>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${t.approved === false ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'}`}>
                            {t.approved === false ? 'Pending' : 'Approved'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 italic">"{t.comment}"</p>
                        {t.email && <p className="mt-2 text-[10px] text-zinc-400">Email: {t.email}</p>}
                        {t.phone && <p className="text-[10px] text-zinc-400">Phone: {t.phone}</p>}
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-white">{t.name}</div>
                          <div className="text-[11px] text-red-400">{t.motor}</div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={async () => {
                              const updated = await api.updateTestimonial(t.id, { approved: !(t.approved === false) });
                              setTestimonials((prev) => prev.map((item) => item.id === t.id ? updated : item));
                              showToast(updated.approved === false ? 'Review ditunda moderasi' : 'Review disetujui');
                            }}
                            className="p-1 text-zinc-400 hover:text-white"
                            title={t.approved === false ? 'Setujui review' : 'Tunda review'}
                          >
                            {t.approved === false ? <CheckCircle className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => {
                              setEditingTesti(t);
                              setIsTestiModalOpen(true);
                            }}
                            className="p-1 text-zinc-400 hover:text-white"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTesti(t.id)}
                            className="p-1 text-zinc-400 hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 6: SETTINGS */}
            {activeTab === 'settings' && settings && (
              <div className="max-w-3xl space-y-6 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-lg font-bold text-white">Pengaturan Identitas Showroom</h2>
                  <p className="text-xs text-zinc-400">
                    Perubahan langsung disimpan ke file database dan diterapkan ke website secara realtime.
                  </p>
                </div>

                <form onSubmit={handleSaveSettings} className="bg-zinc-900/50 border border-white/10 rounded-3xl p-6 sm:p-8 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-300 uppercase mb-1">
                        Nama Dealer Resmi
                      </label>
                      <input
                        type="text"
                        value={settings.name}
                        onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                        className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-red-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-300 uppercase mb-1">
                        Tagline / Slogan
                      </label>
                      <input
                        type="text"
                        value={settings.tagline}
                        onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                        className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-zinc-300 uppercase mb-1">
                      Template View Website
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {templateOptions.map((option) => {
                        const isSelected = (settings.websiteTemplate || 'classic') === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleTemplateChange(option.value)}
                            className={`group text-left rounded-2xl border p-3 transition-all ${isSelected ? 'border-red-500 bg-red-500/10 shadow-lg shadow-red-950/30' : 'border-white/10 bg-zinc-950/70 hover:border-white/20'}`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className={`h-8 w-8 rounded-full ${option.accent}`} />
                              <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                                {isSelected ? 'Active' : 'Preview'}
                              </span>
                            </div>
                            <div className="text-sm font-bold text-white">{option.label}</div>
                            <p className="mt-1 text-[11px] text-zinc-400">{option.description}</p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-zinc-950 p-4">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                        Live Preview
                      </div>
                      <div className={`website-template-${settings.websiteTemplate || 'classic'} rounded-2xl border p-4 shadow-inner`}>
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className={`h-3 w-16 rounded-full ${currentTemplate.accent}`} />
                          <div className="flex gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-white/70" />
                            <span className="h-2.5 w-2.5 rounded-full bg-white/40" />
                            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="h-3 w-32 rounded-full bg-white/80" />
                          <div className="h-2.5 w-24 rounded-full bg-white/40" />
                          <div className={`mt-4 h-20 rounded-xl ${currentTemplate.accent}`} />
                          <div className="grid grid-cols-3 gap-2 pt-2">
                            <div className="h-12 rounded-lg bg-white/10" />
                            <div className="h-12 rounded-lg bg-white/10" />
                            <div className="h-12 rounded-lg bg-white/10" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-300 uppercase mb-1">
                        Nomor WhatsApp Sales (dengan kode 62)
                      </label>
                      <input
                        type="text"
                        value={settings.phone}
                        onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                        className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-red-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-300 uppercase mb-1">
                        Email Resmi
                      </label>
                      <input
                        type="email"
                        value={settings.email}
                        onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                        className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 uppercase mb-1">
                      Alamat Showroom
                    </label>
                    <textarea
                      rows={2}
                      value={settings.address}
                      onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 uppercase mb-1">
                      Jam Operasional
                    </label>
                    <input
                      type="text"
                      value={settings.workingHours}
                      onChange={(e) => setSettings({ ...settings, workingHours: e.target.value })}
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 uppercase mb-1">
                      Hero Headline Subtitle
                    </label>
                    <textarea
                      rows={2}
                      value={settings.heroSubtitle}
                      onChange={(e) => setSettings({ ...settings, heroSubtitle: e.target.value })}
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div className="pt-3 flex justify-end">
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-900/40 flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      <span>Simpan Pengaturan ke Database</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </main>

      {/* --- MODAL ADD / EDIT MOTOR --- */}
      {isMotorModalOpen && editingMotor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-zinc-950 border border-white/15 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-zinc-900/60">
              <h3 className="text-base font-bold text-white">
                {editingMotor.id ? 'Edit Data Motor' : 'Tambah Motor Baru'}
              </h3>
              <button
                onClick={() => setIsMotorModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMotor} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block font-bold text-zinc-300 uppercase mb-1">Nama Motor *</label>
                <input
                  type="text"
                  required
                  value={editingMotor.name || ''}
                  onChange={(e) => setEditingMotor({ ...editingMotor, name: e.target.value })}
                  placeholder="Contoh: Honda Vario 160 ABS"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:border-red-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-300 uppercase mb-1">Kategori</label>
                  <select
                    value={editingMotor.category || 'Matic'}
                    onChange={(e) => setEditingMotor({ ...editingMotor, category: e.target.value })}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:border-red-500 focus:outline-none"
                  >
                    <option value="Matic">Matic</option>
                    <option value="Matic Premium">Matic Premium</option>
                    <option value="Sport">Sport</option>
                    <option value="Adventure">Adventure</option>
                    <option value="Cub/Bebek">Cub/Bebek</option>
                    <option value="EV">EV (Listrik)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-zinc-300 uppercase mb-1">Harga OTR *</label>
                  <input
                    type="text"
                    required
                    value={editingMotor.price || ''}
                    onChange={(e) => setEditingMotor({ ...editingMotor, price: e.target.value })}
                    placeholder="20.775.000"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:border-red-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Image Input & Upload */}
              <div>
                <label className="block font-bold text-zinc-300 uppercase mb-1">
                  Gambar Motor (URL atau Upload File)
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editingMotor.image || ''}
                    onChange={(e) => setEditingMotor({ ...editingMotor, image: e.target.value })}
                    placeholder="https://... atau /uploads/..."
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:border-red-500 focus:outline-none"
                  />
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs flex items-center gap-1.5 border border-white/10">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Foto dari Perangkat</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUploadMotor}
                        className="hidden"
                      />
                    </label>
                    {editingMotor.image && (
                      <span className="text-zinc-500 text-[11px] truncate max-w-xs">
                        {editingMotor.image}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Specs Tag Input */}
              <div>
                <label className="block font-bold text-zinc-300 uppercase mb-1">
                  Spesifikasi Utama (pisahkan dengan koma)
                </label>
                <input
                  type="text"
                  value={
                    Array.isArray(editingMotor.specs)
                      ? editingMotor.specs.join(', ')
                      : (editingMotor.specs as any) || ''
                  }
                  onChange={(e) =>
                    setEditingMotor({
                      ...editingMotor,
                      specs: e.target.value.split(',').map((s) => s.trim()),
                    })
                  }
                  placeholder="160cc, ABS, Smart Key, LED"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-300 uppercase mb-1">Deskripsi</label>
                <textarea
                  rows={2}
                  value={editingMotor.description || ''}
                  onChange={(e) => setEditingMotor({ ...editingMotor, description: e.target.value })}
                  placeholder="Deskripsi keunggulan motor..."
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:border-red-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="bestseller-toggle"
                  checked={Boolean(editingMotor.is_bestseller)}
                  onChange={(e) =>
                    setEditingMotor({ ...editingMotor, is_bestseller: e.target.checked })
                  }
                  className="rounded border-zinc-700 text-red-600 focus:ring-red-500 w-4 h-4 bg-zinc-900"
                />
                <label htmlFor="bestseller-toggle" className="text-zinc-300 font-semibold cursor-pointer">
                  Tandai sebagai 🔥 Bestseller di Showroom
                </label>
              </div>

              <div className="pt-4 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMotorModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 text-zinc-400 hover:text-white rounded-xl text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Motor</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL ADD / EDIT PROMO --- */}
      {isPromoModalOpen && editingPromo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-zinc-950 border border-white/15 rounded-3xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <h3 className="font-bold text-white text-sm">
                {editingPromo.id ? 'Edit Promo' : 'Tambah Promo Baru'}
              </h3>
              <button onClick={() => setIsPromoModalOpen(false)} className="text-zinc-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePromo} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-zinc-300 mb-1">Judul Promo *</label>
                <input
                  type="text"
                  required
                  value={editingPromo.title || ''}
                  onChange={(e) => setEditingPromo({ ...editingPromo, title: e.target.value })}
                  placeholder="Contoh: Kredit DP 0%"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-300 mb-1">Label Diskon / Badge</label>
                <input
                  type="text"
                  value={editingPromo.discountValue || ''}
                  onChange={(e) => setEditingPromo({ ...editingPromo, discountValue: e.target.value })}
                  placeholder="Contoh: DP 0% atau Cashback 2 Juta"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-300 mb-1">Deskripsi</label>
                <textarea
                  rows={2}
                  value={editingPromo.description || ''}
                  onChange={(e) => setEditingPromo({ ...editingPromo, description: e.target.value })}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-300 mb-1">Syarat & Ketentuan</label>
                <input
                  type="text"
                  value={editingPromo.terms || ''}
                  onChange={(e) => setEditingPromo({ ...editingPromo, terms: e.target.value })}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPromoModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL ADD / EDIT TESTIMONIAL --- */}
      {isTestiModalOpen && editingTesti && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-zinc-950 border border-white/15 rounded-3xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <h3 className="font-bold text-white text-sm">
                {editingTesti.id ? 'Edit Testimoni' : 'Tambah Testimoni'}
              </h3>
              <button onClick={() => setIsTestiModalOpen(false)} className="text-zinc-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTesti} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-zinc-300 mb-1">Nama Pembeli *</label>
                <input
                  type="text"
                  required
                  value={editingTesti.name || ''}
                  onChange={(e) => setEditingTesti({ ...editingTesti, name: e.target.value })}
                  placeholder="Contoh: Rian Gunawan"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-300 mb-1">Motor yang Dibeli</label>
                <input
                  type="text"
                  value={editingTesti.motor || ''}
                  onChange={(e) => setEditingTesti({ ...editingTesti, motor: e.target.value })}
                  placeholder="Contoh: Honda PCX 160"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-300 mb-1">Komentar / Ulasan *</label>
                <textarea
                  rows={3}
                  required
                  value={editingTesti.comment || ''}
                  onChange={(e) => setEditingTesti({ ...editingTesti, comment: e.target.value })}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTestiModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
