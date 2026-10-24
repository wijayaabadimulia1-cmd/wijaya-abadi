import React, { useEffect, useState } from 'react';
import { Tag, Sparkles, ArrowRight, MessageSquare, CheckCircle, Gift, X } from 'lucide-react';
import { Promo, DealerSettings } from '../types';
import { DEFAULT_CATALOG_ANIMATION } from '../catalogAnimation';
import { MAX_PROMO_IMAGES } from '../constants';

interface PromoImageCarouselProps {
  images: string[];
  title: string;
  animation?: Promo['promoAnimation'];
  isPaused: boolean;
  onOpen: (src: string, alt: string) => void;
}

function PromoImageCarousel({ images, title, animation, isPaused, onOpen }: PromoImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (images.length < 2 || isPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length);
    }, 4800);
    return () => window.clearInterval(timer);
  }, [images.length, isPaused]);

  useEffect(() => {
    setActiveIndex(0);
  }, [images.length]);

  const activeImage = images[activeIndex] || images[0];
  if (!activeImage) return null;

  return (
    <div className="promo-image-carousel">
      <button
        type="button"
        className="promo-image-carousel__image"
        onClick={() => onOpen(activeImage, `${title} - foto ${activeIndex + 1}`)}
        aria-label={`Perbesar foto ${activeIndex + 1} untuk ${title}`}
      >
        <img
          key={activeImage}
          src={activeImage}
          alt={`${title} - foto ${activeIndex + 1}`}
          loading="lazy"
          data-catalog-animation={animation || DEFAULT_CATALOG_ANIMATION}
        />
      </button>
      {images.length > 1 && (
        <div className="promo-image-carousel__dots" aria-label={`Foto promo ${title}`}>
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Tampilkan foto ${index + 1}`}
              aria-current={index === activeIndex}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface PromoSectionProps {
  promos: Promo[];
  settings: DealerSettings;
  showMore?: boolean;
}

export const PromoSection: React.FC<PromoSectionProps> = ({ promos, settings, showMore = false }) => {
  const [activeImage, setActiveImage] = useState<{ src: string; alt: string } | null>(null);
  const cleanPhone = settings.phone ? settings.phone.replace(/[^0-9]/g, '') : '6282129358899';
  const isShowcaseHomepage = settings.websiteTemplate === 'showcase-wijaya-2' && window.location.pathname === '/';
  const isShowcaseHome = settings.websiteTemplate === 'showcase-wijaya-2' && window.location.pathname !== '/promo';
  const visiblePromos = isShowcaseHome ? promos.slice(0, 3) : promos;
  const shouldShowMore = showMore || (isShowcaseHome && promos.length > 3);

  useEffect(() => {
    if (!activeImage) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveImage(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [activeImage]);

  return (
    <>
      {isShowcaseHomepage && promos.length > 0 && (
        <section className="showcase-promo-preview" aria-label="Promo pilihan">
          <div className="showcase-promo-preview__inner">
            <div className="showcase-promo-preview__heading">
              <span>Promo Pilihan</span>
              <a href="/promo">Semua Promo <ArrowRight aria-hidden="true" /></a>
            </div>
            <div className="showcase-promo-preview__grid">
              {promos.slice(0, 3).map((promo, index) => {
                const image = promo.images?.[0];
                return (
                  <a className="showcase-promo-preview__card" href="/promo" key={promo.id || index}>
                    <span className="showcase-promo-preview__copy">
                      <span className="showcase-promo-preview__badge">{promo.badge || 'PROMO'}</span>
                      <strong>{promo.title}</strong>
                      {promo.discountValue && <small>{promo.discountValue}</small>}
                    </span>
                    <span className="showcase-promo-preview__image">
                      {image && <img src={image} alt="" loading="lazy" />}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section id="promo" className={`py-24 bg-zinc-950 relative${isShowcaseHomepage ? ' showcase-promo-intro' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider">
              <Gift className="w-3.5 h-3.5" />
              <span>Penawaran Terbatas</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Promo Honda Bandung & Kredit Motor Honda Terbaik
            </h2>
            <p className="text-zinc-400 text-sm sm:text-base">
              Nikmati promo Honda Bandung, cicilan motor Honda Bandung, dan simulasi kredit fleksibel dari dealer Honda Bandung resmi di Gegerkalong. Dapatkan harga motor Honda terbaik, DP ringan, serta tenor sesuai kebutuhan keluarga Anda.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {visiblePromos.map((promo, idx) => {
              const promoImages = (promo.images || []).slice(0, MAX_PROMO_IMAGES);
              const promoTemplate = promo.promoTemplate || 'classic';
              const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                `Halo Honda Wijaya Abadi, saya ingin klaim penawaran "${promo.title} - ${promo.description}". Mohon informasi syarat dan ketentuannya.`
              )}`;

              return (
                <article
                  key={promo.id || idx}
                  data-promo-template={promoTemplate}
                  className="promo-card group relative bg-zinc-900/60 backdrop-blur-md border border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col justify-between hover:border-red-500/50 transition-all duration-300 shadow-xl overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />

                  <div className="promo-copy">
                    <div className="flex items-center justify-between gap-2">
                      <span className="promo-badge px-3 py-1 rounded-full bg-red-600/20 text-red-400 text-xs font-bold border border-red-500/30">
                        {promo.badge || 'Promo Eksklusif'}
                      </span>
                      {promo.discountValue && (
                        <span className="promo-discount text-xs font-extrabold text-yellow-400 bg-yellow-400/10 px-2.5 py-0.5 rounded-md border border-yellow-400/20">
                          {promo.discountValue}
                        </span>
                      )}
                    </div>
                    <h3 className="promo-title mt-3 text-2xl font-black text-white group-hover:text-red-400 transition-colors">
                      {promo.title}
                    </h3>
                    {promo.description && <p className="promo-description mt-2 text-sm text-zinc-300 leading-relaxed">{promo.description}</p>}
                    <div className="promo-terms mt-3 flex items-center gap-2 text-xs text-zinc-400">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{promo.terms || 'Syarat & Ketentuan Berlaku'}</span>
                    </div>
                    <div className="promo-meta mt-3 text-[10px] uppercase tracking-[0.12em] text-red-300/80 font-semibold">
                      Promo Honda Bandung • Kredit Motor Honda
                    </div>
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="promo-action mt-4 inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-red-950/20 transition-colors hover:bg-red-700"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Klaim {promo.title}</span>
                    </a>
                  </div>

                  {promoImages.length > 0 && (
                    <PromoImageCarousel
                      images={promoImages}
                      title={promo.title}
                      animation={promo.promoAnimation}
                      isPaused={Boolean(activeImage)}
                      onOpen={(src, alt) => setActiveImage({ src, alt })}
                    />
                  )}
                </article>
              );
            })}
          </div>

          {shouldShowMore && (
            <div className="mt-6 flex justify-center">
              <a
                href="/promo"
                className="inline-flex items-center gap-2 rounded-full border border-red-600 px-5 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-600 hover:text-white"
              >
                Lihat promo lainnya <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          )}
        </div>

        {activeImage && (
          <div role="presentation" onClick={() => setActiveImage(null)} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
            <div role="dialog" aria-modal="true" aria-label={activeImage.alt} onClick={(event) => event.stopPropagation()} className="relative flex max-h-[92vh] max-w-[96vw] items-center justify-center">
              <button type="button" aria-label="Tutup gambar promo" onClick={() => setActiveImage(null)} className="absolute -right-2 -top-2 z-10 rounded-full border border-white/20 bg-zinc-900 p-2 text-white shadow-lg hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
              <img src={activeImage.src} alt={activeImage.alt} className="max-h-[88vh] max-w-[94vw] rounded-lg object-contain" />
            </div>
          </div>
        )}
      </section>
    </>
  );
};
