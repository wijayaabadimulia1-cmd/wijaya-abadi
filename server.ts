import express from 'express';
import compression from 'compression';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { execFile } from 'node:child_process';
import { resolve4 } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { promisify } from 'node:util';
import { createServer as createViteServer } from 'vite';
import * as XLSX from 'xlsx';
import { MAX_IMAGE_UPLOAD_BYTES, MAX_MOTOR_IMAGES, MAX_PROMO_IMAGES } from './src/constants';
import { DEFAULT_CATALOG_ANIMATION, isCatalogAnimation, normalizeCatalogAnimationSpeed } from './src/catalogAnimation';
import { findSeoLandingPost, getSeoLandingPosts, getSeoLandingPostPath } from './src/utils/seoPosts';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const SALES_COUNTER_ROOT_DOMAINS = new Set(['kreditmotorhonda.id', 'kreditmotorhonda.tech', 'solusikreditmotor.cloud']);
const DEFAULT_DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_DIR = path.resolve(process.env.DATA_DIR || DEFAULT_DATA_DIR);
const FALLBACK_DB_FILE = path.join(DEFAULT_DATA_DIR, 'db.json');
const PERSISTENT_DB_FILE = path.join(DATA_DIR, 'db.json');
const DB_FILE = fs.existsSync(PERSISTENT_DB_FILE)
  ? PERSISTENT_DB_FILE
  : FALLBACK_DB_FILE;
const OWNER_ANALYTICS_ROOT_DIR = path.resolve(process.env.OWNER_ANALYTICS_ROOT_DIR || path.dirname(DATA_DIR));
const OWNER_ANALYTICS_SITE_DB_FILES: Record<string, string> = {
  'wijaya.kreditmotorhonda.tech': path.resolve(process.env.OWNER_ANALYTICS_WIJAYA_DB_FILE || path.join(OWNER_ANALYTICS_ROOT_DIR, 'sites', 'wijaya', 'data', 'db.json')),
  'solusikreditmotor.cloud': path.resolve(process.env.OWNER_ANALYTICS_SOLUSI_DB_FILE || path.join(OWNER_ANALYTICS_ROOT_DIR, 'sites', 'solusi', 'data', 'db.json')),
};
const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), 'public', 'uploads'));
const CATALOG_API_URL = String(process.env.CATALOG_API_URL || '').trim().replace(/\/+$/, '');
const CATALOG_SERVICE_TOKEN = String(process.env.CATALOG_SERVICE_TOKEN || '');
const CATALOG_OWNER_DATA_FILE = (() => {
  const configuredPath = path.resolve(process.env.CATALOG_OWNER_DATA_FILE || DB_FILE);
  if (fs.existsSync(configuredPath)) return configuredPath;
  if (fs.existsSync(FALLBACK_DB_FILE)) return FALLBACK_DB_FILE;
  return configuredPath;
})();
const execFileAsync = promisify(execFile);
const DEFAULT_FIF_PRICE_LIST_FILE = path.join(process.cwd(), 'src', 'data', 'fifPriceList.json');
const FIF_TENORS = [11, 17, 23, 29, 35];
const FIF_DP_PERCENTAGES = [10, 13, 15, 20, 25];
const sessions = new Map<string, { id: string; username: string; role: string; createdAt: string }>();

// Ensure directories exist
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function readJsonDbFile(filePath: string) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8').trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (err) {
    console.error(`Error reading db file ${filePath}:`, err);
  }
  return null;
}

function readDb() {
  for (const candidatePath of Array.from(
    new Set(
      [
        CATALOG_OWNER_DATA_FILE,
        PERSISTENT_DB_FILE,
        FALLBACK_DB_FILE,
        DB_FILE,
      ].filter((value): value is string => Boolean(value))
    )
  )) {
    const parsed = readJsonDbFile(candidatePath);
    if (parsed) return parsed;
  }
  return {
    settings: {},
    motors: [],
    promos: [],
    testimonials: [],
    manifesto: [],
    interests: [],
    analytics: { totalViews: 0, simulatorUsed: 0, compareUsed: 0 }
  };
}

function readSiteDb() {
  return readJsonDbFile(PERSISTENT_DB_FILE) || {
    settings: {},
    articles: [],
    auditLogs: [],
  };
}

