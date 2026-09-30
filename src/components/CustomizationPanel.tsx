import React, { useState, useRef } from 'react';
import { Upload, X, Eye } from 'lucide-react';

interface CustomizationPanelProps {
  settings: any;
  onSettingsChange: (settings: any) => void;
}

export function CustomizationPanel({ settings, onSettingsChange }: CustomizationPanelProps) {
  const [previewMode, setPreviewMode] = useState<'logo' | 'banner' | 'fonts' | 'colors' | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const customization = settings.customization || {};

  const handleImageUpload = async (
    file: File,
    type: 'logo' | 'banner'
  ) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target?.result as string;

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: `${type}-${Date.now()}.${file.type.split('/')[1]}`,
            base64Data,
          }),
        });

        const data = await response.json();
        if (data.success) {
          const newSettings = { ...settings };
          if (type === 'logo') {
            newSettings.logo = data.url;
          } else if (type === 'banner') {
            newSettings.heroImage = data.url;
          }
          onSettingsChange(newSettings);
        }
      } catch (error) {
        console.error('Upload error:', error);
        alert('Gagal upload gambar');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleColorChange = (key: string, value: string) => {
    onSettingsChange({
      ...settings,
      customization: {
        ...customization,
        [key]: value,
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
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Banner Hero
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-red-500 transition cursor-pointer"
              onClick={() => bannerInputRef.current?.click()}>
              {settings.heroImage ? (
                <div className="flex flex-col items-center gap-2">
                  <img src={settings.heroImage} alt="Banner" className="h-20 w-auto rounded" />
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:text-red-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSettingsChange({ ...settings, heroImage: '' });
                    }}>
                    Hapus
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <Upload className="w-6 h-6" />
                  <p className="text-sm">Klik untuk upload banner</p>
                </div>
              )}
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files && handleImageUpload(e.target.files[0], 'banner')}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Font Selection */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Pilih Font</h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {fontOptions.map((font) => (
            <button
              key={font.name}
              onClick={() => handleFontChange(font.name)}
              className={`p-4 rounded-lg border-2 transition text-center font-semibold ${
                customization.font === font.name
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              style={{ fontFamily: font.label }}>
              {font.label}
            </button>
          ))}
        </div>
      </div>

      {/* Color Customization */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Warna Tema</h3>

        <div className="space-y-6">
          {/* Color Presets */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Preset Warna</label>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {colorPresets.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => {
                    handleColorChange('primaryColor', preset.primary);
                    handleColorChange('accentColor', preset.accent);
                  }}
                  className={`p-4 rounded-lg border-2 transition ${
                    customization.primaryColor === preset.primary
                      ? 'border-gray-900 shadow-lg'
                      : 'border-gray-200 hover:border-gray-300'
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
                  <p className="text-sm font-medium text-gray-700">{preset.name}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Colors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Primary Color */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Warna Utama (Primary)
              </label>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={customization.primaryColor || '#dc2626'}
                  onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                  className="w-16 h-10 rounded cursor-pointer border border-gray-200"
                />
                <input
                  type="text"
                  value={customization.primaryColor || '#dc2626'}
                  onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  placeholder="#dc2626"
                />
              </div>
              <div
                className="w-full h-16 rounded-lg border-2 border-gray-200"
                style={{ backgroundColor: customization.primaryColor || '#dc2626' }}
              />
            </div>

            {/* Accent Color */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Warna Aksen (Accent)
              </label>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={customization.accentColor || '#f97316'}
                  onChange={(e) => handleColorChange('accentColor', e.target.value)}
                  className="w-16 h-10 rounded cursor-pointer border border-gray-200"
                />
                <input
                  type="text"
                  value={customization.accentColor || '#f97316'}
                  onChange={(e) => handleColorChange('accentColor', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  placeholder="#f97316"
                />
              </div>
              <div
                className="w-full h-16 rounded-lg border-2 border-gray-200"
                style={{ backgroundColor: customization.accentColor || '#f97316' }}
              />
            </div>

            {/* Text Color */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Warna Teks
              </label>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={customization.textColor || '#f4f4f5'}
                  onChange={(e) => handleColorChange('textColor', e.target.value)}
                  className="w-16 h-10 rounded cursor-pointer border border-gray-200"
                />
                <input
                  type="text"
                  value={customization.textColor || '#f4f4f5'}
                  onChange={(e) => handleColorChange('textColor', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  placeholder="#f4f4f5"
                />
              </div>
              <div
                className="w-full h-16 rounded-lg border-2 border-gray-200 flex items-center justify-center font-semibold"
                style={{ backgroundColor: customization.textColor || '#f4f4f5' }}>
                Sample Text
              </div>
            </div>

            {/* Background Color */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Warna Latar Belakang
              </label>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={customization.backgroundColor || '#000000'}
                  onChange={(e) => handleColorChange('backgroundColor', e.target.value)}
                  className="w-16 h-10 rounded cursor-pointer border border-gray-200"
                />
                <input
                  type="text"
                  value={customization.backgroundColor || '#000000'}
                  onChange={(e) => handleColorChange('backgroundColor', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  placeholder="#000000"
                />
              </div>
              <div
                className="w-full h-16 rounded-lg border-2 border-gray-200"
                style={{ backgroundColor: customization.backgroundColor || '#000000' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm p-6 border border-blue-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview Warna</h3>
        <div
          className="w-full rounded-lg p-8 text-center"
          style={{
            backgroundColor: customization.backgroundColor || '#000000',
          }}>
          <div
            className="inline-block px-6 py-3 rounded-lg font-bold text-lg mb-4"
            style={{
              backgroundColor: customization.primaryColor || '#dc2626',
              color: customization.textColor || '#f4f4f5',
            }}>
            Tombol Utama
          </div>
          <div
            className="inline-block ml-2 px-6 py-3 rounded-lg font-bold text-lg"
            style={{
              backgroundColor: customization.accentColor || '#f97316',
              color: customization.textColor || '#f4f4f5',
            }}>
            Tombol Aksen
          </div>
          <p
            className="mt-6 text-base"
            style={{
              color: customization.textColor || '#f4f4f5',
            }}>
            Ini adalah contoh teks dengan warna yang Anda pilih
          </p>
        </div>
      </div>
    </div>
  );
}
