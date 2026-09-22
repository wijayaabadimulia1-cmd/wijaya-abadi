import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, CheckCircle2, MessageSquare, ArrowRight, Info, Percent } from 'lucide-react';
import { Motor, DealerSettings } from '../types';
import { formatRupiah } from '../services/api';

interface CreditSimulatorProps {
  motors: Motor[];
  selectedMotor?: Motor | null;
  settings: DealerSettings;
  onApplyCredit: (motor: Motor, dpSummary: string, installmentSummary: string) => void;
}

export const CreditSimulator: React.FC<CreditSimulatorProps> = ({
  motors,
  selectedMotor,
  settings,
  onApplyCredit,
}) => {
  const [currentMotorId, setCurrentMotorId] = useState<string>(
    selectedMotor ? selectedMotor.id : motors[0]?.id || ''
  );

  // Sync when selectedMotor changes from outside
  useEffect(() => {
    if (selectedMotor) {
      setCurrentMotorId(selectedMotor.id);
    } else if (motors.length > 0 && !currentMotorId) {
      setCurrentMotorId(motors[0].id);
    }
  }, [selectedMotor, motors]);

  const activeMotor = useMemo(() => {
    return motors.find((m) => m.id === currentMotorId) || motors[0];
  }, [motors, currentMotorId]);

  const motorPrice = useMemo(() => {
    if (!activeMotor) return 20000000;
    return activeMotor.numericPrice || Number(String(activeMotor.price).replace(/[^0-9]/g, '')) || 20000000;
  }, [activeMotor]);

  // DP percentage (default 20%)
  const [dpPercent, setDpPercent] = useState<number>(20);
  // Tenor in months: 11, 23, 29, 35 (standard Indonesian motorcycle leasing options: FIF, Adira, OTO)
  const [tenorMonths, setTenorMonths] = useState<number>(35);
  // Flat annual interest rate estimate (typical 8.5% - 11%)
  const [annualRate, setAnnualRate] = useState<number>(9.5);

  // Computed values
  const dpAmount = Math.round((motorPrice * dpPercent) / 100);
  const loanPrincipal = Math.max(0, motorPrice - dpAmount);
  const years = tenorMonths / 12;
  const totalInterest = loanPrincipal * (annualRate / 100) * years;
  const totalLoanRepay = loanPrincipal + totalInterest;
  const monthlyInstallment = Math.round(totalLoanRepay / tenorMonths);
  const totalCustomerSpend = dpAmount + totalLoanRepay;

  const handleApply = () => {
    if (!activeMotor) return;
    const dpSummary = `${formatRupiah(dpAmount)} (${dpPercent}%)`;
    const installmentSummary = `${formatRupiah(monthlyInstallment)} / bln (${tenorMonths} bulan)`;
    onApplyCredit(activeMotor, dpSummary, installmentSummary);
  };

  return (
    <section id="simulasi" className="simulator-section py-24 bg-black relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 w-96 h-96 bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/4 right-0 w-80 h-80 bg-orange-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider">
            <Calculator className="w-3.5 h-3.5" />
            <span>Kalkulator Transparan</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Simulasi Kredit Motor Honda
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base">
            Hitung perkiraan uang muka (DP) dan angsuran bulanan yang sesuai dengan anggaran Anda.
          </p>
        </div>

        {/* Simulator Container */}
        <div className="simulator-container mt-12 bg-zinc-900/60 backdrop-blur-md border border-white/10 rounded-3xl p-6 sm:p-10 shadow-2xl max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
            
            {/* Left Column: Form Controls */}
            <div className="lg:col-span-7 space-y-6">
              {/* Select Motor */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
                  Pilih Unit Motor Honda
                </label>
                <select
                  value={currentMotorId}
                  onChange={(e) => setCurrentMotorId(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/15 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500 font-medium"
                >
                  {motors.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — ({formatRupiah(m.price)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Price Indicator */}
              <div className="simulator-price flex items-center justify-between p-3.5 bg-zinc-950/80 rounded-xl border border-white/5">
                <span className="text-xs text-zinc-400 font-medium">Harga OTR Bandung</span>
                <span className="text-base font-bold text-white">{formatRupiah(motorPrice)}</span>
              </div>

              {/* Down Payment (DP) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    Uang Muka (DP)
                  </label>
                  <span className="text-sm font-bold text-red-400">
                    {formatRupiah(dpAmount)} ({dpPercent}%)
                  </span>
                </div>

                {/* Range Slider */}
                <input
                  type="range"
                  min="10"
                  max="60"
                  step="5"
                  value={dpPercent}
                  onChange={(e) => setDpPercent(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600"
                />

                {/* Quick DP Preset Buttons */}
                <div className="grid grid-cols-5 gap-2 mt-3">
                  {[10, 15, 20, 30, 40].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDpPercent(pct)}
                      className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                        dpPercent === pct
                          ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-900/40'
                          : 'bg-zinc-950 text-zinc-400 border-white/10 hover:text-white hover:border-white/20'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Tenor (Bulan) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    Tenor (Jangka Waktu)
                  </label>
                  <span className="text-sm font-bold text-zinc-200">{tenorMonths} Bulan</span>
                </div>

                <div className="grid grid-cols-4 gap-2.5">
                  {[11, 23, 29, 35].map((months) => (
                    <button
                      key={months}
                      type="button"
                      onClick={() => setTenorMonths(months)}
                      className={`py-3 px-2 rounded-xl text-center border transition-all ${
                        tenorMonths === months
                          ? 'bg-red-600 text-white border-red-500 font-bold shadow-lg shadow-red-900/30'
                          : 'bg-zinc-950 text-zinc-300 border-white/10 hover:border-white/20 font-medium'
                      }`}
                    >
                      <div className="text-sm">{months} bln</div>
                      <div className="text-[10px] opacity-75 font-normal">
                        {months >= 35 ? '3 Tahun' : months >= 23 ? '2 Tahun' : '1 Tahun'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Legal disclaimer */}
              <div className="simulator-disclaimer flex items-start gap-2 text-[11px] text-zinc-500 bg-zinc-950/40 p-3 rounded-xl border border-white/5">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-zinc-400" />
                <span>
                  Simulasi ini bersifat estimasi. Bunga dan cicilan resmi disesuaikan dengan ketentuan leasing rekanan (FIFGROUP, OTO, ADIRA Finance, dll) saat verifikasi berkas.
                </span>
              </div>
            </div>

            {/* Right Column: Calculation Result Card */}
            <div className="simulator-result lg:col-span-5 flex flex-col justify-between bg-gradient-to-b from-zinc-950 to-zinc-900/90 rounded-2xl p-6 sm:p-7 border border-red-500/20 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-2xl pointer-events-none" />

              <div>
                <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
                  Hasil Perhitungan Cicilan
                </span>
                
                {/* Active Motor Preview */}
                {activeMotor && (
                  <div className="mt-4 flex items-center gap-3 pb-4 border-b border-white/10">
                    <div className="w-14 h-14 bg-zinc-900 rounded-xl p-1 flex items-center justify-center border border-white/10 shrink-0">
                      <img
                        src={activeMotor.image}
                        alt={activeMotor.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{activeMotor.name}</h4>
                      <p className="text-xs text-zinc-400">{activeMotor.category}</p>
                    </div>
                  </div>
                )}

                {/* Big Monthly Estimate */}
                <div className="my-6">
                  <span className="text-xs text-zinc-400 block font-medium">Estimasi Cicilan per Bulan</span>
                  <div className="text-3xl sm:text-4xl font-black text-white mt-1 tracking-tight">
                    {formatRupiah(monthlyInstallment)}
                    <span className="text-xs sm:text-sm font-normal text-zinc-400 ml-1">/bulan</span>
                  </div>
                </div>

                {/* Breakdown details */}
                <div className="space-y-3 pt-4 border-t border-white/10 text-xs">
                  <div className="flex justify-between text-zinc-400">
                    <span>Uang Muka (DP {dpPercent}%)</span>
                    <span className="text-zinc-200 font-semibold">{formatRupiah(dpAmount)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Total Pinjaman Pokok</span>
                    <span className="text-zinc-200 font-semibold">{formatRupiah(loanPrincipal)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Tenor Cicilan</span>
                    <span className="text-zinc-200 font-semibold">{tenorMonths} Bulan</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Total Bayar (setelah DP)</span>
                    <span className="text-zinc-200 font-semibold">{formatRupiah(totalCustomerSpend)}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-8 pt-4">
                <button
                  onClick={handleApply}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-red-900/40 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Lanjut Ambil Motor Ini</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>

          </div>
        </div>
      </div>
    </section>
  );
};
