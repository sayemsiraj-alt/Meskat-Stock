import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'http';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import {
  detectPwaAssetKind,
  generateDynamicPwaHttpResponse,
} from './src/utils/pwaServerRenderer';

const createDynamicPwaMiddleware = () => {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const rawUrl = req.url || '/';
    if (!rawUrl.startsWith('/app-manifest.webmanifest') && !rawUrl.startsWith('/app-icon-') && !rawUrl.startsWith('/app-apple-touch-icon.png')) {
      next();
      return;
    }

    try {
      const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost:3000';
      const protoHeader = req.headers['x-forwarded-proto'] as string | undefined;
      const proto = protoHeader
        ? protoHeader.split(',')[0].trim()
        : host.startsWith('localhost') || host.startsWith('127.0.0.1')
        ? 'http'
        : 'https';
      const originUrl = `${proto}://${host.split(',')[0].trim()}`;
      const fullUrl = new URL(rawUrl, originUrl);
      const kind = detectPwaAssetKind(fullUrl.pathname, fullUrl.searchParams);
      if (!kind) {
        next();
        return;
      }

      const result = await generateDynamicPwaHttpResponse(
        kind,
        fullUrl.searchParams,
        originUrl
      );
      res.statusCode = result.statusCode;
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(result.bodyBuffer);
    } catch {
      next();
    }
  };
};

const dynamicPwaBrandingPlugin = (): Plugin => ({
  name: 'dynamic-pwa-branding-endpoints',
  configureServer(server) {
    server.middlewares.use(createDynamicPwaMiddleware());
  },
  configurePreviewServer(server) {
    server.middlewares.use(createDynamicPwaMiddleware());
  },
});

export default defineConfig(() => {
  return {
    plugins: [
      dynamicPwaBrandingPlugin(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'icon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'Stock ERP - Stock Management System',
          short_name: 'Stock ERP',
          description:
            'Dynamic real-time stock management, retail POS, wholesale billing, and accounts ERP.',
          theme_color: '#059669',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'any',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          importScripts: ['/pwa-branding-sw.js'],
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          globIgnores: ['**/pwa-branding-sw.js', '**/firebase-config.json'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/\.netlify\//,
            /^\/app-manifest\.webmanifest/,
            /^\/app-icon-/,
            /^\/app-apple-touch-icon\.png/,
            /^\/firebase-config\.json$/,
            /^\/pwa-branding-sw\.js$/,
          ],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
          navigateFallback: 'index.html',
        },
      }),
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
