import type { CatalogAnimation } from './catalogAnimation';

export interface MotorSpec {
  id?: string;
  name: string;
}

export interface Motor {
  id: string;
  name: string;
  category: string;
  price: string;
  numericPrice?: number;
  image: string;
  images?: string[];
  specs: string[];
  description: string;
  created_at?: string;
  updated_at?: string;
  interest_count?: number;
  is_bestseller?: boolean;
}

export interface FIFPriceListModel {
  price: number;
  options: Record<string, number[]>;
}

export interface FIFPriceList {
  source: string;
  updatedAt?: string;
  tenors: number[];
  models: Record<string, FIFPriceListModel>;
}

export type PromoTemplate = 'classic' | 'showcase' | 'compact';

export interface Promo {
  id: string;
  title: string;
  description: string;
  terms: string;
  badge?: string;
  discountValue?: string;
  images?: string[];
  promoAnimation?: CatalogAnimation;
  promoTemplate?: PromoTemplate;
  created_at?: string;
}

export interface Testimonial {
  id: string;
  name: string;
  motor: string;
  rating: number;
  comment: string;
  email?: string;
  phone?: string;
  approved?: boolean;
  date?: string;
  created_at?: string;
}

export interface ManifestoItem {
  id: string;
  number: string;
  title: string;
  description: string;
  created_at?: string;
}

export type WebsiteTemplate = 'classic' | 'premium' | 'minimal' | 'luxury' | 'sport' | 'showroom' | 'signature' | 'urban' | 'mulia-cerah' | 'honda-wijaya' | 'wijaya-cool';
export type HeroAlignment = 'left' | 'center' | 'right';
export type SiteFont = 'jakarta' | 'serif' | 'mono' | 'system' | 'outfit' | 'inter' | 'montserrat';
export type ThemeMode = 'light' | 'dark';
export type CardRadius = 'sharp' | 'soft' | 'round';
export type HeroAnimation = CatalogAnimation;
export type { CatalogAnimation } from './catalogAnimation';

export interface ThemeColorPalette {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  panelColor?: string;
  cardColor?: string;
  elevatedColor?: string;
  borderColor?: string;
  textColor?: string;
  mutedColor?: string;
  font?: SiteFont;
  heroTextColor?: string;
  heroTitleHighlightColor?: string;
}

export interface WebsiteCustomization {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  panelColor?: string;
  cardColor?: string;
  elevatedColor?: string;
  borderColor?: string;
  textColor?: string;
  mutedColor?: string;
  font?: SiteFont;
  heroAlignment?: HeroAlignment;
  cardRadius?: CardRadius;
  heroTextColor?: string;
  heroTextFont?: string;
  heroBadgeFontSize?: number;
  heroTitleFontSize?: number;
  heroHighlightFontSize?: number;
  heroHeadlineGap?: number;
  heroSubtitleFontSize?: number;
  heroCaptionFontSize?: number;
  heroTitleHighlightColor?: string;
  heroOverlayColor?: string;
  heroOverlayOpacity?: number;
  themeBackgroundAnimation?: boolean;
  colorPalettes?: Partial<Record<ThemeMode, ThemeColorPalette>>;
  templatePaletteBackup?: Partial<Record<ThemeMode, ThemeColorPalette>>;
}

export interface DealerSettings {
  id: string;
  name: string;
  tagline: string;
  phone: string;
  address: string;
  email: string;
  workingHours: string;
  logo: string;
  heroImage: string;
  heroImages?: string[];
  heroTitle: string;
  heroMainTitle?: string;
  heroTitleHighlight?: string;
  heroSubtitle: string;
  heroBadge?: string;
  heroCaption?: string;
  heroAnimation?: HeroAnimation;
  heroAnimationSpeed?: number;
  footerText: string;
  seoTitle?: string;
  seoDescription?: string;
  seoFocusKeyword?: string;
  seoKeywords?: string;
  seoCanonicalUrl?: string;
  seoRobots?: string;
  websiteTemplate?: WebsiteTemplate;
  catalogAnimation?: CatalogAnimation;
  catalogAnimationSpeed?: number;
  customization?: WebsiteCustomization;
  updated_at?: string;
}

export interface AdminSession {
  id: string;
  username: string;
  role: string;
  createdAt?: string;
}

export interface AdminUser {
  id: string;
  username: string;
  role: string;
  created_at?: string;
  updated_at?: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  resource: string;
  details: string;
  created_at: string;
}

export interface LeadInterest {
  id: string;
  motor_id?: string;
  motor_name?: string;
  customer_name: string;
  phone: string;
  payment_method?: 'Cash' | 'Kredit';
  dp_estimate?: string;
  note?: string;
  status: 'Baru' | 'Dihubungi' | 'Selesai' | 'Ditolak';
  created_at: string;
}

export interface CreditCalculation {
  price: number;
  dpPercent: number;
  dpAmount: number;
  loanAmount: number;
  tenorMonths: number;
  interestRateAnnual: number;
  monthlyInstallment: number;
  totalPayment: number;
}
