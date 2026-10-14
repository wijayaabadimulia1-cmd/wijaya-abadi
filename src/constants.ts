import type { ThemeColorPalette, ThemeMode } from './types';

export const MAX_MOTOR_IMAGES = 15;
export const MAX_HERO_IMAGES = 15;
export const MAX_PROMO_IMAGES = 5;
export const MAX_IMAGE_UPLOAD_BYTES = 100 * 1024 * 1024;
export const DEFAULT_SEO_TITLE = 'Dealer Motor Honda Bandung | Harga & Kredit';
export const DEFAULT_SEO_DESCRIPTION = 'Dealer motor Honda di Bandung: cek katalog terbaru, harga OTR, promo, simulasi kredit, DP dan tenor, serta konsultasi WhatsApp dengan cepat dan transparan.';
export const DEFAULT_SEO_FOCUS_KEYWORD = 'Honda Bandung';
export const DEFAULT_SEO_KEYWORDS = 'dealer motor Honda Bandung, harga motor Honda Bandung, kredit motor Honda Bandung, simulasi kredit Honda, promo motor Honda Bandung, DP motor Honda, tenor motor Honda, Honda Beat Bandung, Honda Scoopy Bandung, Honda Vario Bandung, Honda PCX Bandung, Honda ADV Bandung, dealer Honda Bandung, Honda Wijaya Abadi Mulia Motor';
export const DEFAULT_SEO_CANONICAL_URL = 'https://kreditmotorhonda.tech/';
export const DEFAULT_SEO_ROBOTS = 'index, follow';

export const HONDA_WIJAYA_COLOR_PALETTES: Record<ThemeMode, ThemeColorPalette> = {
	light: {
		primaryColor: '#e60012',
		secondaryColor: '#38bdf8',
		accentColor: '#ff2638',
		backgroundColor: '#f7f7f8',
		panelColor: '#ffffff',
		cardColor: '#ffffff',
		elevatedColor: '#ffffff',
		borderColor: '#e4e4e7',
		textColor: '#171717',
		mutedColor: '#52525b',
		heroTextColor: '#171717',
		heroTitleHighlightColor: '#e60012',
	},
	dark: {
		primaryColor: '#ff2638',
		secondaryColor: '#38bdf8',
		accentColor: '#ff3548',
		backgroundColor: '#25282d',
		panelColor: '#34383f',
		cardColor: '#3d424a',
		elevatedColor: '#474d56',
		borderColor: '#59616b',
		textColor: '#ffffff',
		mutedColor: '#e0e3e8',
		heroTextColor: '#ffffff',
		heroTitleHighlightColor: '#ff3548',
	},
};
