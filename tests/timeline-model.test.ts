import { describe, expect, it } from "vitest";
import { horizonteDe, linhaDoTempoEmTexto, organizar, parseTimelineInput, periodoEmTexto, TimelineInputError, type TimelineItem } from "../src/lib/timeline/model";

const HOJE = "2026-11-23";
let n = 0;
const item = (parcial: Partial<TimelineItem>): TimelineItem => ({
  id: `i${++n}`, projectId: "p1", kind: "objetivo", title: "Algo", detail: "", status: "vigente",
  createdAt: `2026-11-0${(n % 9) + 1}T10:00:00Z`, updatedAt: "2026-11-20T10:00:00Z", ...parcial,
});

describe("em que horizonte cada item está", () => {
  it("sem data nenhuma é o norte, sem prazo", () => {
    expect(horizonteDe(item({ kind: "sonho" }), HOJE)).toBe("sem_prazo");
  });

  it("o que já começou e não acabou é agora", () => {
    expect(horizonteDe(item({ startsOn: "2026-11-01", endsOn: "2026-12-31" }), HOJE)).toBe("agora");
    expect(horizonteDe(item({ endsOn: "2026-12-31" }), HOJE)).toBe("agora");
    expect(horizonteDe(item({ startsOn: "2026-10-01" }), HOJE)).toBe("agora");
  });

  // O ponto da linha do tempo: a meta de março dita em novembro não é de agora.
  it("o que começa no futuro cai no horizonte certo pelo início", () => {
    expect(horizonteDe(item({ startsOn: "2027-01-01", endsOn: "2027-03-31", saidOn: "2026-11-23" }), HOJE)).toBe("proximos_3_meses");
    expect(horizonteDe(item({ startsOn: "2027-04-01" }), HOJE)).toBe("6_meses");
    expect(horizonteDe(item({ startsOn: "2027-09-01" }), HOJE)).toBe("1_ano");
    expect(horizonteDe(item({ startsOn: "2028-03-01" }), HOJE)).toBe("mais_adiante");
  });

  it("prazo vencido, alcançado, substituído e abandonado são história", () => {
    expect(horizonteDe(item({ startsOn: "2026-08-01", endsOn: "2026-10-31" }), HOJE)).toBe("historico");
    for (const status of ["alcancado", "substituido", "abandonado"] as const) {
      expect(horizonteDe(item({ status, startsOn: "2026-11-01" }), HOJE), status).toBe("historico");
    }
  });

  it("marco é acontecimento: depois da data, vira história; antes, é futuro", () => {
    expect(horizonteDe(item({ kind: "marco", startsOn: "2026-11-10" }), HOJE)).toBe("historico");
    expect(horizonteDe(item({ kind: "marco", startsOn: "2027-02-10" }), HOJE)).toBe("proximos_3_meses");
    expect(horizonteDe(item({ kind: "marco", startsOn: HOJE }), HOJE)).toBe("agora");
  });
});

describe("organizar e escrever", () => {
  it("agrupa na ordem da tela e deixa de fora grupo vazio", () => {
    const grupos = organizar([
      item({ title: "Ano que vem", startsOn: "2027-09-01" }),
      item({ title: "Hoje", startsOn: "2026-11-01" }),
      item({ kind: "sonho", title: "Ser referência" }),
    ], HOJE);
    expect(grupos.map((g) => g.horizonte)).toEqual(["sem_prazo", "agora", "1_ano"]);
  });

  it("escreve o período em português", () => {
    expect(periodoEmTexto({ startsOn: "2026-11-01", endsOn: "2027-03-31" })).toBe("nov/2026 a mar/2027");
    expect(periodoEmTexto({ startsOn: "2027-01-01", endsOn: "2027-01-31" })).toBe("jan/2027");
    expect(periodoEmTexto({ startsOn: "2027-01-01" })).toBe("a partir de jan/2027");
    expect(periodoEmTexto({})).toBe("sem prazo");
    expect(periodoEmTexto({ kind: "marco", startsOn: "2026-11-05" })).toBe("em 05/11/2026");
  });

  it("o texto para a IA diz o horizonte, o período, quando foi dito e a substituição", () => {
    const novo = item({ id: "novo", kind: "meta", title: "30 conversas por dia", startsOn: "2026-12-01", saidOn: "2026-11-23", sourceLabel: "Reunião de resultados" });
    const velho = item({ id: "velho", kind: "meta", title: "20 conversas por dia", status: "substituido", replacedById: "novo" });
    const texto = linhaDoTempoEmTexto([velho, novo], HOJE);
    expect(texto).toContain("Próximos 3 meses:\n- Meta: 30 conversas por dia (a partir de dez/2026) — dito em 23/11/2026, Reunião de resultados");
    expect(texto).toContain('[Substituído por "30 conversas por dia"]');
    expect(linhaDoTempoEmTexto([], HOJE)).toBe("");
  });
});

describe("o que entra", () => {
  it("aceita o mínimo e completa o resto", () => {
    expect(parseTimelineInput({ kind: "sonho", title: " Ser referência " })).toEqual({
      kind: "sonho", title: "Ser referência", detail: "", status: "vigente",
      startsOn: null, endsOn: null, saidOn: null, sourceId: null, sourceLabel: null,
    });
  });

  it("recusa tipo, data e período inválidos", () => {
    expect(() => parseTimelineInput({ kind: "desejo", title: "x" })).toThrow(TimelineInputError);
    expect(() => parseTimelineInput({ kind: "meta", title: "x", startsOn: "03/2027" })).toThrow(/AAAA-MM-DD/);
    expect(() => parseTimelineInput({ kind: "meta", title: "x", startsOn: "2027-03-01", endsOn: "2027-01-01" })).toThrow(/antes do início/);
    expect(() => parseTimelineInput({ kind: "meta", title: "  " })).toThrow(/o que é/);
  });

  it("na edição só mexe no que veio", () => {
    expect(parseTimelineInput({ status: "alcancado" }, true)).toEqual({ status: "alcancado" });
  });
});
