import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      'server-only': fileURLToPath(new URL('./tests/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
    env: {
      // Never load production credentials, databases, mail, or webhooks in tests.
      DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test',
      RESEND_API_KEY: '',
      GOOGLE_SCRIPT_URL: '',
      NEXT_PUBLIC_GOOGLE_SCRIPT_URL: '',
    },
  },
});
