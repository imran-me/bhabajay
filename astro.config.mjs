// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

const SITE = process.env.PUBLIC_SITE_URL || 'https://bhabajay.com';

// Pages that must never be indexed (private or operational).
const PRIVATE = ['/me', '/admin', '/id', '/parent', '/initiator/track', '/search', '/404', '/quiz/bhabu-secret'];

export default defineConfig({
  site: SITE,
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  integrations: [
    react(),
    sitemap({
      filter: (page) => !PRIVATE.some((p) => new URL(page).pathname.startsWith(p)) && !/\/m\/\d+\/?$/.test(page),
      i18n: { defaultLocale: 'bn', locales: { bn: 'bn-BD' } },
      changefreq: 'weekly',
    }),
  ],
  vite: {
    // cast: @tailwindcss/vite's Vite types differ slightly from Astro's bundled Vite
    plugins: [/** @type {any} */ (tailwindcss())],
    // resvg is a native module used only at build time for OG images
    ssr: { external: ['@resvg/resvg-js', 'harfbuzzjs'] },
    optimizeDeps: { exclude: ['@resvg/resvg-js', 'harfbuzzjs'] },
  },
});
