/** Static-only build configuration. Existing pinned dependencies are reused;
 * Vinext, Sites, Cloudflare, and server-side identity are not loaded here. */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root,
  // Relative output supports both user.github.io/ and user.github.io/repository/.
  // Navigation is in-page state: there are no server routes or SPA rewrite rules.
  base: './',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  build: {
    outDir: 'site',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    // Keep executable assets readable; dependencies keep their license comments.
    minify: false,
    cssMinify: false,
    rolldownOptions: {
      output: {
        banner:
          '/* ONEJARC GENERATED BROWSER BUILD. Edit src/models, src/controllers, and src/views; then rebuild. No backend or real authentication is included. */',
      },
    },
  },
});
