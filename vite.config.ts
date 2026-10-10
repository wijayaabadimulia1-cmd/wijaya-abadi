import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ command }) => {
  const isBuild = command === 'build';

  return {
    base: '/',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'github-pages-spa-fallback',
        closeBundle() {
          if (isBuild) {
            copyFileSync(path.resolve(projectRoot, 'dist/index.html'), path.resolve(projectRoot, 'dist/404.html'));
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(projectRoot, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
