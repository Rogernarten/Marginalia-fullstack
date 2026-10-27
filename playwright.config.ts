import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// Reads .env.local the way Next.js does: the Clerk keys, the Supabase keys, and the two test
// readers' emails. The test process uses them; they're never printed.
loadEnvConfig(process.cwd());

const PORT = 3200;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "setup", testMatch: /global\.setup\.ts/ },
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"] },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
