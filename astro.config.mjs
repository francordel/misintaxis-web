import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';
import icon from 'astro-icon';

export default defineConfig({
  site: 'https://francordel.com',
  output: 'server',
  adapter: cloudflare(),
  integrations: [sitemap(), icon()],
});
