import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(() => {
  return {
    base: '/',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'non-blocking-bundled-stylesheet',
        apply: 'build',
        transformIndexHtml: {
          order: 'post',
          handler(html) {
            let bundledStylesheet = '';
            const transformedHtml = html.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/g, (link) => {
              const href = link.match(/\bhref="([^"]+\.css)"/)?.[1];
              if (!href) return link;

              bundledStylesheet = `<link rel="preload" as="style" href="${href}" onload="this.onload=null;this.rel='stylesheet'"><noscript>${link}</noscript>`;
              return '';
            });
            return transformedHtml.replace(/<head[^>]*>/i, (head) => `${head}${bundledStylesheet}`);
          },
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