function writeSiteDb(data: any) {
  try {
    fs.mkdirSync(path.dirname(PERSISTENT_DB_FILE), { recursive: true });
    fs.writeFileSync(PERSISTENT_DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing site database:', error);
    return false;
  }
}

function getArticleSiteKey(hostname: string, db: any) {
  const host = normalizeAdminHost(hostname);
  if (['localhost', '127.0.0.1', '::1'].includes(host)) return '';

  try {
    const canonicalHost = normalizeAdminHost(new URL(getSiteOrigin(db.settings || {})).hostname);
    return host === canonicalHost ? '' : host;
  } catch {
    return host;
  }
}

function getSiteArticles(db: any, hostname: string) {
  const siteKey = getArticleSiteKey(hostname, db);
  if (!siteKey) return Array.isArray(db.articles) ? db.articles : [];

  const site = Array.isArray(db.articleSites)
    ? db.articleSites.find((item: any) => item.host === siteKey)
    : undefined;
  return Array.isArray(site?.articles) ? site.articles : [];
}

function setSiteArticles(db: any, hostname: string, articles: any[]) {
  const siteKey = getArticleSiteKey(hostname, db);
  if (!siteKey) {
    db.articles = articles;
    return;
  }

  const sites = Array.isArray(db.articleSites) ? db.articleSites : [];
  const index = sites.findIndex((item: any) => item.host === siteKey);
  if (index < 0) sites.push({ host: siteKey, articles });
  else sites[index] = { ...sites[index], articles };
  db.articleSites = sites;
}

function readCatalogDb() {
  const ownerDb = readJsonDbFile(CATALOG_OWNER_DATA_FILE) || readJsonDbFile(PERSISTENT_DB_FILE) || readJsonDbFile(FALLBACK_DB_FILE) || readJsonDbFile(DB_FILE);
  const primaryDb = readDb();
  const baseDb = ownerDb && typeof ownerDb === 'object' ? ownerDb : primaryDb;

  return {
    ...primaryDb,
    ...baseDb,
    settings: {
      ...(primaryDb.settings || {}),
      ...(baseDb.settings || {}),
    },
    motors: Array.isArray(ownerDb?.motors) && ownerDb.motors.length > 0
      ? ownerDb.motors
      : Array.isArray(baseDb.motors) && baseDb.motors.length > 0
        ? baseDb.motors
        : Array.isArray(primaryDb.motors)
          ? primaryDb.motors
          : [],
    promos: Array.isArray(ownerDb?.promos) && ownerDb.promos.length > 0
      ? ownerDb.promos
      : Array.isArray(baseDb.promos) && baseDb.promos.length > 0
        ? baseDb.promos
        : Array.isArray(primaryDb.promos)
          ? primaryDb.promos
          : [],
    testimonials: Array.isArray(ownerDb?.testimonials) && ownerDb.testimonials.length > 0
      ? ownerDb.testimonials
      : Array.isArray(baseDb.testimonials) && baseDb.testimonials.length > 0
        ? baseDb.testimonials
        : Array.isArray(primaryDb.testimonials)
          ? primaryDb.testimonials
          : [],
    manifesto: Array.isArray(ownerDb?.manifesto) && ownerDb.manifesto.length > 0
      ? ownerDb.manifesto
      : Array.isArray(baseDb.manifesto) && baseDb.manifesto.length > 0
        ? baseDb.manifesto
        : Array.isArray(primaryDb.manifesto)
          ? primaryDb.manifesto
          : [],
    fifPriceList: ownerDb?.fifPriceList ?? baseDb.fifPriceList ?? primaryDb.fifPriceList ?? currentFifPriceList(primaryDb),
  };
}

function isSharedCatalogPath(pathname: string) {
  return /^\/api\/(?:motors(?:\/|$)|fif-price-list(?:\/|$)|promos\/global(?:\/|$))/.test(pathname.split('?')[0]);
}

function isSharedCatalogRequest(req: express.Request) {
  const pathname = req.originalUrl.split('?')[0];
  return isSharedCatalogPath(pathname)
    || (pathname === '/api/upload' && req.header('x-catalog-upload') === 'true');
}

function isLoopbackRequest(req: express.Request) {
  const address = req.socket.remoteAddress;
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function hasValidCatalogServiceToken(req: express.Request) {
  const providedToken = req.header('x-catalog-service-token') || '';
  if (!CATALOG_SERVICE_TOKEN || !providedToken || !isLoopbackRequest(req)) return false;
  const expected = Buffer.from(CATALOG_SERVICE_TOKEN);
  const provided = Buffer.from(providedToken);
  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
}

function getJakartaDateParts(timestamp: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: `${values.hour}:00`,
  };
}

function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function buildDateKeys(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const dates: string[] = [];
  for (const cursor = new Date(start); cursor <= end && dates.length < 3661; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
}

function escapeHtmlAttribute(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}

function createPublicInitialData(db: any, hostname?: string) {
  const hostPage = hostname ? getSeoPageForHost(db.settings || {}, hostname) : undefined;
  const siteArticles = getSiteArticles(readSiteDb(), hostname || '');
  const testimonials = (Array.isArray(db.testimonials) ? db.testimonials : [])
    .filter((item: any) => item.approved !== false)
    .map((item: any) => ({
      id: item.id,
      name: item.name,
      motor: item.motor,
      rating: item.rating,
      comment: item.comment,
      approved: true,
      date: item.date,
      created_at: item.created_at,
    }));

  return {
    motors: Array.isArray(db.motors) ? db.motors : [],
    promos: hostPage
      ? Array.isArray(hostPage.promos) ? hostPage.promos : []
      : Array.isArray(db.promos) ? db.promos : [],
    articles: (Array.isArray(siteArticles) ? siteArticles : [])
      .filter((article: any) => article.published === true)
      .sort((left: any, right: any) => String(right.created_at || '').localeCompare(String(left.created_at || ''))),
    testimonials,
    manifesto: Array.isArray(db.manifesto) ? db.manifesto : [],
    fifPriceList: currentFifPriceList(db),
  };
}

async function createSsrInitialData(db: any, hostname?: string) {
  if (!CATALOG_API_URL) return createPublicInitialData(readCatalogDb(), hostname);

  const catalogApiUrl = `http://127.0.0.1:${PORT}`;
  const options = { cache: 'no-store' as RequestCache, signal: AbortSignal.timeout(5000) };

  try {
    const [motorsResponse, priceListResponse] = await Promise.all([
      fetch(`${catalogApiUrl}/api/motors`, options),
      fetch(`${catalogApiUrl}/api/fif-price-list`, options),
    ]);
    if (!motorsResponse.ok) throw new Error(`Catalog API returned HTTP ${motorsResponse.status}`);

    const motors = await motorsResponse.json();
    if (!Array.isArray(motors)) throw new Error('Catalog API returned invalid motor data');

    const catalogDb = { ...db, motors };
    if (priceListResponse.ok) catalogDb.fifPriceList = await priceListResponse.json();
    return createPublicInitialData(catalogDb, hostname);
  } catch (error) {
    console.error('Shared catalog SSR fetch failed:', error);
    return createPublicInitialData(readCatalogDb(), hostname);
  }
}


function updateSeoJsonLdForPage(
  jsonText: string,
  pathname: string,
  canonical: string,
  title: string,
  description: string
): string {
  try {
    const schema = JSON.parse(jsonText);
    const graph = Array.isArray(schema["@graph"]) ? schema["@graph"] : null;
    if (!graph) return jsonText;

    const pageUrl = new URL(canonical).href;
    const origin = new URL(pageUrl).origin;
    const path = new URL(pageUrl).pathname;
    const pageId = `${pageUrl}#webpage`;
    const breadcrumbId = `${pageUrl}#breadcrumb`;

    const webPage = graph.find((item: any) => item["@type"] === "WebPage");
    const breadcrumb = graph.find((item: any) => item["@type"] === "BreadcrumbList");

    if (webPage) {
      webPage["@id"] = pageId;
      webPage.name = title;
      webPage.description = description;
      webPage.url = pageUrl;
      webPage.breadcrumb = { "@id": breadcrumbId };
      if (webPage.isPartOf) {
        webPage.isPartOf["@id"] = `${origin}/#website`;
      }
      if (webPage.about) {
        webPage.about["@id"] = `${origin}/#dealer`;
      }
    }

    if (breadcrumb) {
      breadcrumb["@id"] = breadcrumbId;
      const items: any[] = [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Beranda",
          "item": `${origin}/`
        }
      ];

      if (path !== "/") {
        const segment = path.replace(/^\/+|\/+$/g, "").split("/").pop() || "";
        const label = title.split(/[|–—]/)[0].trim() || segment;
        items.push({
          "@type": "ListItem",
          "position": 2,
          "name": label,
          "item": pageUrl
        });
      }

      breadcrumb.itemListElement = items;
    }

    return JSON.stringify(schema, null, 2);
  } catch {
    return jsonText;
  }
}

function getGoogleTrackingScript(hostname = '') {
  const host = normalizeAnalyticsHost(hostname);
  const consentInitialization = `<script>window.dataLayer=window.dataLayer||[];function gtag(){window.dataLayer.push(arguments);}gtag('consent','default',{'ad_user_data':'denied','ad_personalization':'denied','ad_storage':'denied','analytics_storage':'denied','wait_for_update':500});gtag('js',new Date());</script>`;
  if (host === 'kreditmotorhonda.id' || host.endsWith('.kreditmotorhonda.id')) {
    return `${consentInitialization}<script async src="https://www.googletagmanager.com/gtm.js?id=GTM-W6NNC8TC"></script>`;
  }
  if (host === 'solusikreditmotor.cloud' || host.endsWith('.solusikreditmotor.cloud')) {
    return `${consentInitialization}<script async src="https://www.googletagmanager.com/gtm.js?id=GTM-W7PC28PJ"></script>`;
  }
  if (host === 'kreditmotorhonda.tech' || host.endsWith('.kreditmotorhonda.tech')) {
    return `${consentInitialization}<script>gtag('config','G-9PJGPJZD6B');</script><script async src="https://www.googletagmanager.com/gtag/js?id=G-9PJGPJZD6B"></script>`;
  }
  return '';
}

function renderSeoMetadata(html: string, settings: any = {}, pathname = '/', initialData?: unknown, hostname = '') {
  const landingSeo: Record<string, { title: string; description: string; keywords: string }> = {
    '/dealer-honda-bandung': {
      title: 'Dealer Honda Bandung | Promo & Kredit Terbaik',
      description: 'Temukan dealer Honda Bandung dengan katalog terbaru, simulasi kredit, dan promo untuk kebutuhan harian maupun keluarga.',
      keywords: 'dealer Honda Bandung, dealer motor Honda Bandung, dealer Honda Bandung resmi',
    },
    '/kredit-motor-honda-bandung': {
      title: 'Kredit Motor Honda Bandung | DP & Tenor Fleksibel',
      description: 'Cek simulasi kredit motor Honda Bandung dengan pilihan tenor dan estimasi angsuran yang sesuai kebutuhan Anda.',
      keywords: 'kredit motor Honda Bandung, cicilan motor Honda, DP motor Honda Bandung',
    },
    '/simulasi-kredit-honda': {
      title: 'Simulasi Kredit Honda | Hitung DP & Cicilan',
      description: 'Hitung estimasi DP dan cicilan motor Honda, lalu bandingkan tenor sebelum berkonsultasi dengan dealer.',
      keywords: 'simulasi kredit Honda, hitung cicilan motor Honda, simulasi DP motor',
    },
    '/harga-motor-honda-bandung': {
      title: 'Harga Motor Honda Bandung | Harga & Promo Terbaru',
      description: 'Lihat pilihan motor Honda di Bandung dan tanyakan harga OTR, ketersediaan, serta promo terbaru.',
      keywords: 'harga motor Honda Bandung, harga OTR Honda Bandung, promo motor Honda',
    },
    '/honda-beat-bandung': {
      title: 'Honda Beat Bandung | Harga & Simulasi Kredit',
      description: 'Cari Honda Beat di Bandung? Lihat pilihan unit, cek harga terbaru, dan konsultasikan simulasi kredit dengan sales Honda Wijaya Abadi.',
      keywords: 'Honda Beat Bandung, harga Honda Beat, kredit Honda Beat Bandung',
    },
    '/honda-scoopy-bandung': {
      title: 'Honda Scoopy Bandung | Harga & Simulasi Kredit',
      description: 'Temukan Honda Scoopy di Bandung. Konsultasikan pilihan varian, harga terbaru, promo, dan simulasi kredit melalui WhatsApp.',
      keywords: 'Honda Scoopy Bandung, harga Honda Scoopy, kredit Honda Scoopy Bandung',
    },
    '/honda-vario-bandung': {
      title: 'Honda Vario Bandung | Spesifikasi & Promo Terbaru',
      description: 'Cek Honda Vario Bandung dengan spesifikasi, harga, dan simulasi kredit terbaru untuk aktivitas harian.',
      keywords: 'Honda Vario Bandung, harga Honda Vario, kredit Honda Vario Bandung',
    },
    '/honda-pcx-bandung': {
      title: 'Honda PCX Bandung | Harga & Simulasi Kredit',
      description: 'Lihat pilihan Honda PCX di Bandung dan konsultasikan harga, ketersediaan unit, promo, serta simulasi kredit terbaru.',
      keywords: 'Honda PCX Bandung, harga Honda PCX, kredit Honda PCX Bandung',
    },
    '/honda-adv-bandung': {
      title: 'Honda ADV Bandung | Harga & Simulasi Kredit',
      description: 'Cari Honda ADV di Bandung? Tanyakan ketersediaan unit, harga terbaru, promo, dan pilihan simulasi kredit kepada sales kami.',
      keywords: 'Honda ADV Bandung, harga Honda ADV, kredit Honda ADV Bandung',
    },
  };
  const hostPage = getSeoPageForHost(settings, hostname);
  const hostPost = hostPage ? findSeoLandingPost(hostPage, pathname) : undefined;
  const articlePath = pathname.match(/^\/artikel\/([^/]+)\/?$/);
  let articleSlug = '';
  try {
    articleSlug = articlePath ? decodeURIComponent(articlePath[1]) : '';
  } catch {
    articleSlug = '';
  }
  const article = articleSlug
    ? (Array.isArray((initialData as any)?.articles) ? (initialData as any).articles : []).find((item: any) => item.slug === articleSlug && item.published === true)
    : undefined;
  const page = landingSeo[pathname.replace(/\/+$/, '') || '/'];
  const pageSettings = getSettingsForSeoPage(settings, hostPage);
  const isHostPost = Boolean(hostPost && hostPage && hostPost.id !== hostPage.id);
  const title = String(article
    ? `${article.title} | ${pageSettings.name || 'Honda Wijaya Abadi'}`
    : isHostPost ? hostPost?.title : hostPage?.seoTitle || hostPage?.title || page?.title || pageSettings.seoTitle || 'Dealer Motor Honda Bandung | Harga & Kredit').trim();
  const description = String(article
    ? article.excerpt || article.content.trim().slice(0, 160)
    : isHostPost ? hostPost?.content.trim().slice(0, 160) : hostPage?.seoDescription || page?.description || pageSettings.seoDescription || 'Dealer motor Honda di Bandung: cek katalog terbaru, harga OTR, promo, simulasi kredit, DP dan tenor, serta konsultasi WhatsApp dengan cepat dan transparan.').trim();
  const keywords = String(article
    ? [article.title, article.category, pageSettings.seoKeywords].filter(Boolean).join(', ')
    : hostPage?.seoKeywords || page?.keywords || pageSettings.seoKeywords || 'dealer motor Honda Bandung, harga motor Honda Bandung, kredit motor Honda Bandung, simulasi kredit Honda, promo motor Honda Bandung, DP motor Honda, tenor motor Honda, Honda Beat Bandung, Honda Scoopy Bandung, Honda Vario Bandung, Honda PCX Bandung, Honda ADV Bandung, dealer Honda Bandung, Honda Wijaya Abadi Mulia Motor').trim();
  const normalizedHostname = normalizeAnalyticsHost(hostname);
  const isRootSiteHost = SALES_COUNTER_ROOT_DOMAINS.has(normalizedHostname)
    || normalizedHostname === 'wijaya.kreditmotorhonda.tech';
  const siteOrigin = hostPage
    ? getSeoPageOrigin(hostPage)
    : isRootSiteHost
      ? `https://${normalizedHostname}`
      : getSiteOrigin(pageSettings);
  const articleOrigin = hostname ? `https://${String(hostname).toLowerCase().replace(/:\d+$/, '').replace(/^www\./, '')}` : siteOrigin;
  const logoValue = String(pageSettings.logo || '/uploads/logo.jpeg').trim();
  const logoUrl = /^https?:\/\//i.test(logoValue)
    ? logoValue
    : `${siteOrigin}${logoValue.startsWith('/') ? '' : '/'}${logoValue}`;
  const canonical = article
    ? `${articleOrigin}/artikel/${encodeURIComponent(article.slug)}/`
    : hostPage
    ? `${siteOrigin}${hostPost ? getSeoLandingPostPath(hostPage, hostPost) : '/'}`
    : page
    ? `${siteOrigin}${pathname.replace(/\/+$/, '') || '/'}`
    : String(isRootSiteHost ? `${siteOrigin}/` : pageSettings.seoCanonicalUrl || `${siteOrigin}/`).trim();
  const robots = hostPage && hostPage.sslStatus !== 'active'
    ? 'noindex, follow'
    : String(hostPage?.seoRobots || pageSettings.seoRobots || 'index, follow').trim();
  const escape = escapeHtmlAttribute;
  const googleTrackingScript = getGoogleTrackingScript(hostname);
  const initialSettings = JSON.stringify(publicSettings(pageSettings)).replace(/</g, '\\u003c');
  const initialPublicData = JSON.stringify(initialData).replace(/</g, '\\u003c');
  const heroImagePreload = settings.websiteTemplate === 'wijaya-cool'
    ? '<link rel="preload" as="image" href="/images/wijaya-cool-bandung-landscape-mobile.webp" media="(max-width: 640px)" fetchpriority="high"><link rel="preload" as="image" href="/images/wijaya-cool-bandung-landscape.webp" media="(min-width: 641px)" fetchpriority="high">'
    : '';
  const articleImages = article
    ? (Array.isArray(article.images) && article.images.length ? article.images : article.image ? [article.image] : [])
        .map((image: string) => /^https?:\/\//i.test(image) ? image : `${articleOrigin}${image.startsWith('/') ? '' : '/'}${image}`)
    : [];
  const articleStructuredData = article
    ? `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        description,
        image: articleImages.length ? articleImages : undefined,
        datePublished: article.created_at,
        dateModified: article.updated_at || article.created_at,
        author: { '@type': 'Person', name: article.author || pageSettings.name },
        publisher: { '@type': 'Organization', name: pageSettings.name || 'Honda Wijaya Abadi' },
        mainEntityOfPage: canonical,
      }).replace(/</g, '\\u003c')}</script>`
    : '';

  const normalizedSeoPath = pathname.replace(/\/+$/, '') || '/';
  const fallbackHeading = article?.title || hostPost?.title || hostPage?.seoTitle || hostPage?.title || (page
    ? page.title.split(/[|–—]/)[0].trim()
    : [
        String(pageSettings.heroMainTitle || '').trim(),
        String(pageSettings.heroTitleHighlight || '').trim(),
      ].filter(Boolean).join(' '));
  const shouldAddH1Fallback = normalizedSeoPath === '/' || Boolean(page) || Boolean(hostPage) || Boolean(article);
  const htmlWithH1Fallback =
    shouldAddH1Fallback &&
    fallbackHeading &&
    !/<h1\b/i.test(html)
      ? html.replace(
          '<div id="root"></div>',
          '<div id="root"><h1>' + escape(fallbackHeading) + '</h1></div>'
        )
      : html;

  return htmlWithH1Fallback
    .replace(/<head[^>]*>/i, (head) => `${head}${heroImagePreload}${googleTrackingScript}<script>window.__HWA_INITIAL_SETTINGS__=${initialSettings};window.__HWA_INITIAL_DATA__=${initialPublicData};</script>${articleStructuredData}`)
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escape(title)}</title>`)
    .replace(/<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${escape(description)}" />`)
    .replace(/<meta\s+name="keywords"[^>]*>/i, `<meta name="keywords" content="${escape(keywords)}" />`)
    .replace(/<meta\s+name="robots"[^>]*>/i, `<meta name="robots" content="${escape(robots)}" />`)
    .replace(/<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${escape(canonical)}" />`)
    .replace(/<meta\s+property="og:title"[^>]*>/i, `<meta property="og:title" content="${escape(title)}" />`)
    .replace(/<meta\s+property="og:description"[^>]*>/i, `<meta property="og:description" content="${escape(description)}" />`)
    .replace(/<meta\s+property="og:type"[^>]*>/i, `<meta property="og:type" content="${article ? 'article' : 'website'}" />`)
    .replace(/<meta\s+property="og:url"[^>]*>/i, `<meta property="og:url" content="${escape(canonical)}" />`)
    .replace(/<meta\s+name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${escape(title)}" />`)
    .replace(/<meta\s+name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${escape(description)}" />`)
    .replace(/<meta\s+property="og:image"[^>]*>/i, `<meta property="og:image" content="${escape(articleImages[0] || logoUrl)}" />`)
    .replace(/<meta\s+name="twitter:image"[^>]*>/i, `<meta name="twitter:image" content="${escape(articleImages[0] || logoUrl)}" />`)
    .replace(/https:\/\/kreditmotorhonda\.tech\/uploads\/logo\.jpeg/g, escape(logoUrl))
    .replace(/https:\/\/kreditmotorhonda\.tech/g, escape(siteOrigin))
    .replace(
      /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
      (_match, jsonText) => `<script type="application/ld+json">${updateSeoJsonLdForPage(jsonText, pathname, canonical, title, description)}</script>`
    );;
}

function getSiteOrigin(settings: any = {}, hostname = '') {
  const normalizedHostname = normalizeAnalyticsHost(hostname);
  const rootDomain = getSalesCounterRootDomain(normalizedHostname)
    || (normalizedHostname === 'wijaya.kreditmotorhonda.tech' ? normalizedHostname : undefined);
  if (rootDomain) return `https://${rootDomain}`;
  try {
    return new URL(String(settings.seoCanonicalUrl || process.env.APP_URL || 'https://kreditmotorhonda.tech/')).origin;
  } catch {
    return String(process.env.APP_URL || 'https://kreditmotorhonda.tech').replace(/\/$/, '');
  }
}

const RESERVED_SEO_SUBDOMAINS = new Set(['www', 'wijaya', 'admin', 'api', 'mail', 'ftp', 'm', 'static']);

function getSalesCounterRootDomain(hostname: string) {
  const host = String(hostname || '').toLocaleLowerCase('en-US').replace(/:\d+$/, '').replace(/^www\./, '');
  return SALES_COUNTER_ROOT_DOMAINS.has(host) ? host : undefined;
}

function getSeoPageDomainSuffix(page: any) {
  return SALES_COUNTER_ROOT_DOMAINS.has(page?.domainSuffix) ? page.domainSuffix : 'kreditmotorhonda.tech';
}

function getSeoPageOrigin(page: any) {
  return `https://${page.subdomain}.${getSeoPageDomainSuffix(page)}`;
}

function getSeoPageForHost(settings: any = {}, hostname: string) {
  const host = String(hostname || '').toLocaleLowerCase('en-US').replace(/:\d+$/, '');
  const pages = Array.isArray(settings.seoPages) ? settings.seoPages : [];
  return pages.find((page: any) => {
    const suffix = `.${getSeoPageDomainSuffix(page)}`;
    if (!host.endsWith(suffix)) return false;
    const subdomain = host.slice(0, -suffix.length);
    return page.subdomain === subdomain
      && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)
      && !RESERVED_SEO_SUBDOMAINS.has(subdomain);
  });
}

function normalizeAnalyticsHost(hostname: unknown) {
  const host = String(hostname || '').toLocaleLowerCase('en-US').replace(/:\d+$/, '');
  return host.startsWith('www.') ? host.slice(4) : host;
}

function normalizeSearchKeyword(value: unknown) {
  return String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');
}

const DEFAULT_OWNER_DASHBOARD_KEY = 'KXP6bWUoo2xXqLhrtCTTcBrNqpzUTYqZkEZ2RRULwo0';

function ensureAnalyticsStore(db: any) {
  if (!db || typeof db !== 'object') return db;
  if (!db.analytics || typeof db.analytics !== 'object') db.analytics = {};
  db.analytics.visits = Array.isArray(db.analytics.visits) ? db.analytics.visits : [];
  db.analytics.searches = Array.isArray(db.analytics.searches) ? db.analytics.searches : [];
  db.analytics.whatsappClicks = Array.isArray(db.analytics.whatsappClicks) ? db.analytics.whatsappClicks : [];
  if (!db.settings || typeof db.settings !== 'object') db.settings = {};
  const dashboardConfig = db.settings.ownerDashboard && typeof db.settings.ownerDashboard === 'object'
    ? db.settings.ownerDashboard
    : {};
  db.settings.ownerDashboard = {
    key: String(dashboardConfig.key || DEFAULT_OWNER_DASHBOARD_KEY).trim() || DEFAULT_OWNER_DASHBOARD_KEY,
    enabled: dashboardConfig.enabled !== false,
    allowedHosts: Array.isArray(dashboardConfig.allowedHosts) ? dashboardConfig.allowedHosts : [
      'kreditmotorhonda.tech',
      'kreditmotorhonda.id',
      'solusikreditmotor.cloud',
      'wijaya.kreditmotorhonda.tech',
    ],
    selectedHosts: Array.isArray(dashboardConfig.selectedHosts) && dashboardConfig.selectedHosts.length
      ? dashboardConfig.selectedHosts
      : [
        'kreditmotorhonda.tech',
        'kreditmotorhonda.id',
        'solusikreditmotor.cloud',
        'wijaya.kreditmotorhonda.tech',
      ],
    lastUpdated: dashboardConfig.lastUpdated || new Date().toISOString(),
  };
  return db.analytics;
}

function getOwnerDashboardKey(db: any = readDb()) {
  const configuredKey = String((db?.settings?.ownerDashboard?.key || db?.analytics?.ownerDashboard?.key || DEFAULT_OWNER_DASHBOARD_KEY) || '').trim();
  return configuredKey || DEFAULT_OWNER_DASHBOARD_KEY;
}

function getOwnerDashboardHosts(db: any = readDb()) {
  const configuredHosts = Array.isArray(db?.settings?.ownerDashboard?.selectedHosts)
    ? db.settings.ownerDashboard.selectedHosts
    : Array.isArray(db?.settings?.ownerDashboard?.allowedHosts)
      ? db.settings.ownerDashboard.allowedHosts
      : [];
  const fallbackHosts = [
    'kreditmotorhonda.tech',
    'kreditmotorhonda.id',
    'solusikreditmotor.cloud',
    'wijaya.kreditmotorhonda.tech',
  ];
  return configuredHosts.length ? [...new Set(configuredHosts)] : fallbackHosts;
}

function getOwnerAnalyticsDbCandidates() {
  const rootDir = OWNER_ANALYTICS_ROOT_DIR || path.dirname(DATA_DIR);
  const files = [
    PERSISTENT_DB_FILE,
    FALLBACK_DB_FILE,
    DB_FILE,
    path.join(rootDir, 'data', 'db.json'),
    path.join(rootDir, 'sites', 'wijaya', 'data', 'db.json'),
    path.join(rootDir, 'sites', 'solusi', 'data', 'db.json'),
    path.join(rootDir, 'sites', 'id', 'data', 'db.json'),
  ];
  return [...new Set(files.filter(Boolean))];
}

function getAnalyticsDataSourceFiles() {
  return getOwnerAnalyticsDbCandidates().filter((file) => fs.existsSync(file));
}

function normalizeOwnerDashboardDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : value;
}

function coerceAnalyticsEventDate(value: unknown) {
  try {
    const date = new Date(String(value || ''));
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function summarizeAnalyticsEvents(events: any[] = [], startDate?: string, endDate?: string) {
  const filtered = events.filter((event) => {
    const createdAt = coerceAnalyticsEventDate(event?.created_at || event?.timestamp || event?.date);
    const eventDate = createdAt.slice(0, 10);
    if (startDate && eventDate < startDate) return false;
    if (endDate && eventDate > endDate) return false;
    return true;
  });

  const pages = new Map<string, number>();
  const sources = new Map<string, number>();
  const hosts = new Map<string, number>();
  const searchTerms = new Map<string, number>();

  for (const event of filtered) {
    const page = String(event.path || event.page || '/').trim() || '/';
    const source = String(event.source || event.referrer || 'Direct').trim() || 'Direct';
    const host = normalizeAnalyticsHost(String(event.host || event.hostname || 'kreditmotorhonda.tech')) || 'kreditmotorhonda.tech';
    pages.set(page, (pages.get(page) || 0) + 1);
    sources.set(source, (sources.get(source) || 0) + 1);
    hosts.set(host, (hosts.get(host) || 0) + 1);
    if (event.keyword) {
      searchTerms.set(String(event.keyword), (searchTerms.get(String(event.keyword)) || 0) + 1);
    }
  }

  const topPages = [...pages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([path, count]) => ({ path, count }));
  const sourceBreakdown = [...sources.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
  const hostBreakdown = [...hosts.entries()].sort((a, b) => b[1] - a[1]).map(([host, count]) => ({ host, count }));
  const topSearchTerms = [...searchTerms.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([keyword, count]) => ({ keyword, count }));

  return {
    total: filtered.length,
    topPages,
    sourceBreakdown,
    hostBreakdown,
    topSearchTerms,
  };
}

function getOwnerDashboardSummary(rawKey?: string, startDate?: string, endDate?: string) {
  const normalizedStart = normalizeOwnerDashboardDate(startDate);
  const normalizedEnd = normalizeOwnerDashboardDate(endDate);
  const key = String(rawKey || DEFAULT_OWNER_DASHBOARD_KEY).trim() || DEFAULT_OWNER_DASHBOARD_KEY;
  const files = getAnalyticsDataSourceFiles();

  let visits: any[] = [];
  let searches: any[] = [];
  let whatsappClicks: any[] = [];
  for (const file of files) {
    const db = readJsonDbFile(file);
    if (!db) continue;
    const analytics = ensureAnalyticsStore(db);
    visits = visits.concat(Array.isArray(analytics.visits) ? analytics.visits : []);
    searches = searches.concat(Array.isArray(analytics.searches) ? analytics.searches : []);
    whatsappClicks = whatsappClicks.concat(Array.isArray(analytics.whatsappClicks) ? analytics.whatsappClicks : []);
  }

  const visitsSummary = summarizeAnalyticsEvents(visits, normalizedStart, normalizedEnd);
  const searchesSummary = summarizeAnalyticsEvents(searches, normalizedStart, normalizedEnd);
  const whatsappSummary = summarizeAnalyticsEvents(whatsappClicks, normalizedStart, normalizedEnd);

  const allEvents = [...visits, ...searches, ...whatsappClicks];
  const overall = summarizeAnalyticsEvents(allEvents, normalizedStart, normalizedEnd);

  return {
    key,
    enabled: true,
    totalViews: visits.length,
    totalSearches: searches.length,
    totalWhatsAppClicks: whatsappClicks.length,
    visits: visits.filter((event) => {
      const createdAt = coerceAnalyticsEventDate(event?.created_at || event?.timestamp || event?.date);
      const date = createdAt.slice(0, 10);
      if (normalizedStart && date < normalizedStart) return false;
      if (normalizedEnd && date > normalizedEnd) return false;
      return true;
    }),
    searches: searches.filter((event) => {
      const createdAt = coerceAnalyticsEventDate(event?.created_at || event?.timestamp || event?.date);
      const date = createdAt.slice(0, 10);
      if (normalizedStart && date < normalizedStart) return false;
      if (normalizedEnd && date > normalizedEnd) return false;
      return true;
    }),
    whatsappClicks: whatsappClicks.filter((event) => {
      const createdAt = coerceAnalyticsEventDate(event?.created_at || event?.timestamp || event?.date);
      const date = createdAt.slice(0, 10);
      if (normalizedStart && date < normalizedStart) return false;
      if (normalizedEnd && date > normalizedEnd) return false;
      return true;
    }),
    topPages: overall.topPages,
    sourceBreakdown: overall.sourceBreakdown,
    hostBreakdown: overall.hostBreakdown,
    topSearchTerms: searchesSummary.topSearchTerms,
    searchTermBreakdown: searchesSummary.topSearchTerms,
    visitSummary: visitsSummary,
    searchSummary: searchesSummary,
    whatsappSummary,
    hosts: getOwnerDashboardHosts(),
  };
}

function createOwnerDashboardHtml(payload: any) {
  const summaryRows = payload.topPages.slice(0, 8).map((entry: any) => `<li><span>${escapeHtmlAttribute(entry.path)}</span><strong>${entry.count}</strong></li>`).join('');
  const searchRows = payload.topSearchTerms.slice(0, 8).map((entry: any) => `<li><span>${escapeHtmlAttribute(entry.keyword)}</span><strong>${entry.count}</strong></li>`).join('');
  const referrerRows = payload.sourceBreakdown.slice(0, 8).map((entry: any) => `<li><span>${escapeHtmlAttribute(entry.label)}</span><strong>${entry.count}</strong></li>`).join('');
  const hostRows = payload.hostBreakdown.slice(0, 8).map((entry: any) => `<li><span>${escapeHtmlAttribute(entry.host)}</span><strong>${entry.count}</strong></li>`).join('');
  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Owner Dashboard</title>
    <style>
      body { font-family: Arial, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 32px; }
      .wrap { max-width: 1100px; margin: 0 auto; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin: 24px 0; }
      .card { background: rgba(15,23,42,0.8); border: 1px solid rgba(148,163,184,0.35); border-radius: 16px; padding: 18px; box-shadow: 0 10px 30px rgba(15,23,42,0.25); }
      h1 { margin: 0 0 12px; font-size: clamp(26px, 4vw, 42px); }
      p { color: #cbd5e1; }
      .metric { font-size: 2rem; font-weight: 700; margin-top: 8px; }
      ul { list-style: none; padding: 0; margin: 12px 0 0; }
      li { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; border-bottom: 1px solid rgba(148,163,184,0.2); }
      .muted { opacity: .8; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>Owner Dashboard</h1>
      <p class="muted">Key: ${escapeHtmlAttribute(payload.key)}</p>
      <div class="grid">
        <div class="card"><div>Total Kunjungan</div><div class="metric">${payload.totalViews}</div></div>
        <div class="card"><div>Jumlah Search</div><div class="metric">${payload.totalSearches}</div></div>
        <div class="card"><div>WhatsApp Click</div><div class="metric">${payload.totalWhatsAppClicks}</div></div>
        <div class="card"><div>Website Terpantau</div><div class="metric">${payload.hostBreakdown.length}</div></div>
      </div>
      <div class="grid">
        <div class="card"><h2>Top Halaman</h2><ul>${summaryRows || '<li><span>Belum ada data</span><strong>0</strong></li>'}</ul></div>
        <div class="card"><h2>Top Search</h2><ul>${searchRows || '<li><span>Belum ada data</span><strong>0</strong></li>'}</ul></div>
        <div class="card"><h2>Source</h2><ul>${referrerRows || '<li><span>Belum ada data</span><strong>0</strong></li>'}</ul></div>
        <div class="card"><h2>Host</h2><ul>${hostRows || '<li><span>Belum ada data</span><strong>0</strong></li>'}</ul></div>
      </div>
    </div>
  </body>
</html>`;
}

let cachedGscAccessToken: { token: string; expiresAt: number } | null = null;
const googleSearchConsoleReportCache = new Map<string, { expiresAt: number; report: any }>();
let cachedGoogleSearchConsoleSites: { expiresAt: number; configuredKey: string; sites: string[]; errors: string[] } | null = null;

async function getGoogleSearchConsoleAccessToken() {
  const credentialsFile = process.env.GSC_SERVICE_ACCOUNT_FILE || '/etc/wijaya-abadi/gsc-service-account.json';
  if (!fs.existsSync(credentialsFile)) return null;
  if (cachedGscAccessToken && cachedGscAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedGscAccessToken.token;
  }

  let account: { client_email?: string; private_key?: string };
  try {
    account = JSON.parse(fs.readFileSync(credentialsFile, 'utf8'));
  } catch {
    throw new Error('File service account Search Console tidak valid.');
  }
  if (!account.client_email || !account.private_key) {
    throw new Error('Service account Search Console tidak memiliki client_email atau private_key.');
  }

  const now = Math.floor(Date.now() / 1000);
  const base64url = (value: string | Buffer) => Buffer.from(value).toString('base64url');
  const unsignedToken = [
    base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
    base64url(JSON.stringify({
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })),
  ].join('.');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedToken);
  signer.end();
  const assertion = `${unsignedToken}.${signer.sign(account.private_key).toString('base64url')}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const result = await response.json() as { access_token?: string; expires_in?: number };
  if (!response.ok || !result.access_token) throw new Error('Google Search Console menolak autentikasi service account.');

  cachedGscAccessToken = {
    token: result.access_token,
    expiresAt: Date.now() + Number(result.expires_in || 3600) * 1000,
  };
  return cachedGscAccessToken.token;
}

function getGoogleSearchConsoleSiteHost(site: string) {
  if (site.startsWith('sc-domain:')) return site.slice('sc-domain:'.length).trim().toLowerCase();
  try {
    return normalizeAnalyticsHost(new URL(site).hostname);
  } catch {
    return '';
  }
}

function isMonitoredGoogleSearchConsoleSite(site: string) {
  const host = getGoogleSearchConsoleSiteHost(site);
  return [...SALES_COUNTER_ROOT_DOMAINS].some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function selectGoogleSearchConsoleSites(discoveredSites: string[], configuredSites: string[]) {
  const candidates = [...new Set([...discoveredSites.filter(isMonitoredGoogleSearchConsoleSite), ...configuredSites])];
  const selectedSites = new Set<string>();

  for (const rootDomain of SALES_COUNTER_ROOT_DOMAINS) {
    const rootSites = candidates.filter((site) => {
      const host = getGoogleSearchConsoleSiteHost(site);
      return host === rootDomain || host.endsWith(`.${rootDomain}`);
    });
    const rootDomainProperty = `sc-domain:${rootDomain}`;
    if (rootSites.includes(rootDomainProperty)) {
      selectedSites.add(rootDomainProperty);
      continue;
    }

    const domainProperties = rootSites.filter((site) => site.startsWith('sc-domain:'));
    const broadestDomainProperties = domainProperties.filter((site) => {
      const host = getGoogleSearchConsoleSiteHost(site);
      return !domainProperties.some((otherSite) => {
        const otherHost = getGoogleSearchConsoleSiteHost(otherSite);
        return otherSite !== site && host.endsWith(`.${otherHost}`);
      });
    });
    broadestDomainProperties.forEach((site) => selectedSites.add(site));

    const coveredHosts = broadestDomainProperties.map(getGoogleSearchConsoleSiteHost);
    for (const site of rootSites.filter((item) => !item.startsWith('sc-domain:'))) {
      const host = getGoogleSearchConsoleSiteHost(site);
      if (!coveredHosts.some((domainHost) => host === domainHost || host.endsWith(`.${domainHost}`))) {
        selectedSites.add(site);
      }
    }

  }

  configuredSites
    .filter((site) => !isMonitoredGoogleSearchConsoleSite(site))
    .forEach((site) => selectedSites.add(site));
  return [...selectedSites];
}

async function getGoogleSearchConsoleSites(token: string, configuredSites: string[]) {
  const configuredKey = configuredSites.join(',');
  if (cachedGoogleSearchConsoleSites?.configuredKey === configuredKey && cachedGoogleSearchConsoleSites.expiresAt > Date.now()) {
    return cachedGoogleSearchConsoleSites;
  }

  const errors: string[] = [];
  let discoveredSites: string[] = [];
  try {
    const response = await fetch('https://searchconsole.googleapis.com/webmasters/v3/sites', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json() as { siteEntry?: Array<{ siteUrl?: string }> ; error?: { message?: string } };
    if (!response.ok) throw new Error(data.error?.message || `Google Search Console sites.list gagal (HTTP ${response.status}).`);
    discoveredSites = (data.siteEntry || []).map((entry) => String(entry.siteUrl || '').trim()).filter(Boolean);
  } catch (error: any) {
    errors.push(`Daftar properti Search Console tidak dapat dimuat: ${String(error?.message || 'permintaan gagal')}`);
  }

  const result = {
    expiresAt: Date.now() + 15 * 60 * 1000,
    configuredKey,
    sites: selectGoogleSearchConsoleSites(discoveredSites, configuredSites),
    errors,
  };
  cachedGoogleSearchConsoleSites = result;
  return result;
}

async function getGoogleSearchConsoleKeywords(startDate?: string, endDate?: string) {
  const configuredSites = (process.env.GSC_SITE_URLS || '')
    .split(',')
    .map((site) => site.trim())
    .filter(Boolean);
  const fallbackSites = selectGoogleSearchConsoleSites([], configuredSites);
  const today = new Date();
  const latestAvailableDate = new Date(today);
  latestAvailableDate.setUTCDate(latestAvailableDate.getUTCDate() - 1);
  const effectiveEndDate = endDate && endDate < latestAvailableDate.toISOString().slice(0, 10)
    ? endDate
    : latestAvailableDate.toISOString().slice(0, 10);
  const earliestDate = new Date(today);
  earliestDate.setUTCMonth(earliestDate.getUTCMonth() - 16);
  const effectiveStartDate = startDate || earliestDate.toISOString().slice(0, 10);
  if (effectiveStartDate > effectiveEndDate) {
    return { configured: true, startDate: effectiveStartDate, endDate: effectiveEndDate, sites: fallbackSites, rows: [], errors: [] };
  }

  const token = await getGoogleSearchConsoleAccessToken();
  if (!token) {
    return {
      configured: false,
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
      sites: fallbackSites,
      rows: [],
      errors: ['Search Console belum terhubung. Admin perlu menambahkan secret GSC_SERVICE_ACCOUNT_JSON di GitHub Actions.'],
    };
  }

  const siteSelection = await getGoogleSearchConsoleSites(token, configuredSites);
  const sites = siteSelection.sites;
  const cacheKey = `${effectiveStartDate}:${effectiveEndDate}:${sites.join(',')}`;
  const cached = googleSearchConsoleReportCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.report;

  const responses = await Promise.all(sites.map(async (site) => {
    try {
      const response = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: effectiveStartDate,
          endDate: effectiveEndDate,
          dimensions: ['query'],
          rowLimit: 25_000,
          dataState: 'all',
        }),
      });
      const body = await response.json() as {
        rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; position?: number }>;
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(body.error?.message || `Gagal mengambil data untuk ${site}.`);
      return { site, rows: body.rows || [], error: '' };
    } catch (error: any) {
      return { site, rows: [], error: String(error?.message || `Gagal mengambil data untuk ${site}.`) };
    }
  }));

  const keywordTotals = new Map<string, { keyword: string; clicks: number; impressions: number; positionWeight: number; positionTotal: number; sites: Set<string> }>();
  for (const result of responses) {
    for (const row of result.rows) {
      const keyword = String(row.keys?.[0] || '').trim();
      const normalizedKeyword = normalizeSearchKeyword(keyword);
      if (!normalizedKeyword) continue;
      const impressions = Number(row.impressions || 0);
      const aggregate = keywordTotals.get(normalizedKeyword) || {
        keyword,
        clicks: 0,
        impressions: 0,
        positionWeight: 0,
        positionTotal: 0,
        sites: new Set<string>(),
      };
      aggregate.clicks += Number(row.clicks || 0);
      aggregate.impressions += impressions;
      aggregate.positionWeight += impressions;
      aggregate.positionTotal += Number(row.position || 0) * impressions;
      aggregate.sites.add(result.site);
      keywordTotals.set(normalizedKeyword, aggregate);
    }
  }

  const rows = [...keywordTotals.values()]
    .map(({ positionWeight, positionTotal, sites: matchedSites, ...row }) => ({
      ...row,
      ctr: row.impressions ? row.clicks / row.impressions : 0,
      position: positionWeight ? positionTotal / positionWeight : 0,
      siteCount: matchedSites.size,
    }))
    .sort((left, right) => right.impressions - left.impressions || right.clicks - left.clicks)
    .slice(0, 50);
  const report = {
    configured: true,
    startDate: effectiveStartDate,
    endDate: effectiveEndDate,
    sites,
    rows,
    errors: [...siteSelection.errors, ...responses.filter((result) => result.error).map((result) => result.error)],
  };
  googleSearchConsoleReportCache.set(cacheKey, { report, expiresAt: Date.now() + 5 * 60 * 1000 });
  return report;
}

function publicSeoPage(page: any) {
  return {
    id: page.id,
    siteType: page.siteType,
    subdomain: page.subdomain,
    domainSuffix: getSeoPageDomainSuffix(page),
    title: page.title,
    content: page.content,
    posts: getSeoLandingPosts(page).map((post) => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      content: post.content,
    })),
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    seoKeywords: page.seoKeywords,
    seoRobots: page.seoRobots,
    sslStatus: page.sslStatus,
    updated_at: page.updated_at,
  };
}

function publicSettings(settings: any = {}) {
  const { ownerDashboard: _ownerDashboard, ...publicValues } = settings;
  return {
    ...publicValues,
    seoPages: (Array.isArray(settings.seoPages) ? settings.seoPages : []).map(publicSeoPage),
  };
}

function getSettingsForSeoPage(settings: any = {}, page: any) {
  if (!page) return settings;
  return {
    ...settings,
    ...(page.siteSettings || {}),
    seoTitle: page.seoTitle || page.title || settings.seoTitle,
    seoDescription: page.seoDescription || settings.seoDescription,
    seoKeywords: page.seoKeywords || settings.seoKeywords,
    seoRobots: page.sslStatus === 'active' ? page.seoRobots || 'index, follow' : 'noindex, follow',
    seoCanonicalUrl: `${getSeoPageOrigin(page)}/`,
    seoPages: [publicSeoPage(page)],
    seoPostHost: true,
  };
}

async function installManagedNginxConfig(name: string, contents: string) {
  const configPath = `/etc/nginx/sites-available/${name}`;
  const enabledPath = `/etc/nginx/sites-enabled/${name}`;
  const marker = '# Managed by Honda SEO subdomain pages.';
  try {
    const existing = await fs.promises.readFile(configPath, 'utf8');
    if (!existing.startsWith(marker)) throw new Error(`Nginx config already exists and is not managed by the SEO page provisioner: ${configPath}`);
  } catch (error: any) {
    if (error.code !== 'ENOENT') throw error;
  }

  await fs.promises.mkdir('/etc/nginx/sites-available', { recursive: true });
  await fs.promises.mkdir('/etc/nginx/sites-enabled', { recursive: true });
  const temporaryPath = `${configPath}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  await fs.promises.writeFile(temporaryPath, contents, { encoding: 'utf8', mode: 0o644, flag: 'wx' });
  await fs.promises.rename(temporaryPath, configPath);

  try {
    const stat = await fs.promises.lstat(enabledPath);
    if (!stat.isSymbolicLink() || await fs.promises.realpath(enabledPath) !== configPath) {
      throw new Error(`Nginx site is already enabled from an unmanaged path: ${enabledPath}`);
    }
  } catch (error: any) {
    if (error.code !== 'ENOENT') throw error;
    await fs.promises.symlink(configPath, enabledPath);
  }
}

async function provisionSeoPageSsl(page: any, settings: any): Promise<{ status: 'active' | 'failed' | 'pending'; message: string }> {
  if (typeof process.getuid === 'function' && process.getuid() !== 0) {
    return { status: 'pending', message: 'Provisioning SSL memerlukan service server berjalan dengan izin root.' };
  }

  const subdomain = String(page.subdomain || '').toLocaleLowerCase('en-US');
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain) || RESERVED_SEO_SUBDOMAINS.has(subdomain)) {
    return { status: 'failed', message: 'Format subdomain tidak valid atau memakai nama yang dicadangkan.' };
  }
  const domainSuffix = getSeoPageDomainSuffix(page);
  const rootDomain = domainSuffix;
  const hostname = `${subdomain}.${domainSuffix}`;
  const upstreamPort = domainSuffix === 'kreditmotorhonda.id' ? 3003 : domainSuffix === 'solusikreditmotor.cloud' ? 3002 : 3000;
  let rootAddresses: string[];
  let postAddresses: string[];
  try {
    [rootAddresses, postAddresses] = await Promise.all([
      resolve4(rootDomain),
      resolve4(hostname),
    ]);
  } catch {
    return { status: 'pending', message: `Tambahkan A record ${hostname} ke IP VPS yang sama dengan ${rootDomain}.` };
  }
  if (!postAddresses.some((address) => rootAddresses.includes(address))) {
    return { status: 'pending', message: `A record ${hostname} harus mengarah ke IP yang sama dengan ${rootDomain}.` };
  }

  const isSalesCounter = page.siteType === 'sales-counter';
  const domainKey = domainSuffix.replace(/\./g, '-');
  const certName = isSalesCounter ? `sales-counter-${domainKey}-${subdomain}` : `seo-post-${subdomain}`;
  const certPath = `/etc/letsencrypt/live/${certName}/fullchain.pem`;
  const keyPath = `/etc/letsencrypt/live/${certName}/privkey.pem`;
  const webroot = '/var/www/letsencrypt';
  await fs.promises.mkdir(path.join(webroot, '.well-known', 'acme-challenge'), { recursive: true });

  const acmeConfigName = isSalesCounter ? `honda-sales-counter-${domainKey}-acme` : 'honda-seo-posts-acme';
  const escapedDomainSuffix = domainSuffix.replace(/\./g, '\\.');
  const acmeServerName = isSalesCounter
    ? `~^[a-z0-9-]+\\.${escapedDomainSuffix}$`
    : '~^[a-z0-9-]+\\.kreditmotorhonda\\.tech$';
  await installManagedNginxConfig(acmeConfigName, `# Managed by Honda SEO subdomain pages. ACME HTTP-01 challenge routing.\nserver {\n  listen 80;\n  listen [::]:80;\n  server_name ${acmeServerName};\n  location ^~ /.well-known/acme-challenge/ {\n    root ${webroot};\n    default_type text/plain;\n    try_files $uri =404;\n  }\n  location / { return 301 https://$host$request_uri; }\n}\n`);
  await execFileAsync('nginx', ['-t'], { timeout: 30000, maxBuffer: 1024 * 1024 });
  await execFileAsync('systemctl', ['reload', 'nginx'], { timeout: 30000, maxBuffer: 1024 * 1024 });

  const defaultEmail = `admin@${rootDomain}`;
  const configuredEmail = String(process.env.CERTBOT_EMAIL || settings.email || defaultEmail).trim();
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredEmail) ? configuredEmail : defaultEmail;
  try {
    await execFileAsync('certbot', [
      'certonly', '--webroot', '--webroot-path', webroot,
      '--non-interactive', '--agree-tos', '--keep-until-expiring', '--email', email,
      '--cert-name', certName, '-d', hostname,
    ], { timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
    await fs.promises.access(certPath);
    await fs.promises.access(keyPath);
  } catch (error: any) {
    const message = String(error.stderr || error.message || 'Penerbitan sertifikat gagal').split('\n').slice(-5).join(' ').slice(0, 500);
    return { status: 'failed', message };
  }

  const nginxConfigName = isSalesCounter ? `honda-sales-counter-${domainKey}-${subdomain}` : `honda-seo-post-${subdomain}`;
  await installManagedNginxConfig(nginxConfigName, `# Managed by Honda SEO subdomain pages. TLS reverse proxy for ${hostname}.\nserver {\n  listen 443 ssl;\n  listen [::]:443 ssl;\n  server_name ${hostname};\n  ssl_certificate ${certPath};\n  ssl_certificate_key ${keyPath};\n  include /etc/letsencrypt/options-ssl-nginx.conf;\n  ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;\n  client_max_body_size 100m;\n  location / {\n    proxy_pass http://127.0.0.1:${upstreamPort};\n    proxy_http_version 1.1;\n    proxy_set_header Host $host;\n    proxy_set_header X-Real-IP $remote_addr;\n    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n    proxy_set_header X-Forwarded-Proto $scheme;\n  }\n}\n`);
  await execFileAsync('nginx', ['-t'], { timeout: 30000, maxBuffer: 1024 * 1024 });
  await execFileAsync('systemctl', ['reload', 'nginx'], { timeout: 30000, maxBuffer: 1024 * 1024 });
  return { status: 'active', message: `HTTPS aktif di https://${hostname}` };
}

function slugifySeoValue(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('id-ID')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getSeoMotorPages(db: any): Array<{ motor: any; slug: string; path: string }> {
  const usedSlugs = new Set<string>();
  return (Array.isArray(db.motors) ? db.motors : []).flatMap((motor: any, index: number) => {
    const name = String(motor?.name || '').trim();
    const modelSlug = slugifySeoValue(name.replace(/^Honda\s+/i, ''));
    if (!name || !modelSlug) return [];

    const baseSlug = `honda-${modelSlug}-bandung`;
    let slug = baseSlug;
    if (usedSlugs.has(slug)) slug = `${baseSlug}-${slugifySeoValue(motor.id) || index + 1}`;
    usedSlugs.add(slug);
    return [{ motor, slug, path: `/motor/${slug}/` }];
  });
}

function renderMotorSeoPage(motor: any, slug: string, settings: any = {}, hostname = '') {
  const hostPage = getSeoPageForHost(settings, hostname);
  const origin = hostPage ? getSeoPageOrigin(hostPage) : getSiteOrigin(settings, hostname);
  const canonical = `${origin}/motor/${slug}/`;
  const name = String(motor.name || 'Motor Honda').trim();
  const category = String(motor.category || 'Sepeda Motor Honda').trim();
  const description = String(motor.description || `Lihat harga ${name} di Bandung, spesifikasi, dan pilihan kredit di ${settings.name || 'Honda Wijaya Abadi Mulia Motor'}. Tanyakan ketersediaan unit melalui WhatsApp.`).trim();
  const safeName = escapeHtmlAttribute(name);
  const safeCategory = escapeHtmlAttribute(category);
  const safeDescription = escapeHtmlAttribute(description);
  const dealerName = escapeHtmlAttribute(String(settings.name || 'Honda Wijaya Abadi Mulia Motor'));
  const price = Number(motor.numericPrice) || Number(String(motor.price || '').replace(/[^0-9]/g, '')) || 0;
  const priceLabel = String(motor.price || (price ? `Rp ${new Intl.NumberFormat('id-ID').format(price)}` : 'Hubungi dealer untuk harga')).trim();
  const priceText = escapeHtmlAttribute(priceLabel);
  const specs = Array.isArray(motor.specs) ? motor.specs.filter(Boolean).map((spec: unknown) => String(spec)) : [];
  const images = [...new Set([motor.image, ...(Array.isArray(motor.images) ? motor.images : [])])]
    .flatMap((image: unknown) => {
      if (typeof image !== 'string' || !image.trim()) return [];
      try {
        const imageUrl = new URL(image, origin);
        return ['http:', 'https:'].includes(imageUrl.protocol) ? [imageUrl.href] : [];
      } catch {
        return [];
      }
    });
  const image = images[0] || '';
  const phone = String(settings.phone || '6282129358899').replace(/[^0-9]/g, '');
  const whatsappText = encodeURIComponent(
    `Halo, saya ingin bertanya tentang ${name} di ${settings.name || 'Honda Wijaya Abadi Mulia Motor'}.\n\nLink website: ${canonical}`
  );
  const whatsappUrl = `https://wa.me/${phone}?text=${whatsappText}`;
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    brand: { '@type': 'Brand', name: 'Honda' },
    category,
    sku: String(motor.id || slug),
    ...(images.length ? { image: images } : {}),
    offers: {
      '@type': 'Offer',
      url: canonical,
      priceCurrency: 'IDR',
      ...(price ? { price: String(price) } : {}),
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'ID',
        merchantReturnDays: 7,
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'ID',
        },
        shippingRate: {
          '@type': 'MonetaryAmount',
          value: 0,
          currency: 'IDR',
        },
        deliveryTime: {
          '@type': 'DeliveryTimeSettings',
          transitTime: {
            '@type': 'QuantitativeValue',
            minValue: 1,
            maxValue: 3,
            unitCode: 'DAY',
          },
        },
      },
    },
  };
  const specificationList = specs.length
    ? `<ul>${specs.map((spec: string) => `<li>${escapeHtmlAttribute(spec)}</li>`).join('')}</ul>`
    : '<p>Hubungi dealer untuk informasi spesifikasi dan ketersediaan unit.</p>';

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeName} Bandung | Harga, Spesifikasi & Kredit Honda</title>
  <meta name="description" content="${safeDescription}">
  <meta name="keywords" content="harga ${safeName} Bandung, kredit ${safeName}, spesifikasi ${safeName}, motor Honda Bandung">
  <meta name="robots" content="index, follow">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-honda-32.png?v=20261108">
  <link rel="icon" type="image/png" sizes="192x192" href="/favicon-honda-192.png?v=20261108">
  <link rel="icon" type="image/png" sizes="512x512" href="/favicon-honda.png?v=20261108">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=20261108">
  <link rel="canonical" href="${escapeHtmlAttribute(canonical)}">
  <meta property="og:type" content="product"><meta property="og:title" content="${safeName} Bandung | Harga & Kredit Honda">
  <meta property="og:description" content="${safeDescription}"><meta property="og:url" content="${escapeHtmlAttribute(canonical)}">
  ${image ? `<meta property="og:image" content="${escapeHtmlAttribute(image)}">` : ''}
  <script type="application/ld+json">${JSON.stringify(productSchema).replace(/</g, '\\u003c')}</script>
  <style>
    :root{font-family:Arial,Helvetica,sans-serif;color:#202b27;background:#f4f7f5}*{box-sizing:border-box}body{margin:0}header{background:#fff;border-bottom:1px solid #dce4df;padding:18px max(24px,calc((100% - 1080px)/2));display:flex;justify-content:space-between;align-items:center;gap:16px}header a{color:#b91c1c;font-weight:700;text-decoration:none}.wrap{max-width:1080px;margin:auto;padding:64px 24px 80px}.crumb{font-size:14px;color:#56645d}.crumb a{color:#48574f}.layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.8fr);gap:48px;align-items:center}h1{font-size:clamp(34px,5vw,56px);line-height:1.08;margin:20px 0 16px;color:#17251f}.lead{font-size:18px;line-height:1.7;color:#46564d}.label{color:#b91c1c;text-transform:uppercase;font-size:13px;font-weight:700;letter-spacing:.08em}.price{font-size:28px;font-weight:800;color:#17251f;margin:28px 0 20px}.actions{display:flex;flex-wrap:wrap;gap:12px}.button{display:inline-flex;padding:14px 18px;border-radius:8px;font-weight:700;text-decoration:none}.primary{background:#c8102e;color:#fff}.secondary{border:1px solid #65736b;color:#26372e;background:#fff}.visual{border-radius:12px;background:#e3e9e5;overflow:hidden;min-height:280px;display:grid;place-items:center}.visual img{width:100%;height:100%;max-height:420px;object-fit:cover}.visual span{padding:36px;color:#526158}.details{margin-top:44px;border-top:1px solid #d5ded8;padding-top:28px}.details h2{font-size:24px}.details ul{padding-left:20px;line-height:1.9;color:#3f5047}.dealer{margin-top:32px;font-size:14px;color:#56645d}@media(max-width:720px){header{padding:16px 20px}.wrap{padding:36px 20px 56px}.layout{grid-template-columns:1fr;gap:28px}.visual{min-height:220px}.lead{font-size:16px}}
  </style>
</head>
<body>
  <header><a href="/">Honda Wijaya Abadi</a><a href="/#katalog">Katalog Motor</a></header>
  <main class="wrap">
    <div class="crumb"><a href="/">Beranda</a> / <a href="/#katalog">Motor Honda</a> / ${safeName}</div>
    <section class="layout">
      <div><div class="label">${safeCategory} · Dealer Honda Bandung</div><h1>${safeName} Bandung</h1><p class="lead">${safeDescription}</p><p class="price">${priceText}</p><div class="actions"><a class="button primary" href="${escapeHtmlAttribute(whatsappUrl)}">Tanyakan harga & stok</a><a class="button secondary" href="/#simulasi">Lihat katalog dan simulasi</a></div></div>
      <div class="visual">${image ? `<img src="${escapeHtmlAttribute(image)}" alt="${safeName} di Honda Wijaya Abadi Bandung" loading="eager">` : '<span>Foto unit tersedia melalui katalog dealer.</span>'}</div>
    </section>
    <section class="details"><h2>Spesifikasi ${safeName}</h2>${specificationList}<p class="dealer">Harga dan ketersediaan dapat berubah. Konfirmasi unit, pilihan warna, serta simulasi kredit langsung dengan ${dealerName} di Bandung.</p></section>
  </main>
</body>
</html>`;
}

function renderDynamicSitemap(db: any, hostname = '') {
  const post = getSeoPageForHost(db.settings || {}, hostname);
  const normalizedHostname = normalizeAnalyticsHost(hostname);
  const isRootSiteHost = SALES_COUNTER_ROOT_DOMAINS.has(normalizedHostname)
    || normalizedHostname === 'wijaya.kreditmotorhonda.tech';
  const origin = post
    ? getSeoPageOrigin(post)
    : isRootSiteHost
      ? `https://${normalizedHostname}`
      : getSiteOrigin(db.settings || {});
  const articleOrigin = post ? origin : normalizedHostname ? `https://${normalizedHostname}` : origin;
  const isPrimaryHost = isRootSiteHost || articleOrigin === origin;
  const staticPages: Array<{ path: string; changefreq: string; priority: string; lastmod?: string }> = [
    { path: '/', changefreq: 'daily', priority: '1.0' },
    { path: '/dealer-honda-bandung/', changefreq: 'weekly', priority: '0.9' },
    { path: '/kredit-motor-honda-bandung/', changefreq: 'weekly', priority: '0.9' },
    { path: '/simulasi-kredit-honda/', changefreq: 'weekly', priority: '0.9' },
    { path: '/harga-motor-honda-bandung/', changefreq: 'weekly', priority: '0.9' },
    { path: '/honda-beat-bandung/', changefreq: 'weekly', priority: '0.8' },
    { path: '/honda-scoopy-bandung/', changefreq: 'weekly', priority: '0.8' },
    { path: '/honda-vario-bandung/', changefreq: 'weekly', priority: '0.9' },
    { path: '/honda-pcx-bandung/', changefreq: 'weekly', priority: '0.9' },
    { path: '/honda-adv-bandung/', changefreq: 'weekly', priority: '0.8' },
  ];
  const motorPages = getSeoMotorPages(db).map(({ motor, path: pagePath }) => ({
    path: pagePath,
    changefreq: 'weekly',
    priority: '0.8',
    lastmod: motor.updated_at || motor.created_at,
    imageTitle: String(motor.name || ''),
    images: [...new Set([motor.image, ...(Array.isArray(motor.images) ? motor.images : [])])]
      .flatMap((image: unknown) => {
        if (typeof image !== 'string' || !image.trim()) return [];
        try {
          const imageUrl = new URL(image, origin);
          return ['http:', 'https:'].includes(imageUrl.protocol) ? [imageUrl.href] : [];
        } catch {
          return [];
        }
      }),
  }));
  const hostPostPages = post
    ? getSeoLandingPosts(post)
        .filter((seoPost) => seoPost.id !== post.id)
        .map((seoPost) => ({
          path: getSeoLandingPostPath(post, seoPost),
          changefreq: 'weekly',
          priority: '0.8',
          lastmod: seoPost.updated_at || post.updated_at,
        }))
    : [];
  const articlePages = (Array.isArray(db.articles) ? db.articles : [])
    .filter((article: any) => article.published === true && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(String(article.slug || '')))
    .map((article: any) => ({
      path: `${articleOrigin}/artikel/${encodeURIComponent(article.slug)}/`,
      changefreq: 'weekly',
      priority: '0.7',
      lastmod: article.updated_at || article.created_at,
      absolute: true,
    }));
  const today = new Date().toISOString().slice(0, 10);
  const sitemapPages = post
    ? [{ path: '/', changefreq: 'weekly', priority: '1.0' }, ...hostPostPages, ...motorPages, ...articlePages]
    : isPrimaryHost
      ? [...staticPages, ...motorPages, ...articlePages]
      : articlePages;
  const urls = sitemapPages.map((page: any) => {
    const parsedDate = page.lastmod ? new Date(page.lastmod) : null;
    const lastmod = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString().slice(0, 10) : today;
    const url = page.absolute ? page.path : `${origin}${page.path}`;
    const images = (page.images || []).map((image: string) => `<image:image><image:loc>${escapeHtmlAttribute(image)}</image:loc><image:title>${escapeHtmlAttribute(page.imageTitle || '')}</image:title></image:image>`).join('');
    return `  <url><loc>${escapeHtmlAttribute(url)}</loc><lastmod>${lastmod}</lastmod><changefreq>${page.changefreq}</changefreq><priority>${page.priority}</priority>${images}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>`;
}

function writeDb(data: any) {
  try {
    const targetDbFile = fs.existsSync(PERSISTENT_DB_FILE) || process.env.DATA_DIR
      ? PERSISTENT_DB_FILE
      : FALLBACK_DB_FILE;
    const targetDir = path.dirname(targetDbFile);
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(targetDbFile, JSON.stringify(data, null, 2), 'utf-8');
    if (targetDbFile !== FALLBACK_DB_FILE && fs.existsSync(FALLBACK_DB_FILE)) {
      fs.writeFileSync(FALLBACK_DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    }
    return true;
  } catch (err) {
    console.error('Error writing db:', err);
    return false;
  }
}

function readDefaultFifPriceList() {
  try {
    return JSON.parse(fs.readFileSync(DEFAULT_FIF_PRICE_LIST_FILE, 'utf-8'));
  } catch {
    return { source: 'Bundled price list', tenors: FIF_TENORS, models: {} };
  }
}

function currentFifPriceList(db = readDb()) {
  return db.fifPriceList || readDefaultFifPriceList();
}

function numberFromCell(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const digits = String(value ?? '').replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
}

function saveMotorFifPriceListModel(db: any, input: any) {
  if (!input) return;
  const name = String(input.name || '').trim();
  const catalogMotor = (db.motors || []).find((motor: any) => motor.name === name);
  if (!catalogMotor) throw new Error('Simpan data motor sebelum menyimpan paket cicilan FIF.');

  const price = numberFromCell(input.price);
  if (!price) throw new Error('Harga OTR motor wajib diisi sebelum menyimpan template cicilan.');

  const allowedDp = new Set(FIF_DP_PERCENTAGES.map(String));
  const options: Record<string, number[]> = {};
  for (const [percentage, rawValues] of Object.entries(input.options || {})) {
    if (!allowedDp.has(percentage)) throw new Error(`Persentase DP ${percentage}% tidak tersedia di template.`);
    if (!Array.isArray(rawValues)) throw new Error(`Format cicilan DP ${percentage}% tidak valid.`);
    const values = rawValues.map(numberFromCell);
    if (values.every((value) => value === 0)) continue;
    if (values.length !== FIF_TENORS.length + 1 || values.some((value) => value <= 0)) {
      throw new Error(`DP ${percentage}% harus memiliki nominal DP dan cicilan lengkap untuk tenor ${FIF_TENORS.join(', ')} bulan.`);
    }
    if (values[0] > price) throw new Error(`Nominal DP ${percentage}% tidak boleh melebihi Harga OTR.`);
    options[percentage] = values;
  }

  const current = currentFifPriceList(db);
  const models = { ...(current.models || {}) };
  const previousName = String(input.previousName || '').trim();
  if (previousName && previousName !== name) {
    const oldModelName = Object.keys(models).find((modelName) => normalizeFifModelName(modelName) === normalizeFifModelName(previousName));
    if (oldModelName) delete models[oldModelName];
  }
  models[name] = { price, options };
  db.fifPriceList = {
    ...current,
    source: 'Input dari katalog motor',
    updatedAt: new Date().toISOString(),
    tenors: FIF_TENORS,
    models,
  };
}

function mergeFifPriceListWorkbook(buffer: Buffer, current: any, catalogMotors: any[] = []) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const models: Record<string, any> = {};
  const presets = new Set(FIF_DP_PERCENTAGES.map(String));
  const catalogNames = new Map<string, string>(
    catalogMotors
      .map((motor) => String(motor.name || '').trim())
      .filter(Boolean)
      .map((name) => [name.toLocaleLowerCase('id-ID'), name]),
  );
  const mismatchedNames = new Set<string>();
  const rowIssues: string[] = [];
  let foundTemplateSheet = false;

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], {
      header: 1,
      raw: true,
      blankrows: false,
    });
    if (!rows.length) continue;

    const header = (rows[0] || []).map((value) => String(value || '').trim().toLowerCase());
    const modelColumn = header.indexOf('model');
    const priceColumn = header.indexOf('harga otr');
    const percentColumn = header.indexOf('dp (%)');
    const downPaymentColumn = header.indexOf('nominal dp');
    const tenorColumns = FIF_TENORS.map((tenor) => header.indexOf(`cicilan ${tenor} bln`));
    if ([modelColumn, priceColumn, percentColumn, downPaymentColumn, ...tenorColumns].some((column) => column < 0)) continue;
    foundTemplateSheet = true;

    for (const [rowIndex, row] of rows.slice(1).entries()) {
      const rowNumber = rowIndex + 2;
      const name = String(row[modelColumn] || '').trim();
      if (!name) {
        if (row.some((value) => String(value ?? '').trim())) rowIssues.push(`Baris ${rowNumber}: nama model kosong.`);
        continue;
      }
      const catalogName = catalogNames.get(name.toLocaleLowerCase('id-ID'));
      if (!catalogName) {
        mismatchedNames.add(name);
        continue;
      }

      const price = numberFromCell(row[priceColumn]);
      const percent = numberFromCell(row[percentColumn]);
      const downPayment = numberFromCell(row[downPaymentColumn]);
      const installments = tenorColumns.map((column) => numberFromCell(row[column]));
      const problems: string[] = [];
      if (price <= 0) problems.push('Harga OTR harus diisi');
      if (!presets.has(String(percent))) problems.push(`DP harus salah satu dari ${FIF_DP_PERCENTAGES.join('%, ')}%`);
      if (downPayment <= 0) problems.push('Nominal DP harus diisi');
      if (price > 0 && downPayment > price) problems.push('Nominal DP melebihi Harga OTR');
      const missingTenors = FIF_TENORS.filter((_, index) => installments[index] <= 0);
      if (missingTenors.length) problems.push(`Cicilan tenor ${missingTenors.join(', ')} bulan belum diisi`);
      if (problems.length) {
        rowIssues.push(`Baris ${rowNumber} (${catalogName}): ${problems.join('; ')}.`);
        continue;
      }

      const existing = models[catalogName] || { price, options: {} };
      if (existing.options[String(percent)]) {
        rowIssues.push(`Baris ${rowNumber} (${catalogName}): DP ${percent}% tercantum lebih dari sekali.`);
        continue;
      }
      if (existing.price !== price) {
        rowIssues.push(`Baris ${rowNumber} (${catalogName}): Harga OTR berbeda antarbaris model yang sama.`);
        continue;
      }
      existing.price = price;
      existing.options[String(percent)] = [downPayment, ...installments];
      models[catalogName] = existing;
    }
  }

  if (!foundTemplateSheet) {
    throw new Error(`Format kolom tidak sesuai template. Unduh template terbaru; kolom wajib: Model, Harga OTR, DP (%), Nominal DP, dan Cicilan ${FIF_TENORS.map((tenor) => `${tenor} bln`).join(', ')}.`);
  }
  if (mismatchedNames.size) {
    throw new Error(`Nama motor tidak cocok dengan katalog/template: ${[...mismatchedNames].join(', ')}. Samakan nama pada kolom Model persis dengan nama motor di katalog, lalu unduh template terbaru.`);
  }
  if (rowIssues.length) {
    const visibleIssues = rowIssues.slice(0, 12);
    const remainingCount = rowIssues.length - visibleIssues.length;
    throw new Error(`Periksa data price list berikut:\n${visibleIssues.join('\n')}${remainingCount > 0 ? `\nDan ${remainingCount} kesalahan lainnya.` : ''}`);
  }
  if (!Object.keys(models).length) {
    throw new Error('Tidak ada data valid. Gunakan template price list dan isi semua nominal DP serta cicilan tenor.');
  }

  return {
    ...current,
    source: 'Upload price list FIFGROUP',
    updatedAt: new Date().toISOString(),
    tenors: FIF_TENORS,
    models: { ...(current.models || {}), ...models },
  };
}

