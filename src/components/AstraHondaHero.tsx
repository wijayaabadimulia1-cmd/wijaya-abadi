import React, { useEffect, useState } from 'react';
import { ArrowRight, BadgeCheck, Bike, Calculator, Clock3, Phone, ShieldCheck, Truck } from 'lucide-react';
import type { DealerSettings, FIFPriceList, Motor, Promo } from '../types';
import { getMotorOtrPrice } from '../services/fifPriceList';
import { formatRupiah } from '../services/api';
import { DEFAULT_FEATURED_MOTOR_ROTATION_INTERVAL, normalizeFeaturedMotorRotationInterval } from '../constants';

interface AstraHondaHeroProps {
  settings: DealerSettings;
  motors: Motor[];
  promos: Promo[];
  priceList: FIFPriceList;
  contentOverride?: { badge?: string; headline?: string; subtitle?: string };
  onOpenSimulator: () => void;
  onOpenInterest: (motor?: Motor) => void;
}

export function AstraHondaTopBar({ settings }: Pick<AstraHondaHeroProps, 'settings'>) {
  const phoneDigits = String(settings.phone || '').replace(/\D/g, '');
  const phoneHref = phoneDigits
    ? `tel:${phoneDigits.startsWith('0') ? `+62${phoneDigits.slice(1)}` : `+${phoneDigits}`}`
    : undefined;

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

  useEffect(() => {
    setFeaturedMotorIndex(0);
    if (rotatingMotors.length < 2) return;

    const timerId = window.setInterval(() => {
      setFeaturedMotorIndex((current) => (current + 1) % rotatingMotors.length);
    }, rotationInterval * 1000);

    return () => window.clearInterval(timerId);
  }, [rotatingMotors.length, rotationInterval]);

  return (
    <section id="home" className="astra-honda-hero">
      <div className="astra-honda-hero__inner">
        <div className="astra-honda-hero__copy">
          <span className="astra-honda-hero__badge">
            <BadgeCheck aria-hidden="true" /> {contentOverride?.badge || settings.heroBadge || 'Dealer Resmi Astra Honda Motor'}
          </span>
          <h1>
            {contentOverride?.headline || 'Kredit Motor Honda'}
            <span>{contentOverride?.headline ? 'Harga & Promo Honda' : 'DP Murah & Berkas Dibantu'}</span>
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