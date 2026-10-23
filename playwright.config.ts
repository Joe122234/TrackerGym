import { defineConfig, devices } from "@playwright/test";

const emulatorEnv = [
  "NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true",
  "NEXT_PUBLIC_FIREBASE_API_KEY=demo-key",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-forge.firebaseapp.com",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-forge",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-forge.appspot.com",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890",
  "NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:demo",
  "NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY=",
].join(" ");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    timezoneId: "Asia/Bangkok",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // The smoke flow must run against throwaway emulators, never live data.
    // Start the Auth and Firestore emulators first with `npm run emulators`.
    command: `${emulatorEnv} npm run dev -- -p 3100`,
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
