import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { normalizeBasePath } from './scripts/base-path.js';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',
      precompress: false
    }),
    paths: {
      base: normalizeBasePath(process.env.BASE_PATH)
    },
    alias: {
      '@': 'src'
    }
  }
};

export default config;
