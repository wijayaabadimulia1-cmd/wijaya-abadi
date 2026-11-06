import { api } from '../services/api';

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

export function trackWhatsAppClick(menu: string, registerSalesCounterLead = false) {
  if (typeof window === 'undefined') return;

  try {
    const sessionKey = 'hwa-visitor-session';
    let sessionId = sessionStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `visit_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(sessionKey, sessionId);
    }
    const eventId = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `click_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    void api.trackWhatsAppClick(sessionId, window.location.pathname, menu.slice(0, 120), eventId, registerSalesCounterLead).catch(() => undefined);
  } catch {
    // Keep WhatsApp navigation working when browser storage is unavailable.
  }
}
