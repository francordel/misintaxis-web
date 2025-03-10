import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { settings } from './src/data/settings';

export default defineConfig({
  site: 'https://francordel.github.io',
  base: 'misintaxis-web',
  integrations: [sitemap()],
  vite: {
    ssr: {
      external: ["svgo"],
    },
  },
});
