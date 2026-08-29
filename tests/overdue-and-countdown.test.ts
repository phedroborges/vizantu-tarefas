import { describe, expect, it } from "vitest";
import { hoursUntilDue, overdueDays, timeUntilDueLabel } from "../src/lib/dates";

const HOJE = "2026-08-16";
// 16/08/2026 12:00 em São Paulo (UTC-3) = 15:00 UTC.
const AGORA = new Date("2026-08-16T15:00:00Z");

describe("atraso e contagem regressiva", () => {
  it("1. tarefa em dia não tem atraso", () => {
    expect(overdueDays("2026-08-20", "em_criacao", HOJE)).toBe(0);
    expect(overdueDays("2026-08-16", "em_criacao", HOJE)).toBe(0);
  });

  it("2. atraso é contado em dias", () => {
    expect(overdueDays("2026-08-15", "em_criacao", HOJE)).toBe(1);
    expect(overdueDays("2026-08-01", "em_criacao", HOJE)).toBe(15);
  });

  it("3. status concluído nunca conta como atrasado", () => {
    for (const status of ["aprovado", "problema", "finalizado"] as const) {
      expect(overdueDays("2026-01-01", status, HOJE)).toBe(0);
    }
  });

  it("4. sem prazo não é atraso", () => {
    expect(overdueDays(undefined, "em_criacao", HOJE)).toBe(0);
  });

  it("5. o prazo vale até o fim do dia, não até a hora atual", () => {
    // Meio-dia do próprio dia do prazo: ainda restam ~12h, não 0.
    const horas = hoursUntilDue("2026-08-16", AGORA);
    expect(horas).toBeGreaterThan(11);
    expect(horas).toBeLessThan(13);
  });

  it("6. o rótulo muda de minutos para horas e para dias", () => {
    expect(timeUntilDueLabel("2026-08-16", AGORA)).toMatch(/^faltam 1[12]h$/);
    expect(timeUntilDueLabel("2026-08-18", AGORA)).toBe("faltam 2 dias");
    expect(timeUntilDueLabel("2026-08-17", AGORA)).toBe("faltam 1 dia");
  });

  it("7. faltando menos de uma hora aparece em minutos", () => {
    const quase = new Date("2026-08-17T02:30:00Z"); // 23:30 de 16/08 em SP
    expect(timeUntilDueLabel("2026-08-16", quase)).toMatch(/^faltam \d+min$/);
  });

  it("8. prazo vencido vira 'atrasada há'", () => {
    expect(timeUntilDueLabel("2026-08-15", AGORA)).toBe("atrasada há 1 dia");
    expect(timeUntilDueLabel("2026-08-04", AGORA)).toBe("atrasada há 12 dias");
  });

  it("9. o contador e a coluna de prazo contam o MESMO atraso", () => {
    // Na tela, "atrasada há N dias" aparece ao lado de overdueDays na tabela:
    // se as duas contas divergirem, o usuário vê 11 e 12 na mesma linha.
    for (const due of ["2026-08-15", "2026-08-13", "2026-08-04", "2026-07-20"]) {
      const dias = overdueDays(due, "em_criacao", HOJE);
      expect(timeUntilDueLabel(due, AGORA), due).toBe(`atrasada há ${dias} ${dias === 1 ? "dia" : "dias"}`);
    }
  });

  it("10. a ordenação põe a mais atrasada primeiro", () => {
    const tarefas = [
      { nome: "3 dias", due: "2026-08-13" },
      { nome: "sem atraso", due: "2026-08-30" },
      { nome: "10 dias", due: "2026-08-06" },
    ];
    const ordenadas = [...tarefas].sort(
      (a, b) => overdueDays(b.due, "em_criacao", HOJE) - overdueDays(a.due, "em_criacao", HOJE),
    );
    expect(ordenadas.map((t) => t.nome)).toEqual(["10 dias", "3 dias", "sem atraso"]);
  });
});
