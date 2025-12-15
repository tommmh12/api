import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts', 'tests/**/*.property.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/infrastructure/database/migrations/**',
        'src/scripts/**',
        'src/presentation/server.ts'
      ],
      // Note: Thresholds are intentionally low during initial setup
      // They should be increased as more tests are added
      // Target: 60% for critical paths per Requirements 13
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0
      }
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    // Property-based tests may need more iterations
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  }
});
