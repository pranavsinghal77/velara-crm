import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    // The suite covers pure logic (time maths, serialisation, validation
    // schemas, password hashing) and needs no database.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      JWT_ACCESS_SECRET: 'test-access-secret-that-is-long-enough-000',
      JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-long-enough-0',
      APP_TIMEZONE: 'Asia/Kolkata',
      // 32 bytes of base64, so the encryption helpers are exercisable.
      ENCRYPTION_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
    },
  },
});
