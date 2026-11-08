import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  Globe,
  LayoutDashboard,
  Link2,
  LogOut,
  Maximize,
  Menu,
  MessageSquare,
  Moon,
  RefreshCw,
  Search,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { api } from '../services/api';

interface OwnerAnalytics {
  totalVisits: number;
  previousPeriodChange?: number | null;
  siteCount: number;
  sites: Array<{ host: string; visits: number }>;
  trafficSources: Array<{ source: string; visits: number }>;
  siteAdmins: Array<{ host: string; dataAvailable: boolean; admins: Array<{ username: string; role: string }> }>;
  seoSubdomains: Array<{ host: string; title: string; sslStatus: string; seoRobots: string; postCount: number; updatedAt: string }>;
  seoPosts: Array<{ host: string; title: string; url: string; author: string; updatedAt: string }>;
  siteLeads: Array<{ id: string; host: string; customerName: string; motorName: string; status: string; createdAt: string }>;
  siteLeadsTotal: number;
  dailyVisitors: Array<{ date: string; label: string; visits: number }>;
  topPages: Array<{ page: string; visits: number }>;
  topPagesTotal: number;
  searchTerms: Array<{ keyword: string; searches: number; uniqueVisitors: number }>;
  googleSearchConsole?: {
    configured: boolean;
    startDate?: string;
    endDate?: string;
    sites: string[];
    rows: Array<{ keyword: string; clicks: number; impressions: number; ctr: number; position: number; siteCount: number }>;
    errors: string[];
  };
  whatsappClicks: Array<{ host: string; path: string; menu: string; clicks: number; uniqueVisitors: number }>;
  searchTermsTotal: number;
  timeZone: string;
}

type DateRange = '7d' | '30d' | '90d' | 'all' | 'custom';
type OwnerDashboardSection = 'overview' | 'domains' | 'admins' | 'leads' | 'pages' | 'posts' | 'subdomains';

function jakartaDateKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(date);
}

