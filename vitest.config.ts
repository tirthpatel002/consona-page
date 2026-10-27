import { defineConfig } from 'vitest/config'

// Unit tests cover pure logic only (no DOM rendering).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['app/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
  },
})
