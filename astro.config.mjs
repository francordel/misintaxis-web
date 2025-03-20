import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { settings } from './src/data/settings';
export default defineConfig({
  // Si quieres mantener la URL/base para GitHub Pages, la dejas.
  // Sin embargo, si vas a usar Vercel, normalmente no necesitas "site" ni "base"
  // apuntando a GitHub Pages. Puedes borrarlas o cambiarlas a tu dominio de Vercel.
  site: 'https://francordel.github.io',
  base: 'misintaxis-web',

  // Forzamos a Astro a compilar en modo SSR en lugar de estático
  //output: 'server',

  // Adaptador para desplegar en Vercel
  //adapter: vercel(),

  integrations: [sitemap()],

  vite: {
    ssr: {
      external: ["svgo"],
    },
  },
});
