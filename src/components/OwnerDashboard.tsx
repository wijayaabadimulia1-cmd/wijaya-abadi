import { useEffect, useState } from 'react';
import { Activity, ArrowUpRight, Eye, Globe, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

interface OwnerAnalytics {
  totalVisits: number;
  siteCount: number;
  sites: Array<{ host: string; visits: number }>;
  dailyVisitors: Array<{ date: string; label: string; visits: number }>;
  topPages: Array<{ page: string; visits: number }>;
  timeZone: string;
}

type DateRange = '7d' | '30d' | 'all';

function jakartaDateKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(date);
}

function daysBefore(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export default function OwnerDashboard() {
  const key = new URLSearchParams(window.location.search).get('key') || '';
  const [range, setRange] = useState<DateRange>('7d');
  const [analytics, setAnalytics] = useState<OwnerAnalytics | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!key) {
      setError('Tautan dashboard tidak valid atau belum dikonfigurasi.');
      setIsLoading(false);
      return;
    }

    let active = true;
    const refresh = async () => {
      const today = jakartaDateKey(new Date());
      const startDate = range === 'all' ? undefined : daysBefore(today, range === '7d' ? 6 : 29);
      try {
        const result = await api.getOwnerDashboardAnalytics(key, startDate, range === 'all' ? undefined : today);
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
  }, [key, range]);

  const maxDailyVisits = Math.max(1, ...(analytics?.dailyVisitors || []).map((item) => item.visits));
  const visibleDays = (analytics?.dailyVisitors || []).slice(-30);

  return (
    <main className="min-h-screen bg-[#f4f6f5] text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600 text-white">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-600">Honda Wijaya Abadi</p>
              <h1 className="text-lg font-black">Dashboard Owner</h1>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <div className="text-right text-[11px] text-zinc-500">
              <div>{analytics?.timeZone || 'Asia/Jakarta'}</div>
              <div>{lastUpdated ? `Diperbarui ${lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : isLoading ? 'Memuat data...' : error ? 'Akses tidak tersedia' : 'Belum ada pembaruan'}</div>
            </div>
            <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-1" role="group" aria-label="Periode kunjungan">
              {([
                ['7d', '7 hari'],
                ['30d', '30 hari'],
                ['all', 'Semua'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={range === value}
                  onClick={() => setRange(value)}
                  className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${range === value ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-white'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-7 sm:py-8">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}

        {isLoading && !analytics ? (
          <div className="py-24 text-center text-sm text-zinc-500">Memuat ringkasan kunjungan...</div>
        ) : analytics ? (
          <>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-zinc-200 bg-white p-5">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-500">
                  <span>Total kunjungan</span><Eye className="h-4 w-4 text-red-600" />
                </div>
                <div className="mt-3 text-3xl font-black tabular-nums">{analytics.totalVisits.toLocaleString('id-ID')}</div>
                <div className="mt-1 text-[11px] text-zinc-500">Pengunjung unik per website pada periode terpilih</div>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white p-5">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-500">
                  <span>Website dipantau</span><Globe className="h-4 w-4 text-emerald-700" />
                </div>
                <div className="mt-3 text-3xl font-black tabular-nums">{analytics.siteCount.toLocaleString('id-ID')}</div>
                <div className="mt-1 text-[11px] text-zinc-500">Domain yang dipilih Super Admin</div>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-900 p-5 text-white sm:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
                  <span>Website teratas</span><Activity className="h-4 w-4 text-amber-400" />
                </div>
                <div className="mt-3 truncate text-xl font-black">{analytics.sites[0]?.host || '-'}</div>
                <div className="mt-1 text-[11px] text-zinc-400">{(analytics.sites[0]?.visits || 0).toLocaleString('id-ID')} kunjungan</div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-lg border border-zinc-200 bg-white p-5 sm:p-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-bold">Pergerakan kunjungan</h2>
                    <p className="mt-1 text-[11px] text-zinc-500">Jumlah kunjungan harian dari seluruh website terpilih</p>
                  </div>
                  <span className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700">{range === 'all' ? 'Semua data' : range === '7d' ? '7 hari terakhir' : '30 hari terakhir'}</span>
                </div>
                {visibleDays.length ? (
                  <div className="flex h-48 items-end gap-1 border-b border-zinc-200 pb-2 sm:gap-2">
                    {visibleDays.map((day) => (
                      <div key={day.date} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${day.date}: ${day.visits} kunjungan`}>
                        <span className="hidden text-[10px] font-semibold text-zinc-600 group-hover:block">{day.visits}</span>
                        <div className="w-full max-w-8 rounded-t-sm bg-red-600 transition-colors group-hover:bg-red-500" style={{ height: `${Math.max(3, (day.visits / maxDailyVisits) * 100)}%` }} />
                        <span className="w-full truncate text-center text-[9px] text-zinc-500">{day.label}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="py-16 text-center text-xs text-zinc-500">Belum ada data kunjungan pada periode ini.</p>}
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white p-5 sm:p-6">
                <div className="mb-4">
                  <h2 className="text-sm font-bold">Kunjungan per website</h2>
                  <p className="mt-1 text-[11px] text-zinc-500">Urutan berdasarkan total kunjungan</p>
                </div>
                <div className="divide-y divide-zinc-100">
                  {analytics.sites.map((site) => (
                    <div key={site.host} className="flex items-center justify-between gap-3 py-3">
                      <a href={`https://${site.host}`} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 text-xs font-semibold text-zinc-800 hover:text-red-700">
                        <Globe className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                        <span className="truncate">{site.host}</span><ArrowUpRight className="h-3 w-3 shrink-0" />
                      </a>
                      <span className="shrink-0 text-xs font-bold tabular-nums">{site.visits.toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-5 sm:p-6">
              <div className="mb-4">
                <h2 className="text-sm font-bold">Halaman paling banyak dikunjungi</h2>
                <p className="mt-1 text-[11px] text-zinc-500">Gabungan seluruh website pada periode terpilih</p>
              </div>
              {analytics.topPages.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-xs">
                    <thead className="border-b border-zinc-200 text-[10px] uppercase text-zinc-500">
                      <tr><th className="pb-2 font-semibold">Website / halaman</th><th className="pb-2 text-right font-semibold">Kunjungan</th></tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {analytics.topPages.map((page) => (
                        <tr key={page.page}><td className="py-3 text-zinc-700">{page.page}</td><td className="py-3 text-right font-bold tabular-nums">{page.visits.toLocaleString('id-ID')}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="py-6 text-xs text-zinc-500">Belum ada halaman yang tercatat.</p>}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}