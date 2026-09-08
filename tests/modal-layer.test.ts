import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("camada dos modais legados", () => {
  it("mantém o formulário acima do backdrop que intercepta cliques", () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/\.modal-layer\s*>\s*\.vz-modal\s*\{[^}]*position:\s*relative[^}]*z-index:\s*1/s);
  });
});
