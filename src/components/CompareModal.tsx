import React from 'react';
import { X, Scale, Trash2, ArrowRight, Check, AlertCircle } from 'lucide-react';
import { Motor } from '../types';
import { formatRupiah } from '../services/api';

interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  compareList: Motor[];
  onRemoveMotor: (motorId: string) => void;
  onClearAll: () => void;
  onSelectMotor: (motor: Motor) => void;
}

export const CompareModal: React.FC<CompareModalProps> = ({
  isOpen,
  onClose,
  compareList,
  onRemoveMotor,
  onClearAll,
  onSelectMotor,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-zinc-950 border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Perbandingan Motor Honda</h3>
              <p className="text-xs text-zinc-400">
                Bandingkan spesifikasi dan harga hingga 4 model motor sekaligus
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {compareList.length > 0 && (
              <button
                onClick={onClearAll}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Kosongkan</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-x-auto overflow-y-auto flex-1">
          {compareList.length === 0 ? (
            <div className="py-16 text-center text-zinc-400">
              <AlertCircle className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
              <p className="text-base font-semibold text-white">Belum ada motor yang dipilih</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                Klik tombol "Bandingkan" pada kartu motor di katalog untuk mulai membandingkan spesifikasi.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-w-[600px]">
              {compareList.map((motor) => (
                <div
                  key={motor.id}
                  className="bg-zinc-900/60 border border-white/10 rounded-2xl p-5 flex flex-col justify-between relative group hover:border-red-500/40 transition-colors"
                >
                  <button
                    onClick={() => onRemoveMotor(motor.id)}
                    className="absolute top-3 right-3 p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
                    title="Hapus"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div>
                    {/* Image */}
                    <div className="h-44 bg-zinc-950 rounded-xl p-3 flex items-center justify-center mb-4">
                      <img
                        src={motor.image}
                        alt={motor.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>

                    <span className="text-[11px] font-semibold text-red-400 bg-red-600/10 px-2.5 py-0.5 rounded-full border border-red-500/20">
                      {motor.category}
                    </span>

                    <h4 className="text-lg font-bold text-white mt-2">{motor.name}</h4>
                    <div className="text-xl font-black text-white mt-1">
                      {formatRupiah(motor.price)}
                    </div>

                    {/* Specs List */}
                    <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Spesifikasi Utama
                      </span>
                      <ul className="space-y-1.5">
                        {motor.specs &&
                          motor.specs.map((spec, i) => (
                            <li key={i} className="text-xs text-zinc-300 flex items-center gap-2">
                              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>{spec}</span>
                            </li>
                          ))}
                      </ul>
                    </div>

                    {/* Description */}
                    <p className="mt-4 text-xs text-zinc-400 line-clamp-3">
                      {motor.description}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="mt-6 pt-4 border-t border-white/10">
                    <button
                      onClick={() => {
                        onClose();
                        onSelectMotor(motor);
                      }}
                      className="w-full py-2.5 px-3 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      <span>Pilih Motor Ini</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
