import React, { useState, useEffect, Suspense, lazy } from 'react';
import { MessageSquare, Phone, Scale, Shield, Sparkles } from 'lucide-react';
import { Motor, Promo, Testimonial, DealerSettings, ManifestoItem, FIFPriceList } from './types';
import { api } from './services/api';
import { DEFAULT_FIF_PRICE_LIST, normalizeMotorOtrPrice } from './services/fifPriceList';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { CatalogSection } from './components/CatalogSection';
import { CreditSimulator } from './components/CreditSimulator';
import { CompareModal } from './components/CompareModal';
import { PromoSection } from './components/PromoSection';
import { ManifestoSection } from './components/ManifestoSection';
import { TestimonialsSection } from './components/TestimonialsSection';
import { FooterSection } from './components/FooterSection';
import { InterestModal } from './components/InterestModal';
import { DEFAULT_CATALOG_ANIMATION, DEFAULT_CATALOG_ANIMATION_SPEED } from './catalogAnimation';
import { DEFAULT_SEO_CANONICAL_URL, DEFAULT_SEO_DESCRIPTION, DEFAULT_SEO_KEYWORDS, DEFAULT_SEO_ROBOTS, DEFAULT_SEO_TITLE, HONDA_WIJAYA_COLOR_PALETTES } from './constants';

const AdminPanel = lazy(() => import('./components/AdminPanel').then(({ AdminPanel: panel }) => ({ default: panel })));