function normalizeFifModelName(name: string) {
  return name.toLowerCase().replace(/\b(honda|all|new|evo)\b/g, ' ').replace(/[^a-z0-9]/g, '');
}

function buildFifPriceListTemplate(priceList: any, catalogMotors: any[] = []) {
  const rows: unknown[][] = [[
    'Model', 'Harga OTR', 'DP (%)', 'Nominal DP',
    ...FIF_TENORS.map((tenor) => `Cicilan ${tenor} bln`),
  ]];
  const priceListModels = Object.entries<any>(priceList.models || {});
  const motors = Array.isArray(catalogMotors) ? catalogMotors : [];
  for (const motor of motors) {
    const name = String(motor.name || '').trim();
    if (!name) continue;
    const normalizedName = normalizeFifModelName(name);
    const matchedModel = priceList.models?.[name]
      || priceListModels.find(([modelName]) => normalizeFifModelName(modelName) === normalizedName)?.[1];
    const price = numberFromCell(matchedModel?.price || motor.numericPrice || motor.price);

    for (const percent of FIF_DP_PERCENTAGES) {
      const option = matchedModel?.options?.[String(percent)];
      if (option?.length >= FIF_TENORS.length + 1) {
        rows.push([name, price || '', percent, ...option]);
      } else {
        const downPayment = price ? Math.min(price, Math.ceil((price * percent / 100) / 100_000) * 100_000) : '';
        rows.push([name, price || '', percent, downPayment, ...FIF_TENORS.map(() => '')]);
      }
    }
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Price List');
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
}

function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, expectedHash] = String(storedHash || '').split(':');
  if (!salt || !expectedHash) return false;
  const actualHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actualHash, 'hex'), Buffer.from(expectedHash, 'hex'));
}

