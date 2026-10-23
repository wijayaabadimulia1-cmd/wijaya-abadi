import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SITES = [
  'https://kreditmotorhonda.tech',
  'https://wijaya.kreditmotorhonda.tech',
  'https://www.solusikreditmotor.cloud',
];
const MAX_IMAGE_BYTES = 100 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 2 * 1024 * 1024 * 1024;
const isApply = process.argv.includes('--apply');
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, '..');
const dataDirectory = path.resolve(process.env.DATA_DIR || path.join(projectDirectory, 'data'));
const databaseFile = path.join(dataDirectory, 'db.json');
const uploadsDirectory = path.resolve(process.env.UPLOADS_DIR || path.join(projectDirectory, 'public', 'uploads'));
const sites = process.argv.slice(2).filter((argument) => !argument.startsWith('--'));
const sourceSites = sites.length ? sites.map((site) => new URL(site).origin) : DEFAULT_SITES;

function normalizeName(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('id-ID').replace(/[^a-z0-9]+/g, ' ').trim();
}

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${url} gagal (HTTP ${response.status})`);
  return response.json();
}

function getLocalUploadName(source, sourceOrigin) {
  let parsed;
  try {
    parsed = new URL(source, sourceOrigin);
  } catch {
    return null;
  }
  if (parsed.origin !== sourceOrigin || !['/uploads/', '/media/'].some((prefix) => parsed.pathname.startsWith(prefix))) return null;
  const filename = path.posix.basename(parsed.pathname);
  return filename && filename !== '.' ? filename : null;
}

async function copyCatalogImage(source, sourceOrigin, copiedImages) {
  if (typeof source !== 'string' || !source.trim()) return source;
  const imageName = getLocalUploadName(source, sourceOrigin);
  if (!imageName) return source;

  const imageKey = `${sourceOrigin}/${imageName}`;
  if (copiedImages.has(imageKey)) return copiedImages.get(imageKey);
  const sharedFilename = `catalog-${crypto.createHash('sha256').update(imageKey).digest('hex').slice(0, 12)}-${imageName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const targetPath = path.join(uploadsDirectory, sharedFilename);
  const localOwnerFile = path.join(uploadsDirectory, imageName);

  if (sourceOrigin === sourceSites[0]) {
    try {
      const stats = await fs.stat(localOwnerFile);
      if (stats.isFile()) {
        const reference = `/uploads/${imageName}`;
        copiedImages.set(imageKey, reference);
        return reference;
      }
    } catch {
      // Download it from the public site when the local owner file is not present.
    }
  }

  try {
    const existing = await fs.stat(targetPath);
    if (existing.isFile()) {
      const reference = `/uploads/${sharedFilename}`;
      copiedImages.set(imageKey, reference);
      return reference;
    }
  } catch {
    // A new shared image needs to be downloaded below.
  }

  if (!isApply) {
    copiedImages.set(imageKey, `/uploads/${sharedFilename}`);
    return `/uploads/${sharedFilename}`;
  }

  const response = await fetch(new URL(`/uploads/${encodeURIComponent(imageName)}`, sourceOrigin), {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Foto katalog ${imageName} dari ${sourceOrigin} gagal diunduh (HTTP ${response.status})`);
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_IMAGE_BYTES) throw new Error(`Foto ${imageName} melebihi batas 100 MB.`);
  const contents = Buffer.from(await response.arrayBuffer());
  if (!contents.length || contents.length > MAX_IMAGE_BYTES) throw new Error(`Foto ${imageName} kosong atau melebihi batas 100 MB.`);

  const totalBytes = [...copiedImages.values()].reduce((total, item) => total + (item.bytes || 0), 0) + contents.length;
  if (totalBytes > MAX_TOTAL_IMAGE_BYTES) throw new Error('Total foto migrasi melebihi batas 2 GB.');
  await fs.mkdir(uploadsDirectory, { recursive: true });
  await fs.writeFile(targetPath, contents, { flag: 'wx' });
  copiedImages.set(imageKey, { reference: `/uploads/${sharedFilename}`, bytes: contents.length });
  return `/uploads/${sharedFilename}`;
}

async function main() {
  const catalogByName = new Map();
  const catalogEntries = [];
  const sourceMotorCounts = {};
  const mergedPriceList = { source: 'Shared catalog migration', updatedAt: new Date().toISOString(), tenors: [11, 17, 23, 29, 35], models: {} };
  let sourceMotorCount = 0;

  for (const [siteIndex, origin] of sourceSites.entries()) {
    const [motors, priceList] = await Promise.all([
      fetchJson(new URL('/api/motors', origin)),
      fetchJson(new URL('/api/fif-price-list', origin)),
    ]);
    if (!Array.isArray(motors)) throw new Error(`${origin}/api/motors tidak mengembalikan array.`);
    sourceMotorCount += motors.length;
    sourceMotorCounts[origin] = motors.length;

    for (const motor of motors) {
      const key = normalizeName(motor.name) || `id:${motor.id}`;
      if (siteIndex === 0) {
        const ownerEntry = { motor: { ...motor }, origin };
        catalogEntries.push(ownerEntry);
        if (!catalogByName.has(key)) catalogByName.set(key, ownerEntry);
        continue;
      }
      if (!catalogByName.has(key)) {
        const replicaEntry = { motor: { ...motor }, origin };
        catalogByName.set(key, replicaEntry);
        catalogEntries.push(replicaEntry);
      }
    }

    for (const [name, model] of Object.entries(priceList.models || {})) {
      if (!mergedPriceList.models[name]) mergedPriceList.models[name] = model;
    }
    if (Array.isArray(priceList.tenors) && priceList.tenors.length) mergedPriceList.tenors = priceList.tenors;
  }

  const mergedMotors = catalogEntries.map(({ motor }) => motor);
  const copiedImages = new Map();
  let localImageCount = 0;
  for (const entry of catalogEntries) {
    const imageReferences = Array.isArray(entry.motor.images) ? entry.motor.images : (entry.motor.image ? [entry.motor.image] : []);
    const updatedImages = [];
    for (const image of imageReferences) {
      const updatedImage = await copyCatalogImage(image, entry.origin, copiedImages);
      if (updatedImage !== image) localImageCount += 1;
      updatedImages.push(updatedImage);
    }
    entry.motor.images = [...new Set(updatedImages)];
    entry.motor.image = entry.motor.images[0] || '';
  }

  const summary = {
    mode: isApply ? 'APPLY' : 'DRY RUN',
    sites: sourceSites,
    sourceMotorCount,
    sourceMotorCounts,
    ownerMotorCount: sourceMotorCounts[sourceSites[0]] || 0,
    mergedMotorCount: mergedMotors.length,
    duplicateMotorRecords: sourceMotorCount - mergedMotors.length,
    fifModelCount: Object.keys(mergedPriceList.models).length,
    catalogImageReferences: [...copiedImages.values()].length,
    localImageReferences: localImageCount,
    databaseFile,
    uploadsDirectory,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!isApply) {
    console.log('No files were changed. Re-run with --apply after reviewing this summary and backing up all three sites.');
    return;
  }

  let ownerDb = { settings: {}, motors: [], promos: [], testimonials: [], manifesto: [], interests: [] };
  try {
    ownerDb = JSON.parse(await fs.readFile(databaseFile, 'utf-8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  await fs.mkdir(dataDirectory, { recursive: true });
  const backupName = `${databaseFile}.before-shared-catalog-${new Date().toISOString().replace(/[:.]/g, '-')}.bak`;
  try {
    await fs.copyFile(databaseFile, backupName, fs.constants.COPYFILE_EXCL);
    console.log(`Owner database backup: ${backupName}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const nextDb = {
    ...ownerDb,
    motors: mergedMotors,
    fifPriceList: mergedPriceList,
  };
  const tempFile = `${databaseFile}.${process.pid}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(nextDb, null, 2), { flag: 'wx' });
  await fs.rename(tempFile, databaseFile);
  console.log('Shared catalog has been written to the owner database. Keep source-site uploads until all images are verified.');
}

main().catch((error) => {
  console.error(`Shared catalog migration failed: ${error.message}`);
  process.exitCode = 1;
});