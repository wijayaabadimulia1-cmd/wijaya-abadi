import React, { useState, useMemo } from 'react';
import { Search, Flame, Sparkles, Scale, Check, MessageSquare, Calculator, Tag, ArrowRight, X } from 'lucide-react';
import { Motor } from '../types';
import { formatRupiah } from '../services/api';

interface CatalogSectionProps {
  motors: Motor[];
  compareList: Motor[];
  onToggleCompare: (motor: Motor) => void;
  onOpenSimulator: (motor: Motor) => void;
  onOpenInterest: (motor: Motor) => void;
}

export const CatalogSection: React.FC<CatalogSectionProps> = ({
  motors,
  compareList,
  onToggleCompare,
  onOpenSimulator,
  onOpenInterest,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'default' | 'price-asc' | 'price-desc' | 'bestseller'>('default');
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);

  // Extract unique categories from actual motors data
  const categories = useMemo(() => {
    const cats = new Set<string>(['Semua']);
    motors.forEach((m) => {
      if (m.category) cats.add(m.category);
    });
    return Array.from(cats);
  }, [motors]);

  const isCompared = (motorId: string) => compareList.some((m) => m.id === motorId);

  // Filter & sort
  const filteredMotors = useMemo(() => {
    return motors
      .filter((m) => Boolean(m.image && m.image.trim()))
      .filter((m) => {
        const matchesCategory =
          activeCategory === 'Semua' || m.category.toLowerCase().includes(activeCategory.toLowerCase());
        const matchesSearch =
          m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (m.specs && m.specs.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase())));
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        const priceA = a.numericPrice || Number(String(a.price).replace(/[^0-9]/g, '')) || 0;
        const priceB = b.numericPrice || Number(String(b.price).replace(/[^0-9]/g, '')) || 0;

        if (sortBy === 'price-asc') return priceA - priceB;
        if (sortBy === 'price-desc') return priceB - priceA;
        if (sortBy === 'bestseller') return (b.is_bestseller ? 1 : 0) - (a.is_bestseller ? 1 : 0);
        return 0;
      })
      .slice(0, 10);
  }, [motors, activeCategory, searchQuery, sortBy]);

  return (
    <section id="katalog" className="py-24 bg-zinc-950 relative">
      {/* Background accents */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="absolute top-1/3 right-0 w-96 h-96 bg-red-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider">
            <Tag className="w-3.5 h-3.5" />
            <span>Koleksi Terlengkap</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            Katalog Motor Honda
          </h2>
          <p className="text-zinc-400 text-base sm:text-lg">
            Temukan motor Honda yang sesuai dengan kebutuhan Anda. Dari skutik lincah harian hingga motor sport impian.
          </p>
        </div>

        {/* Filter and Search Bar Controls */}
        <div className="mt-12 space-y-5">
          {/* Top row: Search and Sort */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari Beat, PCX, Vario, 160cc..."
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/80 border border-white/10 focus:border-red-500 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-red-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white text-xs"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Sort Select */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-xs text-zinc-400 whitespace-nowrap">Urutkan:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-zinc-900 border border-white/10 rounded-xl text-xs text-zinc-300 py-2.5 px-3 focus:outline-none focus:border-red-500"
              >
                <option value="default">Paling Relevan</option>
                <option value="bestseller">🔥 Terlaris / Bestseller</option>
                <option value="price-asc">Harga Terendah</option>
                <option value="price-desc">Harga Tertinggi</option>
              </select>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categories.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                    isActive
                      ? 'bg-red-600 text-white shadow-lg shadow-red-900/30 border border-red-500'
                      : 'bg-zinc-900/80 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-white/10'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Motorcycles Grid */}
        {filteredMotors.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-500">
              <Search className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white">Tidak ada motor ditemukan</h3>
            <p className="text-zinc-400 text-sm mt-1">Coba ganti kata kunci pencarian atau kategori filter.</p>
            <button
              onClick={() => {
                setActiveCategory('Semua');
                setSearchQuery('');
              }}
              className="mt-4 px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filteredMotors.map((motor, index) => {
              const selectedForCompare = isCompared(motor.id);

              return (
                <div
                  key={motor.id}
                  className="catalog-card group relative bg-zinc-900/50 backdrop-blur-sm border border-white/10 rounded-3xl overflow-hidden hover:border-red-500/50 transition-all duration-500 flex flex-col justify-between"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  {/* Glowing background on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-red-600/10 to-transparent rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none" />

                  {/* Top card area: image and badges */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setSelectedImage({ src: motor.image, alt: motor.name })}
                      className="relative h-64 w-full overflow-hidden bg-zinc-950 flex items-center justify-center p-6 cursor-zoom-in"
                      aria-label={`Lihat foto ${motor.name} ukuran penuh`}
                    >
                      <img
                        src={motor.image}
                        alt={motor.name}
                        className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500 drop-shadow-2xl"
                        onError={(e) => {
                          e.currentTarget.closest('.catalog-card')?.classList.add('catalog-card-hidden');
                        }}
                      />
                      <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                        Klik untuk lihat foto
                      </span>

                      {/* Category Pill Tag */}
                      <div className="absolute top-4 right-4 bg-zinc-900/90 backdrop-blur-sm text-zinc-300 border border-white/10 px-3 py-1 rounded-full text-xs font-semibold">
                        {motor.category}
                      </div>

                      {/* Bestseller Badge */}
                      {motor.is_bestseller && (
                        <div
                          data-testid={`motor-bestseller-${motor.id}`}
                          className="absolute top-4 left-4 bg-gradient-to-r from-yellow-500 to-orange-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center space-x-1"
                        >
                          <Flame className="w-3.5 h-3.5 fill-current" />
                          <span>Bestseller</span>
                        </div>
                      )}
                    </button>

                    {/* Content area */}
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-white group-hover:text-red-400 transition-colors">
                        {motor.name}
                      </h3>

                      <p className="mt-2 text-zinc-400 text-xs sm:text-sm line-clamp-2 min-h-[36px]">
                        {motor.description || 'Pilihan tepat untuk kenyamanan mobilitas harian Anda.'}
                      </p>

                      {/* Specs Tags */}
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {motor.specs &&
                          motor.specs.slice(0, 4).map((spec, idx) => (
                            <span
                              key={idx}
                              className="bg-zinc-800/60 border border-white/10 px-2.5 py-1 rounded-full text-[11px] text-zinc-300"
                            >
                              {spec}
                            </span>
                          ))}
                      </div>

                      {/* Price Section */}
                      <div className="mt-6 pt-4 border-t border-white/10">
                        <span className="text-[11px] text-zinc-400 uppercase tracking-wider block">
                          Mulai dari OTR Bandung
                        </span>
                        <div className="text-2xl font-black text-white mt-0.5">
                          {formatRupiah(motor.price)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="p-6 pt-0 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {/* Saya Tertarik */}
                      <button
                        onClick={() => onOpenInterest(motor)}
                        data-testid={`motor-interest-${motor.id}`}
                        className="w-full py-2.5 px-3 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-red-900/30 flex items-center justify-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Saya Tertarik</span>
                      </button>

                      {/* Simulasi Kredit */}
                      <button
                        onClick={() => onOpenSimulator(motor)}
                        data-testid={`motor-simulator-${motor.id}`}
                        className="w-full py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs rounded-xl border border-white/10 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Calculator className="w-3.5 h-3.5 text-red-400" />
                        <span>Simulasi Kredit</span>
                      </button>
                    </div>

                    {/* Bandingkan Button */}
                    <button
                      onClick={() => onToggleCompare(motor)}
                      data-testid={`motor-compare-${motor.id}`}
                      className={`w-full py-2 px-3 text-xs font-semibold rounded-xl flex items-center justify-center space-x-2 transition-all duration-300 border ${
                        selectedForCompare
                          ? 'bg-red-600/20 border-red-500/50 text-red-400 shadow-inner'
                          : 'bg-transparent border-white/10 text-zinc-400 hover:bg-red-600/10 hover:text-red-400 hover:border-red-500/30'
                      }`}
                    >
                      <Scale className="w-3.5 h-3.5" />
                      <span>{selectedForCompare ? '✓ Ditambahkan ke Perbandingan' : 'Bandingkan'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setSelectedImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Foto ${selectedImage.alt}`}
        >
          <div className="relative max-h-[92vh] max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <img
              src={selectedImage.src}
              alt={selectedImage.alt}
              className="max-h-[88vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute -right-2 -top-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-zinc-900 shadow-xl hover:bg-red-50"
              aria-label="Tutup foto"
            >
              <X className="h-5 w-5" />
            </button>
            <p className="mt-3 text-center text-sm font-semibold text-white">{selectedImage.alt}</p>
          </div>
        </div>
      )}
    </section>
  );
};
