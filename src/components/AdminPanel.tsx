import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Shield,
  Sun,
  Moon,
} from 'lucide-react';
import { Motor, Promo, Testimonial, DealerSettings, LeadInterest, ManifestoItem, AdminSession, AdminUser, AuditLog, FIFPriceList } from '../types';
import { api, formatRupiah } from '../services/api';
import { DEFAULT_FIF_PRICE_LIST, FIF_DP_PERCENTAGES, FIF_TENORS, getFIFPriceListModel, normalizeMotorOtrPrice } from '../services/fifPriceList';
import { MAX_MOTOR_IMAGES, MAX_PROMO_IMAGES } from '../constants';
import { DEFAULT_SEO_CANONICAL_URL, DEFAULT_SEO_DESCRIPTION, DEFAULT_SEO_FOCUS_KEYWORD, DEFAULT_SEO_KEYWORDS, DEFAULT_SEO_ROBOTS, DEFAULT_SEO_TITLE, HONDA_WIJAYA_COLOR_PALETTES } from '../constants';
import {
  CATALOG_ANIMATION_OPTIONS,
  DEFAULT_CATALOG_ANIMATION,
  DEFAULT_CATALOG_ANIMATION_SPEED,
  MAX_CATALOG_ANIMATION_SPEED,
  MIN_CATALOG_ANIMATION_SPEED,
  normalizeCatalogAnimationSpeed,
} from '../catalogAnimation';
import { createWhatsAppUrl, normalizeWhatsAppNumber } from '../utils/whatsapp';
import { CustomizationPanel } from './CustomizationPanel';

interface AdminPanelProps {
  onBackToWebsite: () => void;
  onRefreshData: () => void;
}

const SEO_KEYWORD_CONCEPTS: Record<string, string> = {
  angsuran: 'kredit',
  cicilan: 'kredit',
  pembiayaan: 'kredit',
  sepeda: 'motor',
  kendaraan: 'motor',
  showroom: 'dealer',
  penjual: 'dealer',
  otr: 'harga',
  price: 'harga',
  diskon: 'promo',
  cashback: 'promo',
  gegerkalong: 'bandung',
};

function seoKeywordTokens(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('id-ID')
    .match(/[a-z0-9]+/g) || [];
}

function seoKeywordConcept(term: string) {
  return SEO_KEYWORD_CONCEPTS[term] || term;
}

