export const CATALOG_ANIMATION_OPTIONS = [
  { value: 'fade', label: 'Fade', description: 'Memudar halus' },
  { value: 'slide-left', label: 'Slide kiri', description: 'Masuk dari kanan' },
  { value: 'slide-right', label: 'Slide kanan', description: 'Masuk dari kiri' },
  { value: 'slide-up', label: 'Slide atas', description: 'Masuk dari bawah' },
  { value: 'slide-down', label: 'Slide bawah', description: 'Masuk dari atas' },
  { value: 'zoom-in', label: 'Zoom masuk', description: 'Muncul dengan zoom lembut' },
  { value: 'zoom-out', label: 'Zoom keluar', description: 'Mengecil ke posisi semula' },
  { value: 'blur', label: 'Blur', description: 'Jernih dari efek buram' },
  { value: 'flip', label: 'Flip', description: 'Berputar seperti kartu' },
  { value: 'rotate', label: 'Putar', description: 'Berputar lembut ke posisi' },
] as const;

export const HERO_ANIMATION_OPTIONS = CATALOG_ANIMATION_OPTIONS;

export type CatalogAnimation = (typeof CATALOG_ANIMATION_OPTIONS)[number]['value'];

export const DEFAULT_CATALOG_ANIMATION: CatalogAnimation = 'fade';
export const DEFAULT_CATALOG_ANIMATION_SPEED = 8;
export const MIN_CATALOG_ANIMATION_SPEED = 3;
export const MAX_CATALOG_ANIMATION_SPEED = 15;

export function isCatalogAnimation(value: unknown): value is CatalogAnimation {
  return CATALOG_ANIMATION_OPTIONS.some((option) => option.value === value);
}

export function normalizeCatalogAnimationSpeed(value: unknown): number {
  const speed = Number(value);
  if (!Number.isFinite(speed)) return DEFAULT_CATALOG_ANIMATION_SPEED;
  return Math.min(MAX_CATALOG_ANIMATION_SPEED, Math.max(MIN_CATALOG_ANIMATION_SPEED, speed));
}
