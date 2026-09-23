import React, { useState, useEffect } from 'react';
import { MessageSquare, Phone, Scale, Shield, Sparkles } from 'lucide-react';
import { Motor, Promo, Testimonial, DealerSettings, ManifestoItem } from './types';
import { api } from './services/api';
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
import { AdminPanel } from './components/AdminPanel';

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
    heroTitle: 'Dealer resmi Sepeda Motor Honda Bandung',
    heroSubtitle:
      'Partner Terpercaya Berkendara Anda. Dapatkan motor Honda impian Anda dengan harga terbaik, promo menarik, dan proses kredit cepat tanpa ribet.',
    footerText:
      'Dealer resmi Honda terpercaya yang siap melayani kebutuhan kendaraan Anda dengan profesional, transparan, dan amanah.',
    websiteTemplate: 'classic',
    customization: {
      primaryColor: '#dc2626',
      accentColor: '#f97316',
      backgroundColor: '#000000',
      panelColor: '#111827',
      textColor: '#f4f4f5',
      mutedColor: '#a1a1aa',
      font: 'jakarta',
      heroAlignment: 'left',
      cardRadius: 'round',
    },
  });

  const [motors, setMotors] = useState<Motor[]>([]);
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
    return localStorage.getItem('hwa-color-mode') === 'light' ? 'light' : 'dark';
  });

  // Fetch initial data from dynamic database
  const loadData = async () => {
    try {
      const [settingsData, motorsData, promosData, testiData, manifestoData] = await Promise.all([
        api.getSettings().catch(() => null),
        api.getMotors().catch(() => []),
        api.getPromos().catch(() => []),
        api.getTestimonials().catch(() => []),
        api.getManifesto().catch(() => []),
      ]);

      if (settingsData && settingsData.name) {
        setSettings(settingsData);
      }
      if (motorsData && motorsData.length > 0) {
        setMotors(motorsData);
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
    loadData();
  }, []);

  useEffect(() => {
    localStorage.setItem('hwa-color-mode', colorMode);
  }, [colorMode]);

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
  const customizationStyle = {
    '--custom-primary': customization.primaryColor || undefined,
    '--custom-accent': customization.accentColor || undefined,
    '--custom-bg': customization.backgroundColor || undefined,
    '--custom-panel': customization.panelColor || undefined,
    '--custom-text': customization.textColor || undefined,
    '--custom-muted': customization.mutedColor || undefined,
  } as React.CSSProperties;
  const customizationClass = `site-font-${customization.font || 'jakarta'} hero-align-${customization.heroAlignment || 'left'} card-radius-${customization.cardRadius || 'round'} site-mode-${colorMode}`;
  const floatingWaUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    'Halo Sales Honda Wijaya Abadi, saya ingin bertanya tentang stok motor dan promo terbaru.'
  )}`;

  // If Admin panel is open, show full CMS interface
  if (isAdminOpen) {
    return (
      <AdminPanel
        onBackToWebsite={() => {
          window.history.pushState({}, '', websitePath);
          setIsAdminOpen(false);
        }}
        onRefreshData={loadData}
      />
    );
  }

  return (
    <div style={customizationStyle} className={`website-shell ${templateClass} ${customizationClass} min-h-screen bg-black text-zinc-100 flex flex-col font-sans selection:bg-red-600 selection:text-white`}>
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
          settings={settings}
          onOpenSimulator={() => handleOpenSimulator()}
          onOpenInterest={() => handleOpenInterest()}
        />

        {/* Motorcycle Catalog */}
        <CatalogSection
          motors={motors}
          compareList={compareList}
          onToggleCompare={handleToggleCompare}
          onOpenSimulator={handleOpenSimulator}
          onOpenInterest={handleOpenInterest}
        />

        {/* Interactive Credit Simulator */}
        <CreditSimulator
          motors={motors}
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
