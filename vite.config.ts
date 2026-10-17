import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      // LightningFS nur im Browser verfügbar — Tests verwenden Mock
      'isomorphic-git/lightningfs.js': new URL(
        './src/lib/__mocks__/lightningfs.ts',
        import.meta.url
      ).pathname
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts']
  }
});