export default function App() {
  const isAdminRoute = window.location.pathname === '/admin' || window.location.pathname.endsWith('/admin');
  const websitePath = isAdminRoute ? window.location.pathname.slice(0, -'/admin'.length) || '/' : '/';
  const [settings, setSettings] = useState<DealerSettings>({
    id: 'hwa-settings-01',
    name: 'Honda Wijaya Abadi Mulia Motor',
    tagline: 'Partner Terpercaya Berkendara Anda',
    phone: '6282129358899',
    address: 'Jl. Gegerkalong Hilir No.68, Gegerkalong, Kec. Sukasari, Kota Bandung, Jawa Barat 40152',
    email: 'wijayaabadimulia1@gmail.com',
    workingHours: 'Senin - Sabtu: 08.00 - 17.00 WIB',
    logo: '/uploads/logo.jpeg',
    heroImage: '/uploads/hero.jpeg',
    heroTitle: 'Dealer Resmi Sepeda Motor Honda Bandung',
    heroMainTitle: 'Saatnya Punya',
    heroTitleHighlight: 'Motor Honda Impian Anda',
    heroSubtitle:
      'Proses mudah, cepat dan aman. Dapatkan motor Honda favorit Anda dengan harga terbaik, promo menarik, dan proses kredit tanpa ribet.',
    footerText:
      'Dealer resmi Honda terpercaya yang siap melayani kebutuhan kendaraan Anda dengan profesional, transparan, dan amanah.',
    seoTitle: DEFAULT_SEO_TITLE,
    seoDescription: DEFAULT_SEO_DESCRIPTION,
    seoKeywords: DEFAULT_SEO_KEYWORDS,
    seoCanonicalUrl: DEFAULT_SEO_CANONICAL_URL,
    seoRobots: DEFAULT_SEO_ROBOTS,
    websiteTemplate: 'honda-wijaya',
    catalogAnimation: DEFAULT_CATALOG_ANIMATION,
    catalogAnimationSpeed: DEFAULT_CATALOG_ANIMATION_SPEED,
    customization: {
      primaryColor: '#e60012',
      accentColor: '#ff2638',
      backgroundColor: '#f7f7f8',
      panelColor: '#ffffff',
      textColor: '#171717',
      mutedColor: '#52525b',
      font: 'jakarta',
      heroAlignment: 'left',
      cardRadius: 'round',
    },
  });

  const [motors, setMotors] = useState<Motor[]>([]);
  const [fifPriceList, setFifPriceList] = useState<FIFPriceList>(DEFAULT_FIF_PRICE_LIST);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [manifesto, setManifesto] = useState<ManifestoItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Compare list state
  const [compareList, setCompareList] = useState<Motor[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState<boolean>(false);

  // Interest Modal state
  const [isInterestOpen, setIsInterestOpen] = useState<boolean>(false);
  const [selectedMotorForInterest, setSelectedMotorForInterest] = useState<Motor | null>(null);
  const [dpSummary, setDpSummary] = useState<string>('');
  const [installmentSummary, setInstallmentSummary] = useState<string>('');

  // Simulator chosen motor state
  const [simulatorMotor, setSimulatorMotor] = useState<Motor | null>(null);

  // Admin CMS toggle state
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(isAdminRoute);
  const [colorMode, setColorMode] = useState<'light' | 'dark'>(() => {
    const savedMode = localStorage.getItem('hwa-color-mode');
    if (savedMode === 'light' || savedMode === 'dark') return savedMode;
    return 'light';
  });
  const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';

  // Fetch initial data from dynamic database
  const loadData = async () => {
    try {
      const [settingsData, motorsData, promosData, testiData, manifestoData, priceListData] = await Promise.all([
        api.getSettings().catch(() => null),
        api.getMotors().catch(() => []),
        api.getPromos().catch(() => []),
        api.getTestimonials().catch(() => []),
        api.getManifesto().catch(() => []),
        api.getFifPriceList().catch(() => DEFAULT_FIF_PRICE_LIST),
      ]);

      setFifPriceList(priceListData);
      if (settingsData && settingsData.name) {
        setSettings(settingsData);
      }
      if (motorsData && motorsData.length > 0) {
        setMotors(motorsData.map((motor) => normalizeMotorOtrPrice(motor, priceListData)));
      }
      if (promosData && promosData.length > 0) {
        setPromos(promosData);
      }
      if (testiData && testiData.length > 0) {
        setTestimonials(testiData.filter((item) => item.approved !== false));
      }
      if (manifestoData && manifestoData.length > 0) {
        setManifesto(manifestoData);
      }
    } catch (err) {
      console.error('Error fetching data from API:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminRoute) {
      void loadData();
      return;
    }

    let isCurrent = true;
    let idleCallbackId: number | undefined;
    let timeoutId: number | undefined;
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    const loadSecondaryData = async () => {
      try {
        const [motorsData, promosData, testiData, manifestoData, priceListData] = await Promise.all([
          api.getMotors().catch(() => []),
          api.getPromos().catch(() => []),
          api.getTestimonials().catch(() => []),
          api.getManifesto().catch(() => []),
          api.getFifPriceList().catch(() => DEFAULT_FIF_PRICE_LIST),
        ]);
        if (!isCurrent) return;

        setFifPriceList(priceListData);
        if (motorsData.length > 0) {
          setMotors(motorsData.map((motor) => normalizeMotorOtrPrice(motor, priceListData)));
        }
        if (promosData.length > 0) setPromos(promosData);
        if (testiData.length > 0) setTestimonials(testiData.filter((item) => item.approved !== false));
        if (manifestoData.length > 0) setManifesto(manifestoData);
      } catch (err) {
        console.error('Error fetching secondary data from API:', err);
      }
    };

    const loadInitialSettings = async () => {
      try {
        const settingsData = await api.getSettings().catch(() => null);
        if (isCurrent && settingsData?.name) setSettings(settingsData);
      } catch (err) {
        console.error('Error fetching initial settings from API:', err);
      } finally {
        if (isCurrent) setLoading(false);
      }

      if (!isCurrent) return;
      if (idleWindow.requestIdleCallback) {
        idleCallbackId = idleWindow.requestIdleCallback(() => void loadSecondaryData(), { timeout: 1500 });
      } else {
        timeoutId = window.setTimeout(() => void loadSecondaryData(), 800);
      }
    };

    void loadInitialSettings();
    return () => {
      isCurrent = false;
      if (idleCallbackId !== undefined) idleWindow.cancelIdleCallback?.(idleCallbackId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const handleAdminSettingsUpdate = (event: Event) => {
      const detail = (event as CustomEvent<DealerSettings>).detail;
      if (!detail) return;

      setSettings((currentSettings) => {
        const mergedCustomization = detail.customization && currentSettings.customization
          ? { ...currentSettings.customization, ...detail.customization }
          : detail.customization || currentSettings.customization;

        return {
          ...currentSettings,
          ...detail,
          customization: mergedCustomization,
        };
      });
    };

    window.addEventListener('hwa-admin-settings-update', handleAdminSettingsUpdate);
    return () => window.removeEventListener('hwa-admin-settings-update', handleAdminSettingsUpdate);
  }, []);

  useEffect(() => {
    if (isAdminRoute) return;

    const sessionKey = 'hwa-visitor-session';
    let sessionId = sessionStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `visit_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(sessionKey, sessionId);
    }

    const trackedKey = `hwa-visitor-tracked:${sessionId}`;
    if (sessionStorage.getItem(trackedKey)) return;
    sessionStorage.setItem(trackedKey, 'pending');
    void api.trackVisitor(sessionId, window.location.pathname)
      .then(() => sessionStorage.setItem(trackedKey, 'done'))
      .catch(() => sessionStorage.removeItem(trackedKey));
  }, [isAdminRoute]);

  useEffect(() => {
    localStorage.setItem('hwa-color-mode', colorMode);
    document.documentElement.dataset.colorMode = colorMode;
    document.documentElement.style.colorScheme = colorMode;
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColor) themeColor.content = colorMode === 'light' ? '#F7FAFF' : '#07111F';
  }, [colorMode]);

  useEffect(() => {
    if (isAdminOpen) return;

    const landingSeo = {
      '/dealer-honda-bandung': {
        title: 'Dealer Honda Bandung | Promo & Kredit Terbaik',
        description:
          'Temukan dealer Honda Bandung resmi dengan katalog terbaru, simulasi kredit, dan promo motor Honda paling menarik untuk kebutuhan harian maupun keluarga.',
        keywords:
          'dealer Honda Bandung, dealer motor Honda Bandung, dealer Honda resmi Bandung, kredit motor Honda Bandung',
      },
      '/kredit-motor-honda-bandung': {
        title: 'Kredit Motor Honda Bandung | DP Ringan & Tenor Fleksibel',
        description:
          'Cek simulasi kredit motor Honda Bandung dengan tenor fleksibel, DP ringan, dan estimasi angsuran yang sesuai kebutuhan Anda.',
        keywords:
          'kredit motor Honda Bandung, cicilan motor Honda, DP motor Honda, tenor motor Honda Bandung',
      },
      '/simulasi-kredit-honda': {
        title: 'Simulasi Kredit Honda | Hitung DP & Cicilan Anda',
        description:
          'Hitung simulasi kredit Honda dengan cepat. Cek estimasi DP, tenor, dan angsuran motor pilihan Anda sebelum datang ke dealer.',
        keywords:
          'simulasi kredit Honda, hitung cicilan motor Honda, kredit Honda Bandung, simulasi DP motor',
      },
      '/harga-motor-honda-bandung': {
        title: 'Harga Motor Honda Bandung | Promo & OTR Terbaru',
        description:
          'Lihat harga motor Honda Bandung terbaru untuk Beat, Scoopy, Vario, PCX, dan ADV. Cek promo, harga OTR, dan pilihan terbaik sesuai kebutuhan Anda.',
        keywords:
          'harga motor Honda Bandung, harga OTR Honda Bandung, promo motor Honda, daftar harga motor Honda',
      },
      '/honda-vario-bandung': {
        title: 'Honda Vario Bandung | Spesifikasi & Promo Terbaru',
        description:
          'Cek Honda Vario Bandung dengan spesifikasi, harga, dan simulasi kredit terbaru. Pilihan motor matik yang praktis dan stylish untuk aktivitas harian.',
        keywords:
          'Honda Vario Bandung, harga Honda Vario, kredit Honda Vario, spesifikasi Vario Bandung',
      },
      '/honda-beat-bandung': {
        title: 'Honda Beat Bandung | Harga & Simulasi Kredit',
        description:
          'Cari Honda Beat di Bandung? Lihat pilihan unit, cek harga terbaru, dan konsultasikan simulasi kredit dengan sales Honda Wijaya Abadi.',
        keywords: 'Honda Beat Bandung, harga Honda Beat, kredit Honda Beat Bandung, cicilan Honda Beat',
      },
      '/honda-scoopy-bandung': {
        title: 'Honda Scoopy Bandung | Harga & Simulasi Kredit',
        description:
          'Temukan Honda Scoopy di Bandung. Konsultasikan pilihan varian, harga terbaru, promo, dan simulasi kredit melalui WhatsApp.',
        keywords: 'Honda Scoopy Bandung, harga Honda Scoopy, kredit Honda Scoopy Bandung, cicilan Scoopy',
      },
      '/honda-pcx-bandung': {
        title: 'Honda PCX Bandung | Harga & Simulasi Kredit',
        description:
          'Lihat pilihan Honda PCX di Bandung dan konsultasikan harga, ketersediaan unit, promo, serta simulasi kredit terbaru.',
        keywords: 'Honda PCX Bandung, harga Honda PCX, kredit Honda PCX Bandung, cicilan Honda PCX',
      },
      '/honda-adv-bandung': {
        title: 'Honda ADV Bandung | Harga & Simulasi Kredit',
        description:
          'Cari Honda ADV di Bandung? Tanyakan ketersediaan unit, harga terbaru, promo, dan pilihan simulasi kredit kepada sales kami.',
        keywords: 'Honda ADV Bandung, harga Honda ADV, kredit Honda ADV Bandung, cicilan Honda ADV',
      },
    } as const;

    const activeLandingSeo = landingSeo[currentPath as keyof typeof landingSeo];
    const title = activeLandingSeo?.title || settings.seoTitle?.trim() || DEFAULT_SEO_TITLE;
    const description = activeLandingSeo?.description || settings.seoDescription?.trim() || DEFAULT_SEO_DESCRIPTION;
    const keywords = activeLandingSeo?.keywords || settings.seoKeywords?.trim() || DEFAULT_SEO_KEYWORDS;
    const canonicalUrl = activeLandingSeo
      ? `https://kreditmotorhonda.tech${currentPath}`
      : settings.seoCanonicalUrl?.trim() || DEFAULT_SEO_CANONICAL_URL;
    const robots = settings.seoRobots?.trim() || DEFAULT_SEO_ROBOTS;
    document.title = title;

    const setMeta = (attribute: 'name' | 'property', key: string, content: string) => {
      let meta = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, key);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    setMeta('name', 'description', description);
    setMeta('name', 'keywords', keywords);
    setMeta('name', 'robots', robots);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', canonicalUrl);
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;
  }, [isAdminOpen, settings.seoCanonicalUrl, settings.seoDescription, settings.seoKeywords, settings.seoRobots, settings.seoTitle, currentPath]);

  // Comparison toggle handler
  const handleToggleCompare = (motor: Motor) => {
    setCompareList((prev) => {
      const exists = prev.some((m) => m.id === motor.id);
      if (exists) {
        return prev.filter((m) => m.id !== motor.id);
      } else {
        if (prev.length >= 4) {
          alert('Maksimal membandingkan 4 motor sekaligus.');
          return prev;
        }
        return [...prev, motor];
      }
    });
  };

  const handleOpenSimulator = (motor?: Motor) => {
    if (motor) {
      setSimulatorMotor(motor);
    }
    const elem = document.getElementById('simulasi');
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOpenInterest = (motor?: Motor) => {
    setSelectedMotorForInterest(motor || motors[0] || null);
    setDpSummary('');
    setInstallmentSummary('');
    setIsInterestOpen(true);
  };

  const handleApplyFromSimulator = (
    motor: Motor,
    dpText: string,
    installmentText: string
  ) => {
    setSelectedMotorForInterest(motor);
    setDpSummary(dpText);
    setInstallmentSummary(installmentText);
    setIsInterestOpen(true);
  };

  const cleanPhone = settings.phone ? settings.phone.replace(/[^0-9]/g, '') : '6282129358899';
  const templateClass = `website-template-${settings.websiteTemplate || 'classic'}`;
  const customization = settings.customization || {};
  const templatePalette = settings.websiteTemplate === 'honda-wijaya'
    ? HONDA_WIJAYA_COLOR_PALETTES[colorMode]
    : {};
  const activePalette = { ...customization, ...templatePalette, ...customization.colorPalettes?.[colorMode] };
  const landingPages = {
    '/dealer-honda-bandung': {
      label: 'Dealer Honda Bandung',
      eyeBrow: 'Dealer Honda Bandung',
      headline: 'Dealer Honda Bandung Resmi',
      subHeadline:
        'Dapatkan motor Honda terbaru, promo menarik, dan konsultasi kredit yang transparan dari showroom yang sudah dipercaya di Bandung.',
      bullets: [
        'Stok motor Honda terbaru dan lengkap',
        'Promo kendaraan, DP ringan, dan tenor fleksibel',
        'Tim sales responsif untuk kebutuhan harian Anda',
      ],
      stats: [
        { value: '500+', label: 'Unit siap jual' },
        { value: '24/7', label: 'Konsultasi WhatsApp' },
        { value: '100%', label: 'Transparan' },
      ],
      faq: [
        'Apakah bisa konsultasi tanpa datang showroom?',
        'Bagaimana cara menghitung simulasi kredit?',
        'Apakah tersedia promo khusus untuk pembelian cash dan kredit?',
      ],
    },
    '/kredit-motor-honda-bandung': {
      label: 'Kredit Motor Honda Bandung',
      eyeBrow: 'Kredit Motor Honda',
      headline: 'Kredit Motor Honda Bandung',
      subHeadline:
        'Pilih motor impian Anda, sesuaikan tenor, dan dapatkan estimasi cicilan yang realistis untuk kebutuhan keluarga dan aktivitas harian.',
      bullets: [
        'Cicilan ringan sesuai budget Anda',
        'Pilihan tenor mulai dari 11 sampai 35 bulan',
        'Estimasi transparan tanpa biaya tersembunyi',
      ],
      stats: [
        { value: 'DP mulai', label: '10%' },
        { value: 'Tenor', label: '11–35 Bulan' },
        { value: 'Siap', label: 'Konsultasi' },
      ],
      faq: [
        'Bagaimana cara menghitung angsuran motor?',
        'Apakah ada biaya tambahan di luar DP dan angsuran?',
        'Bisakah saya memilih motor sesuai budget?',
      ],
    },
    '/simulasi-kredit-honda': {
      label: 'Simulasi Kredit Honda',
      eyeBrow: 'Simulasi Kredit',
      headline: 'Simulasi Kredit Motor Honda',
      subHeadline:
        'Gunakan kalkulator kredit untuk membandingkan angsuran pada beberapa tenor dan keputusan pembelian menjadi lebih cepat, tepat, dan aman.',
      bullets: [
        'Estimasi DP dan angsuran real-time',
        'Tersedia pilihan tenor sesuai budget',
        'Cocok untuk motor Beat, Scoopy, Vario, PCX, dan ADV',
      ],
      stats: [
        { value: '1 menit', label: 'Estimasi cepat' },
        { value: 'Multi', label: 'Pilihan tenor' },
        { value: '0 ribet', label: 'Tanpa daftar panjang' },
      ],
      faq: [
        'Apakah hasil simulasi ini final?',
        'Bisakah saya membandingkan beberapa motor?',
        'Apakah saya tetap bisa minta bantuan sales?',
      ],
    },
    '/harga-motor-honda-bandung': {
      label: 'Harga Motor Honda Bandung',
      eyeBrow: 'Harga Motor Honda',
      headline: 'Harga Motor Honda Bandung',
      subHeadline:
        'Bandingkan model motor Honda yang paling sesuai untuk kebutuhan sehari-hari, perjalanan jauh, hingga gaya hidup modern Anda.',
      bullets: [
        'Daftar harga terbaru dan akurat',
        'Pilihan model sesuai kebutuhan',
        'Cek promo sebelum keputusan pembelian',
      ],
      stats: [
        { value: 'Smart', label: 'Pilih model' },
        { value: 'Ter-update', label: 'Harga terbaru' },
        { value: 'Fleksibel', label: 'Pilihan kredit' },
      ],
      faq: [
        'Apakah harga sudah termasuk biaya administrasi?',
        'Apakah harga bisa berubah tergantung promo?',
        'Bagaimana jika saya ingin bandingkan model?',
      ],
    },
    '/honda-vario-bandung': {
      label: 'Honda Vario Bandung',
      eyeBrow: 'Honda Vario',
      headline: 'Honda Vario Bandung',
      subHeadline:
        'Nikmati teknologi canggih, fitur modern, dan proses kredit yang mudah untuk memulai pengalaman berkendara baru bersama Honda Vario.',
      bullets: [
        'Ramah untuk kebutuhan harian',
        'Desain sporty dan modern',
        'Tersedia simulasi kredit yang jelas',
      ],
      stats: [
        { value: 'Vario', label: 'Pilihan terbaik' },
        { value: 'Cocok', label: 'Harian' },
        { value: 'Promo', label: 'Terbaru' },
      ],
      faq: [
        'Jenis Vario apa yang paling cocok untuk harian?',
        'Apakah tersedia dp ringan untuk Vario?',
        'Bisakah saya mendapatkan bantuan kredit?',
      ],
    },
    '/honda-beat-bandung': {
      label: 'Honda Beat Bandung',
      eyeBrow: 'Honda Beat',
      headline: 'Honda Beat Bandung',
      subHeadline:
        'Konsultasikan varian, ketersediaan, harga terbaru, dan simulasi kredit Honda Beat langsung dengan tim sales.',
      bullets: ['Tanyakan ketersediaan varian', 'Minta rincian harga terbaru', 'Bandingkan pilihan kredit'],
      stats: [
        { value: 'Honda Beat', label: 'Pilihan motor matik' },
        { value: 'Harga', label: 'Konfirmasi terbaru' },
        { value: 'Kredit', label: 'Simulasi tersedia' },
      ],
      faq: [
        'Bagaimana cara mengetahui varian Honda Beat yang tersedia?',
        'Apakah harga Honda Beat bisa berbeda menurut tipe?',
        'Bagaimana cara meminta simulasi kredit Honda Beat?',
      ],
    },
    '/honda-scoopy-bandung': {
      label: 'Honda Scoopy Bandung',
      eyeBrow: 'Honda Scoopy',
      headline: 'Honda Scoopy Bandung',
      subHeadline:
        'Tanyakan pilihan warna dan varian, harga terbaru, ketersediaan unit, serta opsi kredit sebelum berkunjung ke dealer.',
      bullets: ['Konfirmasi varian dan warna', 'Tanyakan stok unit terbaru', 'Konsultasi harga dan kredit'],
      stats: [
        { value: 'Honda Scoopy', label: 'Pilihan bergaya' },
        { value: 'Unit', label: 'Cek ketersediaan' },
        { value: 'Kredit', label: 'Simulasi tersedia' },
      ],
      faq: [
        'Bagaimana mengecek warna Scoopy yang tersedia?',
        'Apakah harga Scoopy berbeda untuk setiap varian?',
        'Bisakah saya meminta simulasi kredit sebelum datang?',
      ],
    },
    '/honda-pcx-bandung': {
      label: 'Honda PCX Bandung',
      eyeBrow: 'Honda PCX',
      headline: 'Honda PCX Bandung',
      subHeadline:
        'Hubungi sales untuk memeriksa pilihan varian, harga terbaru, ketersediaan unit, dan simulasi pembiayaan Honda PCX.',
      bullets: ['Tanyakan pilihan varian', 'Konfirmasi harga dan ketersediaan', 'Bandingkan simulasi pembiayaan'],
      stats: [
        { value: 'Honda PCX', label: 'Pilihan skutik' },
        { value: 'Harga', label: 'Konfirmasi terbaru' },
        { value: 'Kredit', label: 'Simulasi tersedia' },
      ],
      faq: [
        'Varian Honda PCX apa yang tersedia?',
        'Bagaimana cara mengecek harga Honda PCX terbaru?',
        'Apakah tersedia simulasi kredit Honda PCX?',
      ],
    },
    '/honda-adv-bandung': {
      label: 'Honda ADV Bandung',
      eyeBrow: 'Honda ADV',
      headline: 'Honda ADV Bandung',
      subHeadline:
        'Tanyakan harga terbaru, ketersediaan Honda ADV, promo yang sedang berlaku, dan simulasi kredit yang sesuai rencana Anda.',
      bullets: ['Konfirmasi tipe dan stok', 'Tanyakan promo yang berlaku', 'Konsultasi simulasi kredit'],
      stats: [
        { value: 'Honda ADV', label: 'Pilihan skutik petualang' },
        { value: 'Unit', label: 'Cek ketersediaan' },
        { value: 'Kredit', label: 'Simulasi tersedia' },
      ],
      faq: [
        'Bagaimana cara mengecek ketersediaan Honda ADV?',
        'Apakah promo Honda ADV selalu sama?',
        'Bagaimana mendapatkan simulasi kredit Honda ADV?',
      ],
    },
  } as const;
  const activeLandingPage = landingPages[currentPath as keyof typeof landingPages];
  const customizationStyle = {
    '--custom-primary': activePalette.primaryColor || undefined,
    '--custom-secondary': activePalette.secondaryColor || undefined,
    '--custom-accent': activePalette.accentColor || undefined,
    '--custom-bg': activePalette.backgroundColor || undefined,
    '--custom-panel': activePalette.panelColor || undefined,
    '--custom-card': activePalette.cardColor || undefined,
    '--custom-elevated': activePalette.elevatedColor || undefined,
    '--custom-border': activePalette.borderColor || undefined,
    '--custom-text': activePalette.textColor || undefined,
    '--custom-muted': activePalette.mutedColor || undefined,
  } as React.CSSProperties;
  const customizationClass = `site-font-${activePalette.font || 'jakarta'} hero-align-${customization.heroAlignment || 'left'} card-radius-${customization.cardRadius || 'round'} site-mode-${colorMode}`;
  const gradientMotionClass = settings.websiteTemplate === 'mulia-cerah' && customization.themeBackgroundAnimation !== false
    ? 'mulia-gradient-motion'
    : '';
  const floatingWaUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    'Halo Sales Honda Wijaya Abadi, saya ingin bertanya tentang stok motor dan promo terbaru.'
  )}`;

  // If Admin panel is open, show full CMS interface
  if (isAdminOpen) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-zinc-950" aria-label="Memuat panel admin" />}>
        <AdminPanel
          onBackToWebsite={() => {
            window.history.pushState({}, '', websitePath);
            setIsAdminOpen(false);
          }}
          onRefreshData={loadData}
        />
      </Suspense>
    );
  }

  if (activeLandingPage) {
    return (
      <div style={customizationStyle} className={`website-shell ${templateClass} ${customizationClass} ${gradientMotionClass} min-h-screen bg-black text-zinc-100 flex flex-col font-sans selection:bg-red-600 selection:text-white`}>
        <Navbar
          settings={settings}
          compareList={compareList}
          onOpenCompare={() => setIsCompareOpen(true)}
          onOpenInterest={handleOpenInterest}
          colorMode={colorMode}
          onToggleColorMode={() => setColorMode((current) => current === 'dark' ? 'light' : 'dark')}
        />

        <main className="flex-1">
          <Hero
            settings={{ ...settings, customization: activePalette }}
            contentOverride={{
              badge: activeLandingPage.eyeBrow,
              headline: activeLandingPage.headline,
              subtitle: activeLandingPage.subHeadline,
            }}
            onOpenSimulator={() => handleOpenSimulator()}
            onOpenInterest={() => handleOpenInterest()}
          />

          <section className="px-4 pb-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8">
              <div className="grid gap-6 md:grid-cols-3">
                {activeLandingPage.bullets.map((item) => (
                  <div key={item} className="rounded-2xl border border-zinc-700 bg-zinc-950/50 p-5">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-500/15 text-lg text-red-300">✓</div>
                    <p className="text-base font-bold text-white">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <CatalogSection
            motors={motors}
            priceList={fifPriceList}
            animation={settings.catalogAnimation}
            animationSpeed={settings.catalogAnimationSpeed}
            compareList={compareList}
            onToggleCompare={handleToggleCompare}
            onOpenSimulator={handleOpenSimulator}
            onOpenInterest={handleOpenInterest}
          />

          <CreditSimulator
            motors={motors}
            priceList={fifPriceList}
            selectedMotor={simulatorMotor}
            settings={settings}
            onApplyCredit={handleApplyFromSimulator}
          />

          <PromoSection promos={promos} settings={settings} />
          <ManifestoSection items={manifesto} />
          <TestimonialsSection
            testimonials={testimonials}
            onAddTestimonial={async (data) => {
              const created = await api.createTestimonial(data);
              setTestimonials((previous) => [created, ...previous].filter((item) => item.approved !== false));
            }}
          />

          <section className="px-4 pb-20 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
              <div className="mb-8 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">FAQ</p>
                <h2 className="mt-3 text-3xl font-black text-white">Pertanyaan umum yang sering ditanyakan</h2>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {activeLandingPage.faq.map((item) => (
                  <div key={item} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 text-zinc-200">
                    <p className="font-semibold text-white">{item}</p>
                    <p className="mt-3 text-sm text-zinc-300">
                      Tim sales kami siap menjelaskan detailnya dengan jelas agar keputusan Anda lebih cepat dan aman.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>

        <FooterSection settings={settings} />

        <CompareModal
          isOpen={isCompareOpen}
          onClose={() => setIsCompareOpen(false)}
          compareList={compareList}
          onRemoveMotor={(id) => setCompareList((previous) => previous.filter((motor) => motor.id !== id))}
          onClearAll={() => setCompareList([])}
          onSelectMotor={(motor) => handleOpenInterest(motor)}
        />

        <InterestModal
          isOpen={isInterestOpen}
          onClose={() => setIsInterestOpen(false)}
          selectedMotor={selectedMotorForInterest}
          motors={motors}
          settings={settings}
          initialDpSummary={dpSummary}
          initialInstallmentSummary={installmentSummary}
        />

        <aside aria-label="Floating Actions" className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
          <a
            href={floatingWaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2.5 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-2xl shadow-emerald-950/60 transition-all hover:scale-105 active:scale-95"
            title="Chat WhatsApp Sales"
          >
            <MessageSquare className="w-5 h-5 fill-current" />
            <span className="text-xs font-bold hidden sm:inline">Hubungi Sales</span>
          </a>
        </aside>
      </div>
    );
  }

  return (
    <div style={customizationStyle} className={`website-shell ${templateClass} ${customizationClass} ${gradientMotionClass} min-h-screen bg-black text-zinc-100 flex flex-col font-sans selection:bg-red-600 selection:text-white`}>
      {/* Navbar */}
      <Navbar
        settings={settings}
        compareList={compareList}
        onOpenCompare={() => setIsCompareOpen(true)}
        onOpenInterest={handleOpenInterest}
        colorMode={colorMode}
        onToggleColorMode={() => setColorMode((current) => current === 'dark' ? 'light' : 'dark')}
      />

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section */}
        <Hero
          settings={{ ...settings, customization: activePalette }}
          onOpenSimulator={() => handleOpenSimulator()}
          onOpenInterest={() => handleOpenInterest()}
        />

        {settings.websiteTemplate === 'showroom' && (
          <section className="showroom-stats px-4 py-6 sm:py-8" aria-label="Keunggulan dealer">
            <div className="mx-auto grid max-w-7xl grid-cols-2 gap-y-5 sm:grid-cols-4">
              {[
                { value: '500+', label: 'Unit' },
                { value: '10+', label: 'Tahun' },
                { value: '100%', label: 'AHASS' },
                { value: '24/7', label: 'WhatsApp' },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black sm:text-3xl">{stat.value}</span>
                  <span className="mt-1 text-xs font-semibold uppercase">{stat.label}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Motorcycle Catalog */}
        <CatalogSection
          motors={motors}
          priceList={fifPriceList}
          animation={settings.catalogAnimation}
          animationSpeed={settings.catalogAnimationSpeed}
          compareList={compareList}
          onToggleCompare={handleToggleCompare}
          onOpenSimulator={handleOpenSimulator}
          onOpenInterest={handleOpenInterest}
        />

        {/* Interactive Credit Simulator */}
        <CreditSimulator
          motors={motors}
          priceList={fifPriceList}
          selectedMotor={simulatorMotor}
          settings={settings}
          onApplyCredit={handleApplyFromSimulator}
        />

        {/* Promo Campaigns */}
        <PromoSection promos={promos} settings={settings} />

        {/* 4 Pillars Manifesto / Nilai Kami */}
        <ManifestoSection items={manifesto} />

        {/* Testimonials */}
        <TestimonialsSection
          testimonials={testimonials}
          onAddTestimonial={async (data) => {
            const created = await api.createTestimonial(data);
            setTestimonials((prev) => [created, ...prev].filter((item) => item.approved !== false));
          }}
        />
      </main>

      {/* Footer & Contact */}
      <FooterSection settings={settings} />

      {/* Comparison Modal */}
      <CompareModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        compareList={compareList}
        onRemoveMotor={(id) => setCompareList((prev) => prev.filter((m) => m.id !== id))}
        onClearAll={() => setCompareList([])}
        onSelectMotor={(motor) => handleOpenInterest(motor)}
      />

      {/* Interest & Lead Form Modal */}
      <InterestModal
        isOpen={isInterestOpen}
        onClose={() => setIsInterestOpen(false)}
        selectedMotor={selectedMotorForInterest}
        motors={motors}
        settings={settings}
        initialDpSummary={dpSummary}
        initialInstallmentSummary={installmentSummary}
      />

      {/* Floating WhatsApp CTA on Mobile & Desktop */}
      <aside aria-label="Floating Actions" className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        {/* Floating compare notification if items selected */}
        {compareList.length > 0 && !isCompareOpen && (
          <button
            onClick={() => setIsCompareOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white rounded-full border border-red-500/50 shadow-2xl text-xs font-bold hover:bg-zinc-800 transition-all hover:scale-105"
          >
            <Scale className="w-4 h-4 text-red-400" />
            <span>Bandingkan ({compareList.length})</span>
          </button>
        )}

        <a
          href={floatingWaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-2.5 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-2xl shadow-emerald-950/60 transition-all hover:scale-105 active:scale-95"
          title="Chat WhatsApp Sales"
        >
          <MessageSquare className="w-5 h-5 fill-current" />
          <span className="text-xs font-bold hidden sm:inline">Hubungi Sales</span>
        </a>
      </aside>
    </div>
  );
}
