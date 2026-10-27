import React, { useState, useEffect } from 'react';
import { X, Send, MessageSquare, CheckCircle, Bike, ShieldCheck } from 'lucide-react';
import { Motor, DealerSettings } from '../types';
import { api, formatRupiah } from '../services/api';
import { createWhatsAppUrl } from '../utils/whatsapp';

interface InterestModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMotor?: Motor | null;
  motors: Motor[];
  settings: DealerSettings;
  initialDpSummary?: string;
  initialInstallmentSummary?: string;
}

export const InterestModal: React.FC<InterestModalProps> = ({
  isOpen,
  onClose,
  selectedMotor,
  motors,
  settings,
  initialDpSummary,
  initialInstallmentSummary,
}) => {
  const [motorId, setMotorId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Kredit' | 'Cash'>('Kredit');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (selectedMotor) {
      setMotorId(selectedMotor.id);
    } else if (motors.length > 0 && !motorId) {
      setMotorId(motors[0].id);
    }
  }, [selectedMotor, motors]);

  if (!isOpen) return null;

  const currentMotor = motors.find((m) => m.id === motorId) || selectedMotor;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !phone) return;

    setIsSubmitting(true);
    const whatsappWindow = window.open('', '_blank');
    try {
      const dpDetail = initialDpSummary
        ? `${initialDpSummary} | ${initialInstallmentSummary || ''}`
        : paymentMethod === 'Kredit'
        ? 'Estimasi DP Standar 20%'
        : 'Pembelian Cash / Tunai';

      // 1. Save to Database backend
      await api.createInterest({
        motor_id: currentMotor?.id || '',
        motor_name: currentMotor?.name || 'Pertanyaan Umum',
        customer_name: customerName,
        phone: phone,
        payment_method: paymentMethod,
        dp_estimate: dpDetail,
        note: note,
      });

      setIsSuccess(true);

      // 2. Format WhatsApp link and redirect
      const textMsg = `Halo Honda Wijaya Abadi,
Saya tertarik untuk pemesanan/konsultasi unit motor Honda:
• Nama: ${customerName}
• No. WhatsApp: ${phone}
• Unit: ${currentMotor?.name || 'Pilihan Honda'} (${currentMotor ? formatRupiah(currentMotor.price) : ''})
• Pembayaran: ${paymentMethod}
• Simulasi / DP: ${dpDetail}
${note ? `• Catatan: ${note}` : ''}

Mohon informasi ketersediaan unit dan proses pengajuannya. Terima kasih!`;

      const waUrl = createWhatsAppUrl(settings.phone, textMsg);
      if (whatsappWindow) {
        whatsappWindow.location.href = waUrl;
      } else {
        window.location.href = waUrl;
      }
    } catch (err) {
      console.error('Error submitting interest:', err);
      alert('Terjadi kesalahan saat menyimpan data. Anda akan langsung dialihkan ke WhatsApp.');
      const waUrl = createWhatsAppUrl(settings.phone);
      if (whatsappWindow) {
        whatsappWindow.location.href = waUrl;
      } else {
        window.location.href = waUrl;
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-zinc-950 border border-white/15 rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-zinc-900/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Formulir Minat & Konsultasi</h3>
              <p className="text-xs text-zinc-400">Terhubung langsung dengan tim sales resmi Honda</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {isSuccess ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h4 className="text-xl font-bold text-white">Data Berhasil Dikirim!</h4>
            <p className="text-zinc-300 text-sm max-w-sm mx-auto">
              Terima kasih <span className="text-white font-semibold">{customerName}</span>. Permintaan Anda telah tersimpan di sistem kami dan jendela WhatsApp telah dibuka.
            </p>
            <div className="pt-4">
              <button
                onClick={() => {
                  setIsSuccess(false);
                  onClose();
                }}
                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm transition-all"
              >
                Selesai
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Motor Preview / Selector */}
            <div>
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                Unit Motor Pilihan
              </label>
              <select
                value={motorId}
                onChange={(e) => setMotorId(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
              >
                {motors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {formatRupiah(m.price)}
                  </option>
                ))}
              </select>
            </div>

            {/* Input Name */}
            <div>
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                Nama Lengkap *
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Contoh: Budi Pratama"
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
              />
            </div>

            {/* Input Phone */}
            <div>
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                Nomor WhatsApp Aktif *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                Rencana Pembayaran
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Kredit')}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    paymentMethod === 'Kredit'
                      ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-900/30'
                      : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
                  }`}
                >
                  Kredit (Cicilan Ringan)
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Cash')}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    paymentMethod === 'Cash'
                      ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-900/30'
                      : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
                  }`}
                >
                  Cash / Tunai
                </button>
              </div>
            </div>

            {/* Additional note */}
            <div>
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                Pesan / Pertanyaan Tambahan
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Contoh: Tanya warna yang ready stock, pengiriman ke Gegerkalong..."
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
              />
            </div>

            {/* Submit CTA */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-xl text-sm shadow-lg shadow-red-900/40 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Menyimpan...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Kirim Minat & Hubungi WhatsApp</span>
                  </>
                )}
              </button>
              <p className="text-[11px] text-zinc-500 text-center mt-2">
                🔒 Data Anda aman dan hanya digunakan oleh tim Honda Wijaya Abadi.
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
