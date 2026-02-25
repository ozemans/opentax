import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts', 'src/pdf/**/*.ts'],
      exclude: [
        'src/engine/**/index.ts',
        'src/engine/types.ts',
        'src/engine/states/interface.ts',
        'src/engine/states/massachusetts.ts',
        'src/engine/states/new-jersey.ts',
        'src/pdf/**/index.ts',
        'src/pdf/field-maps/types.ts',
        'src/pdf/template-loader.ts',
      ],
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
