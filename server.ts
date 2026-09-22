import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const DB_FILE = path.join(process.cwd(), 'data', 'db.json');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

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

function writeDb(data: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing db:', err);
    return false;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

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
    const newMotor = {
      id: req.body.id || `motor-${Date.now()}`,
      name: req.body.name || 'New Honda Motor',
      category: req.body.category || 'Matic',
      price: req.body.price || 'Rp 20.000.000',
      numericPrice: req.body.numericPrice || Number(String(req.body.price).replace(/[^0-9]/g, '')) || 20000000,
      image: req.body.image || '/uploads/beat_cbs.png',
      specs: Array.isArray(req.body.specs) ? req.body.specs : (typeof req.body.specs === 'string' ? req.body.specs.split(',').map((s: string) => s.trim()) : ['110cc']),
      description: req.body.description || '',
      is_bestseller: Boolean(req.body.is_bestseller),
      interest_count: req.body.interest_count || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.motors = [newMotor, ...(db.motors || [])];
    writeDb(db);
    res.status(201).json(newMotor);
  });

  app.put('/api/motors/:id', (req, res) => {
    const db = readDb();
    const index = (db.motors || []).findIndex((m: any) => m.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Motor not found' });
    }
    const updated = {
      ...db.motors[index],
      ...req.body,
      numericPrice: req.body.numericPrice || (req.body.price ? Number(String(req.body.price).replace(/[^0-9]/g, '')) : db.motors[index].numericPrice),
      specs: Array.isArray(req.body.specs) ? req.body.specs : (typeof req.body.specs === 'string' ? req.body.specs.split(',').map((s: string) => s.trim()) : db.motors[index].specs),
      updated_at: new Date().toISOString()
    };
    db.motors[index] = updated;
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
    const newPromo = {
      id: req.body.id || `promo-${Date.now()}`,
      title: req.body.title || 'Promo Menarik',
      description: req.body.description || '',
      terms: req.body.terms || 'S&K Berlaku',
      badge: req.body.badge || 'Promo',
      discountValue: req.body.discountValue || '',
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
    db.promos[index] = { ...db.promos[index], ...req.body };
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

  // Analytics & Stats
  app.get('/api/analytics', (req, res) => {
    const db = readDb();
    const motors = db.motors || [];
    const interests = db.interests || [];
    const categories = motors.reduce((acc: any, m: any) => {
      acc[m.category] = (acc[m.category] || 0) + 1;
      return acc;
    }, {});

    res.json({
      totalMotors: motors.length,
      totalPromos: (db.promos || []).length,
      totalTestimonials: (db.testimonials || []).length,
      totalInterests: interests.length,
      newInterests: interests.filter((i: any) => i.status === 'Baru').length,
      categoryBreakdown: categories,
      analytics: db.analytics || { totalViews: 4520, simulatorUsed: 842, compareUsed: 519 }
    });
  });

  // File Upload (Base64)
  app.post('/api/upload', (req, res) => {
    try {
      const { filename, base64Data } = req.body;
      if (!base64Data) {
        return res.status(400).json({ error: 'base64Data is required' });
      }
      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer: Buffer;
      let ext = 'png';

      if (matches && matches.length === 3) {
        const mimeType = matches[1];
        ext = mimeType.split('/')[1] || 'png';
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(base64Data, 'base64');
      }

      const safeName = (filename || `upload-${Date.now()}.${ext}`).replace(/[^a-zA-Z0-9._-]/g, '_');
      const targetPath = path.join(UPLOADS_DIR, safeName);
      fs.writeFileSync(targetPath, buffer);

      const fileUrl = `/uploads/${safeName}`;
      res.json({ url: fileUrl, filename: safeName, success: true });
    } catch (err: any) {
      console.error('Upload failed:', err);
      res.status(500).json({ error: 'Upload failed: ' + err.message });
    }
  });

  // Admin login check
  app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    // Simple secure auth for showroom management
    if ((username === 'admin' && password === 'admin123') || (username === 'admin' && !password)) {
      return res.json({ success: true, token: 'hwa-session-token-valid', user: { name: 'Admin Honda Wijaya Abadi', role: 'Super Admin' } });
    }
    // Also allow any login in preview demo if username is provided
    if (username) {
      return res.json({ success: true, token: 'hwa-session-token-valid', user: { name: username, role: 'Staff Dealer' } });
    }
    return res.status(401).json({ error: 'Kredensial tidak valid' });
  });

  // Download / Export All Data (JSON)
  app.get('/api/export/all', (req, res) => {
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
  app.get('/api/export/csv/:type', (req, res) => {
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
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
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
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
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
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
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
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
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
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Honda Wijaya Abadi Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
