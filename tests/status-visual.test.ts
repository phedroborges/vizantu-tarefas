import { describe, expect, it } from "vitest";
import { OVERDUE_ICON, STATUS_ICON, contrastRatio, readableTextOn } from "../src/lib/status-visual";
import { DEFAULT_STATUS_COLORS, TASK_STATUSES } from "../src/lib/types";

const PRETO = "#1c211c";
const BRANCO = "#ffffff";

describe("tag de status: ícone e contraste", () => {
  it("1. toda etapa tem ícone — nenhuma cai num buraco", () => {
    for (const status of TASK_STATUSES) {
      expect(STATUS_ICON[status.value], status.value).toBeTruthy();
    }
    expect(Object.keys(STATUS_ICON)).toHaveLength(TASK_STATUSES.length);
  });

  it("2. a progressão termina em concluído e problema é alerta", () => {
    expect(STATUS_ICON.aprovado).toBe("Check");
    expect(STATUS_ICON.finalizado).toBe("CheckCheck");
    expect(STATUS_ICON.problema).toBe("TriangleAlert");
    expect(OVERDUE_ICON).toBe("TriangleAlert");
  });

  it("3. amarelo pede texto escuro, roxo pede texto claro", () => {
    expect(readableTextOn("#e3c23c")).toBe(PRETO);
    expect(readableTextOn("#6d3bd4")).toBe(BRANCO);
  });

  it("4. toda cor padrão tem contraste WCAG suficiente", () => {
    for (const [status, color] of Object.entries(DEFAULT_STATUS_COLORS)) {
      const text = readableTextOn(color);
      expect(contrastRatio(color, text), `${status} (${color}) contraste`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("5. TODAS as cores padrão pedem texto branco", () => {
    // Metade das tags com texto preto e metade com branco lê como bagunça na
    // tabela, mesmo com cada uma isolada tendo contraste. A escala inteira foi
    // escolhida escura o bastante pra manter o texto branco em todas.
    for (const [status, color] of Object.entries(DEFAULT_STATUS_COLORS)) {
      expect(readableTextOn(color), `${status} (${color})`).toBe(BRANCO);
    }
  });

  it("6. cada etapa tem cor própria, nenhuma repetida dentro do grupo", () => {
    const porGrupo = new Map<string, string[]>();
    for (const status of TASK_STATUSES) {
      const lista = porGrupo.get(status.group) || [];
      lista.push(DEFAULT_STATUS_COLORS[status.value]);
      porGrupo.set(status.group, lista);
    }
    for (const [grupo, cores] of porGrupo) {
      expect(new Set(cores).size, `grupo ${grupo}`).toBe(cores.length);
    }
  });

  it("7. branco e preto puros recebem o oposto", () => {
    expect(readableTextOn("#ffffff")).toBe(PRETO);
    expect(readableTextOn("#000000")).toBe(BRANCO);
  });

  it("8. meio-tom escolhe pelo contraste real, não por corte fixo", () => {
    // #aeb5ae tem luminância 0.45: um corte em 0.5 mandaria texto branco
    // (contraste 2.1). O escuro dá 7.8 e é o certo.
    expect(readableTextOn("#aeb5ae")).toBe(PRETO);
    expect(contrastRatio("#aeb5ae", PRETO)).toBeGreaterThan(contrastRatio("#aeb5ae", BRANCO));
  });

  it("9. hex de 3 dígitos também funciona", () => {
    expect(readableTextOn("#fff")).toBe(PRETO);
    expect(readableTextOn("#000")).toBe(BRANCO);
  });

  it("10. valor inválido não quebra a tabela — cai no texto escuro", () => {
    expect(readableTextOn("roxo")).toBe(PRETO);
    expect(readableTextOn("")).toBe(PRETO);
  });
});
