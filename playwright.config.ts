import { defineConfig } from '@playwright/test'

try { process.loadEnvFile('.env.local') } catch { /* no .env.local (p.ej. CI) — E2E_TEST_EMAIL/PASSWORD vendrán del entorno */ }

// Bloque 0 — solo cubre la regla no-scroll de PREFORMA por ahora (e2e/preforma-no-scroll.spec.ts).
// Corre contra un dev server local; las llamadas a los agentes se mockean con page.route,
// no dependemos del backend/LLM real. /preforma exige sesión (app/providers.tsx redirige a
// /login sin ella) — E2E_TEST_EMAIL/E2E_TEST_PASSWORD hacen login real una vez por test.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
