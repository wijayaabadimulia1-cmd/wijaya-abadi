import React from 'react';
import { Award, ShieldCheck, HeartHandshake, Zap } from 'lucide-react';
import { ManifestoItem } from '../types';

interface ManifestoSectionProps {
  items: ManifestoItem[];
}

export const ManifestoSection: React.FC<ManifestoSectionProps> = ({ items }) => {
  return (
    <section id="manifesto" className="py-24 bg-black relative border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider">
            <Award className="w-3.5 h-3.5" />
            <span>Komitmen Showroom</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Nilai & Standar Pelayanan Kami
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base">
            Fondasi komitmen Honda Wijaya Abadi Mulia Motor dalam melayani ribuan pelanggan setia di Bandung.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-zinc-900/40 border border-white/10 rounded-3xl p-6 sm:p-7 relative overflow-hidden group hover:border-red-500/40 transition-all duration-300"
            >
              {/* Giant watermarked number */}
              <div className="text-5xl font-black text-white/5 absolute top-3 right-4 select-none group-hover:text-red-600/10 transition-colors">
                {item.number}
              </div>

              <div className="relative z-10 space-y-3">
                <span className="text-red-500 text-xs font-black tracking-widest uppercase">
                  Pilar {item.number}
                </span>
                <h3 className="text-xl font-bold text-white group-hover:text-red-400 transition-colors">
                  {item.title}
                </h3>
                <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
