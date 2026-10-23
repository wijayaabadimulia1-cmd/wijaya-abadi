const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const persistentRoot = '/var/lib/honda-wijaya-abadi';
const sharedUploads = path.join(persistentRoot, 'uploads');
const sharedCatalogDb = path.join(persistentRoot, 'data', 'db.json');
const catalogServiceToken = String(process.env.CATALOG_SERVICE_TOKEN || '');

if (!/^[a-f0-9]{64}$/i.test(catalogServiceToken)) {
  throw new Error('Set CATALOG_SERVICE_TOKEN to a 64-character hex secret in .env (openssl rand -hex 32).');
}

const sites = [
  {
    name: 'honda-wijaya-abadi',
    port: 3000,
    appUrl: 'https://kreditmotorhonda.tech',
    dataDir: path.join(persistentRoot, 'data'),
    catalogOwner: true,
  },
  {
    name: 'wijaya-kreditmotor',
    port: 3001,
    appUrl: 'https://wijaya.kreditmotorhonda.tech',
    dataDir: path.join(persistentRoot, 'sites', 'wijaya', 'data'),
    catalogOwner: false,
  },
  {
    name: 'solusi-kreditmotor',
    port: 3002,
    appUrl: 'https://www.solusikreditmotor.cloud',
    dataDir: path.join(persistentRoot, 'sites', 'solusi', 'data'),
    catalogOwner: false,
  },
];

module.exports = {
  apps: sites.map((site) => ({
    name: site.name,
    script: 'npm',
    args: 'start',
    cwd: __dirname,
    env: {
      NODE_ENV: 'production',
      PORT: site.port,
      APP_URL: site.appUrl,
      DATA_DIR: site.dataDir,
      UPLOADS_DIR: sharedUploads,
      CATALOG_SERVICE_TOKEN: catalogServiceToken,
      CATALOG_ADMIN_URL: 'https://kreditmotorhonda.tech/admin',
      ...(site.catalogOwner ? {} : {
        CATALOG_API_URL: 'http://127.0.0.1:3000',
        CATALOG_OWNER_DATA_FILE: sharedCatalogDb,
      }),
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '400M',
    error_file: `logs/${site.name}-err.log`,
    out_file: `logs/${site.name}-out.log`,
    log_file: `logs/${site.name}-combined.log`,
    time: true,
  })),
};
