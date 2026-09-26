// @vitest-environment jsdom

import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyTheme, readTheme, resolveTheme, THEME_BOOT_SCRIPT } from "../src/lib/theme";

function systemTheme(dark: boolean) {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
    matches: dark,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe("tema da interface", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-vz-theme");
  });

  afterEach(() => vi.unstubAllGlobals());

  it("resolve a preferência automática com o tema do sistema", () => {
    systemTheme(true);
    expect(resolveTheme("system")).toBe("dark");
    applyTheme("system");
    expect(document.documentElement.dataset.vzTheme).toBe("dark");
    expect(readTheme()).toBe("system");
  });

  it("mantém uma escolha explícita mesmo quando o sistema discorda", () => {
    systemTheme(true);
    applyTheme("light");
    expect(document.documentElement.dataset.vzTheme).toBe("light");
    expect(readTheme()).toBe("light");
  });

  it("resolve o automático antes da primeira pintura", () => {
    systemTheme(true);
    localStorage.setItem("vz-theme", "system");
    window.eval(THEME_BOOT_SCRIPT);
    expect(document.documentElement.dataset.vzTheme).toBe("dark");
  });

  it("aplica os tokens escuros ao vz-root dentro do html temático", () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), "src/styles/vizantu.css"), "utf8");
    expect(css).toMatch(/:root\[data-vz-theme="dark"\]\s+\.vz-root/);
  });
});
