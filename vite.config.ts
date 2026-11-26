import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {createHash} from 'node:crypto';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
      {
        name: 'inject-pwa-precache-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }

          const distDir = path.resolve(__dirname, 'dist');
          const htmlPath = path.resolve(distDir, 'index.html');
          const serviceWorkerPath = path.resolve(distDir, 'sw.js');
          const html = fs.readFileSync(htmlPath, 'utf8');
          const precacheAssets = Array.from(
            new Set(
              Array.from(
                html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g),
                (match) => match[1]
              )
            )
          ).sort();

          if (precacheAssets.length === 0) {
            throw new Error('No bundled JavaScript or CSS assets found for PWA precaching.');
          }

          const buildHash = createHash('sha256')
            .update(html)
            .update('\n')
            .update(precacheAssets.join('\n'));
          for (const assetPath of [
            'manifest.webmanifest',
            'icons/icon-192.png',
            'icons/icon-512.png',
            'icons/icon-512-maskable.png',
            'icons/apple-touch-icon.png',
          ]) {
            buildHash.update(fs.readFileSync(path.resolve(distDir, assetPath)));
          }
          const buildId = buildHash.digest('hex').slice(0, 12);
          const serviceWorker = fs.readFileSync(serviceWorkerPath, 'utf8');

          if (
            !serviceWorker.includes('__BUILD_ID__') ||
            !serviceWorker.includes('__PRECACHE_ASSETS_JSON__')
          ) {
            throw new Error('PWA service worker build placeholders were not found.');
          }

          fs.writeFileSync(
            serviceWorkerPath,
            serviceWorker
              .replace('__BUILD_ID__', buildId)
              .replace('__PRECACHE_ASSETS_JSON__', JSON.stringify(precacheAssets))
          );
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
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
