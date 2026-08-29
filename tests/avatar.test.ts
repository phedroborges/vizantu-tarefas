import { describe, expect, it } from "vitest";
import { AVATAR_COLORS, avatarColor, colorForName, initialsOf, isHexColor } from "../src/lib/avatar";

describe("avatar de membros e clientes", () => {
  it("1. duas palavras viram primeira + última inicial", () => {
    expect(initialsOf("Franciele Costa")).toBe("FC");
    expect(initialsOf("Ana Paula Souza")).toBe("AS");
  });

  it("2. nome único usa as duas primeiras letras", () => {
    expect(initialsOf("Fernando")).toBe("FE");
  });

  it("3. espaço extra e nome vazio não quebram", () => {
    expect(initialsOf("  Luís   Silva  ")).toBe("LS");
    expect(initialsOf("")).toBe("?");
    expect(initialsOf("   ")).toBe("?");
  });

  it("4. a cor é estável — mesma pessoa, mesma cor, sempre", () => {
    const primeira = colorForName("Cyntthia Almeida");
    for (let i = 0; i < 50; i++) expect(colorForName("Cyntthia Almeida")).toBe(primeira);
  });

  it("5. a cor derivada sempre sai da paleta", () => {
    for (const nome of ["Phedro", "Franciele Costa", "Fernando", "Erika Iorrana", "Luís", ""]) {
      expect(AVATAR_COLORS as readonly string[]).toContain(colorForName(nome));
    }
  });

  it("6. nomes diferentes não caem todos na mesma cor", () => {
    const nomes = ["Phedro", "Cyntthia Almeida", "Erika Iorrana", "Luís", "Franciele Costa", "Fernando"];
    expect(new Set(nomes.map(colorForName)).size).toBeGreaterThan(1);
  });

  it("7. a cor escolhida pelo cliente vence a derivada do nome", () => {
    expect(avatarColor("Casa Caramelo", "#ff8800")).toBe("#ff8800");
    expect(avatarColor("Casa Caramelo", null)).toBe(colorForName("Casa Caramelo"));
    // Valor inválido não vaza pro style e cai na cor derivada.
    expect(avatarColor("Casa Caramelo", "laranja")).toBe(colorForName("Casa Caramelo"));
  });

  it("8. só hex válido passa", () => {
    expect(isHexColor("#fff")).toBe(true);
    expect(isHexColor("#a1b2c3")).toBe(true);
    expect(isHexColor("rgb(0,0,0)")).toBe(false);
    expect(isHexColor(undefined)).toBe(false);
  });
});
