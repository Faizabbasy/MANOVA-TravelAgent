import { defineConfig } from '@playwright/test'
const artifactRun = `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`
// Deliberately no webServer: never start the application DB/dev migration entrypoint.
// Run against backend/scripts/accounting-rehearsal.ts (TEST memory) and a local frontend server only.
export default defineConfig({
  testDir: './e2e',
  testMatch: process.env.ACCOUNTING_YEAR_UAT === '1' ? 'year-demo.spec.ts' : 'accounting.spec.ts',
  // Receipt matching uses its own explicit TEST_ONLY policy fixture. Other journeys use the unknown-policy fixture.
  grep: process.env.ACCOUNTING_NAVIGATION_UAT === '1' ? /finance menus render/ : process.env.ACCOUNTING_POLICY_UAT === '1' ? /owner resolves pending corrections/ : process.env.ACCOUNTING_RECEIPT_MATCH_UAT === '1' ? /owner matches a supplier/ : undefined,
  grepInvert: process.env.ACCOUNTING_NAVIGATION_UAT === '1' || process.env.ACCOUNTING_POLICY_UAT === '1' || process.env.ACCOUNTING_RECEIPT_MATCH_UAT === '1' ? undefined : /owner matches a supplier|owner resolves pending corrections|finance menus render/,
  workers: 1,
  timeout: 120000,
  expect: { timeout: 30000 }, // Also supports cold local dev compilation; assertions and API boundary stay real.
  outputDir: `../docs/owner-accounting-implementation/browser-artifacts-${artifactRun}`,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8080',
    browserName: 'chromium',
    launchOptions: { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  }
})
