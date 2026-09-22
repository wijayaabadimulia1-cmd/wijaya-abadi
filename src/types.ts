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

export interface Promo {
  id: string;
  title: string;
  description: string;
  terms: string;
  badge?: string;
  discountValue?: string;
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

export type WebsiteTemplate = 'classic' | 'premium' | 'minimal' | 'luxury' | 'sport';
export type HeroAlignment = 'left' | 'center' | 'right';
export type SiteFont = 'jakarta' | 'serif' | 'mono' | 'system';
export type CardRadius = 'sharp' | 'soft' | 'round';

export interface WebsiteCustomization {
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  panelColor?: string;
  textColor?: string;
  mutedColor?: string;
  font?: SiteFont;
  heroAlignment?: HeroAlignment;
  cardRadius?: CardRadius;
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
  heroTitle: string;
  heroTitleHighlight?: string;
  heroSubtitle: string;
  footerText: string;
  websiteTemplate?: WebsiteTemplate;
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
