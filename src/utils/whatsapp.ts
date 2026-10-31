export function normalizeWhatsAppNumber(value: string | undefined, fallback = '6282129358899') {
  const digits = String(value || fallback).replace(/\D/g, '');
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits || fallback;
}

export function withCurrentWebsiteLink(message = '') {
  const cleanMessage = String(message || '').trim();
  const websiteUrl = typeof window !== 'undefined' ? window.location.href : '';

  if (!websiteUrl || cleanMessage.includes(websiteUrl)) return cleanMessage;

  return `${cleanMessage}${cleanMessage ? '\n\n' : ''}Link website: ${websiteUrl}`;
}

export function createWhatsAppUrl(phone: string | undefined, message?: string) {
  const number = normalizeWhatsAppNumber(phone);
  const messageWithWebsite = withCurrentWebsiteLink(message);
  return `https://wa.me/${number}${messageWithWebsite ? `?text=${encodeURIComponent(messageWithWebsite)}` : ''}`;
}
