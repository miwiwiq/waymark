import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The apps' tsconfigs exclude spec files, so tsconfig paths don't reach them.
  resolve: {
    alias: { '@app/common': fileURLToPath(new URL('./libs/common/src/index.ts', import.meta.url)) },
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
  },
});
