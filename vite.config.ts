import { defineConfig } from 'vitest/config';

export default defineConfig({
  // relative asset URLs so the build works from any sub-path (GitHub Pages: /when-to-trim-calculator/)
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
