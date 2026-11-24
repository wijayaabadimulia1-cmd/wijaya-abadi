import fs from 'node:fs';
import path from 'node:path';

const [transferArgument, targetArgument] = process.argv.slice(2);
if (!transferArgument || !targetArgument) throw new Error('Usage: node import-catalog.mjs <catalog-transfer.json> <live-db.json>');
const transferPath = path.resolve(transferArgument);
const targetPath = path.resolve(targetArgument);
const transfer = JSON.parse(fs.readFileSync(transferPath, 'utf8'));
if (transfer.backupDate !== '2026-10-21' || !Array.isArray(transfer.motors) || transfer.motors.length !== 18) throw new Error('Expected the 2026-10-21 catalog with exactly 18 motors.');
if (!transfer.fifPriceList || Object.keys(transfer.fifPriceList.models || {}).length !== 31) throw new Error('Expected 31 FIF models from the backup.');
if (transfer.motors.some((motor) => motor.image || !Array.isArray(motor.images) || motor.images.length)) throw new Error('This transfer must not contain photo references.');
if (new Set(transfer.motors.map((motor) => motor.id)).size !== 18) throw new Error('Motor IDs are not unique.');
const currentRaw = fs.readFileSync(targetPath, 'utf8');
const current = JSON.parse(currentRaw);
if (current.motors !== undefined && !Array.isArray(current.motors)) throw new Error('Live motors field is invalid; refusing to change the database.');
if (Array.isArray(current.motors) && current.motors.length !== 0) throw new Error('Live catalog is no longer empty; refusing to overwrite it.');
const currentFif = current.fifPriceList && typeof current.fifPriceList === 'object' ? current.fifPriceList : {};
const liveFif = transfer.existingLiveFifPriceList && typeof transfer.existingLiveFifPriceList === 'object' ? transfer.existingLiveFifPriceList : {};
const backupModels = transfer.fifPriceList.models || {};
const liveModels = liveFif.models || {};
const currentModels = currentFif.models || {};
const mergedModels = { ...backupModels, ...liveModels, ...currentModels };
const tenors = Array.isArray(currentFif.tenors) && currentFif.tenors.length
  ? currentFif.tenors
  : Array.isArray(liveFif.tenors) && liveFif.tenors.length
    ? liveFif.tenors
    : transfer.fifPriceList.tenors;
const next = {
  ...current,
  motors: transfer.motors,
  fifPriceList: {
    source: 'Backup catalog 2026-10-21 merged with existing live FIF prices',
    updatedAt: new Date().toISOString(),
    tenors,
    models: mergedModels,
  },
};
const stat = fs.statSync(targetPath);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = targetPath + '.before-catalog-' + stamp + '.bak';
fs.copyFileSync(targetPath, backupPath, fs.constants.COPYFILE_EXCL);
fs.chmodSync(backupPath, stat.mode & 0o777);
const tempPath = targetPath + '.catalog-' + process.pid + '.tmp';
const descriptor = fs.openSync(tempPath, 'wx', stat.mode & 0o777);
try {
  fs.writeFileSync(descriptor, JSON.stringify(next, null, 2));
  fs.fsyncSync(descriptor);
} catch (error) {
  fs.closeSync(descriptor);
  fs.rmSync(tempPath, { force: true });
  throw error;
}
fs.closeSync(descriptor);
if (typeof process.getuid === 'function' && process.getuid() === 0) {
  fs.chownSync(backupPath, stat.uid, stat.gid);
  fs.chownSync(tempPath, stat.uid, stat.gid);
}
if (fs.readFileSync(targetPath, 'utf8') !== currentRaw) {
  fs.rmSync(tempPath, { force: true });
  throw new Error('Live database changed during import; no catalog write was made.');
}
fs.renameSync(tempPath, targetPath);
console.log(JSON.stringify({ motorCount: next.motors.length, fifModelCount: Object.keys(mergedModels).length, existingLiveFifModelsPreserved: Object.keys(liveModels).length, backupPath }));
