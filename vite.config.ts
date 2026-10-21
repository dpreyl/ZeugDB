import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  resolve: {
    // Svelte component tests need client exports; database tests keep sql.js's Node entry point.
    conditions: process.env.VITEST ? ['browser'] : undefined,
    alias: {
      ...(process.env.VITEST
        ? { 'sql.js': new URL('./node_modules/sql.js/dist/sql-wasm.js', import.meta.url).pathname }
        : {}),
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: [
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
      'static/**/*.test.js',
      'scripts/**/*.test.js',
      'gitea/**/*.test.ts'
    ]
  }
});
