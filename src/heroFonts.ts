export const HERO_FONT_OPTIONS = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Source Sans 3',
  'Nunito Sans',
  'Nunito',
  'Raleway',
  'PT Sans',
  'Lora',
  'Merriweather',
  'Playfair Display',
  'Oswald',
  'Roboto Condensed',
  'Ubuntu',
  'Rubik',
  'Work Sans',
  'DM Sans',
  'Manrope',
  'Figtree',
  'Plus Jakarta Sans',
  'Outfit',
  'Urbanist',
  'Space Grotesk',
  'Space Mono',
  'IBM Plex Sans',
  'IBM Plex Mono',
  'Source Code Pro',
  'Inconsolata',
  'Fira Sans',
  'Fira Code',
  'Noto Sans',
  'Noto Serif',
  'Noto Sans Display',
  'Noto Serif Display',
  'Libre Franklin',
  'Libre Baskerville',
  'Crimson Text',
  'Cormorant Garamond',
  'EB Garamond',
  'Bitter',
  'Cabin',
  'Karla',
  'Mulish',
  'Heebo',
  'Assistant',
  'Hind',
  'Arimo',
  'Archivo',
  'Archivo Black',
  'Barlow',
  'Barlow Condensed',
  'Exo 2',
  'Titillium Web',
  'Teko',
  'Rajdhani',
  'Kanit',
  'Sora',
  'Lexend',
  'Albert Sans',
  'Onest',
  'Red Hat Display',
  'Red Hat Text',
  'Public Sans',
  'Jost',
  'Josefin Sans',
  'Quicksand',
  'Comfortaa',
  'Dosis',
  'Varela Round',
  'Signika',
  'Catamaran',
  'Asap',
  'Asap Condensed',
  'Merriweather Sans',
  'Source Serif 4',
  'Newsreader',
  'Spectral',
  'Domine',
  'Cardo',
  'Alegreya',
  'Alegreya Sans',
  'IBM Plex Serif',
  'Vollkorn',
  'Arvo',
  'Zilla Slab',
  'Roboto Slab',
  'Slabo 27px',
  'PT Serif',
  'PT Sans Caption',
  'Bricolage Grotesque',
  'Epilogue',
  'Commissioner',
  'Fraunces',
  'Instrument Sans',
  'Instrument Serif',
  'DM Serif Display',
  'Gabarito',
] as const;

export type HeroFont = (typeof HERO_FONT_OPTIONS)[number];

const LEGACY_HERO_FONT_FAMILIES: Record<string, string> = {
  jakarta: 'Plus Jakarta Sans',
  serif: 'Georgia',
  mono: 'monospace',
  system: 'system-ui',
  outfit: 'Outfit',
  inter: 'Inter',
  montserrat: 'Montserrat',
};

export function resolveHeroFont(value?: string): string {
  const family = LEGACY_HERO_FONT_FAMILIES[value || 'jakarta'] || value || 'Plus Jakarta Sans';
  return family === 'Georgia' || family === 'monospace' || family === 'system-ui'
    ? family
    : HERO_FONT_OPTIONS.includes(family as HeroFont) ? family : 'Plus Jakarta Sans';
}

export function getHeroFontStack(value?: string): string {
  const family = resolveHeroFont(value);
  if (family === 'Georgia') return 'Georgia, serif';
  if (family === 'monospace') return 'monospace';
  if (family === 'system-ui') return 'system-ui, sans-serif';
  return `"${family}", sans-serif`;
}

export function loadHeroFont(value?: string): void {
  if (typeof document === 'undefined') return;
  const family = resolveHeroFont(value);
  if (family === 'Georgia' || family === 'monospace' || family === 'system-ui') return;

  const id = `google-font-${family.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  if (document.getElementById(id)) return;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=optional`;
  document.head.appendChild(link);
}