function seoTermsAreClose(first: string, second: string) {
  if (first === second) return true;
  if (Math.abs(first.length - second.length) > 1 || Math.min(first.length, second.length) < 5) return false;

  let firstIndex = 0;
  let secondIndex = 0;
  let edits = 0;
  while (firstIndex < first.length && secondIndex < second.length) {
    if (first[firstIndex] === second[secondIndex]) {
      firstIndex += 1;
      secondIndex += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (first.length > second.length) firstIndex += 1;
    else if (second.length > first.length) secondIndex += 1;
    else {
      firstIndex += 1;
      secondIndex += 1;
    }
  }
  return edits + (first.length - firstIndex) + (second.length - secondIndex) <= 1;
}

function matchFocusKeyword(keyword: string, title: string, description: string) {
  const ignoredTerms = new Set(['dan', 'dari', 'di', 'ke', 'untuk', 'yang', 'dengan', 'pada']);
  const focusTerms = [...new Set(seoKeywordTokens(keyword).filter((term) => !ignoredTerms.has(term)).map(seoKeywordConcept))];
  const titleTerms = seoKeywordTokens(title).map(seoKeywordConcept);
  const descriptionTerms = seoKeywordTokens(description).map(seoKeywordConcept);
  const matches = (term: string, candidates: string[]) => candidates.some((candidate) => seoTermsAreClose(term, candidate));
  const matchedTerms = focusTerms.filter((term) => matches(term, [...titleTerms, ...descriptionTerms]));
  const minimumMatches = focusTerms.length <= 2 ? focusTerms.length : Math.ceil(focusTerms.length * 0.67);
  const appearsInTitle = focusTerms.some((term) => matches(term, titleTerms));
  const appearsInDescription = focusTerms.some((term) => matches(term, descriptionTerms));

  return {
    passed: focusTerms.length > 0 && matchedTerms.length >= minimumMatches && appearsInTitle && appearsInDescription,
    detail: focusTerms.length ? `${matchedTerms.length}/${focusTerms.length} istilah relevan cocok` : 'Kata kunci belum diatur',
  };
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBackToWebsite, onRefreshData }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'motors' | 'promos' | 'leads' | 'testimonials' | 'settings' | 'seo' | 'customization' | 'security' | 'credit' | 'export'>('dashboard');
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [securityForm, setSecurityForm] = useState({ username: '', password: '', role: 'Staff Admin' });

  // Local state for all dynamic data
  const [motors, setMotors] = useState<Motor[]>([]);
  const [editingMotorFifOptions, setEditingMotorFifOptions] = useState<Record<string, string[]>>({});
  const [promos, setPromos] = useState<Promo[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [settings, setSettings] = useState<DealerSettings | null>(null);
  const [leads, setLeads] = useState<LeadInterest[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [visitorFilter, setVisitorFilter] = useState<'all' | '7d' | '30d' | 'today' | 'custom'>('7d');
  const [visitorStartDate, setVisitorStartDate] = useState('');
  const [visitorEndDate, setVisitorEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [activeExport, setActiveExport] = useState<string | null>(null);
  const [adminTheme, setAdminTheme] = useState<'dark' | 'light'>(() => (
    localStorage.getItem('hwa-admin-theme') === 'light' ? 'light' : 'dark'
  ));
  const [isCheckingSeo, setIsCheckingSeo] = useState(false);
  const [seoFileChecks, setSeoFileChecks] = useState<{ sitemap: boolean | null; robots: boolean | null }>({ sitemap: null, robots: null });
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [fifPriceList, setFifPriceList] = useState<FIFPriceList>(DEFAULT_FIF_PRICE_LIST);
  const [isImportingFifPriceList, setIsImportingFifPriceList] = useState(false);
  const fifPriceListInputRef = useRef<HTMLInputElement>(null);

  // Modals for CRUD
  const [isMotorModalOpen, setIsMotorModalOpen] = useState(false);
  const [editingMotor, setEditingMotor] = useState<Partial<Motor> | null>(null);

  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Partial<Promo> | null>(null);
  const [isUploadingPromoImages, setIsUploadingPromoImages] = useState(false);
  const [sharingPromo, setSharingPromo] = useState<Promo | null>(null);
  const [promoRecipientPhone, setPromoRecipientPhone] = useState('');

  const [isTestiModalOpen, setIsTestiModalOpen] = useState(false);
  const [editingTesti, setEditingTesti] = useState<Partial<Testimonial> | null>(null);

  // Search in motors
  const [motorSearch, setMotorSearch] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    localStorage.setItem('hwa-admin-theme', adminTheme);
  }, [adminTheme]);

  useEffect(() => {
    if (!settings) return;
    window.dispatchEvent(new CustomEvent('hwa-admin-settings-update', { detail: settings }));
  }, [settings]);

  const toggleAdminTheme = () => {
    setAdminTheme((mode) => mode === 'dark' ? 'light' : 'dark');
  };

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [motorsRes, promosRes, testiRes, settingsRes, leadsRes, priceListRes] = await Promise.all([
        api.getMotors(),
        api.getPromos(),
        api.getTestimonials(),
        api.getSettings(),
        api.getInterests(),
        api.getFifPriceList().catch(() => DEFAULT_FIF_PRICE_LIST),
      ]);

      setFifPriceList(priceListRes);
      setMotors(motorsRes.map((motor) => normalizeMotorOtrPrice(motor, priceListRes)));
      setPromos(promosRes);
      setTestimonials(testiRes);
      setSettings(settingsRes);
      setLeads(leadsRes);
    } catch (err) {
      console.error('Failed to load admin data:', err);
      showToast('Gagal memuat beberapa data dari database');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('hwa-admin-token');
    if (!token) {
      setAdminSession(null);
      return;
    }

    api.getAdminMe()
      .then(setAdminSession)
      .catch(() => {
        localStorage.removeItem('hwa-admin-token');
        setAdminSession(null);
      });
  }, []);

  useEffect(() => {
    if (!adminSession) return;
    loadAllData();
    api.getAdminUsers().then(setAdminUsers).catch(() => undefined);
    api.getAuditLogs().then(setAuditLogs).catch(() => undefined);
  }, [adminSession]);

  useEffect(() => {
    if (!adminSession || activeTab !== 'seo') return;

    void handleCheckSeoFiles();
    const intervalId = window.setInterval(() => {
      void handleCheckSeoFiles();
    }, 5 * 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, [adminSession, activeTab]);

  const handleAdminLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const result = await api.loginAdmin(loginForm.username, loginForm.password);
      setAdminSession(result.user);
    } catch (error: any) {
      setLoginError(error.message || 'Login gagal');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAdminLogout = async () => {
    await api.logoutAdmin();
    setAdminSession(null);
  };

  const refreshSecurityData = async () => {
    const [users, logs] = await Promise.all([api.getAdminUsers(), api.getAuditLogs()]);
    setAdminUsers(users);
    setAuditLogs(logs);
  };

  const handleCreateAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await api.createAdminUser(securityForm);
      setSecurityForm({ username: '', password: '', role: 'Staff Admin' });
      await refreshSecurityData();
      showToast('Admin baru berhasil dibuat');
    } catch (error: any) {
      alert(error.message || 'Gagal membuat admin');
    }
  };

  const visitorAnalytics = analytics?.analytics || {
    totalViews: 0,
    dailyVisitors: [],
    hourlyVisitors: [],
    peakHour: '-',
  };
  const dailyVisitors: Array<{ label: string; visits: number }> = Array.isArray(visitorAnalytics.dailyVisitors)
    ? visitorAnalytics.dailyVisitors.map((item: any) => ({
        isoDate: String(item?.date || ''),
        label: String(item?.label || ''),
        visits: Number(item?.visits || 0),
      }))
    : [];
  const hourlyVisitors: Array<{ label: string; visits: number }> = Array.isArray(visitorAnalytics.hourlyVisitors)
    ? visitorAnalytics.hourlyVisitors.map((item: any) => ({
        label: String(item?.label || ''),
        visits: Number(item?.visits || 0),
      }))
    : [];

  const visitorFilterOptions = [
    { value: 'all', label: 'Semua data' },
    { value: '7d', label: '7 hari terakhir' },
    { value: '30d', label: '30 hari terakhir' },
    { value: 'today', label: 'Hari ini' },
    { value: 'custom', label: 'Tanggal tertentu' },
  ] as const;

  const visitorFilterPresets = visitorFilterOptions.filter((option) => option.value !== 'custom');

  const todayIsoDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

  useEffect(() => {
    if (visitorFilter !== 'custom') return;
    if (!visitorStartDate && !visitorEndDate) {
      setVisitorStartDate(todayIsoDate);
      setVisitorEndDate(todayIsoDate);
    }
  }, [todayIsoDate, visitorFilter, visitorStartDate, visitorEndDate]);

  const effectiveVisitorStartDate = visitorStartDate || todayIsoDate;
  const effectiveVisitorEndDate = visitorEndDate || effectiveVisitorStartDate;
  const daysAgo = (date: string, days: number) => {
    const shifted = new Date(`${date}T00:00:00.000Z`);
    shifted.setUTCDate(shifted.getUTCDate() - days);
    return shifted.toISOString().slice(0, 10);
  };
  const analyticsStartDate = visitorFilter === 'today'
    ? todayIsoDate
    : visitorFilter === '7d'
      ? daysAgo(todayIsoDate, 6)
      : visitorFilter === '30d'
        ? daysAgo(todayIsoDate, 29)
        : visitorFilter === 'custom'
          ? effectiveVisitorStartDate
          : undefined;
  const analyticsEndDate = visitorFilter === 'custom'
    ? effectiveVisitorEndDate
    : visitorFilter === 'all'
      ? undefined
      : todayIsoDate;

  useEffect(() => {
    if (!adminSession) return;

    let isCurrent = true;
    const refreshVisitorAnalytics = async () => {
      try {
        const result = await api.getAnalytics(analyticsStartDate, analyticsEndDate);
        if (isCurrent) setAnalytics(result);
      } catch (error) {
        console.error('Failed to refresh visitor analytics:', error);
      }
    };

    void refreshVisitorAnalytics();
    const intervalId = window.setInterval(() => void refreshVisitorAnalytics(), 15_000);
    return () => {
      isCurrent = false;
      window.clearInterval(intervalId);
    };
  }, [adminSession, analyticsEndDate, analyticsStartDate]);

  const activeDailyVisitors = dailyVisitors;
  const activeHourlyVisitors = hourlyVisitors;

  const totalSelectedVisitors = activeDailyVisitors.reduce((sum: number, item: { label: string; visits: number }) => sum + Number(item.visits || 0), 0);
  const websiteVisitorTotal = Number(visitorAnalytics.totalViews || 0);
  const todayWebsiteVisitors = totalSelectedVisitors;
  const averageDailyWebsiteVisitors = activeDailyVisitors.length
    ? Math.round(totalSelectedVisitors / activeDailyVisitors.length)
    : 0;
  const busyHourVisitors = activeHourlyVisitors.filter((item: { visits: number }) => Number(item.visits || 0) > 0);
  const peakHourEntry: { label: string; visits: number } = busyHourVisitors.length
    ? busyHourVisitors.reduce(
        (max: { label: string; visits: number }, item: { label: string; visits: number }) => Number(item.visits || 0) > Number(max.visits || 0) ? item : max,
        busyHourVisitors[0]
      )
    : { label: '09:00', visits: 0 };
  const peakWebsiteHour = peakHourEntry.label || visitorAnalytics.peakHour || '09.00 - 12.00';
  const peakWebsiteHourVisitors = Number(peakHourEntry.visits || 0);
  const dailyPieColors = ['#22d3ee', '#fb7185', '#fbbf24', '#34d399', '#818cf8', '#f97316', '#a3e635'];
  const dailyPieEntries = activeDailyVisitors
    .filter((item: { visits: number }) => Number(item.visits || 0) > 0)
    .map((item: { label: string; visits: number; isoDate?: string }) => ({
      label: item.isoDate
        ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${item.isoDate}T12:00:00Z`))
        : item.label,
      visits: Number(item.visits || 0),
    }));
  const rankedPieEntries = [...dailyPieEntries].sort((first, second) => second.visits - first.visits);
  const dailyPieDisplayEntries = rankedPieEntries.length > 7
    ? [
        ...rankedPieEntries.slice(0, 6),
        { label: 'Hari lainnya', visits: rankedPieEntries.slice(6).reduce((sum, item) => sum + item.visits, 0) },
      ]
    : dailyPieEntries;
  const dailyPieTotal = dailyPieDisplayEntries.reduce((sum, item) => sum + item.visits, 0);
  let pieStartAngle = -90;
  const dailyPieSlices = dailyPieDisplayEntries.map((item, index) => {
    const sweepAngle = dailyPieTotal ? item.visits / dailyPieTotal * 360 : 0;
    const startAngle = pieStartAngle;
    const endAngle = startAngle + sweepAngle;
    pieStartAngle = endAngle;
    const pointAt = (angle: number) => {
      const radians = angle * Math.PI / 180;
      return { x: 110 + 94 * Math.cos(radians), y: 110 + 94 * Math.sin(radians) };
    };
    const start = pointAt(startAngle);
    const end = pointAt(endAngle);
    const path = sweepAngle >= 359.99
      ? ''
      : `M 110 110 L ${start.x} ${start.y} A 94 94 0 ${sweepAngle > 180 ? 1 : 0} 1 ${end.x} ${end.y} Z`;
    return { ...item, color: dailyPieColors[index % dailyPieColors.length], path, sweepAngle };
  });
  const topFiveHours = [...busyHourVisitors]
    .sort((first: { visits: number }, second: { visits: number }) => Number(second.visits || 0) - Number(first.visits || 0))
    .slice(0, 5);
  const topHourMaxVisits = Math.max(...topFiveHours.map((item: { visits: number }) => Number(item.visits || 0)), 1);
  const weeklyTrendVisitors = activeDailyVisitors.slice(-7);
  const weeklyTrendMaxVisits = Math.max(...weeklyTrendVisitors.map((item: { visits: number }) => Number(item.visits || 0)), 1);
  const weeklyTrendPoints = weeklyTrendVisitors.map((item: { label: string; visits: number; isoDate?: string }, index: number) => {
    const x = 42 + (index / Math.max(weeklyTrendVisitors.length - 1, 1)) * 636;
    const y = 168 - (Number(item.visits || 0) / weeklyTrendMaxVisits) * 122;
    const dateLabel = item.isoDate
      ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${item.isoDate}T12:00:00Z`))
      : item.label;
    return { ...item, x, y, dateLabel };
  });
  const weeklyTrendArea = weeklyTrendPoints.length > 1
    ? `M ${weeklyTrendPoints[0].x} 174 L ${weeklyTrendPoints.map((point) => `${point.x} ${point.y}`).join(' L ')} L ${weeklyTrendPoints[weeklyTrendPoints.length - 1].x} 174 Z`
    : '';
  const previousDayVisitors = Number(weeklyTrendVisitors[weeklyTrendVisitors.length - 2]?.visits || 0);
  const latestDayVisitors = Number(weeklyTrendVisitors[weeklyTrendVisitors.length - 1]?.visits || 0);
  const weeklyTrendChange = previousDayVisitors
    ? Math.round(((latestDayVisitors - previousDayVisitors) / previousDayVisitors) * 100)
    : latestDayVisitors > 0 ? 100 : 0;

  const handleExportVisitorData = () => {
    const rows = [
      ['Tanggal', 'Nama hari', 'Pengunjung'],
      ...activeDailyVisitors.map((item: { label: string; visits: number; isoDate?: string }) => [
        item.isoDate || item.label,
        item.label,
        String(item.visits || 0),
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `visitor-data-${visitorFilter}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Data pengunjung berhasil diekspor');
  };

  if (!adminSession) {
    return (
      <div className={`admin-panel relative min-h-screen flex items-center justify-center px-4 ${adminTheme === 'light' ? 'admin-theme-light bg-zinc-50 text-zinc-900' : 'bg-zinc-950 text-zinc-100'}`}>
        <button
          type="button"
          onClick={toggleAdminTheme}
          aria-label={`Aktifkan mode ${adminTheme === 'dark' ? 'terang' : 'gelap'} admin`}
          title={`Aktifkan mode ${adminTheme === 'dark' ? 'terang' : 'gelap'} admin`}
          className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
        >
          {adminTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span>{adminTheme === 'dark' ? 'Tema terang' : 'Tema gelap'}</span>
        </button>
        <form onSubmit={handleAdminLogin} className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-900/80 p-7 shadow-2xl">
          <div className="mb-7">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-400">Honda Wijaya Abadi</p>
            <h1 className="mt-2 text-2xl font-black text-white">Login Admin Panel</h1>
            <p className="mt-2 text-sm text-zinc-400">Masuk untuk mengelola website dan melihat histori perubahan.</p>
          </div>
          <div className="space-y-4">
            <input required value={loginForm.username} onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })} placeholder="Username" className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-500 focus:outline-none" />
            <input required type="password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} placeholder="Password" className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-500 focus:outline-none" />
            {loginError && <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{loginError}</p>}
            <button disabled={isLoggingIn} className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-60">{isLoggingIn ? 'Memverifikasi...' : 'Masuk ke Panel Admin'}</button>
            <button type="button" onClick={onBackToWebsite} className="w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-zinc-300 hover:bg-white/5">Kembali ke Website</button>
          </div>
        </form>
      </div>
    );
  }

  // --- Motor CRUD Handlers ---
  const handleOpenAddMotor = () => {
    setEditingMotorFifOptions(Object.fromEntries(FIF_DP_PERCENTAGES.map((percentage) => [String(percentage), Array(FIF_TENORS.length + 1).fill('')])));
    setEditingMotor({
      name: '',
      category: 'Matic',
      price: '20.000.000',
      specs: ['110cc', 'eSP'],
      description: '',
      image: '',
      images: Array(MAX_MOTOR_IMAGES).fill(''),
      is_bestseller: false,
    });
    setIsMotorModalOpen(true);
  };

  const handleOpenEditMotor = (motor: Motor) => {
    const fifModel = getFIFPriceListModel(motor.name, fifPriceList);
    setEditingMotorFifOptions(Object.fromEntries(FIF_DP_PERCENTAGES.map((percentage) => {
      const values = fifModel?.options?.[String(percentage)] || [];
      return [String(percentage), Array.from({ length: FIF_TENORS.length + 1 }, (_, index) => values[index] ? String(values[index]) : '')];
    })));
    setEditingMotor({ ...motor, images: [...(motor.images || [motor.image]), ...Array(MAX_MOTOR_IMAGES).fill('')].slice(0, MAX_MOTOR_IMAGES) });
    setIsMotorModalOpen(true);
  };

  const handleSaveMotor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMotor || !editingMotor.name) return;

    try {
      const name = editingMotor.name.trim();
      const numericPrice = Number(String(editingMotor.price || '').replace(/[^0-9]/g, ''));
      if (!numericPrice) throw new Error('Harga OTR wajib diisi sebelum menyimpan motor dan template cicilan.');

      const fifOptions: Record<string, number[]> = {};
      for (const percentage of FIF_DP_PERCENTAGES) {
        const key = String(percentage);
        const rawValues = editingMotorFifOptions[key] || Array(FIF_TENORS.length + 1).fill('');
        const values = rawValues.map((value) => Number(String(value || '').replace(/[^0-9]/g, '')));
        if (values.every((value) => value === 0)) continue;
        if (values.some((value) => value <= 0)) {
          throw new Error(`Paket DP ${percentage}% belum lengkap. Isi nominal DP dan cicilan tenor ${FIF_TENORS.join(', ')} bulan, atau kosongkan seluruh baris.`);
        }
        if (values[0] > numericPrice) throw new Error(`Nominal DP ${percentage}% tidak boleh melebihi Harga OTR.`);
        fifOptions[key] = values;
      }

      const previousName = editingMotor.id ? motors.find((motor) => motor.id === editingMotor.id)?.name : undefined;
      const motorToSave = {
        ...editingMotor,
        name,
        price: numericPrice.toLocaleString('id-ID'),
        numericPrice,
        fifPriceListModel: { name, previousName, price: numericPrice, options: fifOptions },
      };
      if (editingMotor.id) {
        await api.updateMotor(editingMotor.id, motorToSave);
        showToast(`Motor dan data cicilan "${name}" berhasil diperbarui`);
      } else {
        await api.createMotor(motorToSave);
        showToast(`Motor dan template cicilan "${name}" berhasil ditambahkan`);
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

  const handleFileUploadMotor = async (e: React.ChangeEvent<HTMLInputElement>, imageIndex: number) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      showToast('Mengunggah gambar...');
      const url = await api.uploadImage(file);
      setEditingMotor((prev) => {
        if (!prev) return null;
        const images = [...(prev.images || Array(MAX_MOTOR_IMAGES).fill(''))];
        images[imageIndex] = url;
        return { ...prev, image: images[0] || '', images };
      });
      showToast('Gambar berhasil diunggah!');
    } catch (err: any) {
      alert('Gagal upload gambar: ' + err.message);
    } finally {
      input.value = '';
    }
  };

  // --- Promo CRUD Handlers ---
  const handlePromoImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);
    if (!files.length || !editingPromo) return;

    const existingImages = editingPromo.images || [];
    const availableSlots = MAX_PROMO_IMAGES - existingImages.length;
    if (files.length > availableSlots) {
      alert(`Maksimal ${MAX_PROMO_IMAGES} foto per promo. Tersisa ${availableSlots} slot.`);
      input.value = '';
      return;
    }
    if (files.some((file) => !file.type.startsWith('image/'))) {
      alert('Pilih file gambar yang valid.');
      input.value = '';
      return;
    }

    setIsUploadingPromoImages(true);
    try {
      const uploadedImages = await Promise.all(files.map((file) => api.uploadImage(file)));
      setEditingPromo((current) => current ? { ...current, images: [...(current.images || []), ...uploadedImages] } : current);
      showToast(`${uploadedImages.length} foto promo berhasil diunggah`);
    } catch (error: any) {
      alert(`Gagal upload foto promo: ${error.message}`);
    } finally {
      setIsUploadingPromoImages(false);
      input.value = '';
    }
  };

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

  const handleSharePromo = (event: React.FormEvent) => {
    event.preventDefault();
    if (!sharingPromo) return;

    const recipient = normalizeWhatsAppNumber(promoRecipientPhone, '');
    if (recipient.length < 9 || recipient.length > 15) {
      alert('Masukkan nomor WhatsApp konsumen yang valid, termasuk kode negara bila diperlukan.');
      return;
    }

    const promoImage = sharingPromo.images?.[0];
    if (!promoImage) return;

    const websiteLink = `${window.location.origin}/#promo`;
    const imageLink = new URL(promoImage, window.location.origin).href;
    const message = [
      'Halo Kak, ada promo menarik dari Honda Wijaya Abadi:',
      '',
      `${sharingPromo.title}${sharingPromo.discountValue ? ` - ${sharingPromo.discountValue}` : ''}`,
      sharingPromo.description,
      `Syarat & ketentuan: ${sharingPromo.terms || 'Berlaku sesuai ketentuan dealer.'}`,
      '',
      `Foto promo: ${imageLink}`,
      `Lihat promo: ${websiteLink}`,
    ].join('\n');
    const whatsappUrl = `https://web.whatsapp.com/send?${new URLSearchParams({ phone: recipient, text: message })}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    setSharingPromo(null);
    setPromoRecipientPhone('');
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
    { value: 'showroom', label: 'Showroom', accent: 'bg-red-700', description: 'Layout dealer resmi dengan hero, statistik, dan katalog yang jelas.' },
    { value: 'signature', label: 'Signature', accent: 'bg-gradient-to-r from-red-600 to-amber-500', description: 'Branding premium dengan sentuhan eksklusif dan elegan.' },
    { value: 'urban', label: 'Urban', accent: 'bg-gradient-to-r from-slate-700 to-zinc-900', description: 'Modern urban untuk tampilan dealer yang lebih fresh dan stylish.' },
    { value: 'mulia-cerah', label: 'Mulia Cerah', accent: 'bg-gradient-to-r from-blue-600 to-cyan-400', description: 'Tema otomotif modern dengan palette biru-cyan yang konsisten di mode terang dan gelap.' },
    { value: 'honda-wijaya', label: 'Honda Wijaya', accent: 'bg-red-600', description: 'Showroom Honda dengan tampilan merah-putih yang tegas dan elegan.' },
  ];

  const currentTemplate = templateOptions.find((item) => item.value === (settings?.websiteTemplate || 'classic')) || templateOptions[0];

  const seoTitle = settings?.seoTitle || DEFAULT_SEO_TITLE;
  const seoDescription = settings?.seoDescription || DEFAULT_SEO_DESCRIPTION;
  const seoFocusKeyword = settings?.seoFocusKeyword || DEFAULT_SEO_FOCUS_KEYWORD;
  const seoKeywords = settings?.seoKeywords || DEFAULT_SEO_KEYWORDS;
  const seoCanonicalUrl = settings?.seoCanonicalUrl || DEFAULT_SEO_CANONICAL_URL;
  const seoRobots = settings?.seoRobots || DEFAULT_SEO_ROBOTS;
  const focusKeywordMatch = matchFocusKeyword(seoFocusKeyword, seoTitle, seoDescription);
  const focusKeywordInMetadata = focusKeywordMatch.passed;
  const allowsSearchIndexing = /\bindex\b/i.test(seoRobots) && /\bfollow\b/i.test(seoRobots);
  let seoDomain = 'kreditmotorhonda.tech';
  let canonicalUsesHttps = false;
  try {
    const canonical = new URL(seoCanonicalUrl);
    seoDomain = canonical.hostname;
    canonicalUsesHttps = canonical.protocol === 'https:';
  } catch {
    canonicalUsesHttps = false;
  }
  const seoChecks = [
    { label: 'Judul SEO 30-60 karakter', passed: seoTitle.length >= 30 && seoTitle.length <= 60, detail: `${seoTitle.length} karakter` },
    { label: 'Deskripsi 120-160 karakter', passed: seoDescription.length >= 120 && seoDescription.length <= 160, detail: `${seoDescription.length} karakter` },
    { label: 'Kata kunci atau variasi relevan di judul/deskripsi', passed: focusKeywordInMetadata, detail: focusKeywordMatch.detail },
    { label: 'Canonical menggunakan HTTPS', passed: canonicalUsesHttps, detail: seoCanonicalUrl },
    { label: 'Robots mengizinkan index dan follow', passed: allowsSearchIndexing, detail: seoRobots },
    { label: 'Sitemap tersedia dan berformat XML', passed: seoFileChecks.sitemap === true, detail: seoFileChecks.sitemap === null ? 'Belum diperiksa' : seoFileChecks.sitemap ? 'Valid' : 'Perlu diperbaiki' },
    { label: 'Robots.txt memuat deklarasi Sitemap', passed: seoFileChecks.robots === true, detail: seoFileChecks.robots === null ? 'Belum diperiksa' : seoFileChecks.robots ? 'Valid' : 'Perlu diperbaiki' },
  ];
  const seoScore = Math.round((seoChecks.filter((check) => check.passed).length / seoChecks.length) * 100);

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

    const isMuliaCerah = template === 'mulia-cerah';
    const isHondaWijaya = template === 'honda-wijaya';
    const hasManagedPalette = settings.websiteTemplate === 'mulia-cerah' || settings.websiteTemplate === 'honda-wijaya';
    const isLeavingManagedPalette = hasManagedPalette && !isMuliaCerah && !isHondaWijaya;
    const { colorPalettes, templatePaletteBackup, themeBackgroundAnimation, ...baseCustomization } = settings.customization || {};
    const previousColorPalettes = hasManagedPalette
      ? templatePaletteBackup
      : colorPalettes;
    const customization = isMuliaCerah
      ? {
          ...settings.customization,
          themeBackgroundAnimation: true,
          templatePaletteBackup: previousColorPalettes,
          colorPalettes: {
            ...(previousColorPalettes || {}),
            light: {
              primaryColor: '#1769FF',
              secondaryColor: '#38BDF8',
              accentColor: '#06B6D4',
              backgroundColor: '#F7FAFF',
              panelColor: '#FFFFFF',
              cardColor: '#FFFFFF',
              elevatedColor: '#FFFFFF',
              borderColor: '#E2EAF5',
              textColor: '#14213D',
              mutedColor: '#52627A',
              heroTextColor: '#14213D',
              heroTitleHighlightColor: '#1769FF',
            },
            dark: {
              primaryColor: '#3B82F6',
              secondaryColor: '#38BDF8',
              accentColor: '#22D3EE',
              backgroundColor: '#07111F',
              panelColor: '#0B1729',
              cardColor: '#101F35',
              elevatedColor: '#152943',
              borderColor: '#233750',
              textColor: '#F1F5F9',
              mutedColor: '#B8C7DB',
              heroTextColor: '#F1F5F9',
              heroTitleHighlightColor: '#38BDF8',
            },
          },
        }
      : isHondaWijaya
        ? {
            ...baseCustomization,
            templatePaletteBackup: previousColorPalettes,
            colorPalettes: {
              ...(previousColorPalettes || {}),
              ...HONDA_WIJAYA_COLOR_PALETTES,
            },
          }
      : isLeavingManagedPalette
          ? {
              ...baseCustomization,
              ...(templatePaletteBackup ? { colorPalettes: templatePaletteBackup } : {}),
            }
        : settings.customization;
    const headlineSettings = isMuliaCerah
      ? {
          heroMainTitle: 'Satu Klik Dapat',
          heroTitleHighlight: 'Sepeda Motor Impian',
          heroSubtitle: 'Melayani pembelian cash dan kredit. Dapatkan motor Honda impian Anda dengan harga terbaik, promo menarik, dan proses kredit yang mudah.',
        }
      : isHondaWijaya
        ? {
            heroTitle: 'Dealer Resmi Sepeda Motor Honda Bandung',
            heroMainTitle: 'Saatnya Punya',
            heroTitleHighlight: 'Motor Honda Impian Anda',
            heroSubtitle: 'Proses mudah, cepat dan aman. Dapatkan motor Honda favorit Anda dengan harga terbaik, promo menarik, dan proses kredit tanpa ribet.',
          }
      : {};
    const nextSettings = { ...settings, ...headlineSettings, websiteTemplate: template, customization };
    setSettings(nextSettings);

    try {
      const saved = await api.updateSettings({
        websiteTemplate: template,
        ...headlineSettings,
        ...(isMuliaCerah || isHondaWijaya || isLeavingManagedPalette ? { customization } : {}),
      });
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

  const handleSaveCustomization = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!settings) return;
    try {
      const savedSettings = await api.updateSettings(settings);
      setSettings(savedSettings);
      showToast('Customisasi website berhasil disimpan!');
      onRefreshData();
    } catch (err: any) {
      alert('Gagal menyimpan customisasi website: ' + err.message);
    }
  };

  const handleRestoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const backup: unknown = JSON.parse(await file.text());
      const isRecord = (value: unknown): value is Record<string, unknown> => (
        typeof value === 'object' && value !== null && !Array.isArray(value)
      );
      if (!isRecord(backup)) {
        throw new Error('File bukan backup Honda Wijaya Abadi yang valid.');
      }
      const collections = ['motors', 'promos', 'testimonials', 'interests'];
      const hasAppData = 'settings' in backup || collections.some((key) => key in backup);
      const validCollections = collections.every((key) => backup[key] === undefined || Array.isArray(backup[key]));
      const validSettings = backup.settings === undefined || (
        typeof backup.settings === 'object' && backup.settings !== null && !Array.isArray(backup.settings)
      );
      if (!hasAppData || !validCollections || !validSettings) {
        throw new Error('Struktur file backup tidak valid.');
      }
      if (!window.confirm('Pemulihan akan mengganti seluruh data website saat ini. Lanjutkan?')) return;

      setIsImportingBackup(true);
      await api.importDatabase(backup);
      await loadAllData();
      await onRefreshData();
      showToast('Backup berhasil dipulihkan');
    } catch (error: any) {
      alert(error.message || 'Gagal memulihkan backup');
    } finally {
      setIsImportingBackup(false);
      input.value = '';
    }
  };

  const handleImportFifPriceList = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setIsImportingFifPriceList(true);
    try {
      const result = await api.importFifPriceList(file);
      await loadAllData();
      await onRefreshData();
      showToast(`Price list berhasil diperbarui untuk ${result.modelCount} model`);
    } catch (error: any) {
      alert(error.message || 'Gagal mengimpor price list FIF');
    } finally {
      setIsImportingFifPriceList(false);
      input.value = '';
    }
  };

  const handleAdminExport = async (key: string, download: () => Promise<void>, message: string) => {
    setActiveExport(key);
    try {
      await download();
      showToast(message);
    } catch (error: any) {
      alert(error.message || 'Gagal mengunduh data');
    } finally {
      setActiveExport(null);
    }
  };

  const handleCheckSeoFiles = async () => {
    setIsCheckingSeo(true);
    try {
      const [sitemapResponse, robotsResponse] = await Promise.all([
        fetch('/sitemap.xml', { cache: 'no-store' }),
        fetch('/robots.txt', { cache: 'no-store' }),
      ]);
      const [sitemapContent, robotsContent] = await Promise.all([
        sitemapResponse.text(),
        robotsResponse.text(),
      ]);
      setSeoFileChecks({
        sitemap: sitemapResponse.ok && sitemapContent.includes('<urlset'),
        robots: robotsResponse.ok && robotsContent.toLowerCase().includes('sitemap:'),
      });
    } catch {
      setSeoFileChecks({ sitemap: false, robots: false });
    } finally {
      setIsCheckingSeo(false);
    }
  };

  return (
    <div className={`admin-panel min-h-screen flex flex-col font-sans ${adminTheme === 'light' ? 'admin-theme-light bg-zinc-50 text-zinc-900' : 'bg-zinc-950 text-zinc-100'}`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-red-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 border border-red-400 font-medium text-xs sm:text-sm animate-in fade-in">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="admin-header sticky top-0 z-30 bg-black/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between">
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
          <button
            onClick={async () => {
              try {
                await api.downloadAdminReport();
                showToast('Laporan rating, minat, dan histori berhasil diunduh');
              } catch (error: any) {
                alert(error.message || 'Gagal mengunduh laporan admin');
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl text-xs font-bold shadow-md shadow-red-950/40"
            title="Download rating, minat calon konsumen, dan histori perubahan"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Laporan Admin</span>
          </button>
          <button
            type="button"
            onClick={toggleAdminTheme}
            aria-label={`Aktifkan mode ${adminTheme === 'dark' ? 'terang' : 'gelap'} admin`}
            title={`Aktifkan mode ${adminTheme === 'dark' ? 'terang' : 'gelap'} admin`}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
          >
            {adminTheme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{adminTheme === 'dark' ? 'Terang' : 'Gelap'}</span>
          </button>
          <div className="h-4 w-px bg-white/10 hidden md:block" />
          <span className="text-xs text-zinc-400 hidden md:inline">
            Login: <strong className="text-white">{adminSession.username}</strong>
          </span>
          <button onClick={handleAdminLogout} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-900">Logout</button>
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
          <div className="flex min-w-0 flex-wrap items-center justify-start gap-1.5 pb-1 md:flex-1 md:justify-end">
            {[
              { id: 'dashboard', label: 'Ringkasan', icon: TrendingUp },
              { id: 'motors', label: `Motor (${motors.length})`, icon: Bike },
              { id: 'leads', label: `Peminat (${leads.length})`, icon: MessageSquare },
              { id: 'promos', label: `Promo (${promos.length})`, icon: Tag },
              { id: 'testimonials', label: `Ulasan (${testimonials.length})`, icon: Star },
              { id: 'settings', label: 'Pengaturan Dealer', icon: SettingsIcon },
              { id: 'seo', label: 'Dashboard SEO', icon: Search },
              { id: 'customization', label: 'Customisasi', icon: SettingsIcon },
              { id: 'security', label: 'Admin & Histori', icon: Shield },
              { id: 'credit', label: 'Cicilan Motor', icon: FileSpreadsheet },
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

                  <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-5">
                    <div className="flex items-center justify-between text-zinc-400 mb-2">
                      <span className="text-xs font-semibold uppercase">Pengunjung sesuai filter</span>
                      <Users className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div className="text-3xl font-black text-white">{todayWebsiteVisitors.toLocaleString('id-ID')}</div>
                    <p className="text-[11px] text-cyan-400 mt-1">
                      {averageDailyWebsiteVisitors.toLocaleString('id-ID')} rata-rata per hari · Puncak {peakWebsiteHour}
                    </p>
                  </div>
                </div>

                <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
                    <div>
                      <h3 className="text-base font-bold text-white">Pengunjung Website</h3>
                      <p className="text-xs text-zinc-400">Log tersimpan di database · diperbarui otomatis setiap 15 detik · WIB</p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                      <div className="flex flex-wrap items-center gap-2">
                        {visitorFilterPresets.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setVisitorFilter(option.value as 'all' | '7d' | '30d' | 'today')}
                            className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition-colors ${
                              visitorFilter === option.value
                                ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                                : 'border-white/10 bg-zinc-950 text-zinc-300 hover:border-cyan-500/40 hover:text-white'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setVisitorFilter('custom')}
                          className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition-colors ${
                            visitorFilter === 'custom'
                              ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                              : 'border-white/10 bg-zinc-950 text-zinc-300 hover:border-cyan-500/40 hover:text-white'
                          }`}
                        >
                          Tanggal tertentu
                        </button>
                      </div>

                      {visitorFilter === 'custom' && (
                        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-950 px-2 py-1.5">
                          <input
                            type="date"
                            value={visitorStartDate}
                            onChange={(event) => setVisitorStartDate(event.target.value)}
                            className="rounded-lg border border-white/10 bg-zinc-950 px-2 py-1.5 text-[10px] text-zinc-200 focus:border-cyan-500 focus:outline-none"
                            aria-label="Tanggal mulai"
                          />
                          <span className="text-[10px] text-zinc-500">s/d</span>
                          <input
                            type="date"
                            value={visitorEndDate}
                            onChange={(event) => setVisitorEndDate(event.target.value)}
                            className="rounded-lg border border-white/10 bg-zinc-950 px-2 py-1.5 text-[10px] text-zinc-200 focus:border-cyan-500 focus:outline-none"
                            aria-label="Tanggal akhir"
                          />
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleExportVisitorData}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Export CSV
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Total periode</p>
                      <div className="mt-2 text-2xl font-black text-white">{todayWebsiteVisitors.toLocaleString('id-ID')}</div>
                      <p className="mt-1 text-[11px] text-zinc-500">Total pada rentang filter aktif</p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Rata-rata / hari</p>
                      <div className="mt-2 text-2xl font-black text-white">{averageDailyWebsiteVisitors.toLocaleString('id-ID')}</div>
                      <p className="mt-1 text-[11px] text-zinc-500">Rata-rata harian pada rentang aktif</p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Jam ramai</p>
                      <div className="mt-2 text-2xl font-black text-white">{peakWebsiteHourVisitors.toLocaleString('id-ID')}</div>
                      <p className="mt-1 text-[11px] text-cyan-400">Puncak {peakWebsiteHour}</p>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-white">Tren pengunjung harian</h4>
                        <span className="text-[10px] text-emerald-300">Live · {visitorAnalytics.timeZone || 'Asia/Jakarta'}</span>
                      </div>
                      <p className="mb-3 text-[10px] text-zinc-500">Komposisi jumlah pengunjung untuk setiap tanggal pada periode terpilih</p>
                      {dailyPieSlices.length ? (
                        <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[220px_1fr]">
                          <svg viewBox="0 0 220 220" role="img" aria-label="Diagram pie komposisi pengunjung harian" className="mx-auto h-52 w-52 drop-shadow-[0_8px_24px_rgba(34,211,238,0.12)]">
                            {dailyPieSlices.map((slice, index) => slice.sweepAngle >= 359.99 ? (
                              <circle key={slice.label} cx="110" cy="110" r="94" fill={slice.color} />
                            ) : (
                              <path key={`${slice.label}-${index}`} d={slice.path} fill={slice.color} stroke="#09090b" strokeWidth="2">
                                <title>{`${slice.label}: ${slice.visits} pengunjung`}</title>
                              </path>
                            ))}
                            <circle cx="110" cy="110" r="57" fill="#09090b" stroke="rgba(255,255,255,0.08)" />
                            <text x="110" y="104" fill="#a1a1aa" fontSize="10" textAnchor="middle">TOTAL PENGUNJUNG</text>
                            <text x="110" y="129" fill="#ffffff" fontSize="23" fontWeight="700" textAnchor="middle">{totalSelectedVisitors.toLocaleString('id-ID')}</text>
                          </svg>
                          <div className="space-y-2">
                            {dailyPieSlices.map((slice, index) => (
                              <div key={`${slice.label}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                                  <span className="truncate text-[11px] font-medium text-zinc-300">{slice.label}</span>
                                </div>
                                <div className="shrink-0 text-right">
                                  <span className="text-[11px] font-bold text-white">{slice.visits.toLocaleString('id-ID')}</span>
                                  <span className="ml-2 text-[10px] text-zinc-500">{dailyPieTotal ? Math.round(slice.visits / dailyPieTotal * 100) : 0}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-zinc-500">Belum ada log pengunjung pada rentang ini.</div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="text-sm font-bold text-white">Top 5 jam ramai</h4>
                          <p className="mt-1 text-[10px] text-zinc-500">Akumulasi sesuai filter · WIB</p>
                        </div>
                        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-[10px] font-semibold text-cyan-300">{topFiveHours.length}/5</span>
                      </div>
                      {topFiveHours.length ? (
                        <div className="space-y-3">
                          {topFiveHours.map((item: { label: string; visits: number }, index: number) => {
                            const width = Math.max(8, (Number(item.visits || 0) / topHourMaxVisits) * 100);
                            return (
                              <div key={item.label} className="grid grid-cols-[24px_48px_1fr_42px] items-center gap-2">
                                <span className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-black ${index === 0 ? 'bg-amber-400/15 text-amber-300' : 'bg-white/5 text-zinc-400'}`}>{index + 1}</span>
                                <span className="text-[11px] font-semibold text-zinc-200">{item.label}</span>
                                <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800">
                                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-300 transition-[width] duration-500" style={{ width: `${width}%` }} />
                                </div>
                                <span className="text-right text-[11px] font-bold text-white">{item.visits}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-zinc-500">Belum ada kunjungan pada rentang ini.</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-950/70 p-4 sm:p-5">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white">Tren pengunjung 7 hari</h4>
                        <p className="mt-1 text-[10px] text-zinc-500">7 tanggal terakhir dalam filter aktif · data otomatis diperbarui</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Total 7 hari</div>
                          <div className="text-lg font-black text-white">{weeklyTrendVisitors.reduce((sum, item) => sum + Number(item.visits || 0), 0).toLocaleString('id-ID')}</div>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${weeklyTrendChange > 0 ? 'bg-emerald-400/10 text-emerald-300' : weeklyTrendChange < 0 ? 'bg-rose-400/10 text-rose-300' : 'bg-white/5 text-zinc-400'}`}>
                          {weeklyTrendChange > 0 ? '+' : ''}{weeklyTrendChange}% vs hari sebelumnya
                        </span>
                      </div>
                    </div>
                    {weeklyTrendPoints.length ? (
                      <svg viewBox="0 0 720 220" role="img" aria-label="Grafik tren pengunjung selama tujuh hari" className="h-56 w-full overflow-visible">
                        <defs>
                          <linearGradient id="visitor-trend-area" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.32" />
                            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                          </linearGradient>
                          <linearGradient id="visitor-trend-line" x1="0" x2="1" y1="0" y2="0">
                            <stop offset="0%" stopColor="#22d3ee" />
                            <stop offset="100%" stopColor="#34d399" />
                          </linearGradient>
                        </defs>
                        {[0, 1, 2, 3].map((line) => {
                          const y = 48 + line * 42;
                          return <line key={line} x1="42" x2="678" y1={y} y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 6" />;
                        })}
                        {weeklyTrendArea && <path d={weeklyTrendArea} fill="url(#visitor-trend-area)" />}
                        {weeklyTrendPoints.length > 1 && (
                          <polyline points={weeklyTrendPoints.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="url(#visitor-trend-line)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                        )}
                        {weeklyTrendPoints.map((point, index) => (
                          <g key={point.isoDate || index}>
                            <circle cx={point.x} cy={point.y} r="5" fill="#22d3ee" stroke="#09090b" strokeWidth="2">
                              <title>{`${point.dateLabel}: ${point.visits} pengunjung`}</title>
                            </circle>
                            <text x={point.x} y={point.y - 12} fill="#e4e4e7" fontSize="10" fontWeight="600" textAnchor="middle">{point.visits}</text>
                            <text x={point.x} y="210" fill="#a1a1aa" fontSize="10" textAnchor="middle">{point.dateLabel}</text>
                          </g>
                        ))}
                      </svg>
                    ) : (
                      <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-zinc-500">Grafik akan terisi setelah kunjungan pertama tercatat.</div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
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
                          const waUrl = createWhatsAppUrl(
                            lead.phone,
                            `Halo Kak ${lead.customer_name}, terima kasih telah menghubungi Honda Wijaya Abadi mengenai unit ${lead.motor_name}. Apakah ada yang bisa kami bantu?`
                          );

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
                                  <span>Kirim WhatsApp</span>
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

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
                            const waUrl = createWhatsAppUrl(
                              lead.phone,
                              `Halo Kak ${lead.customer_name}, kami dari dealer resmi Honda Wijaya Abadi. Terkait pemesanan motor ${lead.motor_name}, ada yang ingin ditanyakan mengenai promo dan sistem kredit.`
                            );

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
                                    <span>Kirim WhatsApp ({lead.phone})</span>
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
                                      title={`Kirim WhatsApp ke ${lead.customer_name}`}
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

                      <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSharingPromo(p);
                            setPromoRecipientPhone('');
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500 px-3 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-950/30 transition-colors hover:bg-emerald-400"
                          title="Bagikan promo ke konsumen via WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Kirim Promo via WhatsApp</span>
                        </button>
                        <div className="flex items-center justify-end gap-2">
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
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${t.approved === false ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'}`}>
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
                  <section className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4 sm:p-5 space-y-4">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-200">Animasi Foto Katalog</h3>
                      <p className="mt-1 text-[11px] text-zinc-500">Pilih gaya pergantian foto dan jeda tampil tiap foto. Simpan bersama pengaturan di bawah.</p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                      {CATALOG_ANIMATION_OPTIONS.map((option) => {
                        const selectedAnimation = settings.catalogAnimation || DEFAULT_CATALOG_ANIMATION;
                        const animationSpeed = normalizeCatalogAnimationSpeed(
                          settings.catalogAnimationSpeed ?? DEFAULT_CATALOG_ANIMATION_SPEED,
                        );
                        const isSelected = selectedAnimation === option.value;
                        const previewStyle: React.CSSProperties & { '--catalog-animation-duration': string } = {
                          '--catalog-animation-duration': `${Math.min(animationSpeed * 0.3, 3)}s`,
                        };

                        return (
                          <button
                            key={option.value}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => setSettings({ ...settings, catalogAnimation: option.value })}
                            className={`rounded-xl border p-2 text-left transition-colors ${isSelected ? 'border-red-500 bg-red-500/10' : 'border-white/10 bg-zinc-900 hover:border-white/25'}`}
                          >
                            <div
                              className="catalog-animation-preview mb-2 flex h-14 items-center justify-center overflow-hidden rounded-lg bg-zinc-800"
                              data-catalog-animation={option.value}
                              style={previewStyle}
                            >
                              {motors.find((motor) => motor.image)?.image ? (
                                <img
                                  src={motors.find((motor) => motor.image)?.image}
                                  alt=""
                                  className="h-full w-full object-contain"
                                />
                              ) : (
                                <span className="text-[10px] font-bold text-zinc-400">Foto motor</span>
                              )}
                            </div>
                            <span className="block text-[11px] font-bold text-white">{option.label}</span>
                            <span className="mt-0.5 block text-[10px] text-zinc-500">{option.description}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="rounded-xl border border-white/10 bg-zinc-900 p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label htmlFor="catalog-animation-speed" className="text-xs font-semibold text-zinc-200">
                          Jeda tampil setiap foto
                        </label>
                        <span className="text-xs font-bold text-red-400">
                          {normalizeCatalogAnimationSpeed(settings.catalogAnimationSpeed ?? DEFAULT_CATALOG_ANIMATION_SPEED)} detik
                        </span>
                      </div>
                      <input
                        id="catalog-animation-speed"
                        type="range"
                        min={MIN_CATALOG_ANIMATION_SPEED}
                        max={MAX_CATALOG_ANIMATION_SPEED}
                        step="1"
                        value={normalizeCatalogAnimationSpeed(settings.catalogAnimationSpeed ?? DEFAULT_CATALOG_ANIMATION_SPEED)}
                        onChange={(event) => setSettings({ ...settings, catalogAnimationSpeed: Number(event.target.value) })}
                        className="w-full accent-red-600"
                      />
                      <div className="flex justify-between text-[10px] text-zinc-500">
                        <span>{MIN_CATALOG_ANIMATION_SPEED} detik (lebih cepat)</span>
                        <span>{MAX_CATALOG_ANIMATION_SPEED} detik (lebih lambat)</span>
                      </div>
                    </div>
                  </section>

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
                            className={`group text-left rounded-2xl border p-3 transition-all ${isSelected ? 'border-red-500 bg-red-500/10 shadow-lg shadow-red-950/30' : 'border-white/10 bg-zinc-900 hover:border-white/25'}`}
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

                    <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.32)]">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                        Live Preview
                      </div>
                      <div className={`website-template-${settings.websiteTemplate || 'classic'} overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 p-4 shadow-inner`}>
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

                  <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4 space-y-4">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-300">Custom Tema & Layout</div>
                      <p className="mt-1 text-[11px] text-zinc-500">Atur warna, font, posisi hero, dan bentuk kartu website utama.</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {([
                        { label: 'Honda Red', values: { primaryColor: '#dc2626', accentColor: '#f97316', backgroundColor: '#000000', panelColor: '#111827', textColor: '#f4f4f5', mutedColor: '#a1a1aa', font: 'jakarta', heroAlignment: 'left', cardRadius: 'round' } },
                        { label: 'Ocean Blue', values: { primaryColor: '#0284c7', accentColor: '#22d3ee', backgroundColor: '#07161d', panelColor: '#0d2430', textColor: '#e0f2fe', mutedColor: '#a5f3fc', font: 'jakarta', heroAlignment: 'center', cardRadius: 'soft' } },
                        { label: 'Emerald', values: { primaryColor: '#059669', accentColor: '#84cc16', backgroundColor: '#07130f', panelColor: '#10241b', textColor: '#ecfdf5', mutedColor: '#bbf7d0', font: 'jakarta', heroAlignment: 'right', cardRadius: 'soft' } },
                      ] as const).map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setSettings({ ...settings, customization: { ...settings.customization, ...preset.values } })}
                          className="rounded-lg border border-white/10 px-3 py-2 text-[11px] font-bold text-zinc-300 hover:border-red-500/50 hover:text-white"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        ['primaryColor', 'Warna Utama'],
                        ['accentColor', 'Warna Aksen'],
                        ['backgroundColor', 'Warna Latar'],
                        ['panelColor', 'Warna Panel'],
                        ['textColor', 'Warna Teks'],
                        ['mutedColor', 'Teks Sekunder'],
                      ].map(([key, label]) => (
                        <label key={key} className="text-[11px] text-zinc-400">
                          <span className="mb-1 block">{label}</span>
                          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 p-1.5">
                            <input
                              type="color"
                              value={(settings.customization as any)?.[key] || '#dc2626'}
                              onChange={(event) => setSettings({ ...settings, customization: { ...settings.customization, [key]: event.target.value } })}
                              className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent"
                            />
                            <span className="font-mono text-[10px] text-zinc-500">{(settings.customization as any)?.[key] || '#dc2626'}</span>
                          </div>
                        </label>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label className="text-[11px] text-zinc-400">
                        <span className="mb-1 block">Font Website</span>
                        <select value={settings.customization?.font || 'jakarta'} onChange={(event) => setSettings({ ...settings, customization: { ...settings.customization, font: event.target.value as any } })} className="w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-zinc-200 focus:border-red-500 focus:outline-none">
                          <option value="jakarta">Jakarta Sans</option>
                          <option value="serif">Serif Elegan</option>
                          <option value="mono">Mono Modern</option>
                          <option value="system">System</option>
                        </select>
                      </label>
                      <label className="text-[11px] text-zinc-400">
                        <span className="mb-1 block">Posisi Hero</span>
                        <select value={settings.customization?.heroAlignment || 'left'} onChange={(event) => setSettings({ ...settings, customization: { ...settings.customization, heroAlignment: event.target.value as any } })} className="w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-zinc-200 focus:border-red-500 focus:outline-none">
                          <option value="left">Kiri</option>
                          <option value="center">Tengah</option>
                          <option value="right">Kanan</option>
                        </select>
                      </label>
                      <label className="text-[11px] text-zinc-400">
                        <span className="mb-1 block">Bentuk Kartu</span>
                        <select value={settings.customization?.cardRadius || 'round'} onChange={(event) => setSettings({ ...settings, customization: { ...settings.customization, cardRadius: event.target.value as any } })} className="w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-zinc-200 focus:border-red-500 focus:outline-none">
                          <option value="sharp">Tegas</option>
                          <option value="soft">Soft</option>
                          <option value="round">Rounded</option>
                        </select>
                      </label>
                    </div>

                    {settings.websiteTemplate === 'mulia-cerah' && (
                      <label className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-xs font-semibold text-zinc-200">
                        <input
                          type="checkbox"
                          checked={settings.customization?.themeBackgroundAnimation !== false}
                          onChange={(event) => setSettings({
                            ...settings,
                            customization: { ...settings.customization, themeBackgroundAnimation: event.target.checked },
                          })}
                          className="h-4 w-4 accent-blue-500"
                        />
                        <span>Animasi gradien latar</span>
                        <span className="ml-auto text-[11px] text-zinc-400">
                          {settings.customization?.themeBackgroundAnimation === false ? 'Off' : 'On'}
                        </span>
                      </label>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="text-[11px] text-zinc-400">
                        <span className="mb-1 flex items-center justify-between">
                          <span>Ukuran teks aksen hero</span>
                          <span>{settings.customization?.heroHighlightFontSize ?? 42}px</span>
                        </span>
                        <input
                          type="range"
                          min="24"
                          max="58"
                          step="1"
                          value={settings.customization?.heroHighlightFontSize ?? 42}
                          onChange={(event) => setSettings({
                            ...settings,
                            customization: { ...settings.customization, heroHighlightFontSize: Number(event.target.value) },
                          })}
                          className="w-full accent-blue-500"
                        />
                      </label>
                      <label className="text-[11px] text-zinc-400">
                        <span className="mb-1 flex items-center justify-between">
                          <span>Jarak antarbaris headline</span>
                          <span>{settings.customization?.heroHeadlineGap ?? 4}px</span>
                        </span>
                        <input
                          type="range"
                          min="0"
                          max="32"
                          step="1"
                          value={settings.customization?.heroHeadlineGap ?? 4}
                          onChange={(event) => setSettings({
                            ...settings,
                            customization: { ...settings.customization, heroHeadlineGap: Number(event.target.value) },
                          })}
                          className="w-full accent-blue-500"
                        />
                      </label>
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

            {activeTab === 'seo' && settings && (
              <form onSubmit={handleSaveSettings} className="space-y-6 animate-in fade-in duration-300">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">Dashboard SEO</h2>
                    <p className="mt-1 text-xs text-zinc-400">Pantau kesiapan halaman utama dan kelola metadata pencarian.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={`https://www.google.com/search?q=${encodeURIComponent(`site:${seoDomain}`)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800">
                      <Search className="h-3.5 w-3.5" />
                      Cek hasil Google
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800">
                      Buka Search Console
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <button
                      type="button"
                      onClick={() => void handleCheckSeoFiles()}
                      disabled={isCheckingSeo}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                    >
                      <RotateCcw className={`h-3.5 w-3.5 ${isCheckingSeo ? 'animate-spin' : ''}`} />
                      {isCheckingSeo ? 'Memeriksa...' : 'Periksa sitemap & robots'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <section className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
                    <p className="text-xs text-zinc-400">SEO Score</p>
                    <p className="mt-2 text-2xl font-bold text-white">{seoScore}<span className="ml-1 text-sm font-medium text-zinc-500">/ 100</span></p>
                    <p className="mt-1 text-[11px] text-zinc-500">{seoChecks.filter((check) => check.passed).length} dari {seoChecks.length} pemeriksaan lolos</p>
                  </section>
                  <section className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
                    <p className="text-xs text-zinc-400">Focus keyword</p>
                    <p className="mt-2 break-words text-sm font-semibold text-white">{seoFocusKeyword || 'Belum diatur'}</p>
                    <p className={`mt-1 text-[11px] ${focusKeywordInMetadata ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {focusKeywordInMetadata ? `Cocok: ${focusKeywordMatch.detail}` : `Perlu variasi yang lebih relevan · ${focusKeywordMatch.detail}`}
                    </p>
                  </section>
                  <section className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
                    <p className="text-xs text-zinc-400">Pengindeksan</p>
                    <p className={`mt-2 text-sm font-semibold ${allowsSearchIndexing ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {allowsSearchIndexing ? 'Diizinkan oleh robots' : 'Dibatasi oleh robots'}
                    </p>
                    <p className="mt-1 break-all text-[11px] text-zinc-500">{seoRobots}</p>
                  </section>
                  <section className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
                    <p className="text-xs text-zinc-400">Sitemap</p>
                    <p className={`mt-2 text-sm font-semibold ${seoFileChecks.sitemap === true ? 'text-emerald-400' : seoFileChecks.sitemap === false ? 'text-amber-400' : 'text-zinc-300'}`}>
                      {seoFileChecks.sitemap === true ? 'Valid' : seoFileChecks.sitemap === false ? 'Perlu diperiksa' : 'Belum diperiksa'}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">{seoDomain}</p>
                  </section>
                </div>

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="space-y-5">
                    <section className="space-y-4 rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
                      <h3 className="text-sm font-bold text-white">Metadata halaman utama</h3>
                      <label className="block space-y-1.5 text-xs font-medium text-zinc-300">
                        Judul SEO
                        <input value={settings.seoTitle ?? DEFAULT_SEO_TITLE} onChange={(event) => setSettings({ ...settings, seoTitle: event.target.value })} maxLength={70} className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none" placeholder="Judul halaman yang tampil di Google" />
                        <span className="block text-right text-[11px] text-zinc-500">{seoTitle.length} / 60 karakter ideal</span>
                      </label>
                      <label className="block space-y-1.5 text-xs font-medium text-zinc-300">
                        Deskripsi SEO
                        <textarea rows={4} value={settings.seoDescription ?? DEFAULT_SEO_DESCRIPTION} onChange={(event) => setSettings({ ...settings, seoDescription: event.target.value })} maxLength={200} className="w-full resize-y rounded-lg border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none" placeholder="Ringkas isi halaman untuk hasil pencarian" />
                        <span className="block text-right text-[11px] text-zinc-500">{seoDescription.length} / 160 karakter ideal</span>
                      </label>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="block space-y-1.5 text-xs font-medium text-zinc-300">
                          Focus keyword
                          <input value={settings.seoFocusKeyword || DEFAULT_SEO_FOCUS_KEYWORD} onChange={(event) => setSettings({ ...settings, seoFocusKeyword: event.target.value })} className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none" placeholder="contoh: kredit motor Honda" />
                          <span className="block text-[11px] text-zinc-500">Tidak harus sama persis: Google memahami variasi dan sinonim yang relevan, misalnya kredit, cicilan, atau angsuran. Pemeriksaan ini panduan konten, bukan jaminan posisi di hasil Google.</span>
                        </label>
                        <label className="block space-y-1.5 text-xs font-medium text-zinc-300">
                          Kata kunci tambahan
                          <input value={settings.seoKeywords ?? DEFAULT_SEO_KEYWORDS} onChange={(event) => setSettings({ ...settings, seoKeywords: event.target.value })} className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none" placeholder="Pisahkan kata kunci dengan koma" />
                          <span className="block text-[11px] text-zinc-500">Google tidak menggunakan meta keywords sebagai faktor ranking. Masukkan variasi kata kunci secara alami ke konten dan judul section halaman.</span>
                        </label>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="block space-y-1.5 text-xs font-medium text-zinc-300">
                          URL canonical
                          <input type="url" value={settings.seoCanonicalUrl ?? DEFAULT_SEO_CANONICAL_URL} onChange={(event) => setSettings({ ...settings, seoCanonicalUrl: event.target.value })} className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none" />
                        </label>
                        <label className="block space-y-1.5 text-xs font-medium text-zinc-300">
                          Robots
                          <select value={settings.seoRobots ?? DEFAULT_SEO_ROBOTS} onChange={(event) => setSettings({ ...settings, seoRobots: event.target.value })} className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none">
                            <option value="index, follow">Index, follow</option>
                            <option value="noindex, follow">Noindex, follow</option>
                            <option value="index, nofollow">Index, nofollow</option>
                            <option value="noindex, nofollow">Noindex, nofollow</option>
                          </select>
                        </label>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
                      <h3 className="mb-3 text-sm font-bold text-white">Pratinjau hasil pencarian</h3>
                      <div className="max-w-2xl rounded-lg border border-white/10 bg-zinc-950 p-4">
                        <p className="truncate text-xs text-emerald-400">{seoCanonicalUrl}</p>
                        <h4 className="mt-1 line-clamp-2 text-lg font-medium text-sky-300">{seoTitle}</h4>
                        <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-zinc-300">{seoDescription}</p>
                      </div>
                      <button type="submit" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-500">
                        <Save className="h-4 w-4" />
                        Simpan metadata SEO
                      </button>
                    </section>
                  </div>

                  <aside className="space-y-4">
                    <section className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
                      <div className="flex items-center gap-4">
                        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full p-1" style={{ background: `conic-gradient(#ef4444 ${seoScore * 3.6}deg, #27272a 0deg)` }}>
                          <div className="grid h-full w-full place-items-center rounded-full bg-zinc-950 text-xl font-black text-white">{seoScore}</div>
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">SEO Score</h3>
                          <p className="mt-1 text-xs text-zinc-400">{seoChecks.filter((check) => check.passed).length} dari {seoChecks.length} pemeriksaan lolos</p>
                        </div>
                      </div>
                      <div className="mt-5 space-y-3">
                        {seoChecks.map((check) => (
                          <div key={check.label} className="flex items-start gap-2.5 text-xs">
                            <CheckCircle className={`mt-0.5 h-4 w-4 shrink-0 ${check.passed ? 'text-emerald-400' : 'text-zinc-600'}`} />
                            <div className="min-w-0">
                              <p className={check.passed ? 'text-zinc-200' : 'text-zinc-400'}>{check.label}</p>
                              <p className="mt-0.5 break-words text-[11px] text-zinc-500">{check.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                    <section className="rounded-xl border border-white/10 bg-zinc-900/50 p-4 text-xs">
                      <h3 className="font-bold text-white">Berkas SEO</h3>
                      <a href="/sitemap.xml" target="_blank" rel="noreferrer" className="mt-3 block text-sky-300 hover:text-sky-200">Buka sitemap.xml</a>
                      <a href="/robots.txt" target="_blank" rel="noreferrer" className="mt-2 block text-sky-300 hover:text-sky-200">Buka robots.txt</a>
                    </section>
                  </aside>
                </div>
              </form>
            )}

            {activeTab === 'customization' && settings && (
              <form onSubmit={handleSaveCustomization} className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-lg font-bold text-white">Customisasi Website</h2>
                  <p className="text-xs text-zinc-400">
                    Ubah logo, banner, font, dan warna website sesuai brand Honda Wijaya Abadi.
                  </p>
                </div>

                <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-4 sm:p-6">
                  <CustomizationPanel settings={settings} onSettingsChange={setSettings} />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-900/40 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>Simpan Customisasi</span>
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-lg font-bold text-white">Admin & Histori Perubahan</h2>
                  <p className="text-xs text-zinc-400">Kelola akun admin dan pantau aktivitas perubahan pada CMS.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <form
                    onSubmit={async (event) => {
                      event.preventDefault();
                      try {
                        const updated = await api.updateAdminUser(adminSession.id, { username: securityForm.username || adminSession.username, password: securityForm.password || undefined });
                        setAdminSession({ ...adminSession, username: updated.username });
                        setSecurityForm({ ...securityForm, username: '', password: '' });
                        showToast('Username dan password berhasil diperbarui');
                        await refreshSecurityData();
                      } catch (error: any) {
                        alert(error.message || 'Gagal memperbarui akun');
                      }
                    }}
                    className="rounded-3xl border border-white/10 bg-zinc-900/50 p-6 space-y-4"
                  >
                    <h3 className="font-bold text-white">Akun Saya</h3>
                    <input value={securityForm.username} onChange={(event) => setSecurityForm({ ...securityForm, username: event.target.value })} placeholder={`Username saat ini: ${adminSession.username}`} className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:border-red-500 focus:outline-none" />
                    <input type="password" value={securityForm.password} onChange={(event) => setSecurityForm({ ...securityForm, password: event.target.value })} placeholder="Password baru (opsional)" className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:border-red-500 focus:outline-none" />
                    <button className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-500">Simpan Perubahan Akun</button>
                  </form>

                  {adminSession.role === 'Super Admin' && (
                    <form onSubmit={handleCreateAdmin} className="rounded-3xl border border-white/10 bg-zinc-900/50 p-6 space-y-4">
                      <h3 className="font-bold text-white">Buat Admin Baru</h3>
                      <input required value={securityForm.username} onChange={(event) => setSecurityForm({ ...securityForm, username: event.target.value })} placeholder="Username admin baru" className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:border-red-500 focus:outline-none" />
                      <input required type="password" minLength={8} value={securityForm.password} onChange={(event) => setSecurityForm({ ...securityForm, password: event.target.value })} placeholder="Password admin baru" className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:border-red-500 focus:outline-none" />
                      <select value={securityForm.role} onChange={(event) => setSecurityForm({ ...securityForm, role: event.target.value })} className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2.5 text-xs text-white focus:border-red-500 focus:outline-none">
                        <option>Staff Admin</option>
                        <option>Super Admin</option>
                      </select>
                      <button className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20">Tambah Admin</button>
                    </form>
                  )}
                </div>

                <div className="rounded-3xl border border-white/10 bg-zinc-900/50 p-6">
                  <h3 className="mb-4 font-bold text-white">Daftar Admin</h3>
                  <div className="space-y-2">
                    {adminUsers.map((user) => (
                      <div key={user.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-zinc-950/70 px-4 py-3">
                        <div><div className="text-sm font-bold text-white">{user.username}</div><div className="text-[11px] text-zinc-400">{user.role}</div></div>
                        {adminSession.role === 'Super Admin' && user.id !== adminSession.id && <button onClick={async () => { if (!window.confirm(`Hapus admin ${user.username}?`)) return; await api.deleteAdminUser(user.id); setAdminUsers((prev) => prev.filter((item) => item.id !== user.id)); showToast(`Admin ${user.username} berhasil dihapus`); }} className="text-[10px] text-red-400 hover:text-red-300">Hapus</button>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-zinc-900/50 p-6">
                  <h3 className="mb-4 font-bold text-white">Histori Perubahan</h3>
                  <div className="max-h-96 overflow-auto space-y-2">
                    {auditLogs.length === 0 ? <p className="text-xs text-zinc-500">Belum ada histori perubahan.</p> : auditLogs.map((log) => (
                      <div key={log.id} className="border-b border-white/5 pb-2 text-xs">
                        <div className="flex items-center justify-between gap-3"><span className="font-bold text-red-300">{log.action}</span><span className="text-zinc-500">{new Date(log.created_at).toLocaleString('id-ID')}</span></div>
                        <div className="mt-1 text-zinc-300">{log.details}</div><div className="text-zinc-500">oleh {log.actor}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'credit' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-lg font-bold text-white">Cicilan & Price List FIFGROUP</h2>
                  <p className="text-xs text-zinc-400">Kelola tabel DP dan angsuran yang digunakan katalog serta kalkulator kredit.</p>
                </div>

                <section className="space-y-4 rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
                  <div className="flex items-start gap-3">
                    <FileSpreadsheet className="mt-0.5 h-5 w-5 text-emerald-400" />
                    <div>
                      <h3 className="text-sm font-bold text-white">Price list cicilan FIFGROUP</h3>
                      <p className="mt-1 text-xs text-zinc-400">
                        {motors.length} model katalog · {Object.keys(fifPriceList.models).length} model price list · Sumber: {fifPriceList.source}
                        {fifPriceList.updatedAt ? ` · Diperbarui ${new Date(fifPriceList.updatedAt).toLocaleString('id-ID')}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">Unduh template, isi nominal DP dan cicilan untuk setiap model, lalu unggah. Data yang diunggah langsung tersimpan dan memperbarui katalog serta kalkulator; model yang tidak disertakan tetap dipertahankan.</p>
                    </div>
                  </div>
                  <input
                    ref={fifPriceListInputRef}
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(event) => void handleImportFifPriceList(event)}
                    className="hidden"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isImportingFifPriceList}
                      onClick={() => fifPriceListInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      <Upload className="h-4 w-4" />
                      {isImportingFifPriceList ? 'Mengimpor price list...' : 'Upload price list Excel'}
                    </button>
                    <button
                      type="button"
                      disabled={activeExport !== null}
                      onClick={() => void handleAdminExport('fif-template', () => api.downloadFifPriceListTemplate(), 'Template price list berhasil diunduh')}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" />
                      {activeExport === 'fif-template' ? 'Menyiapkan template...' : 'Download template Excel'}
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-500">Template berisi kolom model, harga OTR, DP 10%, 15%, 20%, 30%, 40%, serta cicilan tenor 11, 17, 23, 29, dan 35 bulan.</p>
                  <div className="overflow-hidden rounded-xl border border-white/10">
                    <div className="grid grid-cols-[minmax(0,1fr)_120px_110px] gap-3 border-b border-white/10 bg-zinc-950/80 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                      <span>Model motor</span>
                      <span>Harga OTR</span>
                      <span>DP + cicilan</span>
                    </div>
                    <div className="max-h-[225px] overflow-y-auto overscroll-contain divide-y divide-white/5">
                      {motors.map((motor) => {
                        const normalizedMotorName = motor.name.toLocaleLowerCase('id-ID').replace(/\b(honda|all|new|evo)\b/g, ' ').replace(/[^a-z0-9]/g, '');
                        const configuredModel = fifPriceList.models[motor.name]
                          || Object.entries(fifPriceList.models).find(([modelName]) => modelName.toLocaleLowerCase('id-ID').replace(/\b(honda|all|new|evo)\b/g, ' ').replace(/[^a-z0-9]/g, '') === normalizedMotorName)?.[1];
                        const readyDpPackages = Object.values(configuredModel?.options || {}).filter((option) => option.length >= 6 && option.every((amount) => Number(amount) > 0)).length;
                        const motorPrice = configuredModel?.price || motor.numericPrice || motor.price;
                        return (
                          <div key={motor.id} className="grid min-h-11 grid-cols-[minmax(0,1fr)_120px_110px] items-center gap-3 px-3 py-2 text-[11px]">
                            <span className="truncate font-semibold text-zinc-200" title={motor.name}>{motor.name}</span>
                            <span className="truncate text-zinc-300">{formatRupiah(motorPrice)}</span>
                            <span className={readyDpPackages === 5 ? 'font-semibold text-emerald-300' : 'font-medium text-amber-300'}>{readyDpPackages}/5 paket siap</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-500">5 model terlihat sekaligus. Scroll daftar untuk melihat model lain; template mengikuti nama dan harga OTR katalog terbaru.</p>
                </section>
              </div>
            )}

            {activeTab === 'export' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-lg font-bold text-white">Download & Backup Data</h2>
                  <p className="text-xs text-zinc-400">Unduh salinan database lengkap atau ekspor data pilihan. Pemulihan backup akan mengganti data saat ini.</p>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <section className="space-y-4 rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
                    <div className="flex items-start gap-3">
                      <Database className="mt-0.5 h-5 w-5 text-red-400" />
                      <div>
                        <h3 className="text-sm font-bold text-white">Backup lengkap</h3>
                        <p className="mt-1 text-xs text-zinc-400">Satu file JSON berisi pengaturan, katalog, promo, ulasan, prospek, dan histori.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={activeExport !== null}
                      onClick={() => void handleAdminExport('backup-json', () => api.downloadAllBackup(), 'Backup database berhasil diunduh')}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50"
                    >
                      <FileJson className="h-4 w-4" />
                      {activeExport === 'backup-json' ? 'Menyiapkan backup...' : 'Unduh backup JSON'}
                    </button>
                  </section>

                  <section className="space-y-4 rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
                    <div className="flex items-start gap-3">
                      <FileSpreadsheet className="mt-0.5 h-5 w-5 text-emerald-400" />
                      <div>
                        <h3 className="text-sm font-bold text-white">Laporan Excel</h3>
                        <p className="mt-1 text-xs text-zinc-400">Laporan ringkas rating, minat konsumen, dan histori perubahan.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={activeExport !== null}
                      onClick={() => void handleAdminExport('report-xlsx', () => api.downloadAdminReport(), 'Laporan Excel berhasil diunduh')}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" />
                      {activeExport === 'report-xlsx' ? 'Menyiapkan laporan...' : 'Unduh laporan Excel'}
                    </button>
                  </section>

                  <section className="space-y-4 rounded-2xl border border-white/10 bg-zinc-900/50 p-5 xl:col-span-2">
                    <div className="flex items-start gap-3">
                      <FileDown className="mt-0.5 h-5 w-5 text-sky-400" />
                      <div>
                        <h3 className="text-sm font-bold text-white">Ekspor CSV</h3>
                        <p className="mt-1 text-xs text-zinc-400">Pilih satu kumpulan data untuk dibuka di spreadsheet.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {[
                        { type: 'motors' as const, label: 'Katalog motor', count: motors.length },
                        { type: 'interests' as const, label: 'Data peminat', count: leads.length },
                        { type: 'promos' as const, label: 'Promo', count: promos.length },
                        { type: 'testimonials' as const, label: 'Ulasan', count: testimonials.length },
                      ].map((dataset) => (
                        <button
                          key={dataset.type}
                          type="button"
                          disabled={activeExport !== null}
                          onClick={() => void handleAdminExport(`csv-${dataset.type}`, () => api.downloadCsv(dataset.type), `Ekspor ${dataset.label.toLowerCase()} berhasil diunduh`)}
                          className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-3 text-left text-xs text-zinc-200 hover:border-red-500/50 hover:bg-zinc-900 disabled:opacity-50"
                        >
                          <span>{activeExport === `csv-${dataset.type}` ? 'Menyiapkan...' : dataset.label}</span>
                          <span className="shrink-0 font-mono text-zinc-500">{dataset.count}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 xl:col-span-2">
                    <div className="flex items-start gap-3">
                      <HardDrive className="mt-0.5 h-5 w-5 text-amber-300" />
                      <div>
                        <h3 className="text-sm font-bold text-white">Pulihkan backup JSON</h3>
                        <p className="mt-1 text-xs text-zinc-400">Pilih file backup yang dibuat dari panel ini. Database saat ini akan diganti setelah konfirmasi.</p>
                      </div>
                    </div>
                    <input ref={backupInputRef} type="file" accept=".json,application/json" onChange={handleRestoreBackup} className="hidden" />
                    <button
                      type="button"
                      disabled={isImportingBackup}
                      onClick={() => backupInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-bold text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
                    >
                      <Upload className="h-4 w-4" />
                      {isImportingBackup ? 'Memulihkan data...' : 'Pilih file backup'}
                    </button>
                  </section>
                </div>
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
                <p className="mt-1 text-[10px] text-zinc-500">Nama ini akan dipakai sebagai nama model di template price list. Gunakan satu nama yang konsisten.</p>
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
                  <p className="mt-1 text-[10px] text-zinc-500">Harga OTR menjadi nilai awal motor ini pada template Excel price list.</p>
                </div>
              </div>

              <details open className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                <summary className="cursor-pointer list-none text-xs font-bold text-emerald-200">
                  Input nominal DP & cicilan FIF
                  <span className="ml-2 text-[10px] font-medium text-zinc-400">nilai ini ikut disimpan ke template Excel dan kalkulator</span>
                </summary>
                <p className="mt-2 text-[10px] text-zinc-400">Isi satu baris lengkap untuk setiap paket yang tersedia. Baris kosong boleh dilewati; cicilan tidak dibuat otomatis agar nominal tetap sesuai price list resmi.</p>
                <div className="mt-3 max-h-[260px] overflow-auto rounded-lg border border-white/10">
                  <table className="min-w-[760px] w-full text-left text-[10px]">
                    <thead className="sticky top-0 z-10 bg-zinc-900 text-zinc-400">
                      <tr>
                        <th className="px-2 py-2">DP</th>
                        <th className="px-2 py-2">Nominal DP</th>
                        {FIF_TENORS.map((tenor) => <th key={tenor} className="px-2 py-2">{tenor} bln</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {FIF_DP_PERCENTAGES.map((percentage) => {
                        const key = String(percentage);
                        const values = editingMotorFifOptions[key] || Array(FIF_TENORS.length + 1).fill('');
                        return (
                          <tr key={key}>
                            <th className="whitespace-nowrap px-2 py-2 font-bold text-zinc-300">{percentage}%</th>
                            {values.map((value, valueIndex) => (
                              <td key={valueIndex} className="px-1.5 py-1.5">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={value}
                                  onChange={(event) => setEditingMotorFifOptions((current) => ({
                                    ...current,
                                    [key]: Array.from({ length: FIF_TENORS.length + 1 }, (_, index) => index === valueIndex ? event.target.value : current[key]?.[index] || ''),
                                  }))}
                                  placeholder={valueIndex === 0 ? 'DP Rp' : 'Rp'}
                                  aria-label={valueIndex === 0 ? `Nominal DP ${percentage}%` : `Cicilan DP ${percentage}% tenor ${FIF_TENORS[valueIndex - 1]} bulan`}
                                  className="w-24 rounded-md border border-white/10 bg-zinc-950 px-2 py-2 text-[10px] text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </details>

              <div>
                <label className="block font-bold text-zinc-300 uppercase mb-1">
                  Gambar Motor (maksimal {MAX_MOTOR_IMAGES} foto, URL atau Upload File)
                </label>
                <p className="mb-2 text-[11px] text-zinc-500">Foto pertama menjadi cover kartu katalog. Foto kosong tidak ditampilkan di website.</p>
                <p className="mb-2 text-[10px] text-zinc-500">5 slot foto terlihat sekaligus; scroll untuk mengisi hingga {MAX_MOTOR_IMAGES} foto.</p>
                <div className="max-h-[220px] space-y-2 overflow-y-auto overscroll-contain pr-1">
                  {Array.from({ length: MAX_MOTOR_IMAGES }, (_, imageIndex) => {
                    const images = editingMotor.images || [editingMotor.image || ''];
                    const imageValue = images[imageIndex] || '';
                    return (
                      <div key={imageIndex} className="flex items-center gap-2">
                        <span className="w-5 text-[10px] font-bold text-zinc-500">{imageIndex + 1}</span>
                        <input
                          type="text"
                          value={imageValue}
                          onChange={(e) => {
                            const nextImages = [...(editingMotor.images || Array(MAX_MOTOR_IMAGES).fill(''))];
                            nextImages[imageIndex] = e.target.value;
                            setEditingMotor({ ...editingMotor, image: nextImages[0] || '', images: nextImages });
                          }}
                          placeholder="https://... atau /uploads/..."
                          className="min-w-0 flex-1 bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:border-red-500 focus:outline-none"
                        />
                        <label className="cursor-pointer rounded-lg border border-white/10 bg-zinc-800 p-2 text-zinc-300 hover:bg-zinc-700" title={`Upload foto ${imageIndex + 1}`}>
                          <Upload className="h-3.5 w-3.5" />
                          <input type="file" accept="image/*" onChange={(e) => handleFileUploadMotor(e, imageIndex)} className="hidden" />
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

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
          <div className="bg-zinc-950 border border-white/15 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-zinc-300">Foto Promo</label>
                  <span className="text-zinc-500">{editingPromo.images?.length || 0}/{MAX_PROMO_IMAGES}</span>
                </div>
                {!!editingPromo.images?.length && (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {editingPromo.images.map((image, imageIndex) => (
                      <div key={`${image}-${imageIndex}`} className="relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
                        <img src={image} alt={`Foto promo ${imageIndex + 1}`} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          aria-label={`Hapus foto promo ${imageIndex + 1}`}
                          onClick={() => setEditingPromo({ ...editingPromo, images: editingPromo.images?.filter((_, index) => index !== imageIndex) })}
                          className="absolute right-1 top-1 rounded-md bg-black/75 p-1 text-white hover:bg-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 ${isUploadingPromoImages || (editingPromo.images?.length || 0) >= MAX_PROMO_IMAGES ? 'pointer-events-none opacity-50' : ''}`}>
                  <Upload className="h-4 w-4" />
                  {isUploadingPromoImages ? 'Mengunggah foto...' : 'Upload foto'}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={isUploadingPromoImages || (editingPromo.images?.length || 0) >= MAX_PROMO_IMAGES}
                    onChange={(event) => void handlePromoImageUpload(event)}
                    className="hidden"
                  />
                </label>
                <p className="text-[11px] text-zinc-500">Maksimal {MAX_PROMO_IMAGES} foto. Pilih beberapa gambar sekaligus.</p>
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block font-bold text-zinc-300">
                  Template Promo
                  <select
                    value={editingPromo.promoTemplate || 'classic'}
                    onChange={(event) => setEditingPromo({ ...editingPromo, promoTemplate: event.target.value as Promo['promoTemplate'] })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 font-normal text-white"
                  >
                    <option value="classic">Kartu Standar</option>
                    <option value="showcase">Sorotan Gambar</option>
                    <option value="compact">Galeri Ringkas</option>
                  </select>
                </label>
                <label className="block font-bold text-zinc-300">
                  Animasi Promo
                  <select
                    value={editingPromo.promoAnimation || DEFAULT_CATALOG_ANIMATION}
                    onChange={(event) => setEditingPromo({ ...editingPromo, promoAnimation: event.target.value as Promo['promoAnimation'] })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 font-normal text-white"
                  >
                    {CATALOG_ANIMATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
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
                  disabled={isUploadingPromoImages}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl disabled:opacity-50"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sharingPromo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/15 bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-white">Bagikan promo ke konsumen</h3>
                <p className="mt-1 text-[11px] text-zinc-400">Preview pesan WhatsApp</p>
              </div>
              <button type="button" onClick={() => setSharingPromo(null)} aria-label="Tutup" className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSharePromo} className="space-y-4 p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[160px_1fr]">
                {sharingPromo.images?.[0] ? (
                  <img src={sharingPromo.images[0]} alt={`Foto ${sharingPromo.title}`} className="h-36 w-full rounded-xl border border-white/10 bg-zinc-900 object-cover sm:h-32" />
                ) : (
                  <div className="flex h-36 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-amber-400/30 bg-amber-400/5 px-3 text-center sm:h-32">
                    <Upload className="h-5 w-5 text-amber-300" />
                    <span className="text-[10px] text-amber-200">Foto promo perlu ditambahkan</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPromo(sharingPromo);
                        setIsPromoModalOpen(true);
                        setSharingPromo(null);
                      }}
                      className="text-[10px] font-bold text-cyan-300 underline underline-offset-2"
                    >
                      Edit & upload foto
                    </button>
                  </div>
                )}
                <div className="min-w-0">
                  <span className="inline-flex rounded-md bg-red-500/10 px-2 py-1 text-[10px] font-bold text-red-300">{sharingPromo.badge || 'Promo'}</span>
                  <h4 className="mt-2 text-base font-black text-white">{sharingPromo.title}</h4>
                  {sharingPromo.discountValue && <p className="mt-1 text-xs font-bold text-amber-300">{sharingPromo.discountValue}</p>}
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-zinc-300">{sharingPromo.description}</p>
                  <a href={`${window.location.origin}/#promo`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-300 hover:text-cyan-200">
                    <ExternalLink className="h-3 w-3" />
                    kreditmotorhonda.tech/#promo
                  </a>
                </div>
              </div>

              <div>
                <label htmlFor="promo-whatsapp-recipient" className="mb-1.5 block text-xs font-bold text-zinc-200">Nomor WhatsApp konsumen *</label>
                <input
                  id="promo-whatsapp-recipient"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={promoRecipientPhone}
                  onChange={(event) => setPromoRecipientPhone(event.target.value)}
                  placeholder="Contoh: 0812 3456 7890"
                  className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
                <p className="mt-1.5 text-[10px] text-zinc-500">Nomor akan dinormalisasi ke kode negara Indonesia (+62) bila dimulai dengan 0 atau 8.</p>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-[11px] leading-relaxed text-zinc-300">
                Foto promo dan tautan website akan ikut dalam pesan. WhatsApp Web akan meminta scan QR atau login jika belum aktif; periksa pesan lalu tekan <strong className="text-white">Kirim</strong> di WhatsApp.
              </div>

              <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
                <button type="button" onClick={() => setSharingPromo(null)} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-white/5">Batal</button>
                <button type="submit" disabled={!sharingPromo.images?.[0]} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40">
                  <MessageSquare className="h-4 w-4" />
                  Buka WhatsApp Web
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