function ensureAdminUsers(db: any) {
  if (!Array.isArray(db.adminUsers) || db.adminUsers.length === 0) {
    db.adminUsers = [{
      id: 'admin-abadi',
      username: '@Abadi',
      passwordHash: hashPassword('@MuliaB2026'),
      role: 'Super Admin',
      created_at: new Date().toISOString(),
    }];
    writeDb(db);
  }
  return db.adminUsers;
}

function publicAdminUser(user: any, db: any = readDb()) {
  const assignedSeoPages = Array.isArray((db.settings || {}).seoPages)
    ? (db.settings || {}).seoPages.filter((page: any) => page.adminUserId === user.id)
    : [];
  const assignedSeoPage = assignedSeoPages[0]
    ? {
        id: assignedSeoPages[0].id,
        subdomain: assignedSeoPages[0].subdomain,
        title: assignedSeoPages[0].title || assignedSeoPages[0].seoTitle || assignedSeoPages[0].subdomain,
      }
    : null;

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    created_at: user.created_at,
    updated_at: user.updated_at,
    assignedSeoPageId: assignedSeoPage?.id || null,
    assignedSeoPage,
    assignedSeoPages: assignedSeoPages.map((page: any) => ({
      id: page.id,
      subdomain: page.subdomain,
      title: page.title || page.seoTitle || page.subdomain,
    })),
  };
}

function syncAdminPostAssignment(db: any, adminUserId: string, nextSeoPageId: string | null | undefined) {
  const seoPages = Array.isArray(db.settings?.seoPages) ? db.settings.seoPages : [];
  if (!adminUserId) return;

  seoPages.forEach((page: any) => {
    if (page.adminUserId === adminUserId && page.id !== nextSeoPageId) {
      delete page.adminUserId;
    }
  });

  if (nextSeoPageId) {
    const targetPage = seoPages.find((page: any) => page.id === nextSeoPageId);
    if (targetPage) targetPage.adminUserId = adminUserId;
  }
}

function getSession(req: express.Request) {
  const token = req.header('x-admin-token');
  return token ? sessions.get(token) : undefined;
}

function appendAudit(db: any, entry: Record<string, unknown>) {
  db.auditLogs = [
    { id: `audit-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`, created_at: new Date().toISOString(), ...entry },
    ...(db.auditLogs || []),
  ].slice(0, 500);
}

function normalizeMotorImages(value: unknown, fallback: unknown = []): string[] {
  const source = Array.isArray(value) ? value : Array.isArray(fallback) ? fallback : [fallback];
  return source.map((image: unknown) => String(image || '').trim()).filter(Boolean);
}

function isSharedCatalogImageUrl(value: string) {
  try {
    const url = new URL(value);
    const filename = url.pathname.slice('/uploads/'.length);
    return url.origin === 'https://kreditmotorhonda.tech'
      && url.pathname.startsWith('/uploads/')
      && Boolean(filename)
      && path.basename(filename) === filename
      && !url.search
      && !url.hash;
  } catch {
    return false;
  }
}

const imageReferenceFields = new Set(['image', 'images', 'heroImage', 'heroImages', 'logo', 'avatar', 'photo', 'banner', 'thumbnail']);
const importableImageHosts = new Set(['images.unsplash.com']);

function mapImageReferences(value: unknown, mapImage: (url: string) => string, field = ''): unknown {
  if (typeof value === 'string') return imageReferenceFields.has(field) ? mapImage(value) : value;
  if (Array.isArray(value)) return value.map((item) => mapImageReferences(item, mapImage, field));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapImageReferences(item, mapImage, key)]));
  }
  return value;
}

async function saveExternalImage(url: string): Promise<string> {
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== 'https:' || !importableImageHosts.has(parsedUrl.hostname)) {
    throw new Error('Sumber gambar tidak didukung. Unggah file gambar dari perangkat Anda.');
  }

  const response = await fetch(parsedUrl, { signal: AbortSignal.timeout(20000), redirect: 'error' });
  if (!response.ok) throw new Error(`Gambar eksternal gagal diunduh (HTTP ${response.status})`);
  if (!response.headers.get('content-type')?.startsWith('image/')) throw new Error('Sumber tidak mengirim file gambar');
  if (Number(response.headers.get('content-length') || 0) > MAX_IMAGE_UPLOAD_BYTES) throw new Error('Ukuran gambar melebihi batas 100 MB');
  if (!response.body) throw new Error('File gambar eksternal kosong');

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_IMAGE_UPLOAD_BYTES) {
      await reader.cancel();
      throw new Error('Ukuran gambar melebihi batas 100 MB');
    }
    chunks.push(Buffer.from(value));
  }

  const image = await sharp(Buffer.concat(chunks, totalBytes), { limitInputPixels: 40000000 })
    .rotate()
    .webp({ quality: 82 })
    .toBuffer();
  const filename = `import-${Date.now()}-${crypto.randomBytes(5).toString('hex')}.webp`;
  await fs.promises.writeFile(path.join(UPLOADS_DIR, filename), image, { flag: 'wx' });
  return `/uploads/${filename}`;
}

const SUPER_ADMIN_ALLOWED_HOSTS = new Set([
  'kreditmotorhonda.tech',
  'www.kreditmotorhonda.tech',
  'wijaya.kreditmotorhonda.tech',
  'kreditmotorhonda.id',
  'www.kreditmotorhonda.id',
  'solusikreditmotor.cloud',
  'www.solusikreditmotor.cloud',
  'localhost',
  '127.0.0.1',
  '::1',
]);
const SUPER_ADMIN_ALLOWED_ROOT_DOMAINS = new Set([
  'kreditmotorhonda.tech',
  'kreditmotorhonda.id',
  'solusikreditmotor.cloud',
]);

function normalizeAdminHost(hostname: string) {
  return String(hostname || '').trim().toLowerCase().replace(/:\d+$/, '').replace(/^www\./, '');
}

function isSuperAdminAllowedHost(hostname: string) {
  const host = normalizeAdminHost(hostname);
  return SUPER_ADMIN_ALLOWED_HOSTS.has(host)
    || [...SUPER_ADMIN_ALLOWED_ROOT_DOMAINS].some((domain) => host.endsWith(`.${domain}`));
}

function isAdminAuthorizedForHost(session: any, hostname: string, db: any = readDb()) {
  if (!session) return false;

  const host = normalizeAdminHost(hostname);
  if (session.role === 'Super Admin') return isSuperAdminAllowedHost(host);

  const hostPost = getSeoPageForHost(db.settings || {}, host);
  if (hostPost) {
    return session.id === hostPost.adminUserId;
  }

  const assignedSeoPage = Array.isArray(db.settings?.seoPages)
    ? db.settings.seoPages.find((page: any) => page.adminUserId === session.id)
    : undefined;
  if (!assignedSeoPage) return false;

  const assignedHost = String(assignedSeoPage.subdomain || '').trim().toLowerCase();
  const assignedDomainSuffix = getSeoPageDomainSuffix(assignedSeoPage);
  if (!assignedHost) return false;

  const permittedHosts = new Set([`${assignedHost}.${assignedDomainSuffix}`]);
  return permittedHosts.has(host);
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Sesi admin tidak valid atau sudah berakhir' });

  const host = normalizeAdminHost(req.hostname);
  if (session.role === 'Super Admin' && !isSuperAdminAllowedHost(host)) {
    return res.status(403).json({ error: 'Super Admin hanya dapat masuk dari domain utama yang diizinkan.' });
  }

  if (session.role !== 'Super Admin' && !isAdminAuthorizedForHost(session, host, readDb())) {
    return res.status(403).json({ error: 'Akses admin tidak diizinkan untuk domain ini.' });
  }

  (req as any).adminSession = session;
  next();
}

function getCatalogAccessState(req: express.Request) {
  const session = getSession(req);
  const host = normalizeAnalyticsHost(req.hostname);
  const isMainCatalogHost = host === 'kreditmotorhonda.tech';
  const isApprovedSuperAdminHost = Boolean(session?.role === 'Super Admin' && isSuperAdminAllowedHost(host));
  const isLocalCatalogHost = host === 'localhost' || host === '127.0.0.1';
  const canManageCatalog = Boolean(session) && (isMainCatalogHost || isApprovedSuperAdminHost || (session?.role === 'Super Admin' && isLocalCatalogHost));

  return {
    session,
    host,
    isMainCatalogHost,
    isSuperAdmin: session?.role === 'Super Admin',
    canManageCatalog,
    owner: isMainCatalogHost || isApprovedSuperAdminHost || (session?.role === 'Super Admin' && isLocalCatalogHost),
    adminUrl: 'https://kreditmotorhonda.tech/admin',
  };
}

function requireCatalogWriteAccess(req: express.Request, res: express.Response, next: express.NextFunction) {
  const access = getCatalogAccessState(req);
  if (!access.session) {
    return res.status(401).json({ error: 'Sesi admin tidak valid atau sudah berakhir' });
  }
  if (!access.canManageCatalog) {
    return res.status(403).json({ error: 'Hanya admin utama katalog yang dapat mengedit motor dan katalog shared.' });
  }
  next();
}

function requireSalesCounterAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Sesi admin tidak valid atau sudah berakhir' });
  if (session.role !== 'Super Admin' || !getSalesCounterRootDomain(req.hostname)) {
    return res.status(403).json({ error: 'Website Sales Counter hanya dapat dibuat oleh Super Admin di domain utama yang didukung.' });
  }
  (req as any).adminSession = session;
  next();
}

