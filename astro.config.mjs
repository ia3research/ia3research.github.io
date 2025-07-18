// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: "https://almtav08.github.io",
  base: "/ia3-prop/",
  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [],
});