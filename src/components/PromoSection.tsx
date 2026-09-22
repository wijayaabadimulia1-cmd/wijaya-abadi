import React from 'react';
import { Tag, Sparkles, ArrowRight, MessageSquare, CheckCircle, Gift } from 'lucide-react';
import { Promo, DealerSettings } from '../types';

interface PromoSectionProps {
  promos: Promo[];
  settings: DealerSettings;
}

export const PromoSection: React.FC<PromoSectionProps> = ({ promos, settings }) => {
  const cleanPhone = settings.phone ? settings.phone.replace(/[^0-9]/g, '') : '6282129358899';

  return (
    <section id="promo" className="py-24 bg-zinc-950 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider">
            <Gift className="w-3.5 h-3.5" />
            <span>Penawaran Terbatas</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Promo Spesial Honda Bulan Ini
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base">
            Nikmati kemudahan memiliki sepeda motor Honda dengan berbagai keuntungan eksklusif dari Honda Wijaya Abadi.
          </p>
        </div>

        {/* Promo Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {promos.map((promo, idx) => {
            const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
              `Halo Honda Wijaya Abadi, saya ingin klaim penawaran "${promo.title} - ${promo.description}". Mohon informasi syarat dan ketentuannya.`
            )}`;

            return (
              <div
                key={promo.id || idx}
                className="promo-card group relative bg-zinc-900/60 backdrop-blur-md border border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col justify-between hover:border-red-500/50 transition-all duration-300 shadow-xl overflow-hidden"
              >
                {/* Background glow */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />

                <div>
                  {/* Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-3 py-1 rounded-full bg-red-600/20 text-red-400 text-xs font-bold border border-red-500/30">
                      {promo.badge || 'Promo Eksklusif'}
                    </span>
                    {promo.discountValue && (
                      <span className="text-xs font-extrabold text-yellow-400 bg-yellow-400/10 px-2.5 py-0.5 rounded-md border border-yellow-400/20">
                        {promo.discountValue}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="promo-title text-2xl font-black text-white group-hover:text-red-400 transition-colors">
                    {promo.title}
                  </h3>

                  {/* Description */}
                  <p className="promo-description mt-3 text-sm text-zinc-300 leading-relaxed">
                    {promo.description}
                  </p>

                  {/* Terms */}
                  <div className="promo-terms mt-6 pt-4 border-t border-white/10 flex items-center gap-2 text-xs text-zinc-400">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{promo.terms || 'Syarat & Ketentuan Berlaku'}</span>
                  </div>
                </div>

                {/* WhatsApp Action */}
                <div className="mt-8">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="promo-action w-full py-3 px-4 bg-zinc-800 hover:bg-red-600 text-white font-bold text-xs rounded-xl border border-white/10 hover:border-red-500 transition-all flex items-center justify-center gap-2 shadow-md"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Klaim Promo via WhatsApp</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