async function startServer() {
  const app = express();
  // CORS_ALLOWLIST_MIDDLEWARE
  const allowedOrigins = new Set([
    'https://kreditmotorhonda.tech',
    'https://wijaya.kreditmotorhonda.tech',
    'https://solusikreditmotor.cloud',
    'https://kreditmotorhonda.id',
    'https://www.kreditmotorhonda.id',
  ]);

  app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (origin && allowedOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS'
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With, X-Catalog-Upload'
      );
      res.setHeader('Access-Control-Max-Age', '600');

      if (req.method === 'OPTIONS') {
        return res.status(204).end();
      }
    }

    next();
  });
  app.use(compression());
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));
  app.use((req, res, next) => {
    if (req.hostname.toLowerCase() === 'www.kreditmotorhonda.tech') {
      return res.redirect(301, `https://kreditmotorhonda.tech${req.originalUrl}`);
    }
    next();
  });

  app.use((req, res, next) => {
    if (!CATALOG_API_URL || !isSharedCatalogRequest(req)) return next();
    if (!CATALOG_SERVICE_TOKEN) {
      return res.status(503).json({ error: 'Shared catalog proxy belum dikonfigurasi.' });
    }

    const requestPath = req.originalUrl.split('?')[0];
    const needsAdmin = !['GET', 'HEAD'].includes(req.method)
      || requestPath === '/api/motors/export.xlsx'
      || requestPath === '/api/motors/template.xlsx'
      || requestPath === '/api/fif-price-list/template';
    const session = needsAdmin ? getSession(req) : null;
    if (needsAdmin && !session) {
      return res.status(401).json({ error: 'Sesi admin tidak valid atau sudah berakhir' });
    }
    if (!['GET', 'HEAD'].includes(req.method) && !getCatalogAccessState(req).canManageCatalog) {
      return res.status(403).json({ error: 'Edit katalog hanya tersedia di admin utama kreditmotorhonda.tech.' });
    }

    let target: URL;
    try {
      target = new URL(req.originalUrl, CATALOG_API_URL);
    } catch {
      return res.status(503).json({ error: 'URL layanan katalog bersama tidak valid.' });
    }

    const headers: Record<string, string | string[] | undefined> = { ...req.headers, host: target.host, 'x-catalog-service-token': CATALOG_SERVICE_TOKEN };
    delete headers['x-admin-token'];
    delete headers['x-catalog-actor'];
    delete headers.connection;
    delete headers['proxy-connection'];
    delete headers['transfer-encoding'];
    delete headers['content-length'];
    const jsonBody = req.body === undefined ? undefined : Buffer.from(JSON.stringify(req.body));
    if (jsonBody) {
      headers['content-length'] = String(jsonBody.length);
      if (session) headers['x-catalog-actor'] = session.username;
    }

    const upstream = httpRequest(target, { method: req.method, headers }, (upstreamResponse) => {
      res.statusCode = upstreamResponse.statusCode || 502;
      for (const [name, value] of Object.entries(upstreamResponse.headers)) {
        if (value && !['connection', 'keep-alive', 'transfer-encoding', 'upgrade'].includes(name.toLowerCase())) {
          res.setHeader(name, value);
        }
      }

      if (session && res.statusCode >= 200 && res.statusCode < 300) {
        const db = readDb();
        appendAudit(db, {
          actor: session.username,
          action: `SHARED ${req.method} ${requestPath}`,
          resource: requestPath,
          details: 'Perubahan katalog bersama melalui panel admin situs ini',
        });
        writeDb(db);
      }
      upstreamResponse.pipe(res);
    });

    upstream.on('error', (error) => {
      console.error('Shared catalog proxy error:', error.message);
      if (!res.headersSent) res.status(502).json({ error: 'Layanan katalog bersama tidak dapat dijangkau.' });
      else res.destroy(error);
    });
    req.on('aborted', () => upstream.destroy());
    if (jsonBody) upstream.end(jsonBody);
    else req.pipe(upstream);
  });

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Public reads remain available; all writes require an authenticated admin.
  app.use('/api', (req, res, next) => {
    const fullPath = `/api${req.path}`;
    const isSharedCatalogUpload = fullPath === '/api/upload' && req.header('x-catalog-upload') === 'true';
    if (hasValidCatalogServiceToken(req) && (isSharedCatalogPath(fullPath) || isSharedCatalogUpload)) {
      if (req.method === 'GET' || req.method === 'HEAD') return next();
      const db = readDb();
      appendAudit(db, {
        actor: req.header('x-catalog-actor') || 'shared-catalog-proxy',
        action: `${req.method} ${fullPath}`,
        resource: fullPath,
        details: `Perubahan katalog dari ${req.header('x-forwarded-host') || 'situs lain'}`,
      });
      writeDb(db);
      return next();
    }

    const isPublicWrite =
      req.method === 'POST' &&
      (req.path === '/admin/login' || req.path === '/testimonials' || req.path === '/interests' || req.path === '/analytics/visit' || req.path === '/analytics/search' || req.path === '/analytics/whatsapp' || req.path === '/owner-dashboard/analytics');
    const hostPost = getSeoPageForHost(readDb().settings || {}, req.hostname);
    if (hostPost && req.method !== 'GET' && !isPublicWrite) {
      const session = getSession(req);
      if (!session) return res.status(401).json({ error: 'Sesi admin tidak valid atau sudah berakhir' });
      if (session.role !== 'Super Admin' && session.id !== hostPost.adminUserId) {
        return res.status(403).json({ error: 'Akun ini tidak ditugaskan ke post subdomain tersebut.' });
      }
      const allowedPostWrite = req.method === 'PUT' && req.path === '/settings'
        || req.method === 'POST' && (req.path === '/admin/logout' || req.path === '/upload')
        || ['POST', 'PUT', 'DELETE'].includes(req.method) && (/^\/promos(?:\/[^/]+)?$/.test(req.path) || /^\/articles(?:\/[^/]+)?$/.test(req.path));
      if (!allowedPostWrite) return res.status(403).json({ error: 'Admin post hanya dapat mengubah promo dan pengaturan situs post ini.' });
      (req as any).adminSession = session;
      return next();
    }
    if (req.method === 'GET' || isPublicWrite) return next();
    return requireAdmin(req, res, () => {
      const session = (req as any).adminSession;
      const isArticleWrite = /^\/articles(?:\/[^/]+)?$/.test(req.path);
      const db = isArticleWrite ? readSiteDb() : readDb();
      appendAudit(db, {
        actor: session.username,
        action: `${req.method} ${req.path}`,
        resource: req.path,
        details: 'Perubahan data melalui admin panel',
      });
      if (isArticleWrite) writeSiteDb(db);
      else writeDb(db);
      next();
    });
  });

  // Serve uploaded files
  const imageCacheDirectory = path.join(process.cwd(), 'data', 'image-cache');
  const supportedImageWidths = new Set([96, 160, 320, 400, 480, 640, 960, 1280]);
  const webpQuality = 70;
  app.get('/media/:filename', async (req, res, next) => {
    const filename = req.params.filename;
    const width = Number(req.query.width);
    if (path.basename(filename) !== filename || !supportedImageWidths.has(width)) {
      return res.sendStatus(400);
    }

    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(filename).toLowerCase())) return next();

    const uploadsPath = path.resolve(UPLOADS_DIR);
    const sourcePath = path.resolve(uploadsPath, filename);
    if (!sourcePath.startsWith(`${uploadsPath}${path.sep}`)) return res.sendStatus(400);

    try {
      const sourceStats = await fs.promises.stat(sourcePath);
      if (!sourceStats.isFile()) return res.sendStatus(404);

      const cacheKey = crypto
        .createHash('sha256')
        .update(`${filename}:${sourceStats.size}:${sourceStats.mtimeMs}:${width}:webp:${webpQuality}`)
        .digest('hex');
      const cachePath = path.join(imageCacheDirectory, `${cacheKey}.webp`);
      let imageBuffer: Buffer;

      try {
        imageBuffer = await fs.promises.readFile(cachePath);
      } catch {
        imageBuffer = await sharp(sourcePath)
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: webpQuality })
          .toBuffer();
        await fs.promises.mkdir(imageCacheDirectory, { recursive: true });
        await fs.promises.writeFile(cachePath, imageBuffer);
      }

      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      res.type('image/webp').send(imageBuffer);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return res.sendStatus(404);
      next(error);
    }
  });
  app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '1h' }));
  app.use('/api/files', express.static(UPLOADS_DIR));

  // --- API Endpoints ---
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Honda Wijaya Abadi API' });
  });

  // Settings
  app.get('/api/settings', (req, res) => {
    const db = readCatalogDb();
    const settings = db.settings || {};
    const page = getSeoPageForHost(settings, req.hostname);
    if (page) return res.json(publicSettings(getSettingsForSeoPage(settings, page)));
    const session = getSession(req);
    if (session?.role === 'Super Admin') return res.json(settings);
    return res.json(publicSettings(settings));
  });

  app.get('/api/fif-price-list', (req, res) => {
    res.json(currentFifPriceList());
  });

  app.get('/api/catalog/status', requireAdmin, (req, res) => {
    const access = getCatalogAccessState(req);
    res.json({
      owner: access.owner,
      canManageCatalog: access.canManageCatalog,
      adminUrl: access.adminUrl,
    });
  });

  app.get('/api/fif-price-list/template', (req, res) => {
    try {
      const db = readDb();
      const buffer = buildFifPriceListTemplate(currentFifPriceList(db), db.motors);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="template-price-list-fif-${new Date().toISOString().slice(0, 10)}.xlsx"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal membuat template price list' });
    }
  });

  app.post('/api/fif-price-list/import', requireCatalogWriteAccess, express.raw({
    type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'],
    limit: Infinity,
  }), (req, res) => {
    try {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: 'File Excel kosong atau tidak terbaca.' });
      }
      const db = readDb();
      db.fifPriceList = mergeFifPriceListWorkbook(req.body, currentFifPriceList(db), db.motors || []);
      if (!writeDb(db)) return res.status(500).json({ error: 'Gagal menyimpan price list ke database.' });
      return res.json({
        success: true,
        source: db.fifPriceList.source,
        updatedAt: db.fifPriceList.updatedAt,
        modelCount: Object.keys(db.fifPriceList.models).length,
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'File price list tidak valid.' });
    }
  });

  app.put('/api/settings', requireAdmin, (req, res) => {
    const db = readDb();
    const hostPage = getSeoPageForHost(db.settings || {}, req.hostname);
    const settingsUpdates = { ...(req.body || {}) };
    if (hostPage) {
      const session = (req as any).adminSession || getSession(req);
      if (!session || (session.role !== 'Super Admin' && session.id !== hostPage.adminUserId)) {
        return res.status(403).json({ error: 'Akun ini tidak ditugaskan ke post subdomain tersebut.' });
      }
      if (session.role !== 'Super Admin') {
        delete settingsUpdates.seoTitle;
        delete settingsUpdates.seoDescription;
        delete settingsUpdates.seoKeywords;
        delete settingsUpdates.seoRobots;
      }
    }
    if (!hostPage && Object.prototype.hasOwnProperty.call(settingsUpdates, 'seoPages')) {
      const session = (req as any).adminSession || getSession(req);
      if (session?.role !== 'Super Admin') {
        delete settingsUpdates.seoPages;
        delete settingsUpdates.ownerDashboard;
        if (Object.keys(settingsUpdates).length === 0) {
          return res.status(403).json({ error: 'Hanya Super Admin yang dapat mengelola post subdomain.' });
        }
      }
    }
    let hasExternalImage = false;
    mapImageReferences(settingsUpdates, (url) => {
      if (/^https?:\/\//i.test(url)) hasExternalImage = true;
      return url;
    });
    if (hasExternalImage) return res.status(400).json({ error: 'Unggah gambar melalui panel admin agar tersimpan di server.' });
    if (hostPage) {
      const siteSettingFields = [
        'name', 'tagline', 'phone', 'address', 'email', 'workingHours', 'logo', 'heroImage', 'heroImages',
        'heroTitle', 'heroMainTitle', 'heroTitleHighlight', 'heroSubtitle', 'heroBadge', 'heroCaption', 'footerText',
        'websiteTemplate', 'catalogAnimation', 'catalogAnimationSpeed', 'featuredMotorRotationInterval', 'customization',
      ];
      const siteSettings = { ...(hostPage.siteSettings || {}) };
      for (const field of siteSettingFields) {
        if (Object.prototype.hasOwnProperty.call(settingsUpdates, field)) siteSettings[field] = settingsUpdates[field];
      }
      const nextPage = {
        ...hostPage,
        siteSettings,
        ...(typeof settingsUpdates.seoTitle === 'string' ? { seoTitle: settingsUpdates.seoTitle.trim() } : {}),
        ...(typeof settingsUpdates.seoDescription === 'string' ? { seoDescription: settingsUpdates.seoDescription.trim() } : {}),
        ...(typeof settingsUpdates.seoKeywords === 'string' ? { seoKeywords: settingsUpdates.seoKeywords.trim() } : {}),
        ...(typeof settingsUpdates.seoRobots === 'string' ? { seoRobots: settingsUpdates.seoRobots } : {}),
        updated_at: new Date().toISOString(),
      };
      db.settings.seoPages = db.settings.seoPages.map((page: any) => page.id === hostPage.id ? nextPage : page);
      if (!writeDb(db)) return res.status(500).json({ error: 'Gagal menyimpan pengaturan post.' });
      return res.json(publicSettings(getSettingsForSeoPage(db.settings, nextPage)));
    }
    db.settings = { ...db.settings, ...settingsUpdates, updated_at: new Date().toISOString() };
    if (!writeDb(db)) {
      return res.status(500).json({ error: 'Gagal menyimpan pengaturan dealer. Periksa ruang penyimpanan dan izin database server.' });
    }
    res.json(db.settings);
  });

  // Motors
  app.get('/api/motors', (req, res) => {
    const db = readDb();
    res.json(db.motors || []);
  });

  const fifWorkbookHeaders = FIF_DP_PERCENTAGES.flatMap((percentage) => [
    `DP ${percentage}%`,
    ...FIF_TENORS.map((tenor) => `Cicilan DP ${percentage}% ${tenor} Bulan`),
  ]);
  const motorWorkbookHeaders = ['ID', 'Nama Motor', 'Kategori', 'Harga OTR', 'Spesifikasi', 'Bestseller', 'Deskripsi', ...fifWorkbookHeaders];
  const createMotorWorkbook = (motors: any[], priceList: any, includeGuide = false) => {
    const rows = [motorWorkbookHeaders, ...motors.map((motor) => {
      const fifEntry = Object.entries(priceList.models || {}).find(([modelName]) => (
        modelName === motor.name || normalizeFifModelName(modelName) === normalizeFifModelName(motor.name)
      )) as [string, any] | undefined;
      const fifOptions = fifEntry?.[1]?.options || {};
      const fifValues = FIF_DP_PERCENTAGES.flatMap((percentage) => {
        const values = fifOptions[String(percentage)] || [];
        return [values[0] || '', ...FIF_TENORS.map((_, index) => values[index + 1] || '')];
      });
      return [
        motor.id || '',
        motor.name || '',
        motor.category || '',
        fifEntry?.[1]?.price || motor.numericPrice || motor.price || '',
        Array.isArray(motor.specs) ? motor.specs.join('; ') : motor.specs || '',
        motor.is_bestseller ? 'Ya' : 'Tidak',
        motor.description || '',
        ...fifValues,
      ];
    })];
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 24 }, { wch: 34 }, { wch: 18 }, { wch: 18 }, { wch: 36 }, { wch: 14 }, { wch: 56 },
      ...FIF_DP_PERCENTAGES.flatMap(() => [{ wch: 16 }, ...FIF_TENORS.map(() => ({ wch: 18 }))]),
    ];
    worksheet['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(motorWorkbookHeaders.length - 1)}${Math.max(rows.length, 1)}` };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Motor');
    if (includeGuide) {
      const guide = XLSX.utils.aoa_to_sheet([
        ['Petunjuk Upload Motor'],
        ['Katalog motor saat ini sudah disertakan. Tambahkan motor baru setelah baris terakhir pada sheet Motor.'],
        ['Jangan mengubah nama kolom.'],
        ['ID yang cocok dengan katalog akan memperbarui motor; ID kosong atau baru akan menambahkan motor.'],
        ['Nama Motor dan Harga OTR wajib diisi. Harga boleh berupa angka atau format rupiah.'],
        ['Spesifikasi dipisahkan dengan titik koma (;). Contoh: 125cc; PGM-FI.'],
        ['Bestseller menerima Ya/Tidak.'],
        ['Isi nominal DP dan semua tenor untuk tiap persentase, atau biarkan seluruh paket persentase tersebut kosong.'],
        ['Foto dan paket cicilan yang sudah ada tidak diubah oleh upload massal.'],
        ['Motor yang tidak ada di file tidak akan dihapus.'],
      ]);
      guide['!cols'] = [{ wch: 110 }];
      XLSX.utils.book_append_sheet(workbook, guide, 'Petunjuk');
    }
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  };

  app.get('/api/motors/export.xlsx', (req, res) => {
    const db = readDb();
    const dateStr = new Date().toISOString().slice(0, 10);
    const buffer = createMotorWorkbook(Array.isArray(db.motors) ? db.motors : [], currentFifPriceList(db));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="katalog-motor-honda-${dateStr}.xlsx"`);
    res.send(buffer);
  });

  app.get('/api/motors/template.xlsx', (req, res) => {
    const db = readDb();
    const dateStr = new Date().toISOString().slice(0, 10);
    const buffer = createMotorWorkbook(Array.isArray(db.motors) ? db.motors : [], currentFifPriceList(db), true);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="template-upload-motor-${dateStr}.xlsx"`);
    res.send(buffer);
  });

  app.post('/api/motors/import', requireCatalogWriteAccess, express.raw({ type: ['text/csv', 'application/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'], limit: '5mb' }), (req, res) => {
    try {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'File upload kosong atau tidak terbaca.' });

      const workbook = XLSX.read(req.body, { type: 'buffer', raw: false });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!worksheet) return res.status(400).json({ error: 'File tidak memiliki data motor.' });

      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false, blankrows: false }) as unknown[][];
      const headers = (rows[0] || []).map((value) => String(value ?? '').replace(/^\uFEFF/, '').trim().toLocaleLowerCase('id-ID'));
      const requiredHeaders = ['id', 'nama motor', 'kategori', 'harga otr', 'spesifikasi', 'bestseller', 'deskripsi'];
      const hasAnyFifHeaders = fifWorkbookHeaders.some((header) => headers.includes(header.toLocaleLowerCase('id-ID')));
      const hasAllFifHeaders = fifWorkbookHeaders.every((header) => headers.includes(header.toLocaleLowerCase('id-ID')));
      if (hasAnyFifHeaders && !hasAllFifHeaders) return res.status(400).json({ error: 'Kolom DP dan cicilan tidak lengkap. Gunakan template Excel terbaru.' });
      const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
      if (missingHeaders.length > 0) return res.status(400).json({ error: `Kolom file tidak lengkap: ${missingHeaders.join(', ')}.` });
      if (rows.length > 501) return res.status(400).json({ error: 'Maksimal 500 motor per file.' });

      const allHeaders = hasAllFifHeaders ? [...requiredHeaders, ...fifWorkbookHeaders.map((header) => header.toLocaleLowerCase('id-ID'))] : requiredHeaders;
      const columnIndex = Object.fromEntries(allHeaders.map((header) => [header, headers.indexOf(header)]));
      const stagedMotors: Array<{ id: string; name: string; category: string; price: string; numericPrice: number; specs: string[]; is_bestseller: boolean; description: string; fifOptions: Record<string, number[]> }> = [];
      const seenIds = new Set<string>();
      const rowErrors: string[] = [];

      for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex];
        if (!row.some((value) => String(value ?? '').trim())) continue;
        const cell = (header: string) => String(row[columnIndex[header]] ?? '').trim();
        const id = cell('id');
        const name = cell('nama motor');
        const category = cell('kategori') || 'Matic';
        const numericPrice = Number(cell('harga otr').replace(/[^0-9]/g, ''));
        const rowNumber = rowIndex + 1;
        const fifOptions: Record<string, number[]> = {};

        if (!name) rowErrors.push(`Baris ${rowNumber}: nama motor wajib diisi.`);
        if (!Number.isSafeInteger(numericPrice) || numericPrice <= 0) rowErrors.push(`Baris ${rowNumber}: harga OTR tidak valid.`);
        if (id && seenIds.has(id)) rowErrors.push(`Baris ${rowNumber}: ID ${id} muncul lebih dari sekali.`);
        if (id) seenIds.add(id);

        if (hasAllFifHeaders) {
          for (const percentage of FIF_DP_PERCENTAGES) {
            const values = [
              cell(`dp ${percentage}%`),
              ...FIF_TENORS.map((tenor) => cell(`cicilan dp ${percentage}% ${tenor} bulan`)),
            ].map((value) => Number(value.replace(/[^0-9]/g, '')));
            if (values.every((value) => value === 0)) continue;
            if (values.some((value) => value <= 0)) {
              rowErrors.push(`Baris ${rowNumber}: paket DP ${percentage}% harus diisi lengkap untuk tenor ${FIF_TENORS.join(', ')} bulan.`);
            } else if (values[0] > numericPrice) {
              rowErrors.push(`Baris ${rowNumber}: nominal DP ${percentage}% melebihi Harga OTR.`);
            } else {
              fifOptions[String(percentage)] = values;
            }
          }
        }

        stagedMotors.push({
          id: id || `motor-${Date.now()}-${rowIndex}`,
          name,
          category,
          price: numericPrice > 0 ? numericPrice.toLocaleString('id-ID') : '',
          numericPrice,
          specs: cell('spesifikasi').split(/[;,]/).map((spec) => spec.trim()).filter(Boolean),
          is_bestseller: /^(ya|yes|true|1|iya)$/i.test(cell('bestseller')),
          description: cell('deskripsi'),
          fifOptions,
        });
      }

      if (stagedMotors.length === 0) return res.status(400).json({ error: 'Tidak ada baris motor untuk diimpor.' });
      if (rowErrors.length > 0) return res.status(400).json({ error: rowErrors.slice(0, 10).join(' ') });

      const db = readDb();
      const originalMotors = Array.isArray(db.motors) ? db.motors : [];
      const motors = [...originalMotors];
      let created = 0;
      let updated = 0;
      const now = new Date().toISOString();

      for (const importedMotor of stagedMotors) {
        const existingIndex = motors.findIndex((motor: any) => String(motor.id) === importedMotor.id);
        if (existingIndex >= 0) {
          const existingMotor = motors[existingIndex];
          const images = Array.isArray(existingMotor.images) ? existingMotor.images : (existingMotor.image ? [existingMotor.image] : []);
          motors[existingIndex] = { ...existingMotor, ...importedMotor, images, image: existingMotor.image || images[0] || '', updated_at: now };
          updated += 1;
        } else {
          motors.push({ ...importedMotor, image: '', images: [], interest_count: 0, created_at: now, updated_at: now });
          created += 1;
        }
      }

      db.motors = motors;
      if (hasAllFifHeaders) {
        try {
          for (const importedMotor of stagedMotors) {
            const previousName = originalMotors.find((motor: any) => String(motor.id) === importedMotor.id)?.name;
            saveMotorFifPriceListModel(db, {
              name: importedMotor.name,
              previousName,
              price: importedMotor.numericPrice,
              options: importedMotor.fifOptions,
            });
          }
        } catch (error: any) {
          return res.status(400).json({ error: error.message || 'Paket cicilan pada file tidak valid.' });
        }
      }
      if (!writeDb(db)) return res.status(500).json({ error: 'Gagal menyimpan katalog motor.' });
      return res.json({ created, updated, total: stagedMotors.length });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'File motor tidak valid.' });
    }
  });

  app.post('/api/motors', requireCatalogWriteAccess, (req, res) => {
    const db = readDb();
    const images = normalizeMotorImages(req.body.images, [req.body.image]);
    if (images.some((image) => /^https?:\/\//i.test(image) && !isSharedCatalogImageUrl(image))) {
      return res.status(400).json({ error: 'Unggah gambar motor melalui panel admin agar tersimpan di server.' });
    }
    if (images.length > MAX_MOTOR_IMAGES) {
      return res.status(400).json({ error: `Maksimal ${MAX_MOTOR_IMAGES} foto per motor` });
    }
    const newMotor = {
      id: req.body.id || `motor-${Date.now()}`,
      name: req.body.name || 'New Honda Motor',
      category: req.body.category || 'Matic',
      price: req.body.price || 'Rp 20.000.000',
      numericPrice: req.body.numericPrice || Number(String(req.body.price).replace(/[^0-9]/g, '')) || 20000000,
      image: images[0] || '',
      images,
      specs: Array.isArray(req.body.specs) ? req.body.specs : (typeof req.body.specs === 'string' ? req.body.specs.split(',').map((s: string) => s.trim()) : ['110cc']),
      description: req.body.description || '',
      is_bestseller: Boolean(req.body.is_bestseller),
      interest_count: req.body.interest_count || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.motors = [newMotor, ...(db.motors || [])];
    try {
      saveMotorFifPriceListModel(db, req.body.fifPriceListModel);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Data cicilan FIF motor tidak valid.' });
    }
    writeDb(db);
    res.status(201).json(newMotor);
  });

  app.put('/api/motors/:id', requireCatalogWriteAccess, (req, res) => {
    const db = readDb();
    const index = (db.motors || []).findIndex((m: any) => m.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Motor not found' });
    }
    const existingImages = Array.isArray(db.motors[index].images) ? db.motors[index].images : [db.motors[index].image];
    const images = normalizeMotorImages(req.body.images, existingImages);
    if (images.some((image) => /^https?:\/\//i.test(image) && !isSharedCatalogImageUrl(image))) {
      return res.status(400).json({ error: 'Unggah gambar motor melalui panel admin agar tersimpan di server.' });
    }
    if (images.length > MAX_MOTOR_IMAGES) {
      return res.status(400).json({ error: `Maksimal ${MAX_MOTOR_IMAGES} foto per motor` });
    }
    const { fifPriceListModel, ...motorData } = req.body || {};
    const updated = {
      ...db.motors[index],
      ...motorData,
      image: images[0] || '',
      images,
      numericPrice: req.body.numericPrice || (req.body.price ? Number(String(req.body.price).replace(/[^0-9]/g, '')) : db.motors[index].numericPrice),
      specs: Array.isArray(req.body.specs) ? req.body.specs : (typeof req.body.specs === 'string' ? req.body.specs.split(',').map((s: string) => s.trim()) : db.motors[index].specs),
      updated_at: new Date().toISOString()
    };
    db.motors[index] = updated;
    try {
      saveMotorFifPriceListModel(db, fifPriceListModel);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Data cicilan FIF motor tidak valid.' });
    }
    writeDb(db);
    res.json(updated);
  });

  app.delete('/api/motors/:id', requireCatalogWriteAccess, (req, res) => {
    const db = readDb();
    db.motors = (db.motors || []).filter((m: any) => m.id !== req.params.id);
    writeDb(db);
    res.json({ success: true, message: 'Motor deleted' });
  });

  // Promos
  app.get('/api/promos/global', (_req, res) => {
    const db = readDb();
    res.json(Array.isArray(db.globalPromos) ? db.globalPromos : []);
  });

  app.post('/api/promos/global', (req, res) => {
    const db = readDb();
    const body = req.body || {};
    const id = String(body.id || '').trim();
    const title = String(body.title || '').trim();
    if (!id || !title) return res.status(400).json({ error: 'ID dan judul promo wajib diisi.' });

    const images = Array.isArray(body.images)
      ? body.images.filter((image: unknown): image is string => typeof image === 'string' && Boolean(image.trim())).map((image: string) => {
          const value = image.trim();
          return value.startsWith('/uploads/') ? `https://kreditmotorhonda.tech${value}` : value;
        })
      : [];
    if (images.length > MAX_PROMO_IMAGES) {
      return res.status(400).json({ error: `Maksimal ${MAX_PROMO_IMAGES} foto per promo.` });
    }

    const globalPromos = Array.isArray(db.globalPromos) ? db.globalPromos : [];
    const previous = globalPromos.find((promo: any) => promo.id === id);
    const now = new Date().toISOString();
    const promo = {
      id,
      title,
      description: String(body.description || ''),
      terms: String(body.terms || 'S&K Berlaku'),
      badge: String(body.badge || 'Promo'),
      discountValue: String(body.discountValue || ''),
      images,
      promoAnimation: body.promoAnimation || 'fade',
      promoTemplate: body.promoTemplate || 'classic',
      disabledHosts: Array.isArray(previous?.disabledHosts) ? previous.disabledHosts : [],
      created_at: previous?.created_at || body.created_at || now,
      updated_at: now,
    };

    db.globalPromos = [promo, ...globalPromos.filter((item: any) => item.id !== id)];
    writeDb(db);
    res.json(promo);
  });

  app.get('/api/admin/global-promos', requireAdmin, (req, res) => {
    const session = (req as any).adminSession;
    if (session.role !== 'Super Admin') {
      return res.status(403).json({ error: 'Hanya Super Admin yang dapat mengatur publikasi promo global.' });
    }

    const db = readDb();
    const seoPages = Array.isArray(db.settings?.seoPages) ? db.settings.seoPages : [];
    const availableDomains = [...new Set([
      'kreditmotorhonda.tech',
      'kreditmotorhonda.id',
      'solusikreditmotor.cloud',
      'wijaya.kreditmotorhonda.tech',
      ...Object.keys(OWNER_ANALYTICS_SITE_DB_FILES),
      ...seoPages.map((page: any) => `${String(page.subdomain || '').trim().toLowerCase()}.kreditmotorhonda.tech`),
    ])].filter((host) => host && !host.startsWith('.')).sort();

    return res.json({ availableDomains });
  });

  app.put('/api/promos/global/:id/domains', requireAdmin, (req, res) => {
    const session = (req as any).adminSession;
    if (session.role !== 'Super Admin') {
      return res.status(403).json({ error: 'Hanya Super Admin yang dapat mengubah domain promo global.' });
    }

    const db = readDb();
    const globalPromos = Array.isArray(db.globalPromos) ? db.globalPromos : [];
    const promo = globalPromos.find((item: any) => item.id === req.params.id);
    if (!promo) return res.status(404).json({ error: 'Promo global tidak ditemukan.' });

    const seoPages = Array.isArray(db.settings?.seoPages) ? db.settings.seoPages : [];
    const allowedHosts = new Set([
      'kreditmotorhonda.tech',
      'kreditmotorhonda.id',
      'solusikreditmotor.cloud',
      'wijaya.kreditmotorhonda.tech',
      ...Object.keys(OWNER_ANALYTICS_SITE_DB_FILES),
      ...seoPages.map((page: any) => `${String(page.subdomain || '').trim().toLowerCase()}.kreditmotorhonda.tech`),
    ]);
    const disabledHosts = Array.isArray(req.body?.disabledHosts)
      ? [...new Set<string>(req.body.disabledHosts.map((host: unknown) => String(host || '').trim().toLowerCase()))]
        .filter((host) => allowedHosts.has(host))
      : [];

    promo.disabledHosts = disabledHosts;
    promo.updated_at = new Date().toISOString();
    db.globalPromos = globalPromos;
    appendAudit(db, {
      actor: session.username,
      action: 'UPDATE_GLOBAL_PROMO_DOMAINS',
      resource: promo.id,
      details: `Promo ${promo.title}; disembunyikan di: ${disabledHosts.join(', ') || 'tidak ada domain'}`,
    });
    if (!writeDb(db)) return res.status(500).json({ error: 'Gagal menyimpan pengaturan domain promo.' });
    return res.json({ disabledHosts });
  });

  app.delete('/api/promos/global/:id', (req, res) => {
    const db = readDb();
    db.globalPromos = (Array.isArray(db.globalPromos) ? db.globalPromos : []).filter((promo: any) => promo.id !== req.params.id);
    writeDb(db);
    res.json({ success: true });
  });

  app.get('/api/promos', (req, res) => {
      const collectionNames = ['motors', 'promos', 'globalPromos', 'testimonials', 'interests', 'manifesto', 'auditLogs', 'adminUsers'];
      const collections = ['motors', 'promos', 'globalPromos', 'testimonials', 'interests', 'manifesto', 'auditLogs', 'adminUsers'];
    const db = readDb();
    const hostPage = getSeoPageForHost(db.settings || {}, req.hostname);
    res.json(hostPage ? (Array.isArray(hostPage.promos) ? hostPage.promos : []) : db.promos || []);
  });

  app.post('/api/promos', requireAdmin, (req, res) => {
    const db = readDb();
    const hostPage = getSeoPageForHost(db.settings || {}, req.hostname);
    const images = Array.isArray(req.body.images)
      ? req.body.images.filter((image: unknown): image is string => typeof image === 'string' && Boolean(image.trim())).map((image: string) => image.trim())
      : [];
    if (images.some((image: string) => /^https?:\/\//i.test(image))) {
      return res.status(400).json({ error: 'Unggah gambar promo melalui panel admin agar tersimpan di server.' });
    }
    if (images.length > MAX_PROMO_IMAGES) {
      return res.status(400).json({ error: `Maksimal ${MAX_PROMO_IMAGES} foto per promo` });
    }
    const newPromo = {
      id: req.body.id || `promo-${Date.now()}`,
      title: req.body.title || 'Promo Menarik',
      description: req.body.description || '',
      terms: req.body.terms || 'S&K Berlaku',
      badge: req.body.badge || 'Promo',
      discountValue: req.body.discountValue || '',
      images,
      promoAnimation: req.body.promoAnimation || 'fade',
      promoTemplate: req.body.promoTemplate || 'classic',
      created_at: new Date().toISOString()
    };
    if (hostPage) hostPage.promos = [newPromo, ...(Array.isArray(hostPage.promos) ? hostPage.promos : [])];
    else db.promos = [newPromo, ...(db.promos || [])];
    writeDb(db);
    res.status(201).json(newPromo);
  });

  app.put('/api/promos/:id', requireAdmin, (req, res) => {
    const db = readDb();
    const hostPage = getSeoPageForHost(db.settings || {}, req.hostname);
    const promos = hostPage ? (Array.isArray(hostPage.promos) ? hostPage.promos : []) : (db.promos || []);
    const index = promos.findIndex((p: any) => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Promo not found' });
    const images = req.body.images === undefined
      ? promos[index].images || []
      : Array.isArray(req.body.images)
        ? req.body.images.filter((image: unknown): image is string => typeof image === 'string' && Boolean(image.trim())).map((image: string) => image.trim())
        : [];
    if (images.some((image: string) => /^https?:\/\//i.test(image))) {
      return res.status(400).json({ error: 'Pindahkan gambar promo lama ke penyimpanan server atau unggah ulang sebelum menyimpan.' });
    }
    if (images.length > MAX_PROMO_IMAGES) {
      return res.status(400).json({ error: `Maksimal ${MAX_PROMO_IMAGES} foto per promo` });
    }
    promos[index] = { ...promos[index], ...req.body, images };
    if (hostPage) hostPage.promos = promos;
    else db.promos = promos;
    writeDb(db);
    res.json(promos[index]);
  });

  app.delete('/api/promos/:id', requireAdmin, (req, res) => {
    const db = readDb();
    const hostPage = getSeoPageForHost(db.settings || {}, req.hostname);
    if (hostPage) hostPage.promos = (Array.isArray(hostPage.promos) ? hostPage.promos : []).filter((p: any) => p.id !== req.params.id);
    else db.promos = (db.promos || []).filter((p: any) => p.id !== req.params.id);
    writeDb(db);
    res.json({ success: true });
  });

  // Articles are stored independently from SEO subdomain posts.
  app.get('/api/articles', (req, res) => {
    const db = readSiteDb();
    const session = getSession(req);
    if (req.header('x-admin-token') && !session) return res.status(401).json({ error: 'Sesi admin tidak valid atau sudah berakhir' });
    if (session && !isAdminAuthorizedForHost(session, req.hostname, readDb())) return res.status(403).json({ error: 'Akses admin tidak diizinkan untuk domain ini.' });
    const articles = getSiteArticles(db, req.hostname);
    const visibleArticles = session ? articles : articles.filter((article: any) => article.published === true);
    res.json(visibleArticles.sort((left: any, right: any) => String(right.created_at || '').localeCompare(String(left.created_at || ''))));
  });

  app.post('/api/articles', requireAdmin, (req, res) => {
    const db = readSiteDb();
    const articles = getSiteArticles(db, req.hostname);
    const title = String(req.body.title || '').trim();
    const slug = String(req.body.slug || title).toLocaleLowerCase('id-ID').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63).replace(/-+$/g, '');
    const excerpt = String(req.body.excerpt || '').trim();
    const content = String(req.body.content || '').trim();
    const images = normalizeMotorImages(req.body.images);
    if (!title || !slug || !excerpt || !content) return res.status(400).json({ error: 'Judul, slug, ringkasan, dan isi artikel wajib diisi.' });
    if (articles.some((article: any) => article.slug === slug)) return res.status(409).json({ error: 'Slug artikel sudah digunakan.' });
    if (images.length > MAX_MOTOR_IMAGES) return res.status(400).json({ error: `Maksimal ${MAX_MOTOR_IMAGES} gambar per artikel.` });

    const now = new Date().toISOString();
    const article = {
      id: `article-${crypto.randomUUID()}`,
      title,
      slug,
      category: String(req.body.category || 'Tips Berkendara').trim(),
      excerpt,
      content,
      image: images[0] || '',
      images,
      animation: isCatalogAnimation(req.body.animation) ? req.body.animation : DEFAULT_CATALOG_ANIMATION,
      animationSpeed: normalizeCatalogAnimationSpeed(req.body.animationSpeed),
      author: String(req.body.author || 'Honda Wijaya Abadi').trim(),
      published: req.body.published === true,
      created_at: now,
      updated_at: now,
    };
    setSiteArticles(db, req.hostname, [article, ...articles]);
    if (!writeSiteDb(db)) return res.status(500).json({ error: 'Gagal menyimpan artikel.' });
    res.status(201).json(article);
  });

  app.put('/api/articles/:id', requireAdmin, (req, res) => {
    const db = readSiteDb();
    const articles = getSiteArticles(db, req.hostname);
    const index = articles.findIndex((article: any) => article.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Artikel tidak ditemukan.' });
    const current = articles[index];
    const title = String(req.body.title ?? current.title).trim();
    const slug = String(req.body.slug ?? current.slug).toLocaleLowerCase('id-ID').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63).replace(/-+$/g, '');
    const excerpt = String(req.body.excerpt ?? current.excerpt).trim();
    const content = String(req.body.content ?? current.content).trim();
    const images = req.body.images === undefined ? normalizeMotorImages(current.images, current.image) : normalizeMotorImages(req.body.images);
    if (!title || !slug || !excerpt || !content) return res.status(400).json({ error: 'Judul, slug, ringkasan, dan isi artikel wajib diisi.' });
    if (articles.some((article: any) => article.slug === slug && article.id !== current.id)) return res.status(409).json({ error: 'Slug artikel sudah digunakan.' });
    if (images.length > MAX_MOTOR_IMAGES) return res.status(400).json({ error: `Maksimal ${MAX_MOTOR_IMAGES} gambar per artikel.` });

    articles[index] = {
      ...current,
      title,
      slug,
      category: String(req.body.category ?? current.category ?? 'Tips Berkendara').trim(),
      excerpt,
      content,
      image: images[0] || '',
      images,
      animation: isCatalogAnimation(req.body.animation ?? current.animation) ? (req.body.animation ?? current.animation) : DEFAULT_CATALOG_ANIMATION,
      animationSpeed: normalizeCatalogAnimationSpeed(req.body.animationSpeed ?? current.animationSpeed),
      author: String(req.body.author ?? current.author ?? 'Honda Wijaya Abadi').trim(),
      published: req.body.published === undefined ? current.published === true : req.body.published === true,
      updated_at: new Date().toISOString(),
    };
    setSiteArticles(db, req.hostname, articles);
    if (!writeSiteDb(db)) return res.status(500).json({ error: 'Gagal memperbarui artikel.' });
    res.json(articles[index]);
  });

  app.delete('/api/articles/:id', requireAdmin, (req, res) => {
    const db = readSiteDb();
    const articles = getSiteArticles(db, req.hostname).filter((article: any) => article.id !== req.params.id);
    setSiteArticles(db, req.hostname, articles);
    if (!writeSiteDb(db)) return res.status(500).json({ error: 'Gagal menghapus artikel.' });
    res.json({ success: true });
  });

  // Testimonials
  app.get('/api/testimonials', (req, res) => {
    const db = readDb();
    res.json(db.testimonials || []);
  });

  app.post('/api/testimonials', (req, res) => {
    const db = readDb();
    const email = String(req.body.email || '').trim();
    const phone = String(req.body.phone || '').trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phonePattern = /^[0-9+()\-\s]{8,20}$/;

    if (email && !emailPattern.test(email)) {
      return res.status(400).json({ error: 'Format email tidak valid' });
    }
    if (phone && !phonePattern.test(phone)) {
      return res.status(400).json({ error: 'Format nomor telepon tidak valid' });
    }

    const newTestimonial = {
      id: req.body.id || `testi-${Date.now()}`,
      name: req.body.name || 'Pelanggan Setia',
      motor: req.body.motor || 'Honda',
      rating: Number(req.body.rating) || 5,
      comment: req.body.comment || '',
      email: email || undefined,
      phone: phone || undefined,
      approved: req.body.approved !== false,
      date: req.body.date || 'Baru saja',
      created_at: new Date().toISOString()
    };
    db.testimonials = [newTestimonial, ...(db.testimonials || [])];
    writeDb(db);
    res.status(201).json(newTestimonial);
  });

  app.put('/api/testimonials/:id', (req, res) => {
    const db = readDb();
    const index = (db.testimonials || []).findIndex((t: any) => t.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Testimonial not found' });

    const email = String(req.body.email ?? db.testimonials[index].email ?? '').trim();
    const phone = String(req.body.phone ?? db.testimonials[index].phone ?? '').trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phonePattern = /^[0-9+()\-\s]{8,20}$/;

    if (email && !emailPattern.test(email)) {
      return res.status(400).json({ error: 'Format email tidak valid' });
    }
    if (phone && !phonePattern.test(phone)) {
      return res.status(400).json({ error: 'Format nomor telepon tidak valid' });
    }

    db.testimonials[index] = { ...db.testimonials[index], ...req.body, email: email || undefined, phone: phone || undefined };
    writeDb(db);
    res.json(db.testimonials[index]);
  });

  app.delete('/api/testimonials/:id', (req, res) => {
    const db = readDb();
    db.testimonials = (db.testimonials || []).filter((t: any) => t.id !== req.params.id);
    writeDb(db);
    res.json({ success: true });
  });

  // Manifesto (Nilai & Komitmen)
  app.get('/api/manifesto', (req, res) => {
    const db = readDb();
    res.json(db.manifesto || []);
  });

  app.put('/api/manifesto/:id', (req, res) => {
    const db = readDb();
    const index = (db.manifesto || []).findIndex((m: any) => m.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Manifesto not found' });
    db.manifesto[index] = { ...db.manifesto[index], ...req.body };
    writeDb(db);
    res.json(db.manifesto[index]);
  });

  // Leads / Interests (Peminat & Konsultasi)
  app.get('/api/interests', requireAdmin, (req, res) => {
    const db = readDb();
    const session = (req as any).adminSession;
    const host = normalizeAnalyticsHost(req.hostname);
    const interests = session?.role === 'Super Admin'
      ? (db.interests || [])
      : (db.interests || []).filter((item: any) => normalizeAnalyticsHost(item.host || '') === host);
    res.json(interests);
  });

  app.post('/api/interests', (req, res) => {
    const db = readDb();
    const newLead = {
      id: `lead-${Date.now()}`,
      host: normalizeAnalyticsHost(req.hostname),
      motor_id: req.body.motor_id || '',
      motor_name: req.body.motor_name || 'Umum',
      customer_name: req.body.customer_name || 'Calon Pembeli',
      phone: req.body.phone || '',
      payment_method: req.body.payment_method || 'Kredit',
      dp_estimate: req.body.dp_estimate || '',
      note: req.body.note || '',
      status: 'Baru',
      created_at: new Date().toISOString()
    };
    db.interests = [newLead, ...(db.interests || [])];

    // Increment interest count on motor if specified
    if (newLead.motor_id) {
      const mIdx = (db.motors || []).findIndex((m: any) => m.id === newLead.motor_id);
      if (mIdx !== -1) {
        db.motors[mIdx].interest_count = (db.motors[mIdx].interest_count || 0) + 1;
      }
    }
    writeDb(db);
    res.status(201).json(newLead);
  });

  app.patch('/api/interests/:id/status', requireAdmin, (req, res) => {
    const db = readDb();
    const index = (db.interests || []).findIndex((i: any) => i.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Lead not found' });
    const session = (req as any).adminSession;
    if (session?.role !== 'Super Admin' && normalizeAnalyticsHost(db.interests[index].host || '') !== normalizeAnalyticsHost(req.hostname)) {
      return res.status(403).json({ error: 'Peminat ini bukan milik domain admin Anda.' });
    }
    db.interests[index].status = req.body.status || 'Dihubungi';
    writeDb(db);
    res.json(db.interests[index]);
  });

  app.delete('/api/interests/:id', requireAdmin, (req, res) => {
    const db = readDb();
    const session = (req as any).adminSession;
    const target = (db.interests || []).find((item: any) => item.id === req.params.id);
    if (target && session?.role !== 'Super Admin' && normalizeAnalyticsHost(target.host || '') !== normalizeAnalyticsHost(req.hostname)) {
      return res.status(403).json({ error: 'Peminat ini bukan milik domain admin Anda.' });
    }
    db.interests = (db.interests || []).filter((i: any) => i.id !== req.params.id);
    writeDb(db);
    res.json({ success: true });
  });

  // Visitor events are stored without IP addresses or other personal identifiers.
  app.post('/api/analytics/visit', (req, res) => {
    const sessionId = String(req.body?.sessionId || '');
    const pagePath = String(req.body?.path || '/');
    const host = normalizeAnalyticsHost(req.hostname);
    const allowedSources = new Set(['Organik Search', 'Social Media', 'Direct', 'Referral', 'Lainnya']);
    const source = allowedSources.has(String(req.body?.source || '')) ? String(req.body.source) : 'Lainnya';
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(sessionId) || !pagePath.startsWith('/') || pagePath.length > 200 || pagePath.startsWith('/admin')) {
      return res.status(400).json({ error: 'Data kunjungan tidak valid.' });
    }

    const db = readDb();
    db.visitorLogs = Array.isArray(db.visitorLogs) ? db.visitorLogs : [];
    const existing = db.visitorLogs.find((entry: any) => entry.sessionId === sessionId && (entry.host || 'kreditmotorhonda.tech') === host);
    if (existing) return res.status(200).json({ recorded: false });

    const visit = {
      id: `visit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      sessionId,
      host,
      timestamp: new Date().toISOString(),
      path: pagePath,
      source,
    };
    db.visitorLogs.push(visit);
    if (!writeDb(db)) return res.status(500).json({ error: 'Gagal menyimpan log pengunjung.' });
    return res.status(201).json({ recorded: true });
  });

  app.post('/api/analytics/search', (req, res) => {
    const sessionId = String(req.body?.sessionId || '');
    const eventId = String(req.body?.eventId || '');
    const keyword = String(req.body?.keyword ?? req.body?.query ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
    const normalizedKeyword = normalizeSearchKeyword(keyword);
    const host = normalizeAnalyticsHost(req.hostname);
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(sessionId) || (eventId && !/^[a-zA-Z0-9_-]{8,100}$/.test(eventId)) || keyword.length < 2 || keyword.length > 100 || /[\u0000-\u001f]/.test(keyword)) {
      return res.status(400).json({ error: 'Kata kunci pencarian tidak valid.' });
    }

    const db = readDb();
    db.searchLogs = Array.isArray(db.searchLogs) ? db.searchLogs : [];
    const existing = db.searchLogs.find((entry: any) =>
      normalizeAnalyticsHost(entry.host || 'kreditmotorhonda.tech') === host
      && (eventId
        ? entry.sessionId === sessionId && entry.eventId === eventId
        : entry.sessionId === sessionId && normalizeSearchKeyword(entry.keyword) === normalizedKeyword)
    );
    if (existing) return res.status(200).json({ recorded: false });

    db.searchLogs.push({
      id: `search-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      ...(eventId ? { eventId } : {}),
      sessionId,
      host,
      timestamp: new Date().toISOString(),
      keyword,
    });
    if (db.searchLogs.length > 20_000) db.searchLogs.splice(0, db.searchLogs.length - 20_000);
    if (!writeDb(db)) return res.status(500).json({ error: 'Gagal menyimpan kata kunci pencarian.' });
    return res.status(201).json({ recorded: true });
  });

  app.post('/api/analytics/whatsapp', (req, res) => {
    const sessionId = String(req.body?.sessionId || '');
    const eventId = String(req.body?.eventId || '');
    const pagePath = String(req.body?.path || '/');
    const menu = String(req.body?.menu || '').trim().replace(/[\u0000-\u001f]/g, ' ');
    const host = normalizeAnalyticsHost(req.hostname);
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(sessionId)
      || (eventId && !/^[a-zA-Z0-9_-]{8,100}$/.test(eventId))
      || !pagePath.startsWith('/') || pagePath.length > 200
      || pagePath.startsWith('/admin') || pagePath.startsWith('/owner-dashboard')
      || !menu || menu.length > 120) {
      return res.status(400).json({ error: 'Data klik WhatsApp tidak valid.' });
    }

    const db = readDb();
    db.whatsappLogs = Array.isArray(db.whatsappLogs) ? db.whatsappLogs : [];
    if (eventId && db.whatsappLogs.some((entry: any) => entry.eventId === eventId && entry.sessionId === sessionId)) {
      return res.status(200).json({ recorded: false });
    }

    db.whatsappLogs.push({
      id: `whatsapp-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      eventId,
      sessionId,
      host,
      timestamp: new Date().toISOString(),
      path: pagePath,
      menu,
    });
    if (db.whatsappLogs.length > 20_000) db.whatsappLogs.splice(0, db.whatsappLogs.length - 20_000);
    if (!writeDb(db)) return res.status(500).json({ error: 'Gagal menyimpan klik WhatsApp.' });
    return res.status(201).json({ recorded: true });
  });

  app.get('/api/admin/owner-dashboard', requireAdmin, (req, res) => {
    const session = (req as any).adminSession;
    if (session.role !== 'Super Admin') {
      return res.status(403).json({ error: 'Hanya Super Admin yang dapat mengatur dashboard owner.' });
    }
    const db = readDb();
    const config = db.settings?.ownerDashboard || {};
    const token = String(config.token || '');
    return res.json({
      selectedHosts: Array.isArray(config.hosts) ? config.hosts : [],
      dashboardUrl: token ? `https://kreditmotorhonda.tech/owner-dashboard?key=${encodeURIComponent(token)}` : '',
    });
  });

  app.put('/api/admin/owner-dashboard', requireAdmin, (req, res) => {
    const session = (req as any).adminSession;
    if (session.role !== 'Super Admin') {
      return res.status(403).json({ error: 'Hanya Super Admin yang dapat mengatur dashboard owner.' });
    }

    const db = readDb();
    const seoPages = Array.isArray(db.settings?.seoPages) ? db.settings.seoPages : [];
    const allowedHosts = new Set([
      'kreditmotorhonda.tech',
      ...Object.keys(OWNER_ANALYTICS_SITE_DB_FILES),
      ...seoPages.map((page: any) => `${String(page.subdomain || '').toLocaleLowerCase('en-US')}.kreditmotorhonda.tech`),
    ]);
    const requestedHosts = Array.isArray(req.body?.hosts) ? req.body.hosts : [];
    const hosts = [...new Set(requestedHosts.map((host: unknown) => String(host || '').trim().toLocaleLowerCase('en-US')))]
      .filter((host) => allowedHosts.has(host));
    if (!hosts.length) return res.status(400).json({ error: 'Pilih setidaknya satu website untuk dashboard owner.' });

    const token = String(db.settings?.ownerDashboard?.token || crypto.randomBytes(32).toString('base64url'));
    db.settings = { ...db.settings, ownerDashboard: { token, hosts }, updated_at: new Date().toISOString() };
    appendAudit(db, { actor: session.username, action: 'UPDATE_OWNER_DASHBOARD', resource: 'owner-dashboard', details: `Website owner: ${hosts.join(', ')}` });
    if (!writeDb(db)) return res.status(500).json({ error: 'Gagal menyimpan konfigurasi dashboard owner.' });

    return res.json({
      selectedHosts: hosts,
      dashboardUrl: `https://kreditmotorhonda.tech/owner-dashboard?key=${encodeURIComponent(token)}`,
    });
  });

  app.post('/api/owner-dashboard/analytics', async (req, res) => {
    const db = readDb();
    const config = db.settings?.ownerDashboard || {};
    const providedToken = Buffer.from(String(req.body?.key || ''));
    const expectedToken = Buffer.from(String(config.token || ''));
    if (!expectedToken.length || providedToken.length !== expectedToken.length || !crypto.timingSafeEqual(providedToken, expectedToken)) {
      return res.status(404).json({ error: 'Tautan dashboard tidak valid atau sudah dinonaktifkan.' });
    }

    const validHosts = new Set<string>(Array.isArray(config.hosts) ? config.hosts.map(String) : []);
    const validStart = isValidDateKey(req.body?.startDate) ? req.body.startDate : '';
    const validEnd = isValidDateKey(req.body?.endDate) ? req.body.endDate : '';
    let startDate = validStart;
    let endDate = validEnd;
    if (startDate && endDate && startDate > endDate) [startDate, endDate] = [endDate, startDate];

    const databaseSources = new Map<string, string>();
    for (const host of validHosts) {
      const sourceFile = OWNER_ANALYTICS_SITE_DB_FILES[host] || DB_FILE;
      if (!databaseSources.has(sourceFile)) databaseSources.set(sourceFile, OWNER_ANALYTICS_SITE_DB_FILES[host] ? host : 'kreditmotorhonda.tech');
    }
    const databaseContents = new Map<string, any>();
    const allLogs: Array<{ timestamp: string; path?: string; host?: string; sessionId?: string; source?: string }> = [];
    const allSearchLogs: Array<{ timestamp: string; keyword?: string; host?: string; sessionId?: string }> = [];
    const allWhatsappLogs: Array<{ timestamp: string; path?: string; menu?: string; host?: string; sessionId?: string }> = [];
    for (const [sourceFile, legacyHost] of databaseSources) {
      try {
        const sourceDb = JSON.parse(fs.readFileSync(sourceFile, 'utf-8'));
        databaseContents.set(sourceFile, sourceDb);
        const sourceLogs = Array.isArray(sourceDb.visitorLogs) ? sourceDb.visitorLogs : [];
        const sourceSearchLogs = Array.isArray(sourceDb.searchLogs) ? sourceDb.searchLogs : [];
        const sourceWhatsappLogs = Array.isArray(sourceDb.whatsappLogs) ? sourceDb.whatsappLogs : [];
        allLogs.push(...sourceLogs.map((log: any) => ({
          ...log,
          host: normalizeAnalyticsHost(log.host || legacyHost),
        })));
        allSearchLogs.push(...sourceSearchLogs.map((log: any) => ({
          ...log,
          host: normalizeAnalyticsHost(log.host || legacyHost),
        })));
        allWhatsappLogs.push(...sourceWhatsappLogs.map((log: any) => ({
          ...log,
          host: normalizeAnalyticsHost(log.host || legacyHost),
        })));
      } catch (error: any) {
        if (error.code !== 'ENOENT') console.error(`Owner analytics could not read ${sourceFile}:`, error.message);
      }
    }
    const siteAdmins = [...validHosts].map((host) => {
      const sourceFile = OWNER_ANALYTICS_SITE_DB_FILES[host] || DB_FILE;
      const sourceDb = databaseContents.get(sourceFile) || {};
      const assignedSeoPage = (Array.isArray(sourceDb.settings?.seoPages) ? sourceDb.settings.seoPages : [])
        .find((page: any) => `${String(page.subdomain || '').toLocaleLowerCase('en-US')}.kreditmotorhonda.tech` === host);
      const hasSeoPost = assignedSeoPage && getSeoLandingPosts(assignedSeoPage).length > 0;
      const admins = (hasSeoPost ? (Array.isArray(sourceDb.adminUsers) ? sourceDb.adminUsers : []) : [])
        .filter((user: any) => user.role !== 'Super Admin' && user.id === assignedSeoPage.adminUserId)
        .map((user: any) => ({ username: String(user.username || ''), role: String(user.role || 'Admin') }))
        .filter((user: any) => user.username);
      return { host, dataAvailable: databaseContents.has(sourceFile), admins };
    });
    const allSiteLeads = [...databaseSources.entries()].flatMap(([sourceFile, legacyHost]) => {
      const sourceDb = databaseContents.get(sourceFile) || {};
      const interests = Array.isArray(sourceDb.interests) ? sourceDb.interests : [];
      return interests.map((lead: any) => ({
        id: String(lead.id || ''),
        host: normalizeAnalyticsHost(lead.host || legacyHost),
        customerName: String(lead.customer_name || 'Calon Pembeli'),
        motorName: String(lead.motor_name || 'Umum'),
        status: String(lead.status || 'Baru'),
        createdAt: String(lead.created_at || ''),
      })).filter((lead: any) => lead.id && validHosts.has(lead.host));
    }).sort((left: any, right: any) => right.createdAt.localeCompare(left.createdAt));
    const filteredSiteLeads = allSiteLeads.filter((lead: any) => {
      if (!startDate && !endDate) return true;
      if (!Number.isFinite(Date.parse(lead.createdAt))) return false;
      const date = getJakartaDateParts(lead.createdAt).date;
      return (!startDate || date >= startDate) && (!endDate || date <= endDate);
    });
    const siteLeads = req.body?.includeAllLeads === true ? filteredSiteLeads : filteredSiteLeads.slice(0, 20);
    const logs = allLogs
      .filter((log) => validHosts.has(log.host || ''))
      .map((log) => ({ ...log, host: normalizeAnalyticsHost(log.host), ...getJakartaDateParts(log.timestamp) }))
      .filter((log) => (!startDate || log.date >= startDate) && (!endDate || log.date <= endDate));
    const previousPeriodChange = (() => {
      if (!startDate || !endDate) return null;
      const periodDays = buildDateKeys(startDate, endDate).length;
      if (!periodDays) return null;

      const previousEnd = new Date(`${startDate}T00:00:00.000Z`);
      previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
      const previousEndKey = previousEnd.toISOString().slice(0, 10);
      const previousStart = new Date(previousEnd);
      previousStart.setUTCDate(previousStart.getUTCDate() - periodDays + 1);
      const previousStartKey = previousStart.toISOString().slice(0, 10);
      const previousVisits = allLogs.filter((log) => validHosts.has(log.host || ''))
        .filter((log) => {
          const date = getJakartaDateParts(log.timestamp).date;
          return date >= previousStartKey && date <= previousEndKey;
        }).length;

      return previousVisits
        ? Number((((logs.length - previousVisits) / previousVisits) * 100).toFixed(1))
        : null;
    })();
    const countsByHost = new Map<string, number>();
    const countsByDate = new Map<string, number>();
    const countsByPage = new Map<string, number>();
    const countsBySource = new Map<string, number>();
    logs.forEach((log) => {
      countsByHost.set(log.host, (countsByHost.get(log.host) || 0) + 1);
      countsByDate.set(log.date, (countsByDate.get(log.date) || 0) + 1);
      const pageKey = `${log.host}${log.path || '/'}`;
      countsByPage.set(pageKey, (countsByPage.get(pageKey) || 0) + 1);
      const source = String(log.source || 'Lainnya');
      countsBySource.set(source, (countsBySource.get(source) || 0) + 1);
    });

    const recordedDates = [...countsByDate.keys()].sort();
    const rangeStart = startDate || recordedDates[0];
    const rangeEnd = endDate || recordedDates.at(-1);
    const dateKeys = rangeStart && rangeEnd ? buildDateKeys(rangeStart, rangeEnd) : [];
    const dailyVisitors = dateKeys.map((date) => ({
      date,
      label: new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(`${date}T12:00:00+07:00`)),
      visits: countsByDate.get(date) || 0,
    }));
    const sites = [...validHosts].map((host) => ({ host, visits: countsByHost.get(host) || 0 }))
      .sort((left, right) => right.visits - left.visits);
    const trafficSources = ['Organik Search', 'Social Media', 'Direct', 'Referral', 'Lainnya']
      .map((source) => ({ source, visits: countsBySource.get(source) || 0 }))
      .filter((item) => item.visits > 0);
    const allTopPages = [...countsByPage.entries()]
      .map(([page, visits]) => ({ page, visits }))
      .sort((left, right) => right.visits - left.visits);
    const topPages = req.body?.includeAllPages === true ? allTopPages : allTopPages.slice(0, 10);
    const filteredSearchLogs = allSearchLogs
      .filter((log) => validHosts.has(log.host || ''))
      .map((log) => ({ ...log, ...getJakartaDateParts(log.timestamp) }))
      .filter((log) => (!startDate || log.date >= startDate) && (!endDate || log.date <= endDate));
    const searchTermsByKeyword = new Map<string, { keyword: string; searches: number; sessions: Set<string> }>();
    filteredSearchLogs.forEach((log) => {
      const normalizedKeyword = normalizeSearchKeyword(log.keyword);
      if (!normalizedKeyword) return;
      const current = searchTermsByKeyword.get(normalizedKeyword) || {
        keyword: String(log.keyword).trim(),
        searches: 0,
        sessions: new Set<string>(),
      };
      current.searches += 1;
      if (log.sessionId) current.sessions.add(log.sessionId);
      searchTermsByKeyword.set(normalizedKeyword, current);
    });
    const allSearchTerms = [...searchTermsByKeyword.values()]
      .map(({ keyword, searches, sessions }) => ({ keyword, searches, uniqueVisitors: sessions.size }))
      .sort((left, right) => right.searches - left.searches || left.keyword.localeCompare(right.keyword, 'id'));
    const searchTerms = req.body?.includeAllSearchTerms === true ? allSearchTerms : allSearchTerms.slice(0, 50);
    const filteredWhatsappLogs = allWhatsappLogs
      .filter((log) => validHosts.has(log.host || ''))
      .map((log) => ({ ...log, ...getJakartaDateParts(log.timestamp) }))
      .filter((log) => (!startDate || log.date >= startDate) && (!endDate || log.date <= endDate));
    const whatsappClicksByMenu = new Map<string, { host: string; path: string; menu: string; clicks: number; sessions: Set<string> }>();
    filteredWhatsappLogs.forEach((log) => {
      const host = normalizeAnalyticsHost(log.host);
      const path = String(log.path || '/');
      const menu = String(log.menu || 'WhatsApp');
      const key = `${host}\u0000${path}\u0000${normalizeSearchKeyword(menu)}`;
      const current = whatsappClicksByMenu.get(key) || { host, path, menu, clicks: 0, sessions: new Set<string>() };
      current.clicks += 1;
      if (log.sessionId) current.sessions.add(log.sessionId);
      whatsappClicksByMenu.set(key, current);
    });
    const whatsappClicks = [...whatsappClicksByMenu.values()]
      .map(({ sessions, ...item }) => ({ ...item, uniqueVisitors: sessions.size }))
      .sort((left, right) => right.clicks - left.clicks || left.host.localeCompare(right.host, 'en'))
      .slice(0, 100);
    let googleSearchConsole;
    try {
      googleSearchConsole = await getGoogleSearchConsoleKeywords(startDate || undefined, endDate || undefined);
    } catch (error: any) {
      googleSearchConsole = {
        configured: true,
        rows: [],
        sites: [],
        errors: [String(error?.message || 'Gagal mengambil data Google Search Console.')],
      };
    }

    return res.json({
      totalVisits: logs.length,
      previousPeriodChange,
      siteCount: validHosts.size,
      sites,
      trafficSources,
      siteAdmins,
      siteLeads,
      siteLeadsTotal: filteredSiteLeads.length,
      dailyVisitors,
      topPages,
      topPagesTotal: allTopPages.length,
      searchTerms,
      searchTermsTotal: allSearchTerms.length,
      googleSearchConsole,
      whatsappClicks,
      timeZone: 'Asia/Jakarta',
    });
  });

  // Analytics & Stats
  app.get('/api/analytics', (req, res) => {
    const db = readDb();
    const motors = db.motors || [];
    const interests = db.interests || [];
    const categories = motors.reduce((acc: any, m: any) => {
      acc[m.category] = (acc[m.category] || 0) + 1;
      return acc;
    }, {});
    const visitorLogs: Array<{ timestamp: string; path?: string }> = Array.isArray(db.visitorLogs) ? db.visitorLogs : [];
    const validStart = isValidDateKey(req.query.startDate) ? req.query.startDate : '';
    const validEnd = isValidDateKey(req.query.endDate) ? req.query.endDate : '';
    let startDate = validStart;
    let endDate = validEnd;
    if (startDate && endDate && startDate > endDate) [startDate, endDate] = [endDate, startDate];

    const datedLogs = visitorLogs.map((log) => ({ ...log, ...getJakartaDateParts(log.timestamp) }));
    const filteredLogs = datedLogs.filter((log) =>
      (!startDate || log.date >= startDate) && (!endDate || log.date <= endDate)
    );
    const dailyCounts = new Map<string, number>();
    const hourlyCounts = new Map<string, number>();
    for (const log of filteredLogs) {
      dailyCounts.set(log.date, (dailyCounts.get(log.date) || 0) + 1);
      hourlyCounts.set(log.hour, (hourlyCounts.get(log.hour) || 0) + 1);
    }

    let dateKeys: string[];
    if (startDate || endDate) {
      const rangeStart = startDate || filteredLogs.map((log) => log.date).sort()[0] || endDate;
      const rangeEnd = endDate || filteredLogs.map((log) => log.date).sort().at(-1) || startDate;
      dateKeys = rangeStart && rangeEnd ? buildDateKeys(rangeStart, rangeEnd) : [];
    } else {
      const recordedDates = [...dailyCounts.keys()].sort();
      dateKeys = recordedDates.length ? buildDateKeys(recordedDates[0], recordedDates[recordedDates.length - 1]) : [];
    }

    const dailyVisitors = dateKeys.map((date) => ({
      date,
      label: new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(`${date}T12:00:00+07:00`)).replace('.', ''),
      visits: dailyCounts.get(date) || 0,
    }));
    const hourlyVisitors = Array.from({ length: 24 }, (_, hour) => {
      const label = `${String(hour).padStart(2, '0')}:00`;
      return { label, visits: hourlyCounts.get(label) || 0 };
    });
    const peakHour = hourlyVisitors.reduce((peak, item) => item.visits > peak.visits ? item : peak, hourlyVisitors[0]);
    const totalViews = filteredLogs.length;

    res.json({
      totalMotors: motors.length,
      totalPromos: (db.promos || []).length,
      totalTestimonials: (db.testimonials || []).length,
      totalInterests: interests.length,
      newInterests: interests.filter((i: any) => i.status === 'Baru').length,
      categoryBreakdown: categories,
      analytics: {
        totalViews,
        simulatorUsed: Number(db.analytics?.simulatorUsed || 0),
        compareUsed: Number(db.analytics?.compareUsed || 0),
        dailyVisitors,
        hourlyVisitors,
        peakHour: peakHour.visits ? peakHour.label : '-',
        visitorLogCount: visitorLogs.length,
        timeZone: 'Asia/Jakarta',
      },
    });
  });

  // File Upload (Base64)
  app.post('/api/upload', express.raw({ type: ['image/*', 'application/octet-stream'], limit: MAX_IMAGE_UPLOAD_BYTES }), (req, res) => {
    try {
      let buffer: Buffer;
      let ext = 'png';
      let filename = '';

      if (Buffer.isBuffer(req.body)) {
        const mimeType = String(req.headers['content-type'] || '').split(';')[0];
        try {
          filename = decodeURIComponent(String(req.headers['x-file-name'] || ''));
        } catch {
          filename = '';
        }
        const fileExtension = filename.split('.').pop()?.toLowerCase() || '';
        const knownImageExtension = ['avif', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'].includes(fileExtension);
        if (!mimeType.startsWith('image/') && !(mimeType === 'application/octet-stream' && knownImageExtension)) {
          return res.status(415).json({ error: 'File yang diunggah harus berupa gambar' });
        }
        buffer = req.body;
        ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
      } else {
        const { filename: legacyFilename, base64Data } = req.body || {};
        if (!base64Data) {
          return res.status(400).json({ error: 'base64Data is required' });
        }
        filename = legacyFilename || '';
        const matches = String(base64Data).match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
          buffer = Buffer.from(matches[2], 'base64');
        } else {
          buffer = Buffer.from(base64Data, 'base64');
        }
      }

      if (buffer.length === 0) {
        return res.status(400).json({ error: 'File gambar kosong' });
      }

      const requestedName = (filename || `upload.${ext}`).replace(/[^a-zA-Z0-9._-]/g, '_');
      const safeName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${requestedName}`;
      const targetPath = path.join(UPLOADS_DIR, safeName);
      fs.writeFileSync(targetPath, buffer);

      const fileUrl = req.header('x-catalog-upload') === 'true'
        ? `https://kreditmotorhonda.tech/uploads/${safeName}`
        : `/uploads/${safeName}`;
      res.json({ url: fileUrl, filename: safeName, success: true });
    } catch (err: any) {
      console.error('Upload failed:', err);
      res.status(500).json({ error: 'Upload failed: ' + err.message });
    }
  });

  app.post('/api/admin/images/migrate-external', requireAdmin, async (_req, res) => {
    try {
      const db = readDb();
      const externalUrls = new Set<string>();
      mapImageReferences(db, (url) => {
        if (/^https?:\/\//i.test(url)) externalUrls.add(url);
        return url;
      });

      const localUrls = new Map<string, string>();
      let unsupportedCount = 0;
      let failedCount = 0;
      for (const url of externalUrls) {
        let hostname = '';
        try {
          hostname = new URL(url).hostname;
        } catch {
          unsupportedCount += 1;
          continue;
        }
        if (!importableImageHosts.has(hostname)) {
          unsupportedCount += 1;
          continue;
        }
        try {
          localUrls.set(url, await saveExternalImage(url));
        } catch (error) {
          console.error('External image import failed:', error);
          failedCount += 1;
        }
      }

      let updatedReferences = 0;
      const updatedDb = mapImageReferences(db, (url) => {
        const localUrl = localUrls.get(url);
        if (localUrl) updatedReferences += 1;
        return localUrl || url;
      });
      if (localUrls.size && !writeDb(updatedDb)) return res.status(500).json({ error: 'Gambar tersimpan, tetapi database gagal diperbarui.' });

      return res.json({ migratedCount: localUrls.size, updatedReferences, unsupportedCount, failedCount });
    } catch (error: any) {
      console.error('External image migration failed:', error);
      return res.status(500).json({ error: error.message || 'Gagal memindahkan gambar eksternal.' });
    }
  });

  // Admin authentication and management
  app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body || {};
    const db = readDb();
    const users = ensureAdminUsers(db);
    const user = users.find((item: any) => item.username === String(username || '').trim());
    if (!user || !verifyPassword(String(password || ''), user.passwordHash)) {
      return res.status(401).json({ error: 'Username atau password tidak valid' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const session = { id: user.id, username: user.username, role: user.role, createdAt: new Date().toISOString() };
    sessions.set(token, session);
    appendAudit(db, { actor: user.username, action: 'LOGIN', resource: 'admin-session', details: 'Login admin berhasil' });
    writeDb(db);
    return res.json({ success: true, token, user: { username: user.username, role: user.role, id: user.id } });
  });

  app.post('/api/admin/logout', requireAdmin, (req, res) => {
    const token = req.header('x-admin-token');
    if (token) sessions.delete(token);
    res.json({ success: true });
  });

  app.get('/api/admin/me', requireAdmin, (req, res) => {
    res.json((req as any).adminSession);
  });

  app.post('/api/admin/seo-pages/:id/provision-ssl', requireAdmin, async (req, res) => {
    const session = (req as any).adminSession;
    if (session.role !== 'Super Admin') {
      return res.status(403).json({ error: 'Hanya Super Admin yang dapat mengaktifkan SSL post.' });
    }

    const db = readDb();
    const page = (Array.isArray(db.settings?.seoPages) ? db.settings.seoPages : []).find((item: any) => item.id === req.params.id);
    if (!page) return res.status(404).json({ error: 'Post subdomain tidak ditemukan.' });

    page.sslStatus = 'provisioning';
    page.sslError = undefined;
    page.updated_at = new Date().toISOString();
    writeDb(db);

    let result: { status: 'pending' | 'active' | 'failed'; message: string };
    try {
      result = await provisionSeoPageSsl(page, db.settings || {});
    } catch (error: any) {
      result = { status: 'failed', message: String(error.message || 'Konfigurasi HTTPS gagal.').slice(0, 500) };
    }

    page.sslStatus = result.status;
    page.sslError = result.status === 'active' ? undefined : result.message;
    page.updated_at = new Date().toISOString();
    appendAudit(db, {
      actor: session.username,
      action: 'PROVISION_SEO_POST_SSL',
      resource: page.id,
      details: `${getSeoPageOrigin(page)}: ${result.status}`,
    });
    if (!writeDb(db)) return res.status(500).json({ error: 'Status SSL gagal disimpan.' });

    return res.status(result.status === 'active' ? 200 : 202).json({
      status: result.status,
      message: result.message,
      seoPages: db.settings.seoPages.map(publicSeoPage),
    });
  });

  app.get('/api/admin/users', requireAdmin, (req, res) => {
    if ((req as any).adminSession?.role !== 'Super Admin') {
      return res.status(403).json({ error: 'Hanya Super Admin yang dapat melihat daftar admin.' });
    }
    const db = readDb();
    res.json(ensureAdminUsers(db).map((user: any) => publicAdminUser(user, db)));
  });

  app.get('/api/admin/sales-counters', requireSalesCounterAdmin, (req, res) => {
    const db = readDb();
    const domainSuffix = getSalesCounterRootDomain(req.hostname)!;
    const pages = Array.isArray(db.settings?.seoPages)
      ? db.settings.seoPages.filter((page: any) => page.siteType === 'sales-counter'
        && getSeoPageDomainSuffix(page) === domainSuffix)
      : [];
    const users = ensureAdminUsers(db);
    res.json(pages.map((page: any) => {
      const user = users.find((item: any) => item.id === page.adminUserId);
      return {
        id: page.id,
        subdomain: page.subdomain,
        domainSuffix,
        name: page.siteSettings?.name || page.title || page.subdomain,
        phone: page.siteSettings?.phone || '',
        username: user?.username || '',
        adminUserId: page.adminUserId,
        seoTitle: page.seoTitle || '',
        seoDescription: page.seoDescription || '',
        seoKeywords: page.seoKeywords || '',
        seoRobots: page.seoRobots || 'index, follow',
        sslStatus: page.sslStatus || 'pending',
        sslError: page.sslError,
        updated_at: page.updated_at,
      };
    }));
  });

  app.put('/api/admin/sales-counters/:id/seo', requireSalesCounterAdmin, (req, res) => {
    const db = readDb();
    const domainSuffix = getSalesCounterRootDomain(req.hostname)!;
    const page = (Array.isArray(db.settings?.seoPages) ? db.settings.seoPages : [])
      .find((item: any) => item.id === req.params.id
        && item.siteType === 'sales-counter'
        && getSeoPageDomainSuffix(item) === domainSuffix);
    if (!page) return res.status(404).json({ error: 'Sales Counter tidak ditemukan pada domain ini.' });

    page.seoTitle = String(req.body?.seoTitle || '').trim().slice(0, 70);
    page.seoDescription = String(req.body?.seoDescription || '').trim().slice(0, 160);
    page.seoKeywords = String(req.body?.seoKeywords || '').trim().slice(0, 300);
    page.seoRobots = ['index, follow', 'noindex, follow', 'index, nofollow', 'noindex, nofollow']
      .includes(req.body?.seoRobots) ? req.body.seoRobots : 'index, follow';
    page.updated_at = new Date().toISOString();
    appendAudit(db, {
      actor: (req as any).adminSession.username,
      action: 'UPDATE_SALES_COUNTER_SEO',
      resource: page.id,
      details: `Memperbarui SEO ${page.subdomain}.${domainSuffix}`,
    });
    if (!writeDb(db)) return res.status(500).json({ error: 'SEO Sales Counter gagal disimpan.' });
    return res.json({
      id: page.id,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      seoKeywords: page.seoKeywords,
      seoRobots: page.seoRobots,
      updated_at: page.updated_at,
    });
  });

  app.post('/api/admin/sales-counters', requireSalesCounterAdmin, async (req, res) => {
    const session = (req as any).adminSession;
    const db = readDb();
    db.settings = db.settings || {};
    const users = ensureAdminUsers(db);
    const sourceSettings = db.settings;
    const domainSuffix = getSalesCounterRootDomain(req.hostname)!;
    const name = String(req.body?.name || '').trim();
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    const phone = String(req.body?.phone || '').replace(/[^0-9]/g, '');
    const subdomain = String(req.body?.subdomain || '').trim().toLocaleLowerCase('en-US');
    const seoTitle = String(req.body?.seoTitle || '').trim().slice(0, 70);
    const seoDescription = String(req.body?.seoDescription || '').trim().slice(0, 160);
    const seoKeywords = String(req.body?.seoKeywords || '').trim().slice(0, 300);
    const reservedSubdomains = new Set([...RESERVED_SEO_SUBDOMAINS, 'kreditmotorhonda', 'solusi', 'sales']);

    if (!name || !username || password.length < 8 || phone.length < 8) {
      return res.status(400).json({ error: 'Nama, username, nomor WhatsApp valid, dan password minimal 8 karakter wajib diisi.' });
    }
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain) || reservedSubdomains.has(subdomain)) {
      return res.status(400).json({ error: 'Subdomain tidak valid atau menggunakan nama yang dicadangkan.' });
    }
    if (users.some((user: any) => String(user.username || '').toLocaleLowerCase('en-US') === username.toLocaleLowerCase('en-US'))) {
      return res.status(409).json({ error: 'Username admin sudah digunakan.' });
    }
    const currentPages = Array.isArray(sourceSettings.seoPages) ? sourceSettings.seoPages : [];
    if (currentPages.some((page: any) => page.subdomain === subdomain && getSeoPageDomainSuffix(page) === domainSuffix)) {
      return res.status(409).json({ error: 'Subdomain sudah digunakan pada domain ini.' });
    }

    const now = new Date().toISOString();
    const suffix = crypto.randomBytes(4).toString('hex');
    const adminUserId = `admin-${Date.now()}-${suffix}`;
    const pageId = `sales-site-${Date.now()}-${suffix}`;
    const normalizedPhone = phone.startsWith('0') ? `62${phone.slice(1)}` : phone;
    const page: any = {
      id: pageId,
      siteType: 'sales-counter',
      subdomain,
      domainSuffix,
      adminUserId,
      title: `${name} | Sales Counter Honda`,
      content: '',
      seoTitle: seoTitle || `${name} | Sales Counter Honda Bandung`.slice(0, 70),
      seoDescription: seoDescription || `Hubungi ${name}, Sales Counter Honda Bandung. Konsultasi motor, harga, promo, dan simulasi kredit Honda melalui WhatsApp.`.slice(0, 160),
      seoKeywords: seoKeywords || `${name}, sales Honda Bandung, kredit motor Honda Bandung`.slice(0, 300),
      seoRobots: 'index, follow',
      siteSettings: {
        name,
        tagline: 'Sales Counter Resmi Honda Bandung',
        phone: normalizedPhone,
        address: sourceSettings.address,
        email: sourceSettings.email,
        workingHours: sourceSettings.workingHours,
        logo: sourceSettings.logo,
        heroImage: sourceSettings.heroImage,
        heroImages: sourceSettings.heroImages,
        customization: sourceSettings.customization,
        heroBadge: 'SALES COUNTER HONDA',
        heroMainTitle: 'Konsultasi &',
        heroTitleHighlight: 'Pengajuan Kredit Motor Honda',
        heroSubtitle: `Konsultasikan kebutuhan motor Honda, harga, promo, dan simulasi kredit bersama ${name}.`,
        footerText: `Hubungi ${name}, Sales Counter Honda Wijaya Abadi, untuk konsultasi motor dan pengajuan kredit.`,
        websiteTemplate: sourceSettings.websiteTemplate || 'wijaya-enerjik',
      },
      sslStatus: 'pending',
      updated_at: now,
    };
    const newUser = {
      id: adminUserId,
      username,
      passwordHash: hashPassword(password),
      role: 'Staff Admin',
      created_at: now,
    };

    db.adminUsers = users;
    db.adminUsers.push(newUser);
    db.settings.seoPages = [page, ...currentPages];
    appendAudit(db, { actor: session.username, action: 'CREATE_SALES_COUNTER', resource: pageId, details: `Membuat website Sales Counter ${name} (${subdomain}.${domainSuffix})` });
    if (!writeDb(db)) return res.status(500).json({ error: 'Data Sales Counter gagal disimpan.' });

    let sslResult: { status: 'pending' | 'active' | 'failed'; message: string };
    try {
      sslResult = await provisionSeoPageSsl(page, db.settings);
    } catch (error: any) {
      sslResult = { status: 'failed', message: String(error.message || 'Konfigurasi HTTPS gagal.').slice(0, 500) };
    }
    page.sslStatus = sslResult.status;
    page.sslError = sslResult.status === 'active' ? undefined : sslResult.message;
    page.updated_at = new Date().toISOString();
    appendAudit(db, {
      actor: session.username,
      action: 'PROVISION_SALES_COUNTER_SSL',
      resource: pageId,
      details: `${subdomain}.${domainSuffix}: ${sslResult.status}`,
    });
    if (!writeDb(db)) return res.status(500).json({ error: 'Website dibuat, tetapi status SSL gagal disimpan.' });

    return res.status(201).json({
      id: page.id,
      subdomain: page.subdomain,
      domainSuffix,
      name,
      phone: normalizedPhone,
      username,
      adminUserId,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      seoKeywords: page.seoKeywords,
      seoRobots: page.seoRobots,
      sslStatus: page.sslStatus,
      sslError: page.sslError,
      updated_at: page.updated_at,
    });
  });

  app.delete('/api/admin/sales-counters/:id', requireSalesCounterAdmin, (req, res) => {
    const session = (req as any).adminSession;
    const db = readDb();
    const pages = Array.isArray(db.settings?.seoPages) ? db.settings.seoPages : [];
    const page = pages.find((item: any) => item.id === req.params.id && item.siteType === 'sales-counter');
    if (!page || getSeoPageDomainSuffix(page) !== getSalesCounterRootDomain(req.hostname)) {
      return res.status(404).json({ error: 'Sales Counter tidak ditemukan pada domain ini.' });
    }

    db.settings.seoPages = pages.filter((item: any) => item.id !== page.id);
    db.adminUsers = (Array.isArray(db.adminUsers) ? db.adminUsers : []).filter((user: any) => user.id !== page.adminUserId);
    for (const [token, activeSession] of sessions) {
      if (activeSession.id === page.adminUserId) sessions.delete(token);
    }
    appendAudit(db, {
      actor: session.username,
      action: 'DELETE_SALES_COUNTER',
      resource: page.id,
      details: `Menghapus ${page.subdomain}.${page.domainSuffix} dan akun admin terkait`,
    });
    if (!writeDb(db)) return res.status(500).json({ error: 'Sales Counter gagal dihapus.' });
    return res.json({ success: true });
  });

  app.post('/api/admin/users', requireAdmin, (req, res) => {
    const session = (req as any).adminSession;
    if (session.role !== 'Super Admin') return res.status(403).json({ error: 'Hanya Super Admin yang dapat membuat admin' });
    const db = readDb();
    const users = ensureAdminUsers(db);
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    const assignedSeoPageId = req.body && Object.prototype.hasOwnProperty.call(req.body, 'assignedSeoPageId')
      ? String(req.body.assignedSeoPageId || '').trim()
      : '';
    if (!username || password.length < 8) return res.status(400).json({ error: 'Username wajib diisi dan password minimal 8 karakter' });
    if (users.some((item: any) => item.username.toLowerCase() === username.toLowerCase())) {
      return res.status(409).json({ error: 'Username sudah digunakan' });
    }
    const role = req.body?.role === 'Super Admin' ? 'Super Admin' : 'Staff Admin';
    if (role === 'Staff Admin' && !assignedSeoPageId) {
      return res.status(400).json({ error: 'Staff Admin wajib ditugaskan ke satu post/domain.' });
    }
    const assignedPage = assignedSeoPageId
      ? (Array.isArray(db.settings?.seoPages) ? db.settings.seoPages.find((page: any) => page.id === assignedSeoPageId) : undefined)
      : undefined;
    if (assignedSeoPageId && !assignedPage) return res.status(404).json({ error: 'Post/domain admin tidak ditemukan.' });
    const newUser = { id: `admin-${Date.now()}`, username, passwordHash: hashPassword(password), role, created_at: new Date().toISOString() };
    db.adminUsers.push(newUser);
    syncAdminPostAssignment(db, newUser.id, assignedSeoPageId || null);
    appendAudit(db, { actor: session.username, action: 'CREATE_ADMIN', resource: newUser.id, details: `Membuat admin ${username}` });
    writeDb(db);
    res.status(201).json(publicAdminUser(newUser, db));
  });

  app.put('/api/admin/users/:id', requireAdmin, (req, res) => {
    const session = (req as any).adminSession;
    const db = readDb();
    const users = ensureAdminUsers(db);
    const index = users.findIndex((item: any) => item.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Admin tidak ditemukan' });
    if (session.role !== 'Super Admin' && session.id !== req.params.id) return res.status(403).json({ error: 'Tidak memiliki izin mengubah admin lain' });
    const current = users[index];
    const username = String(req.body?.username ?? current.username).trim();
    const password = req.body?.password ? String(req.body.password) : '';
    const hasAssignmentUpdate = Object.prototype.hasOwnProperty.call(req.body || {}, 'assignedSeoPageId');
    const assignedSeoPageId = hasAssignmentUpdate ? String(req.body.assignedSeoPageId || '').trim() : undefined;
    if (!username || (password && password.length < 8)) return res.status(400).json({ error: 'Username wajib diisi dan password minimal 8 karakter' });
    const nextRole = session.role === 'Super Admin' && req.body?.role
      ? (req.body.role === 'Super Admin' ? 'Super Admin' : 'Staff Admin')
      : current.role;
    if (nextRole === 'Staff Admin' && hasAssignmentUpdate && !assignedSeoPageId) {
      return res.status(400).json({ error: 'Staff Admin wajib ditugaskan ke satu post/domain.' });
    }
    if (hasAssignmentUpdate && assignedSeoPageId && !(Array.isArray(db.settings?.seoPages) && db.settings.seoPages.some((page: any) => page.id === assignedSeoPageId))) {
      return res.status(404).json({ error: 'Post/domain admin tidak ditemukan.' });
    }
    users[index] = { ...current, username, role: nextRole, ...(password ? { passwordHash: hashPassword(password) } : {}), updated_at: new Date().toISOString() };
    if (hasAssignmentUpdate) syncAdminPostAssignment(db, users[index].id, assignedSeoPageId || null);
    appendAudit(db, { actor: session.username, action: 'UPDATE_ADMIN', resource: current.id, details: `Mengubah akun ${current.username}` });
    writeDb(db);
    res.json(publicAdminUser(users[index], db));
  });

  app.post('/api/admin/change-password', requireAdmin, (req, res) => {
    const session = (req as any).adminSession;
    const db = readDb();
    const users = ensureAdminUsers(db);
    const user = users.find((item: any) => item.id === session.id);
    if (!user) return res.status(404).json({ error: 'Akun admin tidak ditemukan.' });

    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(400).json({ error: 'Password saat ini tidak sesuai.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password baru minimal 8 karakter.' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'Password baru harus berbeda dari password saat ini.' });
    }

    user.passwordHash = hashPassword(newPassword);
    user.updated_at = new Date().toISOString();
    appendAudit(db, {
      actor: session.username,
      action: 'CHANGE_OWN_PASSWORD',
      resource: user.id,
      details: `Mengganti password akun ${session.username}`,
    });
    if (!writeDb(db)) return res.status(500).json({ error: 'Password gagal disimpan.' });

    const currentToken = req.header('x-admin-token');
    for (const [token, activeSession] of sessions) {
      if (activeSession.id === user.id && token !== currentToken) sessions.delete(token);
    }
    return res.json({ success: true });
  });

  app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
    const session = (req as any).adminSession;
    if (session.role !== 'Super Admin') return res.status(403).json({ error: 'Hanya Super Admin yang dapat menghapus admin' });
    const db = readDb();
    const users = ensureAdminUsers(db);
    if (users.length <= 1) return res.status(400).json({ error: 'Minimal harus ada satu admin' });
    const deleted = users.find((item: any) => item.id === req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Admin tidak ditemukan' });
    syncAdminPostAssignment(db, deleted.id, null);
    db.adminUsers = users.filter((item: any) => item.id !== req.params.id);
    appendAudit(db, { actor: session.username, action: 'DELETE_ADMIN', resource: deleted.id, details: `Menghapus akun ${deleted.username}` });
    writeDb(db);
    res.json({ success: true });
  });

  app.get('/api/admin/audit', requireAdmin, (req, res) => {
    const db = readDb();
    res.json(db.auditLogs || []);
  });

  app.get('/api/admin/report', requireAdmin, (req, res) => {
    const db = readDb();
    const dateStr = new Date().toISOString().split('T')[0];
    const workbook = XLSX.utils.book_new();
    const ratings = (db.testimonials || []).map((item: any) => ({
      ID: item.id,
      Nama: item.name,
      Motor: item.motor,
      Rating: item.rating,
      Komentar: item.comment,
      Status: item.approved === false ? 'Pending' : 'Approved',
      Email: item.email || '',
      Telepon: item.phone || '',
      Tanggal: item.date || item.created_at || '',
    }));
    const interests = (db.interests || []).map((item: any) => ({
      ID: item.id,
      Tanggal: item.created_at || '',
      Nama: item.customer_name,
      WhatsApp: item.phone,
      'Unit Diminati': item.motor_name,
      Pembayaran: item.payment_method,
      'Estimasi DP': item.dp_estimate || '',
      Catatan: item.note || '',
      Status: item.status,
    }));
    const history = (db.auditLogs || []).map((item: any) => ({
      ID: item.id,
      Waktu: item.created_at,
      Aktor: item.actor,
      Aksi: item.action,
      Resource: item.resource,
      Detail: item.details,
    }));

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(ratings), 'Rating');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(interests), 'Minat Konsumen');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(history), 'Histori Perubahan');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="laporan-admin-hwa-${dateStr}.xlsx"`);
    res.send(buffer);
  });

  // Download / Export All Data (JSON)
  app.get('/api/export/all', requireAdmin, (req, res) => {
    try {
      const db = readDb();
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `honda-wijaya-abadi-backup-${dateStr}.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(JSON.stringify(db, null, 2));
    } catch (err: any) {
      res.status(500).json({ error: 'Gagal mengekspor data: ' + err.message });
    }
  });

  // Download / Export CSV per collection
  app.get('/api/export/csv/:type', requireAdmin, (req, res) => {
    try {
      const db = readDb();
      const type = req.params.type;
      const dateStr = new Date().toISOString().split('T')[0];

      if (type === 'interests' || type === 'leads') {
        const items = db.interests || [];
        const headers = ['ID', 'Tanggal', 'Nama Pelanggan', 'WhatsApp', 'Unit Motor', 'Metode Pembayaran', 'Estimasi DP', 'Catatan', 'Status'];
        const rows = items.map((i: any) => [
          `"${i.id || ''}"`,
          `"${i.created_at || ''}"`,
          `"${(i.customer_name || '').replace(/"/g, '""')}"`,
          `"${(i.phone || '').replace(/"/g, '""')}"`,
          `"${(i.motor_name || '').replace(/"/g, '""')}"`,
          `"${(i.payment_method || '').replace(/"/g, '""')}"`,
          `"${(i.dp_estimate || '').replace(/"/g, '""')}"`,
          `"${(i.note || '').replace(/"/g, '""')}"`,
          `"${(i.status || '').replace(/"/g, '""')}"`
        ]);
        const csvContent = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="data-peminat-honda-hwa-${dateStr}.csv"`);
        return res.send(csvContent);
      }

      if (type === 'motors') {
        const items = db.motors || [];
        const headers = ['ID', 'Nama Motor', 'Kategori', 'Harga OTR', 'Spesifikasi', 'Bestseller', 'Deskripsi'];
        const rows = items.map((m: any) => [
          `"${m.id || ''}"`,
          `"${(m.name || '').replace(/"/g, '""')}"`,
          `"${(m.category || '').replace(/"/g, '""')}"`,
          `"${(m.price || '').replace(/"/g, '""')}"`,
          `"${(Array.isArray(m.specs) ? m.specs.join('; ') : m.specs || '').replace(/"/g, '""')}"`,
          `"${m.is_bestseller ? 'Ya' : 'Tidak'}"`,
          `"${(m.description || '').replace(/"/g, '""')}"`
        ]);
        const csvContent = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="katalog-motor-honda-hwa-${dateStr}.csv"`);
        return res.send(csvContent);
      }

      if (type === 'promos') {
        const items = db.promos || [];
        const headers = ['ID', 'Judul Promo', 'Badge/Diskon', 'Deskripsi', 'Syarat & Ketentuan'];
        const rows = items.map((p: any) => [
          `"${p.id || ''}"`,
          `"${(p.title || '').replace(/"/g, '""')}"`,
          `"${(p.discountValue || p.badge || '').replace(/"/g, '""')}"`,
          `"${(p.description || '').replace(/"/g, '""')}"`,
          `"${(p.terms || '').replace(/"/g, '""')}"`
        ]);
        const csvContent = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="promo-honda-hwa-${dateStr}.csv"`);
        return res.send(csvContent);
      }

      if (type === 'testimonials') {
        const items = db.testimonials || [];
        const headers = ['ID', 'Nama Pelanggan', 'Motor Dibeli', 'Rating Bintang', 'Komentar'];
        const rows = items.map((t: any) => [
          `"${t.id || ''}"`,
          `"${(t.name || '').replace(/"/g, '""')}"`,
          `"${(t.motor || '').replace(/"/g, '""')}"`,
          `"${t.rating || 5}"`,
          `"${(t.comment || '').replace(/"/g, '""')}"`
        ]);
        const csvContent = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="testimoni-pelanggan-hwa-${dateStr}.csv"`);
        return res.send(csvContent);
      }

      res.status(400).json({ error: 'Tipe data CSV tidak valid. Gunakan interests, motors, promos, atau testimonials.' });
    } catch (err: any) {
      res.status(500).json({ error: 'Gagal mengekspor CSV: ' + err.message });
    }
  });

  // Restore / Import Database (JSON)
  app.post('/api/import/all', (req, res) => {
    try {
      const data = req.body;
      if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'Format data JSON tidak valid' });
      }
      writeDb(data);
      res.json({ success: true, message: 'Database berhasil dipulihkan dari data backup' });
    } catch (err: any) {
      res.status(500).json({ error: 'Gagal memulihkan database: ' + err.message });
    }
  });

  app.get('/sitemap.xml', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    const db = readDb();
    db.articles = getSiteArticles(readSiteDb(), req.hostname);
    res.type('application/xml').send(renderDynamicSitemap(db, req.hostname));
  });

  app.get('/robots.txt', (req, res) => {
    const db = readDb();
    const page = getSeoPageForHost(db.settings || {}, req.hostname);
    const indexRule = !page || (page.sslStatus === 'active' && page.seoRobots !== 'noindex, follow') ? 'Allow: /' : 'Disallow: /';
    const sitemapOrigin = page ? getSeoPageOrigin(page) : `https://${normalizeAdminHost(req.hostname)}`;
    res.set('Cache-Control', 'public, max-age=3600');
    return res.type('text/plain').send(`User-agent: *\n${indexRule}\nDisallow: /admin\nDisallow: /dashboard\nDisallow: /login\nDisallow: /api\nDisallow: /tmp\n\nSitemap: ${sitemapOrigin}/sitemap.xml\n`);
  });

  app.get('/motor/:slug', (req, res) => {
    const db = readDb();
    const productPage = getSeoMotorPages(db).find((page) => page.slug === req.params.slug);
    if (!productPage) {
      return res.status(404).type('html').send('<!doctype html><html lang="id"><meta name="robots" content="noindex, follow"><title>Motor tidak tersedia</title><body><main><h1>Motor tidak tersedia</h1><p>Unit ini sudah tidak tercantum di katalog.</p><a href="/#katalog">Lihat katalog motor aktif</a></main></body></html>');
    }

    res.set('Cache-Control', 'public, max-age=300');
    const hostPage = getSeoPageForHost(db.settings || {}, req.hostname);
    const hostSettings = hostPage ? getSettingsForSeoPage(db.settings || {}, hostPage) : db.settings || {};
    return res.type('html').send(renderMotorSeoPage(productPage.motor, productPage.slug, hostSettings, req.hostname));
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    app.use('/.well-known', express.static(path.join(process.cwd(), 'public', '.well-known'), {
      dotfiles: 'allow',
      index: false,
    }));

    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.get([
      '/',
      '/dealer-honda-bandung',
      '/kredit-motor-honda-bandung',
      '/simulasi-kredit-honda',
      '/harga-motor-honda-bandung',
      '/honda-beat-bandung',
      '/honda-scoopy-bandung',
      '/honda-vario-bandung',
      '/honda-pcx-bandung',
      '/honda-adv-bandung',
    ], async (req, res, next) => {
      try {
        const indexHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
        const transformedHtml = await vite.transformIndexHtml(req.originalUrl, indexHtml);
        const db = readDb();
        const initialData = await createSsrInitialData(db, req.hostname);
        res.set('Cache-Control', 'no-cache');
        res.type('html').send(renderSeoMetadata(transformedHtml, db.settings || {}, req.path, initialData, req.hostname));
      } catch (error) {
        next(error);
      }
    });
    app.get('/artikel/:slug', async (req, res, next) => {
      try {
        const indexHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
        const transformedHtml = await vite.transformIndexHtml(req.originalUrl, indexHtml);
        const db = readDb();
        db.articles = getSiteArticles(readSiteDb(), req.hostname);
        const initialData = await createSsrInitialData(db, req.hostname);
        const article = (initialData as any).articles?.find((item: any) => item.slug === req.params.slug && item.published === true);
        if (!article) return res.status(404).type('html').send('<!doctype html><html lang="id"><meta name="robots" content="noindex, follow"><title>Artikel tidak ditemukan</title><body><main><h1>Artikel tidak ditemukan</h1><a href="/#artikel">Lihat artikel</a></main></body></html>');
        res.set('Cache-Control', 'no-cache');
        res.type('html').send(renderSeoMetadata(transformedHtml, db.settings || {}, req.path, initialData, req.hostname));
      } catch (error) {
        next(error);
      }
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.get([
      '/',
      '/dealer-honda-bandung',
      '/kredit-motor-honda-bandung',
      '/simulasi-kredit-honda',
      '/harga-motor-honda-bandung',
      '/honda-beat-bandung',
      '/honda-scoopy-bandung',
      '/honda-vario-bandung',
      '/honda-pcx-bandung',
      '/honda-adv-bandung',
    ], (req, res, next) => {
      try {
        const indexHtml = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
        const db = readDb();
        res.set('Cache-Control', 'no-cache');
        res.type('html').send(renderSeoMetadata(indexHtml, db.settings || {}, req.path, createPublicInitialData(db, req.hostname), req.hostname));
      } catch (error) {
        next(error);
      }
    });
    app.use('/.well-known', express.static(path.join(distPath, '.well-known'), {
      dotfiles: 'allow',
      index: false,
    }));
    app.use(express.static(distPath, {
      setHeaders(res, filePath) {
        const fileName = path.basename(filePath);
        const relativePath = path.relative(distPath, filePath);
        const isFingerprintAsset = path.dirname(filePath) === path.join(distPath, 'assets')
          && /-[A-Za-z0-9_-]{8,}\.(?:css|js)$/.test(fileName);
        const isStableImage = relativePath.startsWith(`images${path.sep}`);
        const cacheControl = isFingerprintAsset
          ? 'public, max-age=31536000, immutable'
          : isStableImage
            ? 'public, max-age=2592000'
            : 'public, max-age=0, must-revalidate';
        res.setHeader('Cache-Control', cacheControl);
      },
    }));
    app.get('*', (req, res) => {
      if (path.extname(req.path)) return res.sendStatus(404);
      const indexHtml = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
      const db = readDb();
      db.articles = getSiteArticles(readSiteDb(), req.hostname);
      const initialData = createPublicInitialData(db, req.hostname);
      const articlePath = req.path.match(/^\/artikel\/([^/]+)\/?$/);
      if (articlePath && !initialData.articles.some((item: any) => item.slug === articlePath[1] && item.published === true)) {
        return res.status(404).type('html').send('<!doctype html><html lang="id"><meta name="robots" content="noindex, follow"><title>Artikel tidak ditemukan</title><body><main><h1>Artikel tidak ditemukan</h1><a href="/#artikel">Lihat artikel</a></main></body></html>');
      }
      res.set('Cache-Control', 'no-cache');
      res.type('html').send(renderSeoMetadata(indexHtml, db.settings || {}, req.path, initialData, req.hostname));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Honda Wijaya Abadi Server running on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
