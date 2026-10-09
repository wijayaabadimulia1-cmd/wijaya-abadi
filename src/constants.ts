import type { ThemeColorPalette, ThemeMode } from './types';

export const MAX_MOTOR_IMAGES = 15;
export const MAX_HERO_IMAGES = 10;
export const MAX_PROMO_IMAGES = 5;
export const MAX_IMAGE_UPLOAD_BYTES = 100 * 1024 * 1024;
export const DEFAULT_SEO_TITLE = 'Dealer Motor Honda Bandung | Harga & Kredit';
export const DEFAULT_SEO_DESCRIPTION = 'Honda Bandung: dealer motor Honda di Gegerkalong. Cek harga OTR, simulasi kredit, pilihan DP dan tenor, lalu konsultasi melalui WhatsApp.';
export const DEFAULT_SEO_FOCUS_KEYWORD = 'Honda Bandung';
export const DEFAULT_SEO_KEYWORDS = 'dealer motor Honda Bandung, kredit motor Honda Bandung, harga motor Honda Bandung, simulasi cicilan Honda, Honda Beat, Scoopy, Vario, PCX, ADV';
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
		backgroundColor: '#17191d',
		panelColor: '#22252a',
		cardColor: '#2b2f36',
		elevatedColor: '#353a42',
		borderColor: '#41464f',
		textColor: '#ffffff',
		mutedColor: '#d1d5db',
		heroTextColor: '#ffffff',
		heroTitleHighlightColor: '#ff3548',
	},
};
