import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Só *.test.ts/tsx — os *.spec.ts em tests/ são suíte do Playwright (rodam
    // num browser real, fixtures diferentes) e não devem ser pegos aqui.
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    testTimeout: 20_000,
  },
});