function daysBefore(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function Sparkline({ values, label, color }: { values: number[]; label: string; color: string }) {
  if (!values.length) return null;

  const maximum = Math.max(1, ...values);
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
    const y = 30 - (value / maximum) * 24;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="owner-sparkline" viewBox="0 0 100 36" role="img" aria-label={label}>
      <polyline points={points} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  if (!total) return null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const firstRow = total ? (page - 1) * pageSize + 1 : 0;
  const lastRow = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-xs dark:border-slate-800 dark:bg-slate-800/30 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <span className="text-slate-500 dark:text-slate-400">Menampilkan {firstRow}-{lastRow} dari {total} data</span>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          Baris per halaman
          <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            {[10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <button type="button" aria-label="Halaman sebelumnya" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"><ChevronLeft className="h-4 w-4" /></button>
        <span className="min-w-20 text-center tabular-nums text-slate-600 dark:text-slate-300">Halaman {page} dari {pageCount}</span>
        <button type="button" aria-label="Halaman berikutnya" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function paginateRows<T>(rows: T[], page: number, pageSize: number) {
  return rows.slice((page - 1) * pageSize, page * pageSize);
}

const domainColors = ['#dc2626', '#334155', '#f59e0b', '#0891b2', '#059669', '#7c3aed'];

export default function OwnerDashboard() {
  const key = new URLSearchParams(window.location.search).get('key') || '';
  const [range, setRange] = useState<DateRange>('7d');
  const [startDate, setStartDate] = useState(() => daysBefore(jakartaDateKey(new Date()), 6));
  const [endDate, setEndDate] = useState(() => jakartaDateKey(new Date()));
  const [analytics, setAnalytics] = useState<OwnerAnalytics | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('hwa-owner-dashboard-theme') === 'dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<OwnerDashboardSection>('overview');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [showAllDays, setShowAllDays] = useState(false);
  const [showAllSearchTerms, setShowAllSearchTerms] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    localStorage.setItem('hwa-owner-dashboard-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeSection, range, startDate, endDate]);

  useEffect(() => {
    if (!key) {
      setError('Tautan dashboard tidak valid atau belum dikonfigurasi.');
      setIsLoading(false);
      return;
    }

    let active = true;
    const refresh = async () => {
      const today = jakartaDateKey(new Date());
      const requestStartDate = range === 'all'
        ? undefined
        : range === 'custom'
          ? startDate
          : daysBefore(today, range === '7d' ? 6 : range === '30d' ? 29 : range === '90d' ? 89 : 6);
      const requestEndDate = range === 'all'
        ? undefined
        : range === 'custom'
          ? endDate
          : today;

      if (range === 'custom' && (!requestStartDate || !requestEndDate || requestStartDate > requestEndDate)) {
        setError('Pilih tanggal mulai dan akhir yang valid. Tanggal mulai tidak boleh melewati tanggal akhir.');
        setAnalytics(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const result = await api.getOwnerDashboardAnalytics(key, requestStartDate, requestEndDate, {
          pages: activeSection === 'pages',
          searchTerms: showAllSearchTerms,
          leads: activeSection === 'leads',
        });
        if (!active) return;
        setAnalytics(result);
        setError('');
        setLastUpdated(new Date());
      } catch (requestError: any) {
        if (!active) return;
        setError(requestError.message || 'Data dashboard tidak dapat dimuat.');
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void refresh();
    const intervalId = window.setInterval(() => void refresh(), 30_000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [key, range, startDate, endDate, refreshVersion, showAllSearchTerms, activeSection]);

  const selectRange = (nextRange: DateRange) => {
    const today = jakartaDateKey(new Date());
    if (nextRange === '7d') {
      setStartDate(daysBefore(today, 6));
      setEndDate(today);
    } else if (nextRange === '30d') {
      setStartDate(daysBefore(today, 29));
      setEndDate(today);
    } else if (nextRange === '90d') {
      setStartDate(daysBefore(today, 89));
      setEndDate(today);
    } else if (nextRange === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (range === 'all') {
      setStartDate(daysBefore(today, 6));
      setEndDate(today);
    }
    setRange(nextRange);
  };

  const updateStartDate = (value: string) => {
    if (range === 'all') setEndDate(value);
    setStartDate(value);
    setRange('custom');
  };

  const updateEndDate = (value: string) => {
    if (range === 'all') setStartDate(value);
    setEndDate(value);
    setRange('custom');
  };

  const maxDailyVisits = Math.max(1, ...(analytics?.dailyVisitors || []).map((item) => item.visits));
  const dailyAxisMax = Math.max(50, Math.ceil(maxDailyVisits / 50) * 50);
  const allDays = analytics?.dailyVisitors || [];
  const visibleDays = showAllDays
    ? allDays
    : allDays.slice(-(range === '7d' ? 7 : range === '30d' ? 30 : 90));
  const totalDomainVisits = (analytics?.sites || []).reduce((total, site) => total + site.visits, 0);
  const visitSparkline = (analytics?.dailyVisitors || []).slice(-8).map((day) => day.visits);
  const domainSparkline = (analytics?.sites || []).slice(0, 8).map((site) => site.visits);
  const pageSparkline = (analytics?.topPages || []).slice(0, 8).map((page) => page.visits);
  const rangeLabel = range === 'all'
    ? 'Semua data'
    : range === 'custom'
      ? `${startDate} - ${endDate}`
      : range === '7d'
        ? '7 hari terakhir'
        : range === '30d'
          ? '30 hari terakhir'
          : '90 hari terakhir';
  const previousPeriodChange = analytics?.previousPeriodChange ?? null;
  let donutProgress = 0;
  const sourceColors = ['#e60012', '#1478ef', '#f59e0b', '#9333ea', '#a8b1c2'];
  const trafficSources = analytics?.trafficSources || [];
  const donutStops = trafficSources.map((source, index) => {
    const start = donutProgress;
    donutProgress += analytics?.totalVisits ? (source.visits / analytics.totalVisits) * 100 : 0;
    return `${sourceColors[index % sourceColors.length]} ${start}% ${donutProgress}%`;
  });
  const sourceDonutStyle = {
    background: analytics?.totalVisits ? `conic-gradient(${donutStops.join(', ')})` : '#e5e7eb',
  };
  const linePoints = visibleDays.map((day, index) => {
    const x = visibleDays.length <= 1 ? 50 : (index / (visibleDays.length - 1)) * 100;
    const y = 86 - (day.visits / dailyAxisMax) * 68;
    return `${x},${y}`;
  }).join(' ');

  const navItems = [
    { id: 'overview', label: 'Dashboard Analytics', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'domains', label: 'Domain Dipantau', icon: <Globe className="h-4 w-4" /> },
    { id: 'admins', label: 'Admin Owner', icon: <Users className="h-4 w-4" /> },
    { id: 'leads', label: 'Prospek Masuk', icon: <Users className="h-4 w-4" /> },
    { id: 'pages', label: 'URL Landing Pages', icon: <Link2 className="h-4 w-4" /> },
  ];
  const sectionTitles: Record<OwnerDashboardSection, string> = {
    overview: 'Ringkasan Analitik Network',
    domains: 'Domain Dipantau',
    admins: 'Admin Owner',
    leads: 'Prospek Masuk',
    pages: 'URL Landing Pages',
    posts: 'Pos SEO',
    subdomains: 'SEO Subdomain',
  };
  const pageSectionNavigation = (
    <div className="flex w-fit rounded-lg bg-slate-100 p-1 text-[11px] font-semibold dark:bg-slate-800" role="group" aria-label="Bagian URL dan SEO">
      {([
        { id: 'pages', label: 'Landing Pages' },
        { id: 'posts', label: 'Pos SEO' },
        { id: 'subdomains', label: 'SEO Subdomain' },
      ] as const).map((section) => (
        <button key={section.id} type="button" aria-pressed={activeSection === section.id} onClick={() => { setActiveSection(section.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`rounded-md px-3 py-1.5 transition ${activeSection === section.id ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}>
          {section.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className={`owner-dashboard-ui ${isDarkMode ? 'dark' : ''}`}>
      <main className="min-h-screen bg-slate-50 text-slate-800 transition-colors dark:bg-slate-950 dark:text-slate-100">
        <button
          type="button"
          aria-label="Tutup navigasi"
          onClick={() => setIsSidebarOpen(false)}
          className={`fixed inset-0 z-30 bg-slate-950/50 md:hidden ${isSidebarOpen ? 'block' : 'hidden'}`}
        />
        <div className="flex min-h-screen">
          <aside className={`fixed inset-y-0 left-0 z-40 w-64 flex-col justify-between border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900 md:flex ${isSidebarOpen ? 'flex' : 'hidden'}`}>
            <div>
              <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <img className="owner-brand-logo" src="/favicon-honda.jpg" alt="Honda" />
                  <div>
                    <span className="block text-sm font-extrabold leading-none tracking-wide text-white">Honda Tech</span>
                    <span className="text-[10px] font-medium text-slate-300">Owner Analytics</span>
                  </div>
                </div>
                <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden" onClick={() => setIsSidebarOpen(false)} aria-label="Tutup menu">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="mt-6 space-y-1 px-3" aria-label="Navigasi dashboard">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={activeSection === item.id || (item.id === 'pages' && (activeSection === 'posts' || activeSection === 'subdomains')) ? 'page' : undefined}
                    onClick={() => {
                      setActiveSection(item.id as OwnerDashboardSection);
                      setIsSidebarOpen(false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition-colors ${activeSection === item.id ? 'bg-red-600 font-semibold text-white shadow-md shadow-red-950/20' : 'font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60'}`}
                  >
                    {item.icon}<span>{item.label}</span>
                    {item.id === 'domains' && <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${activeSection === item.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}>{analytics?.siteCount || 0}</span>}
                  </button>
                ))}
              </nav>
              <a className="owner-sidebar-promo" href="https://kreditmotorhonda.tech/#katalog" target="_blank" rel="noreferrer">
                <img src="/uploads/hero.jpeg" alt="Motor Honda" />
                <span><strong>Grow Your Business</strong><small>with Honda Tech</small><em>Lihat detail <ArrowUpRight className="h-3 w-3" /></em></span>
              </a>
            </div>
            <div className="m-4 rounded-2xl border border-slate-200/80 bg-slate-100 p-4 dark:border-slate-700/50 dark:bg-slate-800/60">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-300 text-xs font-bold text-slate-700 dark:bg-slate-600 dark:text-slate-200">SA</div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">Super Admin Owner</p>
                  <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">Akses analitik aktif</p>
                </div>
              </div>
              <button type="button" onClick={() => window.location.replace('/')} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-red-500 transition hover:bg-red-500/10">
                <LogOut className="h-4 w-4" />Logout
              </button>
            </div>
          </aside>

          <div className="owner-dashboard-main flex min-w-0 flex-1 flex-col md:ml-64">
            <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 sm:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button type="button" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden" onClick={() => setIsSidebarOpen(true)} aria-label="Buka menu">
                  <Menu className="h-5 w-5" />
                </button>
                <h1 className="hidden truncate text-lg font-bold text-slate-900 dark:text-white sm:block">{sectionTitles[activeSection]}</h1>
                <span className="truncate text-sm font-bold text-slate-900 dark:text-white sm:hidden">{sectionTitles[activeSection]}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <label className="owner-range-select hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 sm:flex">
                  <CalendarDays className="h-3.5 w-3.5 text-red-500" />
                  <span className="sr-only">Periode kunjungan</span>
                  <select aria-label="Periode kunjungan" value={range} onChange={(event) => selectRange(event.target.value as DateRange)}>
                    <option value="7d">7 hari terakhir</option>
                    <option value="30d">30 hari terakhir</option>
                    <option value="90d">90 hari terakhir</option>
                    <option value="all">Semua data</option>
                    <option value="custom">Pilih tanggal</option>
                  </select>
                </label>
                <button type="button" onClick={() => setIsDarkMode((value) => !value)} title={isDarkMode ? 'Gunakan tema terang' : 'Gunakan tema gelap'} aria-label={isDarkMode ? 'Gunakan tema terang' : 'Gunakan tema gelap'} className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                  {isDarkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
                </button>
                <button type="button" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen(); }} title="Layar penuh" aria-label="Layar penuh" className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                  <Maximize className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setRefreshVersion((value) => value + 1)} title="Perbarui data" aria-label="Perbarui data" className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </header>

            <section id="overview" className="owner-hero">
              <div className="owner-hero-copy">
                <span>HONDA TECH <span aria-hidden="true">|</span> OWNER ANALYTICS</span>
                <h2>Honda Tech</h2>
                <p>Insight lebih dalam, keputusan lebih tepat.</p>
              </div>
              <span className="owner-live-status">
                <span className="owner-live-dot" />
                {isLoading ? 'Memperbarui data' : 'Live Traffic Connected'}
              </span>
              <img className="owner-hero-photo" src="/uploads/hero.jpeg" alt="Motor Honda Vario" />
            </section>

            <div className="space-y-6 p-4 sm:p-8">
              <section className={`${activeSection === 'overview' ? '' : 'hidden'} grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4`} aria-label="Ringkasan metrik">
                <div className="owner-kpi owner-kpi-visits rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Kunjungan</span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400"><Eye className="h-4 w-4" /></span>
                  </div>
                  <div className="mt-3 text-3xl font-black tabular-nums text-slate-900 dark:text-white">{(analytics?.totalVisits || 0).toLocaleString('id-ID')}</div>
                  <p className={`mt-2 inline-flex items-center gap-1 text-[11px] font-semibold ${previousPeriodChange === null ? 'text-slate-400 dark:text-slate-500' : previousPeriodChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {previousPeriodChange === null ? 'Data periode sebelumnya belum tersedia' : <>
                      {previousPeriodChange >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {previousPeriodChange > 0 ? '+' : ''}{previousPeriodChange.toFixed(1)}% dari periode sebelumnya
                    </>}
                  </p>
                  <Sparkline values={visitSparkline} label="Tren kunjungan harian" color="#e11d2e" />
                </div>
                <div className="owner-kpi owner-kpi-sites rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Website Dipantau</span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"><Globe className="h-4 w-4" /></span>
                  </div>
                  <div className="mt-3 text-3xl font-black tabular-nums text-slate-900 dark:text-white">{(analytics?.siteCount || 0).toLocaleString('id-ID')}</div>
                  <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">Domain aktif di dashboard owner</p>
                  <Sparkline values={domainSparkline} label="Distribusi kunjungan per domain" color="#2583f7" />
                </div>
                <div className="owner-kpi owner-kpi-top relative overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-br from-slate-900 via-slate-800 to-red-950 p-5 text-white shadow-lg shadow-red-950/20">
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-red-300">Website Teratas</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/40 bg-red-600/30 text-red-300"><Activity className="h-4 w-4" /></span>
                  </div>
                  <a href={analytics?.sites[0] ? `https://${analytics.sites[0].host}` : '#'} target="_blank" rel="noreferrer" className="mt-3 block truncate text-base font-bold text-white transition hover:text-red-300">{analytics?.sites[0]?.host || '-'}</a>
                  <div className="mt-2 text-2xl font-black text-red-400">{(analytics?.sites[0]?.visits || 0).toLocaleString('id-ID')} <span className="text-xs font-normal text-slate-300">kunjungan</span></div>
                </div>
                <div className="owner-kpi owner-kpi-pages rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Halaman Populer</span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"><BarChart3 className="h-4 w-4" /></span>
                  </div>
                  <div className="mt-3 text-3xl font-black tabular-nums text-slate-900 dark:text-white">{(analytics?.topPages.length || 0).toLocaleString('id-ID')}</div>
                  <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">URL terpopuler pada rentang terpilih</p>
                  <Sparkline values={pageSparkline} label="Kunjungan halaman terpopuler" color="#f59e0b" />
                </div>
              </section>

              {range === 'custom' && <section className="owner-custom-date rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-label="Filter tanggal">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="min-w-0 space-y-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    <span>Tanggal mulai</span>
                    <input type="date" aria-label="Tanggal mulai" value={startDate} max={endDate || undefined} onChange={(event) => updateStartDate(event.target.value)} className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                  </label>
                  <label className="min-w-0 space-y-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    <span>Tanggal akhir</span>
                    <input type="date" aria-label="Tanggal akhir" value={endDate} min={startDate || undefined} onChange={(event) => updateEndDate(event.target.value)} className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                  </label>
                </div>
                {startDate > endDate && <p className="mt-3 text-xs text-red-600" role="alert">Tanggal mulai tidak boleh melewati tanggal akhir.</p>}
              </section>}

              {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300" role="alert">{error}</div>}

              <section className={`${activeSection === 'overview' ? '' : 'hidden'} grid grid-cols-1 gap-6 lg:grid-cols-3`}>
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
                  <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white"><BarChart3 className="h-4 w-4 text-red-600" />Pergerakan Kunjungan Harian</h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Jumlah kunjungan harian dari website terpilih</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {allDays.length > 30 && (range === 'all' || range === 'custom') && (
                        <button type="button" aria-expanded={showAllDays} onClick={() => setShowAllDays((value) => !value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                          {showAllDays ? 'Tampilkan 30 hari' : `Lihat semua data (${allDays.length} hari)`}
                        </button>
                      )}
                      <div className="flex w-fit rounded-xl bg-slate-100 p-1 text-[10px] font-semibold dark:bg-slate-800" role="group" aria-label="Periode grafik">
                        {([{ value: '7d', label: '7 Hari' }, { value: '30d', label: '30 Hari' }, { value: '90d', label: '90 Hari' }] as const).map((period) => (
                          <button key={period.value} type="button" aria-pressed={range === period.value} onClick={() => selectRange(period.value)} className={`rounded-lg px-3 py-1.5 transition ${range === period.value ? 'bg-red-600 font-bold text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}>
                            {period.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {visibleDays.length ? (
                    <div className="relative overflow-x-auto pb-2">
                      <div className="min-w-full" style={{ minWidth: `max(100%, ${visibleDays.length * 42}px)` }}>
                      <div className="relative h-24 border-b border-slate-200 pb-2 dark:border-slate-700">
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible" role="img" aria-label="Grafik garis kunjungan harian">
                          <defs>
                            <linearGradient id="owner-visits-area" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0%" stopColor="#ef233c" stopOpacity="0.28" />
                              <stop offset="100%" stopColor="#ef233c" stopOpacity="0.02" />
                            </linearGradient>
                          </defs>
                          {[18, 35, 52, 69, 86].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="#e8ecf2" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />)}
                          <polygon points={`0,86 ${linePoints} 100,86`} fill="url(#owner-visits-area)" />
                          <polyline points={linePoints} fill="none" stroke="#e60012" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                          {visibleDays.map((day, index) => {
                            const pointX = visibleDays.length <= 1 ? 50 : (index / (visibleDays.length - 1)) * 100;
                            const pointY = 86 - (day.visits / dailyAxisMax) * 68;
                            return <g key={day.date}>
                              <text x={Math.max(4, Math.min(96, pointX))} y={Math.max(8, pointY - 3)} fill="#334155" fontSize="1.5" fontWeight="600" textAnchor="middle">{day.visits}</text>
                              <circle cx={pointX} cy={pointY} r="1.7" fill="#e60012"><title>{`${day.date}: ${day.visits} kunjungan`}</title></circle>
                            </g>;
                          })}
                        </svg>
                      </div>
                      <div className="mt-1 flex gap-1.5 sm:gap-3">
                        {visibleDays.map((day) => <span key={day.date} className="min-w-0 flex-1 truncate text-center text-[9px] text-slate-500 sm:text-[10px]">{day.label}</span>)}
                      </div>
                      </div>
                    </div>
                  ) : <p className="py-16 text-center text-xs text-slate-500">Belum ada data kunjungan pada periode ini.</p>}
                </div>

                <div id="domains" className="flex min-w-0 flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white"><Globe className="h-4 w-4 text-red-600" />Kunjungan per Sumber</h3>
                    <span className="shrink-0 text-[10px] text-slate-400">Periode</span>
                  </div>
                  <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Distribusi kunjungan berdasarkan sumber</p>
                  <div className="flex min-h-0 flex-1 items-center justify-center gap-4">
                    <div className="relative h-32 w-32 shrink-0 rounded-full" role="img" aria-label="Distribusi kunjungan berdasarkan sumber" style={sourceDonutStyle}>
                      <div className="absolute inset-6 flex flex-col items-center justify-center rounded-full bg-white text-center dark:bg-slate-900">
                        <span className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">{(analytics?.totalVisits || 0).toLocaleString('id-ID')}</span>
                        <span className="text-[10px] text-slate-400">kunjungan</span>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                    {trafficSources.map((source, index) => (
                      <div key={source.source} className="flex min-w-0 items-center justify-between gap-3 text-xs">
                        <span className="flex min-w-0 items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: sourceColors[index % sourceColors.length] }} />
                          <span className="truncate">{source.source}</span>
                        </span>
                        <span className="shrink-0 font-bold tabular-nums text-slate-900 dark:text-white">{analytics?.totalVisits ? ((source.visits / analytics.totalVisits) * 100).toFixed(1) : '0.0'}%</span>
                      </div>
                    ))}
                    </div>
                  </div>
                </div>
              </section>

              {activeSection === 'overview' && <section className="owner-overview-bottom" aria-label="Insight dan halaman populer">
                <div className="owner-recommendations">
                  <h3><Activity className="h-4 w-4" />Insight &amp; Rekomendasi</h3>
                  <p>{analytics?.sites[0] ? `${analytics.sites[0].host} memimpin dengan ${analytics.sites[0].visits.toLocaleString('id-ID')} kunjungan.` : 'Data website akan muncul setelah kunjungan tercatat.'}</p>
                  <p>{analytics?.topPages[0] ? `Halaman populer: ${analytics.topPages[0].page}.` : 'Belum ada halaman populer pada rentang ini.'}</p>
                  <p>{analytics?.whatsappClicks?.length ? `${analytics.whatsappClicks.length} tombol WhatsApp menerima klik.` : 'Pantau klik WhatsApp untuk mengukur minat calon pembeli.'}</p>
                </div>

                <div className="owner-top-pages">
                  <h3><BarChart3 className="h-4 w-4" />Top 5 Halaman Populer</h3>
                  {analytics?.topPages?.length ? analytics.topPages.slice(0, 5).map((page, index) => (
                    <div className="owner-top-page-row" key={page.page}>
                      <span className="owner-top-page-rank">{index + 1}</span>
                      <span className="owner-top-page-name" title={page.page}>{page.page}</span>
                      <span className="owner-top-page-count">{page.visits.toLocaleString('id-ID')}</span>
                      <span className="owner-top-page-bar"><span style={{ width: `${Math.max(4, (page.visits / (analytics.topPages[0]?.visits || 1)) * 100)}%` }} /></span>
                    </div>
                  )) : <p className="owner-empty-state">Belum ada halaman populer pada rentang ini.</p>}
                </div>

                <a className="owner-promo-card" href="https://kreditmotorhonda.tech/#katalog" target="_blank" rel="noreferrer">
                  <img src="/uploads/hero.jpeg" alt="Pilihan motor Honda" />
                  <span className="owner-promo-copy"><strong>Honda Tech</strong><span>Bangun ekosistem digital Honda bersama kami.</span><em>Pelajari lebih lanjut <ArrowUpRight className="h-3.5 w-3.5" /></em></span>
                </a>
              </section>}

              {activeSection === 'domains' && <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-100 p-5 dark:border-slate-800 sm:px-6">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Detail Domain Dipantau</h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Seluruh domain owner dan kunjungan pada periode {rangeLabel}.</p>
                </div>
                {(analytics?.sites || []).length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-left">
                      <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-semibold uppercase text-slate-400 dark:border-slate-800 dark:bg-slate-800/50"><th className="px-5 py-3 sm:px-6">Domain</th><th className="px-5 py-3 text-right">Kunjungan</th><th className="px-5 py-3 text-right">Porsi</th><th className="px-5 py-3 sm:px-6">Status data</th></tr></thead>
                      <tbody className="divide-y divide-slate-100 text-xs dark:divide-slate-800/60">
                        {paginateRows(analytics!.sites, currentPage, pageSize).map((site, index) => {
                          const adminData = analytics!.siteAdmins.find((item) => item.host === site.host);
                          const share = totalDomainVisits ? (site.visits / totalDomainVisits) * 100 : 0;
                          return <tr key={site.host} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                            <td className="px-5 py-3.5 sm:px-6"><a href={`https://${site.host}`} target="_blank" rel="noreferrer" className="font-semibold text-slate-800 hover:text-red-600 dark:text-slate-200">{site.host}</a></td>
                            <td className="px-5 py-3.5 text-right font-bold tabular-nums text-slate-900 dark:text-white">{site.visits.toLocaleString('id-ID')}</td>
                            <td className="px-5 py-3.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{share.toFixed(1)}%</td>
                            <td className="px-5 py-3.5 sm:px-6"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: domainColors[index % domainColors.length] }} />{adminData?.dataAvailable ? 'Terhubung' : 'Data belum tersedia'}</span></td>
                          </tr>;
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="px-6 py-10 text-center text-xs text-slate-500">Belum ada domain yang dipantau.</p>}
                <TablePagination page={currentPage} pageSize={pageSize} total={analytics?.sites.length || 0} onPageChange={setCurrentPage} onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }} />
              </section>}

              <section id="admin-access" className={`${activeSection === 'admins' ? '' : 'hidden'} overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900`}>
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:px-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Admin Owner per Website</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Admin non-super yang ditugaskan ke subdomain dengan post SEO.</p>
                  </div>
                  <span className="text-[11px] text-slate-400">{analytics?.siteAdmins?.length || 0} website</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginateRows(analytics?.siteAdmins || [], currentPage, pageSize).map((site) => (
                    <div key={site.host} className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{site.host}</p>
                        {site.admins.length ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {site.admins.map((admin) => (
                              <span key={`${site.host}-${admin.username}`} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                <span className="font-semibold">{admin.username}</span><span className="text-slate-400">·</span><span>{admin.role}</span>
                              </span>
                            ))}
                          </div>
                        ) : <p className="mt-1 text-xs text-slate-500">{site.dataAvailable ? 'Belum ada admin post SEO yang ditugaskan.' : 'Data admin tidak tersedia untuk website ini.'}</p>}
                      </div>
                    </div>
                  ))}
                  {!analytics?.siteAdmins?.length && <p className="px-6 py-8 text-center text-xs text-slate-500">Informasi website belum tersedia.</p>}
                </div>
                <TablePagination page={currentPage} pageSize={pageSize} total={analytics?.siteAdmins?.length || 0} onPageChange={setCurrentPage} onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }} />
              </section>

              <section id="prospects" className={`${activeSection === 'leads' ? '' : 'hidden'} overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900`}>
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:px-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Daftar Peminat &amp; Prospek Masuk</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Tersimpan secara dinamis setiap kali pengunjung mengklik &quot;Saya Tertarik&quot; atau &quot;Ajukan Kredit&quot;.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 text-[11px] text-slate-400">{analytics?.siteLeadsTotal || 0} prospek</span>
                  </div>
                </div>
                {analytics?.siteLeads?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-left">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-800/50">
                          <th className="px-5 py-3.5 sm:px-6">Website / Tanggal</th>
                          <th className="px-5 py-3.5 sm:px-6">Nama Peminat</th>
                          <th className="px-5 py-3.5 sm:px-6">Unit Diminati</th>
                          <th className="px-5 py-3.5 sm:px-6">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs dark:divide-slate-800/60">
                        {paginateRows(analytics.siteLeads, currentPage, pageSize).map((lead) => {
                          const statusClass = lead.status === 'Selesai'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : lead.status === 'Ditolak'
                              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
                              : lead.status === 'Dihubungi'
                                ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300'
                                : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300';
                          const createdAt = lead.createdAt ? new Date(lead.createdAt) : null;
                          return (
                            <tr key={`${lead.host}-${lead.id}`} className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                              <td className="px-5 py-3.5 sm:px-6">
                                <span className="block font-semibold text-slate-800 dark:text-slate-200">{lead.host}</span>
                                <span className="mt-1 block text-[10px] text-slate-400">{createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toLocaleString('id-ID') : '-'}</span>
                              </td>
                              <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-200 sm:px-6">{lead.customerName}</td>
                              <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 sm:px-6">{lead.motorName}</td>
                              <td className="px-5 py-3.5 sm:px-6"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusClass}`}>{lead.status}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="px-6 py-10 text-center text-xs text-slate-500">Belum ada data peminat yang tersimpan di website terpilih.</p>}
                <TablePagination page={currentPage} pageSize={pageSize} total={analytics?.siteLeadsTotal || 0} onPageChange={setCurrentPage} onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }} />
              </section>

              <section id="pages" className={`${activeSection === 'pages' ? '' : 'hidden'} overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900`}>
                <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:px-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Halaman Paling Banyak Dikunjungi</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Gabungan seluruh website pada periode terpilih ({analytics?.topPages.length || 0} halaman)</p>
                  </div>
                  {pageSectionNavigation}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-2"><Users className="h-4 w-4" />Diperbarui {lastUpdated ? lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                  </div>
                </div>
                {analytics?.topPages.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] border-collapse text-left">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-800/50">
                          <th className="px-5 py-3.5 sm:px-6">Website / Halaman URL</th>
                          <th className="px-5 py-3.5 sm:px-6">Popularitas</th>
                          <th className="px-5 py-3.5 text-right sm:px-6">Total Kunjungan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs dark:divide-slate-800/60">
                        {paginateRows(analytics.topPages, currentPage, pageSize).map((page, index) => {
                          const percentage = analytics.totalVisits ? (page.visits / analytics.totalVisits) * 100 : 0;
                          const separatorIndex = page.page.indexOf('/');
                          const host = separatorIndex >= 0 ? page.page.slice(0, separatorIndex) : page.page;
                          const path = separatorIndex >= 0 ? page.page.slice(separatorIndex) : '/';
                          return (
                            <tr key={page.page} className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                              <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-200 sm:px-6">
                                <a href={`https://${host}${path}`} target="_blank" rel="noreferrer" className="group flex min-w-0 items-center gap-2 transition hover:text-red-600 dark:hover:text-red-400">
                                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-red-500" />
                                  <span className="truncate">{page.page}</span>
                                </a>
                              </td>
                              <td className="px-5 py-3.5 sm:px-6">
                                <div className="flex items-center gap-3">
                                  <div className="h-2 w-full max-w-36 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full" style={{ width: `${Math.min(100, percentage)}%`, backgroundColor: domainColors[index % domainColors.length] }} /></div>
                                  <span className="text-[10px] font-medium tabular-nums text-slate-500">{percentage.toFixed(1)}%</span>
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-right font-bold tabular-nums text-slate-900 dark:text-white sm:px-6">{page.visits.toLocaleString('id-ID')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="px-6 py-10 text-center text-xs text-slate-500">Belum ada halaman yang tercatat pada periode ini.</p>}
                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-[10px] text-slate-400 dark:border-slate-800 dark:bg-slate-800/30 sm:px-6">
                  <span>Menampilkan halaman terpopuler pada rentang tanggal</span>
                  <span>{isLoading ? 'Memperbarui...' : 'Realtime'}</span>
                </div>
                <TablePagination page={currentPage} pageSize={pageSize} total={analytics?.topPagesTotal || 0} onPageChange={setCurrentPage} onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }} />
              </section>

              {activeSection === 'posts' && <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:px-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Pos SEO</h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Semua pos dari subdomain yang dipilih ({analytics?.seoPosts?.length || 0} pos).</p>
                  </div>
                  {pageSectionNavigation}
                </div>
                {(analytics?.seoPosts || []).length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] border-collapse text-left">
                      <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-semibold uppercase text-slate-400 dark:border-slate-800 dark:bg-slate-800/50"><th className="px-5 py-3 sm:px-6">Subdomain</th><th className="px-5 py-3">Judul Pos</th><th className="px-5 py-3">Penulis</th><th className="px-5 py-3 sm:px-6">Diperbarui</th></tr></thead>
                      <tbody className="divide-y divide-slate-100 text-xs dark:divide-slate-800/60">
                        {paginateRows(analytics!.seoPosts, currentPage, pageSize).map((post) => <tr key={post.url} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="px-5 py-3.5 font-medium text-slate-600 dark:text-slate-300 sm:px-6">{post.host}</td>
                          <td className="max-w-[30rem] px-5 py-3.5 font-semibold text-slate-800 dark:text-slate-200"><a href={post.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-red-600 dark:hover:text-red-400">{post.title}<ArrowUpRight className="h-3 w-3 shrink-0" /></a></td>
                          <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">{post.author || '-'}</td>
                          <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 sm:px-6">{post.updatedAt ? new Date(post.updatedAt).toLocaleDateString('id-ID') : '-'}</td>
                        </tr>)}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="px-6 py-10 text-center text-xs text-slate-500">Belum ada pos SEO pada subdomain yang dipantau.</p>}
                <TablePagination page={currentPage} pageSize={pageSize} total={analytics?.seoPosts?.length || 0} onPageChange={setCurrentPage} onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }} />
              </section>}

              {activeSection === 'subdomains' && <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:px-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">SEO Subdomain</h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Status, indeks, dan jumlah pos pada setiap subdomain.</p>
                  </div>
                  {pageSectionNavigation}
                </div>
                {(analytics?.seoSubdomains || []).length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] border-collapse text-left">
                      <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-semibold uppercase text-slate-400 dark:border-slate-800 dark:bg-slate-800/50"><th className="px-5 py-3 sm:px-6">Subdomain</th><th className="px-5 py-3">Nama Website</th><th className="px-5 py-3">SSL</th><th className="px-5 py-3">Robots</th><th className="px-5 py-3 text-right">Pos</th><th className="px-5 py-3 sm:px-6">Diperbarui</th></tr></thead>
                      <tbody className="divide-y divide-slate-100 text-xs dark:divide-slate-800/60">
                        {paginateRows(analytics!.seoSubdomains, currentPage, pageSize).map((site) => <tr key={site.host} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="px-5 py-3.5 font-semibold text-slate-800 dark:text-slate-200 sm:px-6"><a href={`https://${site.host}`} target="_blank" rel="noreferrer" className="hover:text-red-600 dark:hover:text-red-400">{site.host}</a></td>
                          <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">{site.title}</td>
                          <td className="px-5 py-3.5"><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${site.sslStatus === 'active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'}`}>{site.sslStatus}</span></td>
                          <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">{site.seoRobots}</td>
                          <td className="px-5 py-3.5 text-right font-bold tabular-nums text-slate-900 dark:text-white">{site.postCount}</td>
                          <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 sm:px-6">{site.updatedAt ? new Date(site.updatedAt).toLocaleDateString('id-ID') : '-'}</td>
                        </tr>)}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="px-6 py-10 text-center text-xs text-slate-500">Belum ada subdomain SEO yang tercatat.</p>}
                <TablePagination page={currentPage} pageSize={pageSize} total={analytics?.seoSubdomains?.length || 0} onPageChange={setCurrentPage} onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }} />
              </section>}

              <section className={`${activeSection === 'overview' ? '' : 'hidden'} overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900`} aria-label="Kata kunci pencarian">
                <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:px-6">
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white"><Search className="h-4 w-4 text-red-600" />Pencarian Katalog</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Kata yang diketik di pencarian katalog website ({analytics?.searchTerms?.length || 0} kata kunci)</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    {(analytics?.searchTermsTotal || 0) > 50 && <button type="button" aria-expanded={showAllSearchTerms} onClick={() => setShowAllSearchTerms((value) => !value)} className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{showAllSearchTerms ? 'Tampilkan ringkasan' : `Lihat semua data (${analytics?.searchTermsTotal})`}</button>}
                    <span>Diurutkan berdasarkan frekuensi pencarian</span>
                  </div>
                </div>
                {analytics?.searchTerms?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[420px] border-collapse text-left">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-800/50">
                          <th className="px-5 py-3.5 sm:px-6">Kata kunci</th>
                          <th className="px-5 py-3.5 text-right">Pencarian</th>
                          <th className="px-5 py-3.5 text-right sm:px-6">Pengunjung unik</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs dark:divide-slate-800/60">
                        {analytics.searchTerms.map((term) => (
                          <tr key={term.keyword} className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                            <td className="max-w-[28rem] break-words px-5 py-3.5 font-medium text-slate-800 dark:text-slate-200 sm:px-6">{term.keyword}</td>
                            <td className="px-5 py-3.5 text-right font-bold tabular-nums text-slate-900 dark:text-white">{term.searches.toLocaleString('id-ID')}</td>
                            <td className="px-5 py-3.5 text-right font-medium tabular-nums text-slate-600 dark:text-slate-300 sm:px-6">{term.uniqueVisitors.toLocaleString('id-ID')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="px-6 py-10 text-center text-xs text-slate-500">Belum ada kata kunci pencarian pada periode ini. Pencatatan dimulai setelah fitur ini aktif.</p>}
              </section>

              <section className={`${activeSection === 'overview' ? '' : 'hidden'} overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900`} aria-label="Kata kunci Google">
                <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:px-6">
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white"><Search className="h-4 w-4 text-blue-600" />Kata Kunci Google</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Query Google gabungan ({analytics?.googleSearchConsole?.rows?.length || 0})
                      {analytics?.googleSearchConsole?.startDate && analytics.googleSearchConsole?.endDate
                        ? ` · ${analytics.googleSearchConsole.startDate} – ${analytics.googleSearchConsole.endDate}`
                        : ''}
                    </p>
                  </div>
                  <div className="text-xs text-slate-400">Data Search Console dapat tertunda hingga 3 hari</div>
                </div>
                {analytics?.googleSearchConsole?.configured === false ? (
                  <div className="m-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                    <p className="font-semibold">Google Search Console belum terhubung</p>
                    <p className="mt-1 leading-relaxed">Admin perlu menambahkan secret <code>GSC_SERVICE_ACCOUNT_JSON</code> di GitHub Actions dan memberi service account akses baca ke properti Search Console yang dipantau.</p>
                  </div>
                ) : analytics?.googleSearchConsole?.errors?.length && !analytics.googleSearchConsole?.rows?.length ? (
                  <div className="m-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                    <p className="font-semibold">Sebagian data Search Console tidak tersedia</p>
                    <p className="mt-1 leading-relaxed">{analytics.googleSearchConsole.errors.join(' ')}</p>
                  </div>
                ) : analytics?.googleSearchConsole?.rows?.length ? (
                  <div className="overflow-x-auto">
                    {analytics.googleSearchConsole.errors.length > 0 && (
                      <p className="mx-5 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                        Sebagian properti tidak dapat dibaca: {analytics.googleSearchConsole.errors.join(' ')}
                      </p>
                    )}
                    <table className="w-full min-w-[680px] border-collapse text-left">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-800/50">
                          <th className="px-5 py-3.5 sm:px-6">Query Google</th>
                          <th className="px-5 py-3.5 text-right">Klik</th>
                          <th className="px-5 py-3.5 text-right">Impresi</th>
                          <th className="px-5 py-3.5 text-right">CTR</th>
                          <th className="px-5 py-3.5 text-right">Posisi rata-rata</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs dark:divide-slate-800/60">
                        {analytics.googleSearchConsole.rows.map((row) => (
                          <tr key={row.keyword} className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                            <td className="max-w-[28rem] break-words px-5 py-3.5 font-medium text-slate-800 dark:text-slate-200 sm:px-6">{row.keyword}</td>
                            <td className="px-5 py-3.5 text-right font-bold tabular-nums text-slate-900 dark:text-white">{row.clicks.toLocaleString('id-ID')}</td>
                            <td className="px-5 py-3.5 text-right font-medium tabular-nums text-slate-600 dark:text-slate-300">{row.impressions.toLocaleString('id-ID')}</td>
                            <td className="px-5 py-3.5 text-right font-medium tabular-nums text-slate-600 dark:text-slate-300">{(row.ctr * 100).toFixed(1)}%</td>
                            <td className="px-5 py-3.5 text-right font-medium tabular-nums text-slate-600 dark:text-slate-300">{row.position.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="px-6 py-10 text-center text-xs text-slate-500">Belum ada query Google pada periode ini. Periksa periode, properti Search Console, dan status indeks website.</p>
                )}
              </section>

              <section className={`${activeSection === 'overview' ? '' : 'hidden'} overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900`} aria-label="Klik WhatsApp">
                <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:px-6">
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white"><MessageSquare className="h-4 w-4 text-emerald-600" />Klik WhatsApp</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Gabungan seluruh website pada periode terpilih ({analytics?.whatsappClicks?.length || 0} menu)</p>
                  </div>
                  <div className="text-xs text-slate-400">Diurutkan berdasarkan jumlah klik</div>
                </div>
                {analytics?.whatsappClicks?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-left">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-800/50">
                          <th className="px-5 py-3.5 sm:px-6">Website</th>
                          <th className="px-5 py-3.5">Menu / Tombol</th>
                          <th className="px-5 py-3.5">Halaman</th>
                          <th className="px-5 py-3.5 text-right">Klik</th>
                          <th className="px-5 py-3.5 text-right sm:px-6">Pengunjung unik</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs dark:divide-slate-800/60">
                        {analytics.whatsappClicks.map((click) => (
                          <tr key={`${click.host}-${click.path}-${click.menu}`} className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                            <td className="px-5 py-3.5 font-medium text-slate-700 dark:text-slate-300 sm:px-6">{click.host}</td>
                            <td className="max-w-[22rem] break-words px-5 py-3.5 font-medium text-slate-800 dark:text-slate-200">{click.menu}</td>
                            <td className="max-w-[16rem] truncate px-5 py-3.5 text-slate-500 dark:text-slate-400">{click.path}</td>
                            <td className="px-5 py-3.5 text-right font-bold tabular-nums text-slate-900 dark:text-white">{click.clicks.toLocaleString('id-ID')}</td>
                            <td className="px-5 py-3.5 text-right font-medium tabular-nums text-slate-600 dark:text-slate-300 sm:px-6">{click.uniqueVisitors.toLocaleString('id-ID')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="px-6 py-10 text-center text-xs text-slate-500">Belum ada klik WhatsApp pada periode ini. Klik mulai tercatat setelah fitur ini aktif.</p>}
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
