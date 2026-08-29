import { describe, expect, it } from "vitest";
import { DATE_FORMATS, daysBetweenIso, formatTaskDate, isDateFormatKey } from "../src/lib/date-format";

const HOJE = "2026-08-16";

describe("formatos de data do prazo", () => {
  it("1. os cinco modos aparecem no menu", () => {
    expect(DATE_FORMATS.map((f) => f.key)).toEqual(["inteligente", "curto", "extenso", "numerico", "relativo"]);
  });

  it("2. curto é '16 ago', sem 'de' e sem ponto", () => {
    expect(formatTaskDate(HOJE, "curto", HOJE)).toBe("16 ago");
  });

  it("3. por extenso é '16 de agosto'", () => {
    expect(formatTaskDate(HOJE, "extenso", HOJE)).toBe("16 de agosto");
  });

  it("4. numérico sempre traz o ano", () => {
    expect(formatTaskDate(HOJE, "numerico", HOJE)).toBe("16/08/2026");
  });

  it("5. relativo cobre hoje, amanhã, ontem e os plurais", () => {
    expect(formatTaskDate("2026-08-16", "relativo", HOJE)).toBe("hoje");
    expect(formatTaskDate("2026-08-17", "relativo", HOJE)).toBe("amanhã");
    expect(formatTaskDate("2026-08-15", "relativo", HOJE)).toBe("ontem");
    expect(formatTaskDate("2026-08-19", "relativo", HOJE)).toBe("daqui 3 dias");
    expect(formatTaskDate("2026-08-12", "relativo", HOJE)).toBe("há 4 dias");
  });

  it("6. inteligente usa relativo dentro da semana e data fora dela", () => {
    expect(formatTaskDate("2026-08-17", "inteligente", HOJE)).toBe("amanhã");
    expect(formatTaskDate("2026-08-23", "inteligente", HOJE)).toBe("daqui 7 dias");
    expect(formatTaskDate("2026-08-24", "inteligente", HOJE)).toBe("24 ago");
  });

  it("7. ano diferente aparece na data, mesmo no modo curto", () => {
    expect(formatTaskDate("2027-03-02", "curto", HOJE)).toContain("2027");
    expect(formatTaskDate("2026-03-02", "curto", HOJE)).not.toContain("2026");
  });

  it("8. sem prazo não vira data inválida", () => {
    expect(formatTaskDate(undefined, "curto", HOJE)).toBe("Sem prazo");
  });

  it("9. a diferença é em dias de calendário, não em blocos de 24h", () => {
    expect(daysBetweenIso(HOJE, "2026-08-17")).toBe(1);
    expect(daysBetweenIso(HOJE, "2026-08-15")).toBe(-1);
    // Atravessa a virada do horário de verão sem perder nem ganhar um dia.
    expect(daysBetweenIso("2026-10-17", "2026-10-19")).toBe(2);
  });

  it("10. chave desconhecida (localStorage adulterado) não é aceita", () => {
    expect(isDateFormatKey("curto")).toBe(true);
    expect(isDateFormatKey("qualquer")).toBe(false);
    expect(isDateFormatKey(null)).toBe(false);
  });
});
