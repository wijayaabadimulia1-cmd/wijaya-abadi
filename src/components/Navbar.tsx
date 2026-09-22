import React, { useState } from 'react';
import { Phone, MessageSquare, Scale, Menu, X, Shield, Lock, Bike, Sparkles } from 'lucide-react';
import { DealerSettings, Motor } from '../types';

interface NavbarProps {
  settings: DealerSettings;
  compareList: Motor[];
  onOpenCompare: () => void;
  isAdmin: boolean;
  onToggleAdmin: () => void;
  onOpenInterest: (motor?: Motor) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  settings,
  compareList,
  onOpenCompare,
  isAdmin,
  onToggleAdmin,
  onOpenInterest,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const cleanPhone = settings.phone ? settings.phone.replace(/[^0-9]/g, '') : '6282129358899';
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    'Halo Honda Wijaya Abadi, saya ingin konsultasi mengenai pembelian motor Honda terbaru.'
  )}`;

  const navLinks = [
    { label: 'Beranda', href: '#home' },
    { label: 'Katalog Motor', href: '#katalog' },
    { label: 'Promo', href: '#promo' },
    { label: 'Simulasi Kredit', href: '#simulasi' },
    { label: 'Nilai Kami', href: '#manifesto' },
    { label: 'Testimoni', href: '#testimoni' },
    { label: 'Kontak', href: '#kontak' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-white/10 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo Brand */}
          <a href="#home" className="flex items-center space-x-3 group">
            <div className="w-11 h-11 bg-gradient-to-br from-red-600 to-red-800 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-red-900/30 group-hover:scale-105 transition-transform overflow-hidden border border-red-500/30">
              {settings.logo ? (
                <img
                  src={settings.logo}
                  alt={settings.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to Honda Wing icon
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <Bike className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <div className="text-white font-extrabold text-base sm:text-lg tracking-wide flex items-center gap-1.5">
                <span>{settings.name || 'Honda Wijaya Abadi'}</span>
                <span className="bg-red-600/30 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-red-500/40">
                  RESMI
                </span>
              </div>
              <p className="text-zinc-400 text-xs truncate max-w-[200px] sm:max-w-xs font-normal">
                {settings.tagline || 'Partner Terpercaya Berkendara Anda'}
              </p>
            </div>
          </a>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center space-x-6 text-sm font-medium">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-zinc-300 hover:text-red-400 transition-colors py-1 relative hover:after:w-full after:w-0 after:h-0.5 after:bg-red-600 after:absolute after:bottom-0 after:left-0 after:transition-all"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden sm:flex items-center space-x-3">
            {/* Compare Drawer Trigger */}
            {compareList.length > 0 && (
              <button
                onClick={onOpenCompare}
                className="relative flex items-center gap-2 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl border border-red-500/40 text-xs font-semibold shadow-md transition-all animate-pulse"
                title="Bandingkan Motor"
              >
                <Scale className="w-4 h-4 text-red-400" />
                <span>Bandingkan</span>
                <span className="w-5 h-5 bg-red-600 text-white text-[11px] font-bold rounded-full flex items-center justify-center">
                  {compareList.length}
                </span>
              </button>
            )}

            {/* WhatsApp Direct */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-xs font-semibold rounded-xl transition-colors"
            >
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span>WhatsApp Sales</span>
            </a>

            {/* Admin CMS Toggle */}
            <button
              onClick={onToggleAdmin}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-all ${
                isAdmin
                  ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/30'
                  : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-white/10 hover:border-red-500/30'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isAdmin ? 'Tutup CMS' : 'Admin CMS'}</span>
            </button>
          </div>

          {/* Mobile menu trigger */}
          <div className="flex items-center space-x-2 lg:hidden">
            {compareList.length > 0 && (
              <button
                onClick={onOpenCompare}
                className="p-2 bg-zinc-900 border border-red-500/50 rounded-lg text-red-400 relative"
              >
                <Scale className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                  {compareList.length}
                </span>
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-zinc-300 hover:text-white bg-zinc-900 border border-white/10 rounded-lg"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-zinc-800 bg-zinc-950/95 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col space-y-2">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg text-sm text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>

            <div className="pt-3 border-t border-zinc-800 flex flex-col gap-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold shadow-md"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Hubungi Sales via WhatsApp</span>
              </a>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onToggleAdmin();
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 text-zinc-300 hover:text-white border border-white/10 rounded-xl text-sm font-semibold"
              >
                <Lock className="w-4 h-4" />
                <span>{isAdmin ? 'Tutup Panel CMS' : 'Buka Admin CMS'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
