import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    browser: {
      provider: "playwright",
      name: "chromium",
      enabled: true,
      headless: true,
    },
  },
});
