import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import analog from '@analogjs/platform';
import { defineConfig } from 'vite';

const docs = join(import.meta.dirname, 'src/content/docs');
const pages = existsSync(docs)
  ? readdirSync(docs).map((file) => `/docs/${file.replace(/\.md$/, '')}`)
  : [];

export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite-site',
  build: { target: ['es2022'] },
  plugins: [
    analog({
      static: true,
      content: { highlighter: 'prism' },
      prerender: { routes: ['/', '/docs', ...pages] },
      vite: { tsconfig: join(import.meta.dirname, 'tsconfig.app.json') },
    }),
  ],
});
