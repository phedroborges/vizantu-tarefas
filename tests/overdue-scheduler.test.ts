import { describe, expect, it } from "vitest";
import { estaNaHoraDeAvisar, hojeEmSaoPaulo, horaEmSaoPaulo } from "../src/lib/overdue-scheduler";

// A data que entra na chave de dedupe é a de São Paulo, não a do relógio do
// servidor. Container em UTC é o caso normal, e nele às 21h de Brasília já é o
// dia seguinte — se a chave usasse UTC, todo fim de tarde geraria uma segunda
// leva de avisos das mesmas tarefas.
describe("varredura de atrasos", () => {
  it("usa o dia de São Paulo, não o do relógio do servidor", () => {
    expect(hojeEmSaoPaulo(new Date("2026-09-10T02:30:00Z"))).toBe("2026-09-09");
    expect(hojeEmSaoPaulo(new Date("2026-09-09T12:00:00Z"))).toBe("2026-09-09");
  });

  it("lê a hora de São Paulo, com meia-noite valendo zero", () => {
    expect(horaEmSaoPaulo(new Date("2026-09-09T03:00:00Z"))).toBe(0);
    expect(horaEmSaoPaulo(new Date("2026-09-09T11:00:00Z"))).toBe(8);
    expect(horaEmSaoPaulo(new Date("2026-09-09T23:30:00Z"))).toBe(20);
  });

  it("segura o aviso até as oito da manhã", () => {
    expect(estaNaHoraDeAvisar(new Date("2026-09-09T09:59:00Z"))).toBe(false);
    expect(estaNaHoraDeAvisar(new Date("2026-09-09T11:00:00Z"))).toBe(true);
    expect(estaNaHoraDeAvisar(new Date("2026-09-09T23:00:00Z"))).toBe(true);
  });
});
