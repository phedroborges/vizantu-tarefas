import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Só *.test.ts — os *.spec.ts em tests/ são suíte do Playwright (rodam
    // num browser real, fixtures diferentes) e não devem ser pegos aqui.
    include: ["tests/**/*.test.ts"],
    testTimeout: 20_000,
  },
});
