import React, { useMemo, useState } from 'react';
import { Star, MessageSquareQuote, CheckCircle2, Send } from 'lucide-react';
import { Testimonial } from '../types';

interface TestimonialsSectionProps {
  testimonials: Testimonial[];
  onAddTestimonial?: (data: Partial<Testimonial>) => Promise<void> | void;
}

export const TestimonialsSection: React.FC<TestimonialsSectionProps> = ({
  testimonials,
  onAddTestimonial,
}) => {
  const [form, setForm] = useState({
    name: '',
    motor: '',
    email: '',
    phone: '',
    rating: 5,
    comment: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const averageRating = useMemo(() => {
    if (!testimonials.length) return 0;
    const total = testimonials.reduce((sum, item) => sum + Number(item.rating || 0), 0);
    return total / testimonials.length;
  }, [testimonials]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim() || !form.motor.trim() || !form.comment.trim()) {
      setSubmitMessage('Nama, motor, dan ulasan harus diisi.');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phonePattern = /^[0-9+()\-\s]{8,20}$/;

    if (form.email && !emailPattern.test(form.email)) {
      setSubmitMessage('Format email tidak valid.');
      return;
    }

    if (form.phone && !phonePattern.test(form.phone)) {
      setSubmitMessage('Format nomor telepon tidak valid.');
      return;
    }

    if (!onAddTestimonial) {
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitMessage(null);
      await onAddTestimonial({
        name: form.name.trim(),
        motor: form.motor.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        rating: Number(form.rating),
        comment: form.comment.trim(),
        date: 'Baru saja',
        approved: true,
      });
      setForm({ name: '', motor: '', email: '', phone: '', rating: 5, comment: '' });
      setSubmitMessage('Terima kasih! Ulasan Anda berhasil dikirim.');
    } catch (err) {
      setSubmitMessage('Gagal mengirim ulasan. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="testimoni" className="py-24 bg-zinc-950 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider">
            <Star className="w-3.5 h-3.5 fill-red-400" />
            <span>Ulasan Pembeli</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Apa Kata Pelanggan Kami?
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base">
            Kepuasan pelanggan adalah bukti dedikasi kami memberikan unit original dan layanan terbaik.
          </p>
        </div>

        <div className="mt-8 flex justify-center">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-3 text-center">
            <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">Rating rata-rata</div>
            <div className="mt-1 flex items-center justify-center gap-2">
              <span className="text-2xl font-black text-white">{averageRating.toFixed(1)}</span>
              <span className="text-yellow-400 flex items-center gap-1">
                <Star className="h-4 w-4 fill-current" />
              </span>
              <span className="text-sm text-zinc-300">({testimonials.length} review)</span>
            </div>
          </div>
        </div>

        <div className="mt-10 max-w-3xl mx-auto rounded-3xl border border-white/10 bg-zinc-900/50 p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
            <MessageSquareQuote className="w-4 h-4 text-red-400" />
            <span>Berikan Rating Anda</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Nama Anda
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Masukkan nama"
                  className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Motor yang dibeli
                </label>
                <input
                  type="text"
                  value={form.motor}
                  onChange={(e) => setForm({ ...form, motor: e.target.value })}
                  placeholder="Contoh: Honda Vario 160"
                  className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="contoh@email.com"
                  className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Nomor Telepon
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0812xxxxxx"
                  className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Rating
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm({ ...form, rating: value })}
                    className="p-0.5 transition-transform hover:scale-110"
                    aria-label={`Beri rating ${value} bintang`}
                  >
                    <Star
                      className={`h-6 w-6 ${
                        value <= form.rating ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-600'
                      }`}
                    />
                  </button>
                ))}
                <span className="ml-2 text-sm text-zinc-300">{form.rating}/5</span>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Ulasan
              </label>
              <textarea
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                rows={4}
                placeholder="Ceritakan pengalaman Anda membeli motor di showroom ini..."
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-500 focus:outline-none resize-none"
              />
            </div>

            {submitMessage && (
              <div className="text-xs text-zinc-300 bg-zinc-950 border border-white/10 rounded-xl px-3 py-2">
                {submitMessage}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-900/30 transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {isSubmitting ? 'Mengirim...' : 'Kirim Rating'}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testi) => (
            <div
              key={testi.id}
              className="bg-zinc-900/60 border border-white/10 rounded-3xl p-6 sm:p-7 flex flex-col justify-between hover:border-red-500/30 transition-all shadow-lg"
            >
              <div>
                <div className="flex items-center gap-1 text-yellow-400 mb-4">
                  {[...Array(testi.rating || 5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400" />
                  ))}
                </div>

                <p className="text-zinc-300 text-sm leading-relaxed italic">
                  "{testi.comment.replace(/^"|"$/g, '')}"
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>{testi.name}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </h4>
                  <p className="text-xs text-red-400 font-medium">{testi.motor}</p>
                  {testi.email && <p className="mt-1 text-[10px] text-zinc-400">{testi.email}</p>}
                  {testi.phone && <p className="text-[10px] text-zinc-400">{testi.phone}</p>}
                </div>
                {testi.date && (
                  <span className="text-[11px] text-zinc-500">{testi.date}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
