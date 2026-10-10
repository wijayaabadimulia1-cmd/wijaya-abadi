import express from 'express';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import * as XLSX from 'xlsx';
import { MAX_IMAGE_UPLOAD_BYTES, MAX_MOTOR_IMAGES, MAX_PROMO_IMAGES } from './src/constants';

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const DB_FILE = path.join(process.cwd(), 'data', 'db.json');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
const DEFAULT_FIF_PRICE_LIST_FILE = path.join(process.cwd(), 'src', 'data', 'fifPriceList.json');
const FIF_TENORS = [11, 17, 23, 29, 35];
const FIF_DP_PERCENTAGES = [10, 15, 20, 30, 40];
const sessions = new Map<string, { id: string; username: string; role: string; createdAt: string }>();

// Ensure directories exist
if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
  fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function readDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading db:', err);
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

function renderSeoMetadata(html: string, settings: any = {}) {
  const title = String(settings.seoTitle || 'Dealer Motor Honda Bandung | Harga & Kredit').trim();
  const description = String(settings.seoDescription || 'Temukan informasi kredit motor Honda, harga motor Honda, simulasi cicilan, DP dan tenor. Cek pilihan motor Honda terbaru dan simulasi kredit dengan mudah.').trim();
  const keywords = String(settings.seoKeywords || 'kredit motor Honda, harga motor Honda, simulasi kredit, cicilan motor, DP motor, Honda Beat, Honda Scoopy, Honda Vario, Honda PCX, Honda ADV, dealer motor Honda').trim();
  const canonical = String(settings.seoCanonicalUrl || 'https://kreditmotorhonda.tech/').trim();
  const robots = String(settings.seoRobots || 'index, follow').trim();
  const escape = escapeHtmlAttribute;
  const firstHeroImage = Array.isArray(settings.heroImages) ? settings.heroImages[0] : settings.heroImage;
  const heroFileName = typeof firstHeroImage === 'string' && firstHeroImage.startsWith('/uploads/')
    ? path.basename(firstHeroImage)
    : '';
  const heroPreload = heroFileName && fs.existsSync(path.join(UPLOADS_DIR, heroFileName))
    ? `<link rel="preload" as="image" href="/uploads/${escape(heroFileName)}" fetchpriority="high" />`
    : '';

  return html
    .replace(/<\/head>/i, `${heroPreload}</head>`)
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escape(title)}</title>`)
    .replace(/<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${escape(description)}" />`)
    .replace(/<meta\s+name="keywords"[^>]*>/i, `<meta name="keywords" content="${escape(keywords)}" />`)
    .replace(/<meta\s+name="robots"[^>]*>/i, `<meta name="robots" content="${escape(robots)}" />`)
    .replace(/<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${escape(canonical)}" />`)
    .replace(/<meta\s+property="og:title"[^>]*>/i, `<meta property="og:title" content="${escape(title)}" />`)
    .replace(/<meta\s+property="og:description"[^>]*>/i, `<meta property="og:description" content="${escape(description)}" />`)
    .replace(/<meta\s+property="og:url"[^>]*>/i, `<meta property="og:url" content="${escape(canonical)}" />`)
    .replace(/<meta\s+name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${escape(title)}" />`)
    .replace(/<meta\s+name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${escape(description)}" />`);
}

function writeDb(data: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
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

function publicAdminUser(user: any) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
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

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Sesi admin tidak valid atau sudah berakhir' });
  (req as any).adminSession = session;
  next();
}

async function startServer() {
  const app = express();
  app.use(compression());
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Public reads remain available; all writes require an authenticated admin.
  app.use('/api', (req, res, next) => {
    const isPublicWrite =
      req.method === 'POST' &&
      (req.path === '/admin/login' || req.path === '/testimonials' || req.path === '/interests' || req.path === '/analytics/visit');
    if (req.method === 'GET' || isPublicWrite) return next();
    return requireAdmin(req, res, () => {
      const session = (req as any).adminSession;
      const db = readDb();
      appendAudit(db, {
        actor: session.username,
        action: `${req.method} ${req.path}`,
        resource: req.path,
        details: 'Perubahan data melalui admin panel',
      });
      writeDb(db);
      next();
    });
  });

  // Serve uploaded files
  app.use('/uploads', express.static(UPLOADS_DIR));
  app.use('/api/files', express.static(UPLOADS_DIR));

  // --- API Endpoints ---
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Honda Wijaya Abadi API' });
  });

  // Settings
  app.get('/api/settings', (req, res) => {
    const db = readDb();
    res.json(db.settings || {});
  });

  app.get('/api/fif-price-list', (req, res) => {
    res.json(currentFifPriceList());
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

  app.post('/api/fif-price-list/import', express.raw({
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

  app.put('/api/settings', (req, res) => {
    const db = readDb();
    db.settings = { ...db.settings, ...req.body, updated_at: new Date().toISOString() };
    writeDb(db);
    res.json(db.settings);
  });

  // Motors
  app.get('/api/motors', (req, res) => {
    const db = readDb();
    res.json(db.motors || []);
  });

  app.post('/api/motors', (req, res) => {
    const db = readDb();
    const images = normalizeMotorImages(req.body.images, [req.body.image]);
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

  app.put('/api/motors/:id', (req, res) => {
    const db = readDb();
    const index = (db.motors || []).findIndex((m: any) => m.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Motor not found' });
    }
    const existingImages = Array.isArray(db.motors[index].images) ? db.motors[index].images : [db.motors[index].image];
    const images = normalizeMotorImages(req.body.images, existingImages);
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

  app.delete('/api/motors/:id', (req, res) => {
    const db = readDb();
    db.motors = (db.motors || []).filter((m: any) => m.id !== req.params.id);
    writeDb(db);
    res.json({ success: true, message: 'Motor deleted' });
  });

  // Promos
  app.get('/api/promos', (req, res) => {
    const db = readDb();
    res.json(db.promos || []);
  });

  app.post('/api/promos', (req, res) => {
    const db = readDb();
    const images = Array.isArray(req.body.images)
      ? req.body.images.filter((image: unknown): image is string => typeof image === 'string' && Boolean(image.trim())).map((image: string) => image.trim())
      : [];
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
    db.promos = [newPromo, ...(db.promos || [])];
    writeDb(db);
    res.status(201).json(newPromo);
  });

  app.put('/api/promos/:id', (req, res) => {
    const db = readDb();
    const index = (db.promos || []).findIndex((p: any) => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Promo not found' });
    const images = req.body.images === undefined
      ? db.promos[index].images || []
      : Array.isArray(req.body.images)
        ? req.body.images.filter((image: unknown): image is string => typeof image === 'string' && Boolean(image.trim())).map((image: string) => image.trim())
        : [];
    if (images.length > MAX_PROMO_IMAGES) {
      return res.status(400).json({ error: `Maksimal ${MAX_PROMO_IMAGES} foto per promo` });
    }
    db.promos[index] = { ...db.promos[index], ...req.body, images };
    writeDb(db);
    res.json(db.promos[index]);
  });

  app.delete('/api/promos/:id', (req, res) => {
    const db = readDb();
    db.promos = (db.promos || []).filter((p: any) => p.id !== req.params.id);
    writeDb(db);
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
  app.get('/api/interests', (req, res) => {
    const db = readDb();
    res.json(db.interests || []);
  });

  app.post('/api/interests', (req, res) => {
    const db = readDb();
    const newLead = {
      id: `lead-${Date.now()}`,
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

  app.patch('/api/interests/:id/status', (req, res) => {
    const db = readDb();
    const index = (db.interests || []).findIndex((i: any) => i.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Lead not found' });
    db.interests[index].status = req.body.status || 'Dihubungi';
    writeDb(db);
    res.json(db.interests[index]);
  });

  app.delete('/api/interests/:id', (req, res) => {
    const db = readDb();
    db.interests = (db.interests || []).filter((i: any) => i.id !== req.params.id);
    writeDb(db);
    res.json({ success: true });
  });

  // Visitor events are stored without IP addresses or other personal identifiers.
  app.post('/api/analytics/visit', (req, res) => {
    const sessionId = String(req.body?.sessionId || '');
    const pagePath = String(req.body?.path || '/');
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(sessionId) || !pagePath.startsWith('/') || pagePath.length > 200 || pagePath.startsWith('/admin')) {
      return res.status(400).json({ error: 'Data kunjungan tidak valid.' });
    }

    const db = readDb();
    db.visitorLogs = Array.isArray(db.visitorLogs) ? db.visitorLogs : [];
    const existing = db.visitorLogs.find((entry: any) => entry.sessionId === sessionId);
    if (existing) return res.status(200).json({ recorded: false });

    const visit = {
      id: `visit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      sessionId,
      timestamp: new Date().toISOString(),
      path: pagePath,
    };
    db.visitorLogs.push(visit);
    if (!writeDb(db)) return res.status(500).json({ error: 'Gagal menyimpan log pengunjung.' });
    return res.status(201).json({ recorded: true });
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

      const fileUrl = `/uploads/${safeName}`;
      res.json({ url: fileUrl, filename: safeName, success: true });
    } catch (err: any) {
      console.error('Upload failed:', err);
      res.status(500).json({ error: 'Upload failed: ' + err.message });
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
    return res.json({ success: true, token, user: { name: user.username, role: user.role, id: user.id } });
  });

  app.post('/api/admin/logout', requireAdmin, (req, res) => {
    const token = req.header('x-admin-token');
    if (token) sessions.delete(token);
    res.json({ success: true });
  });

  app.get('/api/admin/me', requireAdmin, (req, res) => {
    res.json((req as any).adminSession);
  });

  app.get('/api/admin/users', requireAdmin, (req, res) => {
    const db = readDb();
    res.json(ensureAdminUsers(db).map(publicAdminUser));
  });

  app.post('/api/admin/users', requireAdmin, (req, res) => {
    const session = (req as any).adminSession;
    if (session.role !== 'Super Admin') return res.status(403).json({ error: 'Hanya Super Admin yang dapat membuat admin' });
    const db = readDb();
    const users = ensureAdminUsers(db);
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    if (!username || password.length < 8) return res.status(400).json({ error: 'Username wajib diisi dan password minimal 8 karakter' });
    if (users.some((item: any) => item.username.toLowerCase() === username.toLowerCase())) {
      return res.status(409).json({ error: 'Username sudah digunakan' });
    }
    const newUser = { id: `admin-${Date.now()}`, username, passwordHash: hashPassword(password), role: req.body?.role === 'Super Admin' ? 'Super Admin' : 'Staff Admin', created_at: new Date().toISOString() };
    db.adminUsers.push(newUser);
    appendAudit(db, { actor: session.username, action: 'CREATE_ADMIN', resource: newUser.id, details: `Membuat admin ${username}` });
    writeDb(db);
    res.status(201).json(publicAdminUser(newUser));
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
    if (!username || (password && password.length < 8)) return res.status(400).json({ error: 'Username wajib diisi dan password minimal 8 karakter' });
    users[index] = { ...current, username, ...(password ? { passwordHash: hashPassword(password) } : {}), ...(session.role === 'Super Admin' && req.body?.role ? { role: req.body.role } : {}), updated_at: new Date().toISOString() };
    appendAudit(db, { actor: session.username, action: 'UPDATE_ADMIN', resource: current.id, details: `Mengubah akun ${current.username}` });
    writeDb(db);
    res.json(publicAdminUser(users[index]));
  });

  app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
    const session = (req as any).adminSession;
    if (session.role !== 'Super Admin') return res.status(403).json({ error: 'Hanya Super Admin yang dapat menghapus admin' });
    const db = readDb();
    const users = ensureAdminUsers(db);
    if (users.length <= 1) return res.status(400).json({ error: 'Minimal harus ada satu admin' });
    const deleted = users.find((item: any) => item.id === req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Admin tidak ditemukan' });
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

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.get('/', async (req, res, next) => {
      try {
        const indexHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
        const transformedHtml = await vite.transformIndexHtml(req.originalUrl, indexHtml);
        res.type('html').send(renderSeoMetadata(transformedHtml, readDb().settings || {}));
      } catch (error) {
        next(error);
      }
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.get('/', (req, res, next) => {
      try {
        const indexHtml = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
        res.type('html').send(renderSeoMetadata(indexHtml, readDb().settings || {}));
      } catch (error) {
        next(error);
      }
    });
    app.use('/.well-known', express.static(path.join(distPath, '.well-known'), {
      dotfiles: 'allow',
      index: false,
    }));
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Honda Wijaya Abadi Server running on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
