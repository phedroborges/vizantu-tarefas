import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Mesmo "@/" do tsconfig — sem isso, testar um componente que importa por
  // alias quebra na resolução antes de rodar qualquer asserção.
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    // Só *.test.ts/tsx — os *.spec.ts em tests/ são suíte do Playwright (rodam
    // num browser real, fixtures diferentes) e não devem ser pegos aqui.
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    testTimeout: 20_000,
  },
});
