import React from 'react';
import { ArrowRight, ShieldCheck, Wrench, Clock, CheckCircle2, ChevronRight, MessageSquare, Calculator } from 'lucide-react';
import { DealerSettings } from '../types';

interface HeroProps {
  settings: DealerSettings;
  onOpenSimulator: () => void;
  onOpenInterest: () => void;
}

export const Hero: React.FC<HeroProps> = ({ settings, onOpenSimulator, onOpenInterest }) => {
  const cleanPhone = settings.phone ? settings.phone.replace(/[^0-9]/g, '') : '6282129358899';
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    'Halo Honda Wijaya Abadi, saya tertarik untuk mengetahui promo dan simulasi kredit motor Honda terbaru.'
  )}`;

  return (
    <section id="home" className="relative min-h-[85vh] flex items-center justify-center overflow-hidden bg-black py-16 sm:py-24">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] bg-red-900/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Headlines & Call-to-actions */}
          <div className="lg:col-span-7 text-center lg:text-left space-y-6">
            {/* Dealer Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/80 border border-red-500/30 text-xs font-semibold text-zinc-300 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="w-2 h-2 rounded-full bg-red-500 -ml-3" />
              <span>{settings.heroTitle || 'Dealer resmi Sepeda Motor Honda Bandung'}</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.15]">
              Partner Terpercaya{' '}
              <span className="bg-gradient-to-r from-red-500 via-red-600 to-orange-500 bg-clip-text text-transparent">
                Berkendara Anda
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-zinc-300 text-base sm:text-lg max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
              {settings.heroSubtitle ||
                'Dapatkan motor Honda impian Anda dengan harga terbaik dan proses yang mudah. Layanan penjualan unit baru, simulasi kredit terjangkau, dan servis resmi AHASS.'}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4 pt-2">
              <a
                href="#katalog"
                className="px-6 py-3.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-900/40 hover:shadow-red-600/30 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Lihat Katalog Motor</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              <button
                onClick={onOpenSimulator}
                className="px-5 py-3.5 bg-zinc-900/90 hover:bg-zinc-800 text-white border border-white/15 hover:border-red-500/50 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all"
              >
                <Calculator className="w-4 h-4 text-red-400" />
                <span>Simulasi Kredit</span>
              </button>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-3.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all"
              >
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span>Chat WhatsApp</span>
              </a>
            </div>

            {/* Trust Badges Bar */}
            <div className="pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 gap-4 text-left">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-white text-xs font-bold">100% Unit AHM</h4>
                  <p className="text-zinc-400 text-[11px]">Garansi Rangka 5 Th</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-white text-xs font-bold">Bengkel AHASS</h4>
                  <p className="text-zinc-400 text-[11px]">Teknisi Bersertifikat</p>
                </div>
              </div>

              <div className="flex items-center gap-3 col-span-2 sm:col-span-1">
                <div className="w-9 h-9 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-white text-xs font-bold">Kredit Instan</h4>
                  <p className="text-zinc-400 text-[11px]">Approval 1 Hari</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Visual Card */}
          <div className="lg:col-span-5 relative">
            <div className="relative group">
              {/* Outer Glow */}
              <div className="absolute inset-0 bg-gradient-to-tr from-red-600/30 to-orange-500/10 rounded-3xl blur-2xl group-hover:opacity-100 opacity-70 transition-all duration-700" />

              <div className="relative bg-zinc-900/60 backdrop-blur-md border border-white/10 rounded-3xl p-4 sm:p-6 overflow-hidden shadow-2xl">
                {/* Image showcase */}
                <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-zinc-950 flex items-center justify-center border border-white/5">
                  <img
                    src={settings.heroImage || '/uploads/hero.jpeg'}
                    alt="Honda Wijaya Abadi Showroom"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    onError={(e) => {
                      // Fallback image if error
                      e.currentTarget.src =
                        'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?crop=entropy&cs=srgb&fm=jpg&w=900&q=80';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  
                  {/* Floating Promo Tag */}
                  <div className="absolute top-4 left-4 bg-gradient-to-r from-red-600 to-red-800 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5 border border-red-400/40">
                    <span className="text-yellow-300">★</span>
                    <span>Showroom Resmi Bandung</span>
                  </div>

                  {/* Bottom Image Caption */}
                  <div className="absolute bottom-4 left-4 right-4 text-left">
                    <span className="text-xs text-red-400 font-semibold tracking-wider uppercase">
                      One Heart. Satu Hati.
                    </span>
                    <h3 className="text-white text-base font-bold">
                      {settings.name || 'Honda Wijaya Abadi Mulia Motor'}
                    </h3>
                  </div>
                </div>

                {/* Sub-card quick info */}
                <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-zinc-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Unit Ready Stock & Siap Kirim</span>
                  </div>
                  <span className="text-zinc-300 font-medium">Bandung & Sekitarnya</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
