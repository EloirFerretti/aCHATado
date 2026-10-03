import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  workers: 2,
  timeout: 30000,
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://localhost:3100",
    viewport: { width: 1280, height: 1011 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start -- --port 3100",
    url: "http://localhost:3100/chat",
    reuseExistingServer: !process.env.CI,
  },
});
