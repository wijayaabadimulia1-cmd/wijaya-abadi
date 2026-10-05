import React, { useEffect, useState } from 'react';
import { Tag, Sparkles, ArrowRight, MessageSquare, CheckCircle, Gift, X } from 'lucide-react';
import { Promo, DealerSettings } from '../types';
import { DEFAULT_CATALOG_ANIMATION } from '../catalogAnimation';
import { MAX_PROMO_IMAGES } from '../constants';

interface PromoSectionProps {
  promos: Promo[];
  settings: DealerSettings;
}

export const PromoSection: React.FC<PromoSectionProps> = ({ promos, settings }) => {
  const [activeImage, setActiveImage] = useState<{ src: string; alt: string } | null>(null);
  const cleanPhone = settings.phone ? settings.phone.replace(/[^0-9]/g, '') : '6282129358899';

  useEffect(() => {
    if (!activeImage) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveImage(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [activeImage]);

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
            const promoImages = (promo.images || []).slice(0, MAX_PROMO_IMAGES);
            const promoTemplate = promo.promoTemplate || 'classic';
            const gridColumns = promoTemplate === 'compact' ? 'grid-cols-3' : 'grid-cols-2';
            const cardPadding = promoTemplate === 'showcase' ? 'p-5 sm:p-6' : promoTemplate === 'compact' ? 'p-4 sm:p-5' : 'p-6 sm:p-8';
            const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
              `Halo Honda Wijaya Abadi, saya ingin klaim penawaran "${promo.title} - ${promo.description}". Mohon informasi syarat dan ketentuannya.`
            )}`;

            return (
              <div
                key={promo.id || idx}
                data-promo-template={promoTemplate}
                className={`promo-card group relative bg-zinc-900/60 backdrop-blur-md border border-white/10 rounded-3xl ${cardPadding} flex flex-col justify-between hover:border-red-500/50 transition-all duration-300 shadow-xl overflow-hidden`}
              >
                {/* Background glow */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />

                <div>
                  {promoImages.length > 0 && (
                    <div className={`relative mb-5 grid ${gridColumns} gap-2`}>
                      {promoImages.map((image, imageIndex) => {
                        const featuredImage = promoTemplate === 'showcase' && imageIndex === 0;
                        const singleImage = promoImages.length === 1;
                        const imageLayout = featuredImage || singleImage
                          ? 'col-span-full aspect-[16/8]'
                          : promoTemplate === 'compact'
                            ? 'aspect-square'
                            : 'aspect-[4/3]';
                        return (
                          <button
                            key={`${image}-${imageIndex}`}
                            type="button"
                            onClick={() => setActiveImage({ src: image, alt: `${promo.title} - foto ${imageIndex + 1}` })}
                            aria-label={`Perbesar foto ${imageIndex + 1} untuk ${promo.title}`}
                            className={`${imageLayout} group/image overflow-hidden rounded-xl border border-white/10 bg-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500`}
                          >
                            <img
                              src={image}
                              alt={`${promo.title} - foto ${imageIndex + 1}`}
                              loading="lazy"
                              data-catalog-animation={promo.promoAnimation || DEFAULT_CATALOG_ANIMATION}
                              className="catalog-photo-animation h-full w-full object-cover transition-transform duration-300 group-hover/image:scale-105"
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}

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
                    <span>Klaim {promo.title} via WhatsApp</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {activeImage && (
        <div
          role="presentation"
          onClick={() => setActiveImage(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={activeImage.alt}
            onClick={(event) => event.stopPropagation()}
            className="relative flex max-h-[92vh] max-w-[96vw] items-center justify-center"
          >
            <button
              type="button"
              aria-label="Tutup gambar promo"
              onClick={() => setActiveImage(null)}
              className="absolute -right-2 -top-2 z-10 rounded-full border border-white/20 bg-zinc-900 p-2 text-white shadow-lg hover:bg-zinc-800"
            >
              <X className="h-5 w-5" />
            </button>
            <img src={activeImage.src} alt={activeImage.alt} className="max-h-[88vh] max-w-[94vw] rounded-lg object-contain" />
          </div>
        </div>
      )}
    </section>
  );
};
