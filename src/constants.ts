import type { ThemeColorPalette, ThemeMode } from './types';

export const MAX_MOTOR_IMAGES = 15;
export const MAX_HERO_IMAGES = 10;
export const MAX_PROMO_IMAGES = 5;
export const MAX_IMAGE_UPLOAD_BYTES = 100 * 1024 * 1024;
export const DEFAULT_SEO_TITLE = 'Dealer Motor Honda Bandung | Harga & Kredit';
export const DEFAULT_SEO_DESCRIPTION = 'Honda Bandung: dealer motor Honda di Gegerkalong. Cek harga OTR, simulasi kredit, pilihan DP dan tenor, lalu konsultasi melalui WhatsApp.';
export const DEFAULT_SEO_FOCUS_KEYWORD = 'Honda Bandung';
export const DEFAULT_SEO_KEYWORDS = 'promo honda bandung, kreditmotorhondabandung, Honda Wijaya Abadi Mulia, kredit motor Honda, harga motor Honda, simulasi kredit, cicilan motor, DP motor, Honda Beat, Honda Scoopy, Honda Vario, Honda PCX, Honda ADV, dealer motor Honda, Honda Bandung, Gegerkalong, Wijaya Abadi Mulia, Honda Wijaya Abadi, promo motor honda bandung, cicilan honda bandung, kredit motor bandung, dealer motor Honda Bandung, kredit motor Honda Bandung, harga motor Honda Bandung, simulasi cicilan Honda, pembiayaan motor Honda Bandung, promo motor Honda Bandung, harga Honda Bandung, kredit Honda Bandung, motor honda bandung, harga OTR Honda Bandung, cicilan Honda Bandung, DP Honda Bandung, sales Honda Bandung, showroom Honda Bandung, dealer Honda Gegerkalong, dealer Honda Bandung resmi, dealer motor Bandung, honda wijaya abadi mulia motor, kredit motor honda bandung, honda bandung promo, bandung motor honda, honda gegerkalong, Honda Wijaya Abadi Mulia Motor, dealer honda bandung, dealer resmi honda bandung, honda bandung resmi, promo motor honda, promo honda bea, harga honda beat bandung, honda beat bandung, harga honda scoopy bandung, honda scoopy bandung, harga honda vario bandung, honda vario bandung, harga honda pcx bandung, honda pcx bandung, harga honda adv bandung, honda adv bandung, kredit honda bandung, cicilan honda bandung, simulasi kredit honda bandung, harga sepeda motor honda bandung, dealer sepeda motor honda bandung, showroom honda bandung, agen motor honda bandung, promo cicilan motor honda bandung';
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
