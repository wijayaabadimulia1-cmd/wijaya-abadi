import React, { useEffect, useState } from 'react';
import { ArrowRight, BadgeCheck, Bike, Calculator, ChevronLeft, ChevronRight, Clock3, Instagram, MapPin, MessageSquare, Music2, Phone, Search, ShieldCheck, Tag, Truck, Youtube } from 'lucide-react';
import type { DealerSettings, FIFPriceList, Motor, Promo } from '../types';
import { getMotorOtrPrice } from '../services/fifPriceList';
import { formatRupiah } from '../services/api';
import { DEFAULT_FEATURED_MOTOR_ROTATION_INTERVAL, normalizeFeaturedMotorRotationInterval } from '../constants';
import { createWhatsAppUrl } from '../utils/whatsapp';

interface AstraHondaHeroProps {
  settings: DealerSettings;
  motors: Motor[];
  promos: Promo[];
  priceList: FIFPriceList;
  contentOverride?: { badge?: string; headline?: string; highlight?: string; subtitle?: string };
  onOpenSimulator: () => void;
  onOpenInterest: (motor?: Motor) => void;
}

export function AstraHondaTopBar({ settings }: Pick<AstraHondaHeroProps, 'settings'>) {
  const phoneDigits = String(settings.phone || '').replace(/\D/g, '');
  const phoneHref = phoneDigits
    ? `tel:${phoneDigits.startsWith('0') ? `+62${phoneDigits.slice(1)}` : `+${phoneDigits}`}`
    : undefined;

  if (settings.websiteTemplate === 'wijaya-enerjik') {
    return (
      <div className="astra-honda-topbar astra-honda-topbar--enerjik">
        <div className="astra-honda-topbar__inner">
          <span className="astra-honda-topbar__item astra-honda-topbar__location">
            <MapPin aria-hidden="true" />
            <span>{settings.address || 'Bandung'}</span>
          </span>
          {phoneHref && (
            <a href={phoneHref} className="astra-honda-topbar__item">
              <Phone aria-hidden="true" />
              <span>{settings.phone}</span>
            </a>
          )}
          <span className="astra-honda-topbar__item astra-honda-topbar__hours">
            <Clock3 aria-hidden="true" />
            <span>{settings.workingHours || 'Layanan konsultasi motor Honda'}</span>
          </span>
          <div className="astra-honda-topbar__socials" aria-label="Media sosial">
            <Youtube aria-hidden="true" />
            <Instagram aria-hidden="true" />
            <Music2 aria-hidden="true" />
            <a href="#katalog" aria-label="Cari motor"><Search aria-hidden="true" /></a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="astra-honda-topbar">
      <div className="astra-honda-topbar__inner">
        {phoneHref ? (
          <a href={phoneHref} className="astra-honda-topbar__item">
            <Phone aria-hidden="true" />
            <span>Hotline Sales: <strong>{settings.phone}</strong></span>
          </a>
        ) : (
          <span className="astra-honda-topbar__item">
            <BadgeCheck aria-hidden="true" />
            <span>{settings.name}</span>
          </span>
        )}
        <span className="astra-honda-topbar__item astra-honda-topbar__hours">
          <Clock3 aria-hidden="true" />
          <span>{settings.workingHours || 'Layanan konsultasi motor Honda'}</span>
        </span>
        <span className="astra-honda-topbar__official">
          <ShieldCheck aria-hidden="true" /> Dealer Resmi Honda
        </span>
      </div>
    </div>
  );
}

export function AstraHondaHero({
  settings,
  motors,
  promos,
  priceList,
  contentOverride,
  onOpenSimulator,
  onOpenInterest,
}: AstraHondaHeroProps) {
  const bestsellerMotors = motors.filter((motor) => motor.is_bestseller);
  const rotatingMotors = bestsellerMotors.length > 0 ? bestsellerMotors : motors.slice(0, 1);
  const [featuredMotorIndex, setFeaturedMotorIndex] = useState(0);
  const rotationInterval = normalizeFeaturedMotorRotationInterval(
    settings.featuredMotorRotationInterval ?? DEFAULT_FEATURED_MOTOR_ROTATION_INTERVAL,
  );
  const featuredMotor = rotatingMotors.length > 0
    ? rotatingMotors[featuredMotorIndex % rotatingMotors.length]
    : undefined;
  const featuredPromo = promos[0];
  const motorImage = featuredMotor?.images?.[0] || featuredMotor?.image || settings.heroImage;
  const motorPrice = featuredMotor ? getMotorOtrPrice(featuredMotor, priceList) : 0;
  const isWijayaEnerjik = settings.websiteTemplate === 'wijaya-enerjik';
  const heroSlides = (settings.heroImages?.length ? settings.heroImages : [settings.heroImage])
    .filter((image): image is string => Boolean(image));
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);

  useEffect(() => {
    setFeaturedMotorIndex(0);
    if (rotatingMotors.length < 2) return;

    const timerId = window.setInterval(() => {
      setFeaturedMotorIndex((current) => (current + 1) % rotatingMotors.length);
    }, rotationInterval * 1000);

    return () => window.clearInterval(timerId);
  }, [rotatingMotors.length, rotationInterval]);

  useEffect(() => {
    setActiveHeroSlide(0);
  }, [heroSlides.join('|')]);

  useEffect(() => {
    if (!isWijayaEnerjik || heroSlides.length < 2) return;
    const timerId = window.setInterval(() => {
      setActiveHeroSlide((current) => (current + 1) % heroSlides.length);
    }, 5500);
    return () => window.clearInterval(timerId);
  }, [heroSlides.length, isWijayaEnerjik]);

  const contactUrl = createWhatsAppUrl(settings.phone, 'Halo Honda Wijaya Abadi, saya ingin konsultasi motor Honda.');

  if (isWijayaEnerjik) {
    return (
      <section id="home" className="wijaya-enerjik-hero">
        <div className="wijaya-enerjik-hero__image" aria-hidden="true">
          {heroSlides.map((image, index) => (
            <img key={image} src={image} alt="" className={index === activeHeroSlide ? 'is-active' : ''} />
          ))}
        </div>
        <div className="wijaya-enerjik-hero__shade" aria-hidden="true" />
        <div className="wijaya-enerjik-hero__inner">
          <div className="wijaya-enerjik-hero__copy">
            <span className="wijaya-enerjik-hero__eyebrow">{contentOverride?.badge || 'HONDA MOTORCYCLE'}</span>
            <h1>
              {contentOverride?.headline || 'Satu Klik Dapat'}
              <span>{contentOverride?.highlight || 'Sepeda Motor Impian'}</span>
            </h1>
            <p>{contentOverride?.subtitle || 'Bersama Honda Wijaya Abadi, wujudkan impian Anda memiliki motor Honda dengan mudah dan cepat.'}</p>
            <div className="wijaya-enerjik-hero__actions">
              <a href={contactUrl} target="_blank" rel="noopener noreferrer" className="wijaya-enerjik-action-primary">
                <MessageSquare aria-hidden="true" /> Konsultasi Sekarang <ArrowRight aria-hidden="true" />
              </a>
              <a href="#promo" className="wijaya-enerjik-action-secondary">Lihat Promo <ArrowRight aria-hidden="true" /></a>
            </div>
          </div>
          {heroSlides.length > 1 && (
            <div className="wijaya-enerjik-hero__controls" aria-label="Kontrol foto hero">
              <button type="button" aria-label="Foto sebelumnya" onClick={() => setActiveHeroSlide((current) => (current - 1 + heroSlides.length) % heroSlides.length)}>
                <ChevronLeft aria-hidden="true" />
              </button>
              <div className="wijaya-enerjik-hero__dots">
                {heroSlides.map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    aria-label={`Tampilkan foto ${index + 1}`}
                    aria-current={index === activeHeroSlide ? 'true' : undefined}
                    onClick={() => setActiveHeroSlide(index)}
                  />
                ))}
              </div>
              <button type="button" aria-label="Foto berikutnya" onClick={() => setActiveHeroSlide((current) => (current + 1) % heroSlides.length)}>
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
        <div className="wijaya-enerjik-benefits" aria-label="Keunggulan dealer">
          <div><ShieldCheck aria-hidden="true" /><span><strong>Dealer Resmi</strong><small>Honda</small></span></div>
          <div><Tag aria-hidden="true" /><span><strong>Harga Terbaik</strong><small>& Promo Menarik</small></span></div>
          <div><Calculator aria-hidden="true" /><span><strong>Proses Kredit</strong><small>Mudah & Cepat</small></span></div>
          <div><Truck aria-hidden="true" /><span><strong>Layanan Purna Jual</strong><small>Bergaransi</small></span></div>
        </div>
      </section>
    );
  }

  return (
    <section id="home" className="astra-honda-hero">
      <div className="astra-honda-hero__inner">
        <div className="astra-honda-hero__copy">
          <span className="astra-honda-hero__badge">
            <BadgeCheck aria-hidden="true" /> {contentOverride?.badge || settings.heroBadge || 'Dealer Resmi Astra Honda Motor'}
          </span>
          <h1>
            {contentOverride?.headline || 'Kredit Motor Honda'}
            <span>{contentOverride?.highlight || (contentOverride?.headline ? 'Harga & Promo Honda' : 'DP Murah & Berkas Dibantu')}</span>
          </h1>
          <p className="astra-honda-hero__description">
            {contentOverride?.subtitle || 'Temukan motor Honda pilihan dengan informasi harga dan simulasi kredit yang terhubung ke katalog dealer. Tim kami siap membantu proses pengajuan Anda.'}
          </p>

          <div className="astra-honda-benefits">
            <div>
              <span className="astra-honda-benefits__icon"><ShieldCheck aria-hidden="true" /></span>
              <span><strong>Unit Honda Resmi</strong><small>Informasi dari katalog dealer</small></span>
            </div>
            <div>
              <span className="astra-honda-benefits__icon"><Calculator aria-hidden="true" /></span>
              <span><strong>Simulasi Kredit</strong><small>Sesuaikan DP dan tenor</small></span>
            </div>
            <div>
              <span className="astra-honda-benefits__icon"><Truck aria-hidden="true" /></span>
              <span><strong>Dibantu Tim Sales</strong><small>Konsultasi langsung dengan dealer</small></span>
            </div>
          </div>

          <div className="astra-honda-hero__actions">
            <button type="button" className="astra-honda-button astra-honda-button--primary" onClick={onOpenSimulator}>
              <Calculator aria-hidden="true" /> Simulasi Angsuran
            </button>
            <a className="astra-honda-button astra-honda-button--outline" href="#katalog">
              <Bike aria-hidden="true" /> Lihat Katalog
            </a>
          </div>
        </div>

        <aside key={featuredMotor?.id || 'empty'} className="astra-honda-featured" aria-label="Motor bestseller pilihan dealer">
          <span className="astra-honda-featured__ribbon">{featuredPromo?.badge || 'Pilihan Motor Honda'}</span>
          {motorImage ? (
            <div className="astra-honda-featured__image-wrap">
              <img src={motorImage} alt={featuredMotor?.name || 'Motor Honda pilihan'} fetchPriority="high" decoding="async" />
            </div>
          ) : (
            <div className="astra-honda-featured__image-wrap astra-honda-featured__empty">
              <Bike aria-hidden="true" />
              <span>Motor pilihan dealer</span>
            </div>
          )}
          <div className="astra-honda-featured__details">
            <span className="astra-honda-featured__eyebrow">{featuredMotor?.category || 'Katalog Motor Honda'}</span>
            <h2>{featuredMotor?.name || 'Pilih Motor Honda Impian Anda'}</h2>
            <p>{featuredMotor?.description || 'Jelajahi katalog untuk melihat motor Honda yang tersedia.'}</p>
            {motorPrice > 0 && (
              <div className="astra-honda-featured__price">
                <span>Harga OTR</span>
                <strong>{formatRupiah(motorPrice)}</strong>
              </div>
            )}
            <button type="button" className="astra-honda-button astra-honda-button--primary astra-honda-featured__cta" onClick={() => onOpenInterest(featuredMotor)} disabled={!featuredMotor}>
              Ajukan motor ini <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}