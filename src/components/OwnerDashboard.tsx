import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Eye,
  Globe,
  LayoutDashboard,
  Link2,
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
  siteCount: number;
  sites: Array<{ host: string; visits: number }>;
  siteAdmins: Array<{ host: string; dataAvailable: boolean; admins: Array<{ username: string; role: string }> }>;
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

type DateRange = '7d' | '30d' | 'all' | 'custom';
type ChartType = 'bar' | 'line';

function jakartaDateKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(date);
}

function daysBefore(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
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
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [showAllDays, setShowAllDays] = useState(false);
  const [showAllPages, setShowAllPages] = useState(false);
  const [showAllSearchTerms, setShowAllSearchTerms] = useState(false);
  const [showAllLeads, setShowAllLeads] = useState(false);

  useEffect(() => {
    localStorage.setItem('hwa-owner-dashboard-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

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
          : daysBefore(today, range === '7d' ? 6 : 29);
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
          pages: showAllPages,
          searchTerms: showAllSearchTerms,
          leads: showAllLeads,
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
  }, [key, range, startDate, endDate, refreshVersion, showAllPages, showAllSearchTerms, showAllLeads]);

  const selectRange = (nextRange: DateRange) => {
    const today = jakartaDateKey(new Date());
    if (nextRange === '7d') {
      setStartDate(daysBefore(today, 6));
      setEndDate(today);
    } else if (nextRange === '30d') {
      setStartDate(daysBefore(today, 29));
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
  const allDays = analytics?.dailyVisitors || [];
  const visibleDays = showAllDays ? allDays : allDays.slice(-30);
  const totalDomainVisits = (analytics?.sites || []).reduce((total, site) => total + site.visits, 0);
  const rangeLabel = range === 'all'
    ? 'Semua data'
    : range === 'custom'
      ? `${startDate} - ${endDate}`
      : range === '7d'
        ? '7 hari terakhir'
        : '30 hari terakhir';
  let donutProgress = 0;
  const donutStops = (analytics?.sites || []).map((site, index) => {
    const start = donutProgress;
    donutProgress += totalDomainVisits ? (site.visits / totalDomainVisits) * 100 : 0;
    return `${domainColors[index % domainColors.length]} ${start}% ${donutProgress}%`;
  });
  const donutStyle = {
    background: totalDomainVisits ? `conic-gradient(${donutStops.join(', ')})` : '#cbd5e1',
  };
  const linePoints = visibleDays.map((day, index) => {
    const x = visibleDays.length <= 1 ? 50 : (index / (visibleDays.length - 1)) * 100;
    const y = 92 - (day.visits / maxDailyVisits) * 78;
    return `${x},${y}`;
  }).join(' ');

  const navItems = [
    { label: 'Dashboard Analytics', href: '#overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Domain Dipantau', href: '#domains', icon: <Globe className="h-4 w-4" /> },
    { label: 'Admin Owner', href: '#admin-access', icon: <Users className="h-4 w-4" /> },
    { label: 'Prospek Masuk', href: '#prospects', icon: <Users className="h-4 w-4" /> },
    { label: 'URL Landing Pages', href: '#pages', icon: <Link2 className="h-4 w-4" /> },
  ];

  return (
    <div className={isDarkMode ? 'dark' : ''}>
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
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-red-700 to-red-500 text-white shadow-lg shadow-red-500/30">
                    <span className="text-lg font-black">H</span>
                  </div>
                  <div>
                    <span className="block text-sm font-extrabold leading-none tracking-wide text-slate-900 dark:text-white">HONDA TECH</span>
                    <span className="text-[10px] font-medium text-slate-400">Owner Analytics</span>
                  </div>
                </div>
                <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden" onClick={() => setIsSidebarOpen(false)} aria-label="Tutup menu">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="mt-6 space-y-1 px-3" aria-label="Navigasi dashboard">
                {navItems.map((item, index) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors ${index === 0 ? 'bg-red-50 font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-400' : 'font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60'}`}
                  >
                    {item.icon}<span>{item.label}</span>
                    {item.href === '#domains' && <span className="ml-auto rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-300">{analytics?.siteCount || 0}</span>}
                  </a>
                ))}
              </nav>
            </div>
            <div className="m-4 rounded-2xl border border-slate-200/80 bg-slate-100 p-4 dark:border-slate-700/50 dark:bg-slate-800/60">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-300 text-xs font-bold text-slate-700 dark:bg-slate-600 dark:text-slate-200">SA</div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">Super Admin Owner</p>
                  <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">Akses analitik aktif</p>
                </div>
              </div>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col md:ml-64">
            <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 sm:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button type="button" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden" onClick={() => setIsSidebarOpen(true)} aria-label="Buka menu">
                  <Menu className="h-5 w-5" />
                </button>
                <h1 className="hidden truncate text-lg font-bold text-slate-900 dark:text-white sm:block">Ringkasan Analitik Network</h1>
                <span className="truncate text-sm font-bold text-slate-900 dark:text-white sm:hidden">Owner Analytics</span>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 sm:flex">
                  <CalendarDays className="h-3.5 w-3.5 text-red-500" />
                  <span>{rangeLabel}</span>
                </div>
                <button type="button" onClick={() => setIsDarkMode((value) => !value)} title={isDarkMode ? 'Gunakan tema terang' : 'Gunakan tema gelap'} aria-label={isDarkMode ? 'Gunakan tema terang' : 'Gunakan tema gelap'} className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                  {isDarkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
                </button>
                <button type="button" onClick={() => setRefreshVersion((value) => value + 1)} title="Perbarui data" aria-label="Perbarui data" className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </header>

            <div className="space-y-6 p-4 sm:p-8">
              <section id="overview" className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Performa Traffic Website</h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">Pantau seluruh domain dan landing page dalam satu dashboard.</p>
                </div>
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />{isLoading ? 'Memperbarui data' : 'Live Traffic Connected'}
                </span>
              </section>

              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Ringkasan metrik">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Kunjungan</span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400"><Eye className="h-4 w-4" /></span>
                  </div>
                  <div className="mt-3 text-3xl font-black tabular-nums text-slate-900 dark:text-white">{(analytics?.totalVisits || 0).toLocaleString('id-ID')}</div>
                  <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">Pengunjung unik pada periode terpilih</p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Website Dipantau</span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"><Globe className="h-4 w-4" /></span>
                  </div>
                  <div className="mt-3 text-3xl font-black tabular-nums text-slate-900 dark:text-white">{(analytics?.siteCount || 0).toLocaleString('id-ID')}</div>
                  <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">Domain aktif di dashboard owner</p>
                </div>
                <div className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-br from-slate-900 via-slate-800 to-red-950 p-5 text-white shadow-lg shadow-red-950/20">
                  <div className="pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-red-600/10 blur-xl" />
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-red-300">Website Teratas</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/40 bg-red-600/30 text-red-300"><Activity className="h-4 w-4" /></span>
                  </div>
                  <a href={analytics?.sites[0] ? `https://${analytics.sites[0].host}` : '#'} target="_blank" rel="noreferrer" className="mt-3 block truncate text-base font-bold text-white transition hover:text-red-300">{analytics?.sites[0]?.host || '-'}</a>
                  <div className="mt-2 text-2xl font-black text-red-400">{(analytics?.sites[0]?.visits || 0).toLocaleString('id-ID')} <span className="text-xs font-normal text-slate-300">kunjungan</span></div>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Halaman Populer</span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"><BarChart3 className="h-4 w-4" /></span>
                  </div>
                  <div className="mt-3 text-3xl font-black tabular-nums text-slate-900 dark:text-white">{(analytics?.topPages.length || 0).toLocaleString('id-ID')}</div>
                  <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">URL terpopuler pada rentang terpilih</p>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5" aria-label="Filter tanggal">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <div>
                    <div className="grid grid-cols-2 gap-3 sm:max-w-xl">
                      <label className="min-w-0 space-y-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        <span>Tanggal mulai</span>
                        <input type="date" aria-label="Tanggal mulai" value={range === 'all' ? '' : startDate} max={endDate || undefined} onChange={(event) => updateStartDate(event.target.value)} className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                      </label>
                      <label className="min-w-0 space-y-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        <span>Tanggal akhir</span>
                        <input type="date" aria-label="Tanggal akhir" value={range === 'all' ? '' : endDate} min={startDate || undefined} onChange={(event) => updateEndDate(event.target.value)} className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                      </label>
                    </div>
                    <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">Tanggal awal dan akhir termasuk dalam hasil. Pilih tanggal yang sama untuk melihat satu hari.</p>
                  </div>
                  <div className="flex w-fit max-w-full rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800" role="group" aria-label="Periode kunjungan">
                    {([
                      ['7d', '7 hari'],
                      ['30d', '30 hari'],
                      ['all', 'Semua'],
                      ['custom', 'Tanggal'],
                    ] as const).map(([value, label]) => (
                      <button key={value} type="button" aria-pressed={range === value} onClick={() => selectRange(value)} className={`whitespace-nowrap rounded-lg px-2.5 py-2 text-[11px] font-semibold transition sm:px-3 ${range === value ? 'bg-white text-red-700 shadow-sm dark:bg-slate-700 dark:text-red-300' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {range === 'custom' && startDate && endDate && startDate > endDate && <p className="mt-3 text-xs text-red-600" role="alert">Tanggal mulai tidak boleh melewati tanggal akhir.</p>}
              </section>

              {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300" role="alert">{error}</div>}

              <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2 sm:p-6">
                  <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white"><BarChart3 className="h-4 w-4 text-red-600" />Pergerakan Kunjungan Harian</h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Jumlah kunjungan harian dari website terpilih</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {allDays.length > 30 && (
                        <button type="button" aria-expanded={showAllDays} onClick={() => setShowAllDays((value) => !value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                          {showAllDays ? 'Tampilkan 30 hari' : `Lihat semua data (${allDays.length} hari)`}
                        </button>
                      )}
                      <div className="flex w-fit rounded-xl bg-slate-100 p-1 text-xs font-medium dark:bg-slate-800" role="group" aria-label="Jenis grafik">
                      <button type="button" aria-pressed={chartType === 'bar'} onClick={() => setChartType('bar')} className={`rounded-lg px-3 py-1.5 transition ${chartType === 'bar' ? 'bg-white font-bold text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Bar</button>
                      <button type="button" aria-pressed={chartType === 'line'} onClick={() => setChartType('line')} className={`rounded-lg px-3 py-1.5 transition ${chartType === 'line' ? 'bg-white font-bold text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Garis</button>
                      </div>
                    </div>
                  </div>
                  {visibleDays.length ? (
                    <div className="relative overflow-x-auto pb-2">
                      <div className="min-w-full" style={{ minWidth: `max(100%, ${visibleDays.length * 42}px)` }}>
                      <div className="relative h-56 border-b border-slate-200 pb-2 dark:border-slate-700">
                        {chartType === 'bar' ? (
                          <div className="flex h-full items-end gap-1.5 sm:gap-3">
                            {visibleDays.map((day) => (
                              <div key={day.date} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2" title={`${day.date}: ${day.visits} kunjungan`}>
                                <span className="text-[10px] font-semibold text-slate-500 opacity-0 transition group-hover:opacity-100">{day.visits}</span>
                                <div className="w-full max-w-10 rounded-t-lg bg-red-600 transition-colors group-hover:bg-red-500" style={{ height: `${Math.max(3, (day.visits / maxDailyVisits) * 76)}%` }} />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible" role="img" aria-label="Grafik garis kunjungan harian">
                            <polyline points={linePoints} fill="none" stroke="#dc2626" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                            {visibleDays.map((day, index) => {
                              const x = visibleDays.length <= 1 ? 50 : (index / (visibleDays.length - 1)) * 100;
                              const y = 92 - (day.visits / maxDailyVisits) * 78;
                              return <circle key={day.date} cx={x} cy={y} r="1.7" fill="#dc2626"><title>{`${day.date}: ${day.visits} kunjungan`}</title></circle>;
                            })}
                          </svg>
                        )}
                      </div>
                      <div className="mt-2 flex gap-1.5 sm:gap-3">
                        {visibleDays.map((day) => <span key={day.date} className="min-w-0 flex-1 truncate text-center text-[9px] text-slate-500 sm:text-[10px]">{day.label}</span>)}
                      </div>
                      </div>
                    </div>
                  ) : <p className="py-16 text-center text-xs text-slate-500">Belum ada data kunjungan pada periode ini.</p>}
                </div>

                <div id="domains" className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                  <div>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white"><Globe className="h-4 w-4 text-red-600" />Kunjungan Per Website</h3>
                      <span className="shrink-0 text-[10px] text-slate-400">Periode</span>
                    </div>
                    <p className="mb-5 text-xs text-slate-500 dark:text-slate-400">Distribusi proporsi kunjungan domain</p>
                    <div className="flex items-center justify-center py-2">
                      <div className="relative h-44 w-44 rounded-full" role="img" aria-label="Distribusi kunjungan antar website" style={donutStyle}>
                        <div className="absolute inset-7 flex flex-col items-center justify-center rounded-full bg-white text-center dark:bg-slate-900">
                          <span className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">{(analytics?.totalVisits || 0).toLocaleString('id-ID')}</span>
                          <span className="text-[10px] text-slate-400">kunjungan</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                    {(analytics?.sites || []).map((site, index) => (
                      <div key={site.host} className="flex min-w-0 items-center justify-between gap-3 text-xs">
                        <a href={`https://${site.host}`} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 font-medium text-slate-700 hover:text-red-600 dark:text-slate-300 dark:hover:text-red-400">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: domainColors[index % domainColors.length] }} />
                          <span className="truncate">{site.host}</span>
                        </a>
                        <span className="shrink-0 font-bold tabular-nums text-slate-900 dark:text-white">{site.visits.toLocaleString('id-ID')} <span className="font-normal text-slate-400">({totalDomainVisits ? Math.round((site.visits / totalDomainVisits) * 100) : 0}%)</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section id="admin-access" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:px-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Admin Owner per Website</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Admin non-super yang ditugaskan ke subdomain dengan post SEO.</p>
                  </div>
                  <span className="text-[11px] text-slate-400">{analytics?.siteAdmins?.length || 0} website</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(analytics?.siteAdmins || []).map((site) => (
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
              </section>

              <section id="prospects" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:px-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Daftar Peminat &amp; Prospek Masuk</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Tersimpan secara dinamis setiap kali pengunjung mengklik &quot;Saya Tertarik&quot; atau &quot;Ajukan Kredit&quot;.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {(analytics?.siteLeadsTotal || 0) > 20 && <button type="button" aria-expanded={showAllLeads} onClick={() => setShowAllLeads((value) => !value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{showAllLeads ? 'Tampilkan ringkasan' : `Lihat semua data (${analytics?.siteLeadsTotal})`}</button>}
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
                        {analytics.siteLeads.map((lead) => {
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
              </section>

              <section id="pages" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:px-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Halaman Paling Banyak Dikunjungi</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Gabungan seluruh website pada periode terpilih ({analytics?.topPages.length || 0} halaman)</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    {(analytics?.topPagesTotal || 0) > 10 && <button type="button" aria-expanded={showAllPages} onClick={() => setShowAllPages((value) => !value)} className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{showAllPages ? 'Tampilkan ringkasan' : `Lihat semua data (${analytics?.topPagesTotal})`}</button>}
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
                        {analytics.topPages.map((page, index) => {
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
              </section>

              <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-label="Kata kunci pencarian">
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

              <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-label="Kata kunci Google">
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

              <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-label="Klik WhatsApp">
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
