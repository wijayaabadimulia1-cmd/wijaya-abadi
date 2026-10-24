import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
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
        name: 'non-blocking-bundled-stylesheet',
        apply: 'build',
        transformIndexHtml: {
          order: 'post',
          handler(html) {
            let bundledStylesheet = '';
            const transformedHtml = html.replace(/<link\\b[^>]*rel="stylesheet"[^>]*>/g, (link) => {
              const href = link.match(/\\bhref="([^"]+\\.css)"/)?.[1];
              if (!href) return link;

              bundledStylesheet = `<link rel="preload" as="style" href="${href}" onload="this.onload=null;this.rel='stylesheet'"><noscript>${link}</noscript>`;
              return '';
            });
            return transformedHtml.replace(/<head[^>]*>/i, (head) => `${head}${bundledStylesheet}`);
          },
        },
      },
      {
        name: 'github-pages-spa-fallback',
        apply: 'build',
        generateBundle: {
          order: 'post',
          handler(_options, bundle) {
            if (!isBuild) return;

            const indexHtml = bundle['index.html'];
            if (!indexHtml || indexHtml.type !== 'asset') {
              this.error('Expected Vite build output to contain index.html.');
            }

            this.emitFile({
              type: 'asset',
              fileName: '404.html',
              source: indexHtml.source,
            });
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
