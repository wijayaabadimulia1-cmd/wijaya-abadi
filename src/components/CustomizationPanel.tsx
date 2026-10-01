import React, { useEffect, useState, useRef } from 'react';
import { Upload, X, Eye, Trash2 } from 'lucide-react';
import type { DealerSettings, ThemeColorPalette, ThemeMode } from '../types';
import { api } from '../services/api';
import { MAX_HERO_IMAGES } from '../constants';
import {
  DEFAULT_CATALOG_ANIMATION,
  DEFAULT_CATALOG_ANIMATION_SPEED,
  HERO_ANIMATION_OPTIONS,
  MAX_CATALOG_ANIMATION_SPEED,
  MIN_CATALOG_ANIMATION_SPEED,
  normalizeCatalogAnimationSpeed,
} from '../catalogAnimation';
import { getHeroFontStack, HERO_FONT_OPTIONS, loadHeroFont, resolveHeroFont } from '../heroFonts';

interface CustomizationPanelProps {
  settings: any;
  onSettingsChange: (settings: any) => void;
}

export function CustomizationPanel({ settings, onSettingsChange }: CustomizationPanelProps) {
  const [previewMode, setPreviewMode] = useState<'logo' | 'banner' | 'fonts' | 'colors' | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [editingThemeMode, setEditingThemeMode] = useState<ThemeMode>('dark');
  const selectedHeroFont = resolveHeroFont(settings.customization?.heroTextFont || settings.customization?.font);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const customization = settings.customization || {};
  const basePalette: ThemeColorPalette = {
    primaryColor: customization.primaryColor || '#dc2626',
    accentColor: customization.accentColor || '#f97316',
    backgroundColor: customization.backgroundColor || '#000000',
    panelColor: customization.panelColor || '#111827',
    textColor: customization.textColor || '#f4f4f5',
    mutedColor: customization.mutedColor || '#a1a1aa',
    font: customization.font || 'jakarta',
    heroTextColor: customization.heroTextColor || '#f4f4f5',
    heroTitleHighlightColor: customization.heroTitleHighlightColor || '#f97316',
  };
  const activePalette: ThemeColorPalette = {
    ...basePalette,
    ...customization.colorPalettes?.[editingThemeMode],
  };
  const themeColorFields: Array<{ key: Exclude<keyof ThemeColorPalette, 'font'>; label: string; fallback: string }> = [
    { key: 'primaryColor', label: 'Warna utama', fallback: '#dc2626' },
    { key: 'accentColor', label: 'Warna aksen', fallback: '#f97316' },
    { key: 'backgroundColor', label: 'Warna latar', fallback: '#000000' },
    { key: 'panelColor', label: 'Warna panel', fallback: '#111827' },
    { key: 'textColor', label: 'Warna teks', fallback: '#f4f4f5' },
    { key: 'mutedColor', label: 'Warna teks sekunder', fallback: '#a1a1aa' },
    { key: 'heroTextColor', label: 'Warna teks hero', fallback: '#f4f4f5' },
    { key: 'heroTitleHighlightColor', label: 'Warna sorotan hero', fallback: '#f97316' },
  ];
  const heroTextSizeFields = [
    { key: 'heroBadgeFontSize', label: 'Ukuran label kecil', min: 10, max: 24, fallback: 12 },
    { key: 'heroTitleFontSize', label: 'Ukuran judul utama', min: 28, max: 76, fallback: 58 },
    { key: 'heroHighlightFontSize', label: 'Ukuran sorotan judul', min: 28, max: 76, fallback: 58 },
    { key: 'heroSubtitleFontSize', label: 'Ukuran deskripsi', min: 12, max: 30, fallback: 18 },
    { key: 'heroCaptionFontSize', label: 'Ukuran caption foto', min: 10, max: 24, fallback: 12 },
  ] as const;

  useEffect(() => {
    loadHeroFont(selectedHeroFont);
  }, [selectedHeroFont]);

  const handleImageUpload = async (
    file: File,
    type: 'logo' | 'banner'
  ) => {
    if (!file) return;

    const currentImages = (settings.heroImages ?? (settings.heroImage ? [settings.heroImage] : [])).filter(Boolean);
    if (type === 'banner' && currentImages.length >= MAX_HERO_IMAGES) {
      alert(`Maksimal ${MAX_HERO_IMAGES} foto untuk Banner Hero`);
      return;
    }

    setIsUploading(true);
    try {
      const extension = file.name.split('.').pop() || 'jpg';
      const uploadFile = new File([file], `${type}-${Date.now()}.${extension}`, { type: file.type });
      const url = await api.uploadImage(uploadFile);
      if (type === 'logo') {
        onSettingsChange({ ...settings, logo: url });
      } else {
        const nextImages = [...currentImages, url];
        onSettingsChange({ ...settings, heroImage: nextImages[0], heroImages: nextImages });
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Gagal upload gambar');
    } finally {
      setIsUploading(false);
    }
  };

  const storedHeroImages: unknown[] = Array.isArray(settings.heroImages)
    ? settings.heroImages
    : settings.heroImage ? [settings.heroImage] : [];
  const heroImages = storedHeroImages
    .filter((image): image is string => typeof image === 'string' && image.trim().length > 0)
    .slice(0, MAX_HERO_IMAGES);

  const handleRemoveHeroImage = (imageIndex: number) => {
    const nextImages = heroImages.filter((_, index) => index !== imageIndex);
    onSettingsChange({ ...settings, heroImage: nextImages[0] || '', heroImages: nextImages });
  };

  const handleHeroImagesUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const availableSlots = MAX_HERO_IMAGES - heroImages.length;
    const filesToUpload = Array.from(files).slice(0, availableSlots);
    if (files.length > availableSlots) {
      alert(`Hanya ${availableSlots} foto yang dapat ditambahkan. Maksimal ${MAX_HERO_IMAGES} foto.`);
    }
    if (!filesToUpload.length) return;

    setIsUploading(true);
    try {
      const uploadedImages = await Promise.all(filesToUpload.map((file, index) => {
        const extension = file.name.split('.').pop() || 'jpg';
        const uploadFile = new File([file], `hero-${Date.now()}-${index}.${extension}`, { type: file.type });
        return api.uploadImage(uploadFile);
      }));
      const nextImages = [...heroImages, ...uploadedImages];
      onSettingsChange({ ...settings, heroImage: nextImages[0] || '', heroImages: nextImages });
    } catch (error) {
      console.error('Hero upload error:', error);
      alert('Gagal upload foto Banner Hero');
    } finally {
      setIsUploading(false);
    }
  };

  const handleColorChange = (key: Exclude<keyof ThemeColorPalette, 'font'>, value: string) => {
    const nextPalette = { ...activePalette, [key]: value };
    onSettingsChange({
      ...settings,
      customization: {
        ...customization,
        colorPalettes: {
          ...customization.colorPalettes,
          [editingThemeMode]: nextPalette,
        },
      },
    });
  };

  const handleColorPreset = (preset: (typeof colorPresets)[number]) => {
    onSettingsChange({
      ...settings,
      customization: {
        ...customization,
        colorPalettes: {
          ...customization.colorPalettes,
          [editingThemeMode]: { ...activePalette, primaryColor: preset.primary, accentColor: preset.accent },
        },
      },
    });
  };

  const handleFontChange = (fontName: string) => {
    onSettingsChange({
      ...settings,
      customization: {
        ...customization,
        font: fontName,
      },
    });
  };

  const fontOptions = [
    { name: 'jakarta', label: 'Plus Jakarta Sans' },
    { name: 'outfit', label: 'Outfit' },
    { name: 'inter', label: 'Inter' },
    { name: 'montserrat', label: 'Montserrat' },
  ];

  const colorPresets = [
    { name: 'Red', primary: '#dc2626', accent: '#f97316' },
    { name: 'Blue', primary: '#2563eb', accent: '#3b82f6' },
    { name: 'Green', primary: '#059669', accent: '#10b981' },
    { name: 'Purple', primary: '#9333ea', accent: '#a855f7' },
  ];

  return (
    <div className="space-y-8">
      {/* Logo Upload */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Logo & Banner</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Logo */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Logo Dealer
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-red-500 transition cursor-pointer"
              onClick={() => logoInputRef.current?.click()}>
              {settings.logo ? (
                <div className="flex flex-col items-center gap-2">
                  <img src={settings.logo} alt="Logo" className="h-20 w-auto rounded" />
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:text-red-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSettingsChange({ ...settings, logo: '' });
                    }}>
                    Hapus
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <Upload className="w-6 h-6" />
                  <p className="text-sm">Klik untuk upload logo</p>
                </div>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files && handleImageUpload(e.target.files[0], 'logo')}
              />
            </div>
          </div>

          {/* Banner/Hero Image */}
          <div className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-950 p-4 text-zinc-100">
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className="block text-sm font-semibold">Foto Banner Hero</label>
                <span className="text-xs text-zinc-400">{heroImages.length} / {MAX_HERO_IMAGES} foto</span>
              </div>
              <button
                type="button"
                disabled={isUploading || heroImages.length >= MAX_HERO_IMAGES}
                onClick={() => bannerInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {isUploading ? 'Mengunggah...' : 'Tambah foto'}
              </button>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  void handleHeroImagesUpload(event.currentTarget.files);
                  event.currentTarget.value = '';
                }}
              />
            </div>
            {heroImages.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {heroImages.map((image, index) => (
                  <div key={`${image}-${index}`} className="relative aspect-[4/3] overflow-hidden rounded-md border border-white/10 bg-black">
                    <img src={image} alt={`Foto Banner Hero ${index + 1}`} className="h-full w-full object-cover" />
                    <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">{index + 1}</span>
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => handleRemoveHeroImage(index)}
                      aria-label={`Hapus foto hero ${index + 1}`}
                      className="absolute right-1 top-1 rounded bg-black/70 p-1.5 text-white hover:bg-red-600 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-zinc-700 px-3 py-8 text-center text-xs text-zinc-400">
                Belum ada foto. Banner hanya menampilkan foto yang diunggah di sini.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-5 rounded-lg border border-zinc-700 bg-zinc-950 p-5 text-zinc-100">
        <div>
          <h3 className="text-base font-semibold">Konten Banner Hero</h3>
          <p className="mt-1 text-xs text-zinc-400">Edit teks utama dan gaya teks yang tampil di banner.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-1 text-xs font-medium text-zinc-300">
            Label kecil
            <input
              value={settings.heroTitle || ''}
              onChange={(event) => onSettingsChange({ ...settings, heroTitle: event.target.value })}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              placeholder="Dealer resmi Honda Bandung"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-zinc-300">
            Judul utama
            <input
              value={settings.heroMainTitle || ''}
              onChange={(event) => onSettingsChange({ ...settings, heroMainTitle: event.target.value })}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              placeholder="Partner Terpercaya"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-zinc-300">
            Teks sorotan judul
            <input
              value={settings.heroTitleHighlight || ''}
              onChange={(event) => onSettingsChange({ ...settings, heroTitleHighlight: event.target.value })}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              placeholder="Berkendara Anda"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-zinc-300 md:col-span-2">
            Deskripsi
            <textarea
              rows={3}
              value={settings.heroSubtitle || ''}
              onChange={(event) => onSettingsChange({ ...settings, heroSubtitle: event.target.value })}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              placeholder="Tulis deskripsi singkat untuk banner..."
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-zinc-300 md:col-span-2">
            Caption foto
            <input
              value={settings.heroCaption || ''}
              onChange={(event) => onSettingsChange({ ...settings, heroCaption: event.target.value })}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              placeholder="One Heart. Satu Hati."
            />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-2">
            {heroTextSizeFields.map(({ key, label, min, max, fallback }) => {
              const fontSize = Number(customization[key]) || fallback;
              return (
                <label key={key} className="space-y-2 text-xs font-medium text-zinc-300">
                  <span className="flex items-center justify-between gap-3">
                    {label}
                    <output className="font-mono tabular-nums text-white">{fontSize} px</output>
                  </span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step="1"
                    value={fontSize}
                    onChange={(event) => onSettingsChange({
                      ...settings,
                      customization: { ...customization, [key]: Number(event.target.value) },
                    })}
                    className="w-full accent-red-500"
                  />
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 border-t border-zinc-800 pt-4 md:grid-cols-2">
          <label className="space-y-1 text-xs font-medium text-zinc-300 md:col-span-2">
            Font teks hero (100 pilihan)
            <select
              value={selectedHeroFont}
              onChange={(event) => onSettingsChange({ ...settings, customization: { ...customization, heroTextFont: event.target.value } })}
              style={{ fontFamily: getHeroFontStack(selectedHeroFont) }}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
            >
              {HERO_FONT_OPTIONS.map((font) => (
                <option key={font} value={font} style={{ fontFamily: getHeroFontStack(font) }}>{font}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-zinc-300">
            Animasi foto
            <select
              value={settings.heroAnimation || DEFAULT_CATALOG_ANIMATION}
              onChange={(event) => onSettingsChange({ ...settings, heroAnimation: event.target.value as DealerSettings['heroAnimation'] })}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
            >
              {HERO_ANIMATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-xs font-medium text-zinc-300 md:col-span-2">
            Kecepatan pergantian foto
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={MIN_CATALOG_ANIMATION_SPEED}
                max={MAX_CATALOG_ANIMATION_SPEED}
                step="1"
                value={normalizeCatalogAnimationSpeed(settings.heroAnimationSpeed ?? DEFAULT_CATALOG_ANIMATION_SPEED)}
                onChange={(event) => onSettingsChange({ ...settings, heroAnimationSpeed: Number(event.target.value) })}
                className="w-full accent-red-500"
              />
              <span className="w-16 text-right text-sm tabular-nums text-white">{normalizeCatalogAnimationSpeed(settings.heroAnimationSpeed ?? DEFAULT_CATALOG_ANIMATION_SPEED)} dtk</span>
            </div>
          </label>
          <label className="flex items-center gap-3 text-xs font-medium text-zinc-300">
            Warna teks
            <input
              type="color"
              value={customization.heroTextColor || '#ffffff'}
              onChange={(event) => onSettingsChange({ ...settings, customization: { ...customization, heroTextColor: event.target.value } })}
              className="h-9 w-12 cursor-pointer rounded border border-zinc-700 bg-zinc-900"
            />
            <span className="font-mono">{customization.heroTextColor || '#ffffff'}</span>
          </label>
          <label className="flex items-center gap-3 text-xs font-medium text-zinc-300">
            Warna teks sorotan
            <input
              type="color"
              value={customization.heroTitleHighlightColor || '#f97316'}
              onChange={(event) => onSettingsChange({ ...settings, customization: { ...customization, heroTitleHighlightColor: event.target.value } })}
              className="h-9 w-12 cursor-pointer rounded border border-zinc-700 bg-zinc-900"
            />
            <span className="font-mono">{customization.heroTitleHighlightColor || '#f97316'}</span>
          </label>
        </div>
      </div>

      {/* Font Selection */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-6 text-zinc-100">
        <h3 className="mb-4 text-lg font-semibold">Pilih Font</h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {fontOptions.map((font) => (
            <button
              key={font.name}
              type="button"
              onClick={() => handleFontChange(font.name)}
              className={`p-4 rounded-lg border-2 transition text-center font-semibold ${
                customization.font === font.name
                  ? 'border-red-500 bg-red-500/10'
                  : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'
              }`}
              style={{ fontFamily: font.label }}>
              {font.label}
            </button>
          ))}
        </div>
      </div>

      {/* Color Customization */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-6 text-zinc-100">
        <h3 className="mb-4 text-lg font-semibold">Warna Tema</h3>

        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium text-zinc-300">Mode tampilan yang diatur</span>
            <div className="inline-flex rounded-md border border-zinc-700 bg-zinc-900 p-1" role="group" aria-label="Pilih mode warna">
              {(['dark', 'light'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={editingThemeMode === mode}
                  onClick={() => setEditingThemeMode(mode)}
                  className={`rounded px-3 py-2 text-xs font-semibold transition-colors ${editingThemeMode === mode ? 'bg-red-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`}
                >
                  {mode === 'dark' ? 'Gelap' : 'Terang'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="space-y-1 text-xs font-medium text-zinc-300 sm:col-span-1">
              Font mode {editingThemeMode === 'dark' ? 'gelap' : 'terang'}
              <select
                value={activePalette.font || 'jakarta'}
                onChange={(event) => onSettingsChange({
                  ...settings,
                  customization: {
                    ...customization,
                    colorPalettes: {
                      ...customization.colorPalettes,
                      [editingThemeMode]: { ...activePalette, font: event.target.value as ThemeColorPalette['font'] },
                    },
                  },
                })}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              >
                <option value="jakarta">Plus Jakarta Sans</option>
                <option value="serif">Serif</option>
                <option value="mono">Monospace</option>
                <option value="system">System</option>
                <option value="outfit">Outfit</option>
                <option value="inter">Inter</option>
                <option value="montserrat">Montserrat</option>
              </select>
            </label>
          </div>

          {/* Color Presets */}
          <div>
            <label className="mb-3 block text-sm font-medium text-zinc-300">Preset warna cepat</label>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {colorPresets.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleColorPreset(preset)}
                  className={`p-4 rounded-lg border-2 transition ${
                    activePalette.primaryColor === preset.primary
                      ? 'border-red-500 bg-red-500/10 shadow-lg'
                      : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'
                  }`}>
                  <div className="flex gap-2 mb-2">
                    <div
                      className="w-8 h-8 rounded"
                      style={{ backgroundColor: preset.primary }}
                    />
                    <div
                      className="w-8 h-8 rounded"
                      style={{ backgroundColor: preset.accent }}
                    />
                  </div>
                  <p className="text-sm font-medium text-zinc-300">{preset.name}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Colors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {themeColorFields.map(({ key, label, fallback }) => (
              <div key={key} className="space-y-2">
                <label className="block text-xs font-medium text-zinc-300">{label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={activePalette[key] || fallback}
                    onChange={(event) => handleColorChange(key, event.target.value)}
                    aria-label={`Pilih ${label.toLowerCase()}`}
                    className="h-10 w-12 cursor-pointer rounded border border-zinc-700 bg-zinc-900 p-1"
                  />
                  <input
                    type="text"
                    value={activePalette[key] || fallback}
                    onChange={(event) => handleColorChange(key, event.target.value)}
                    aria-label={`Kode hex ${label.toLowerCase()}`}
                    className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-mono text-white"
                    placeholder={fallback}
                  />
                </div>
                <div className="h-2 w-full rounded-full" style={{ backgroundColor: activePalette[key] || fallback }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-lg border border-zinc-700 p-6" style={{ backgroundColor: activePalette.backgroundColor, color: activePalette.textColor }}>
        <h3 className="mb-4 text-lg font-semibold">Preview mode {editingThemeMode === 'dark' ? 'gelap' : 'terang'}</h3>
        <div
          className="w-full rounded-lg border p-8 text-center"
          style={{
            backgroundColor: activePalette.panelColor,
            borderColor: activePalette.mutedColor,
            fontFamily: activePalette.font === 'serif' ? 'Georgia, serif' : activePalette.font === 'mono' ? 'monospace' : activePalette.font === 'system' ? 'system-ui, sans-serif' : activePalette.font === 'outfit' ? 'Outfit, sans-serif' : activePalette.font === 'inter' ? 'Inter, sans-serif' : activePalette.font === 'montserrat' ? 'Montserrat, sans-serif' : '"Plus Jakarta Sans", sans-serif',
          }}>
          <div
            className="mb-4 inline-block rounded-lg px-6 py-3 text-lg font-bold"
            style={{
              backgroundColor: activePalette.primaryColor,
              color: activePalette.textColor,
            }}>
            Tombol Utama
          </div>
          <div
            className="ml-2 inline-block rounded-lg px-6 py-3 text-lg font-bold"
            style={{
              backgroundColor: activePalette.accentColor,
              color: activePalette.textColor,
            }}>
            Tombol Aksen
          </div>
          <p
            className="mt-6 text-base"
            style={{
              color: activePalette.mutedColor,
            }}>
            Ini adalah contoh teks dengan warna yang Anda pilih
          </p>
        </div>
      </div>
    </div>
  );
}
