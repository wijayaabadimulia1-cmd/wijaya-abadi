import React from 'react';
import { MapPin, Phone, Mail, Clock, MessageSquare, Shield, Bike, ArrowUp } from 'lucide-react';
import { DealerSettings } from '../types';

interface FooterSectionProps {
  settings: DealerSettings;
  onOpenAdmin: () => void;
}

export const FooterSection: React.FC<FooterSectionProps> = ({ settings, onOpenAdmin }) => {
  const cleanPhone = settings.phone ? settings.phone.replace(/[^0-9]/g, '') : '6282129358899';
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    'Halo Honda Wijaya Abadi, saya ingin konsultasi motor Honda.'
  )}`;

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer id="kontak" className="bg-black border-t border-white/10 pt-20 pb-12 relative text-zinc-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Contact & Map Card */}
        <div className="bg-zinc-900/60 border border-white/10 rounded-3xl p-6 sm:p-10 mb-16 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Dealer Info Left */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase">
                <MapPin className="w-3.5 h-3.5" />
                <span>Kunjungi Dealer Kami</span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-black text-white">
                {settings.name || 'Honda Wijaya Abadi Mulia Motor'}
              </h3>

              <p className="text-sm text-zinc-300">
                Dealer resmi sepeda motor Honda di Kota Bandung dengan fasilitas showroom lengkap, bengkel resmi AHASS, penjualan suku cadang orisinil Honda Genuine Parts, dan layanan sales profesional.
              </p>

              <div className="space-y-3.5 text-xs sm:text-sm">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <span className="text-zinc-200">
                    {settings.address || 'Jl. Gegerkalong Hilir No.68, Gegerkalong, Kec. Sukasari, Kota Bandung, Jawa Barat 40152'}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-red-500 shrink-0" />
                  <span className="text-zinc-200">{settings.phone || '+62 821-2935-8899'}</span>
                </div>

                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-red-500 shrink-0" />
                  <span className="text-zinc-200">{settings.email || 'wijayaabadimulia1@gmail.com'}</span>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-red-500 shrink-0" />
                  <span className="text-zinc-200">{settings.workingHours || 'Senin - Sabtu: 08.00 - 17.00 WIB'}</span>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-3">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Chat Sales via WhatsApp</span>
                </a>
                <a
                  href={`tel:${settings.phone || '082129358899'}`}
                  className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs rounded-xl border border-white/10 transition-colors flex items-center gap-2"
                >
                  <Phone className="w-4 h-4 text-red-400" />
                  <span>Telepon Showroom</span>
                </a>
              </div>
            </div>

            {/* Google Maps Embed Right */}
            <div className="lg:col-span-6 h-72 sm:h-80 rounded-2xl overflow-hidden border border-white/10 shadow-lg relative bg-zinc-950">
              <iframe
                title="Lokasi Honda Wijaya Abadi Mulia Motor"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3961.164321689104!2d107.58552687587637!3d-6.870908867228833!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e68e69007f59d51%3A0xe2be5ba106bb403c!2sJl.%20Gegerkalong%20Hilir%20No.68%2C%20Gegerkalong%2C%20Kec.%20Sukasari%2C%20Kota%20Bandung%2C%20Jawa%20Barat%2040152!5e0!3m2!1sid!2sid!4v1710000000000!5m2!1sid!2sid"
                className="w-full h-full border-0 filter grayscale contrast-125 opacity-90 hover:grayscale-0 transition-all duration-500"
                allowFullScreen={false}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

          </div>
        </div>

        {/* Footer Bottom Links & Info */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-12 border-b border-white/10 text-xs">
          
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold">
                <Bike className="w-4 h-4" />
              </div>
              <span className="text-white font-bold text-base">
                {settings.name || 'Honda Wijaya Abadi Mulia Motor'}
              </span>
            </div>
            <p className="text-zinc-400 max-w-md leading-relaxed">
              {settings.footerText ||
                'Dealer resmi Honda terpercaya yang siap melayani kebutuhan kendaraan Anda dengan profesional dan amanah.'}
            </p>
          </div>

          <div>
            <h4 className="text-white font-bold uppercase tracking-wider mb-3">Tautan Cepat</h4>
            <ul className="space-y-2">
              <li><a href="#home" className="hover:text-red-400 transition-colors">Beranda</a></li>
              <li><a href="#katalog" className="hover:text-red-400 transition-colors">Katalog Motor Honda</a></li>
              <li><a href="#promo" className="hover:text-red-400 transition-colors">Promo & Cashback</a></li>
              <li><a href="#simulasi" className="hover:text-red-400 transition-colors">Simulasi Kredit</a></li>
              <li><a href="#manifesto" className="hover:text-red-400 transition-colors">Nilai & Pelayanan</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold uppercase tracking-wider mb-3">Administrasi</h4>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={onOpenAdmin}
                  className="text-red-400 hover:text-red-300 font-semibold flex items-center gap-1.5"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin CMS Panel</span>
                </button>
              </li>
              <li><span className="text-zinc-500">Authorized Honda Dealer #HWA-BDO</span></li>
              <li><span className="text-zinc-500">PT Astra Honda Motor Partner</span></li>
            </ul>
          </div>

        </div>

        {/* Copyright */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-4">
          <p>© {new Date().getFullYear()} Honda Wijaya Abadi Mulia Motor. Hak Cipta Dilindungi.</p>
          <button
            onClick={scrollToTop}
            className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
          >
            <span>Kembali ke Atas</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </footer>
  );
};
