import React, { useEffect, useState } from 'react';
import { ArrowRight, ShieldCheck, Wrench, Clock, CheckCircle2, ChevronLeft, ChevronRight, MessageSquare, Calculator, Tag } from 'lucide-react';
import { MAX_HERO_IMAGES } from '../constants';
import { DealerSettings } from '../types';
import { DEFAULT_CATALOG_ANIMATION, DEFAULT_CATALOG_ANIMATION_SPEED, normalizeCatalogAnimationSpeed } from '../catalogAnimation';
import { getHeroFontStack, loadHeroFont } from '../heroFonts';
import { responsiveUploadImageSrcSet, responsiveUploadImageUrl } from '../utils/images';

interface HeroProps {
  settings: DealerSettings;
  onOpenSimulator: () => void;
  onOpenInterest: () => void;
  contentOverride?: {
    badge: string;
    headline: React.ReactNode;
    subtitle: string;
  };
}

export const Hero: React.FC<HeroProps> = ({ settings, onOpenSimulator, onOpenInterest, contentOverride }) => {
  const uploadedImages = settings.heroImages ?? (settings.heroImage ? [settings.heroImage] : []);
  const heroImages = uploadedImages.filter((image): image is string => typeof image === 'string' && image.trim().length > 0).slice(0, MAX_HERO_IMAGES);
  const imageSignature = heroImages.join('|');
  const animation = settings.heroAnimation || DEFAULT_CATALOG_ANIMATION;
  const animationSpeed = normalizeCatalogAnimationSpeed(settings.heroAnimationSpeed ?? DEFAULT_CATALOG_ANIMATION_SPEED);
  const [activeSlide, setActiveSlide] = useState(0);
  const cleanPhone = settings.phone ? settings.phone.replace(/[^0-9]/g, '') : '6282129358899';
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    'Halo Honda Wijaya Abadi, saya tertarik untuk mengetahui promo dan simulasi kredit motor Honda terbaru.'
  )}`;

  useEffect(() => {
    setActiveSlide(0);
  }, [imageSignature]);

  useEffect(() => {
    if (
      heroImages.length < 2
      || window.matchMedia('(max-width: 1023px)').matches
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) return;
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroImages.length);
    }, animationSpeed * 1000);
    return () => window.clearInterval(timer);
  }, [heroImages.length, animationSpeed]);

  const heroFont = settings.customization?.heroTextFont || settings.customization?.font;
  const fontFamily = getHeroFontStack(heroFont);

  useEffect(() => {
    loadHeroFont(heroFont);
  }, [heroFont]);

  return (
    <section
      id="home"
      className="relative min-h-[85vh] flex items-center justify-center overflow-hidden bg-black py-16 sm:py-24"
      style={{
        fontFamily,
        '--hero-text-color': settings.customization?.heroTextColor || '#f4f4f5',
        '--hero-highlight-color': settings.customization?.heroTitleHighlightColor || settings.customization?.accentColor || '#f97316',
        '--hero-badge-font-size': `${settings.customization?.heroBadgeFontSize || 12}px`,
        '--hero-title-font-size': `${settings.customization?.heroTitleFontSize || 58}px`,
        '--hero-highlight-font-size': `${settings.customization?.heroHighlightFontSize ?? 42}px`,
        '--hero-headline-gap': `${settings.customization?.heroHeadlineGap ?? 4}px`,
        '--hero-subtitle-font-size': `${settings.customization?.heroSubtitleFontSize || 18}px`,
        '--hero-caption-font-size': `${settings.customization?.heroCaptionFontSize || 12}px`,
      } as React.CSSProperties}
    >
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
            <div className="hero-badge inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/80 border border-red-500/30 text-xs font-semibold text-zinc-300 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="w-2 h-2 rounded-full bg-red-500 -ml-3" />
              <span className="hero-editable-text hero-badge-text">{contentOverride?.badge || settings.heroTitle || 'Dealer resmi Sepeda Motor Honda Bandung'}</span>
            </div>

            {/* Main Headline */}
            <h1 className="hero-editable-text hero-main-title font-black tracking-tight leading-[1.15]">
              {contentOverride?.headline ?? (
                <>
                  {settings.heroMainTitle || 'Satu Klik dapat'}
                  <br />
                  <span className="hero-highlight-text block">
                    {settings.heroTitleHighlight || 'sepeda motor impian'}
                  </span>
                </>
              )}
            </h1>

            {/* Subtitle */}
            <p className="hero-editable-text hero-subtitle text-zinc-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
              {contentOverride?.subtitle || settings.heroSubtitle ||
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
            <div className="pt-6 border-t border-white/10 grid grid-cols-2 lg:grid-cols-4 gap-4 text-left">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-white text-xs font-bold">100% Unit AHM</p>
                  <p className="text-zinc-400 text-[11px]">Garansi Rangka 5 Th</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-white text-xs font-bold">Bengkel AHASS</p>
                  <p className="text-zinc-400 text-[11px]">Teknisi Bersertifikat</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-white text-xs font-bold">Simulasi Kredit</p>
                  <p className="text-zinc-400 text-[11px]">Pilih DP dan tenor</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-white text-xs font-bold">Harga & Promo</p>
                  <p className="text-zinc-400 text-[11px]">Konfirmasi program berlaku</p>
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
                  {heroImages.length > 0 ? (
                    <img
                      key={`${activeSlide}-${heroImages[activeSlide] || heroImages[0]}`}
                      src={responsiveUploadImageUrl(heroImages[activeSlide] || heroImages[0], 960)}
                      srcSet={responsiveUploadImageSrcSet(heroImages[activeSlide] || heroImages[0], [480, 640, 960, 1280])}
                      sizes="(max-width: 1023px) calc(100vw - 32px), 42vw"
                      alt={settings.heroCaption || `Banner Honda Wijaya Abadi ${activeSlide + 1}`}
                      width={960}
                      height={720}
                      decoding="async"
                      loading="eager"
                      className="hero-slide-image absolute inset-0 h-full w-full object-cover"
                      data-hero-animation={animation}
                      style={{ animationDuration: `${Math.min(1500, animationSpeed * 100)}ms` }}
                      onError={(event) => {
                        const image = event.currentTarget;
                        if (image.src.includes('/media/')) {
                          image.removeAttribute('srcset');
                          image.src = heroImages[activeSlide] || heroImages[0];
                          return;
                        }
                        image.style.visibility = 'hidden';
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-zinc-900" aria-label="Belum ada foto banner" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                  {heroImages.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveSlide((current) => (current - 1 + heroImages.length) % heroImages.length)}
                        aria-label="Foto hero sebelumnya"
                        className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 p-2 text-white hover:bg-black/80"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSlide((current) => (current + 1) % heroImages.length)}
                        aria-label="Foto hero berikutnya"
                        className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 p-2 text-white hover:bg-black/80"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <div className="absolute bottom-14 left-0 right-0 z-10 flex justify-center gap-1">
                        {heroImages.map((image, index) => (
                          <button
                            key={`${image}-${index}`}
                            type="button"
                            onClick={() => setActiveSlide(index)}
                            aria-label={`Tampilkan foto hero ${index + 1}`}
                            aria-current={index === activeSlide}
                            className="flex h-8 w-8 items-center justify-center rounded-full"
                          >
                            <span className={`h-2 w-5 rounded-full bg-white ${index === activeSlide ? 'scale-x-100' : 'scale-x-50 opacity-60'} transition-transform`} />
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  
                  {/* Floating Promo Tag */}
                  <div className="absolute top-4 left-4 bg-gradient-to-r from-red-600 to-red-800 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5 border border-red-400/40">
                    <span className="text-yellow-300">★</span>
                    <span>{settings.heroBadge || 'Showroom Resmi Bandung'}</span>
                  </div>

                  {/* Bottom Image Caption */}
                  <div className="absolute bottom-4 left-4 right-4 text-left">
                    <span className="hero-editable-text hero-caption-text font-semibold tracking-wider uppercase">
                      {settings.heroCaption || 'One Heart. Satu Hati.'}
                    </span>
                    <p className="text-white text-base font-bold">
                      {settings.name || 'Honda Wijaya Abadi Mulia Motor'}
                    </p>
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
