module.exports = {
  apps: [
    {
      name: 'honda-wijaya-abadi',
      script: 'npm',
      args: 'start',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DATA_DIR: '/var/lib/honda-wijaya-abadi/data',
        UPLOADS_DIR: '/var/lib/honda-wijaya-abadi/uploads',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      log_file: 'logs/combined.log',
      time: true,
    },
  ],
};
