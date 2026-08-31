import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DueDateValue } from "../src/components/due-date-value";
import { StatusTag, statusColorMap } from "../src/components/status-tag";
import { DEFAULT_STATUS_COLORS, TASK_STATUSES, type TaskStatus } from "../src/lib/types";

// Atraso é fato do PRAZO, não do status: uma tarefa vencida continua "Em
// criação". Antes a tag de status era substituída por "Atrasada" e a etapa
// real sumia da tela — quem olhava a lista não sabia em que pé a demanda
// estava, só que tinha passado da data.
const CORES = statusColorMap(Object.entries(DEFAULT_STATUS_COLORS).map(([status, color]) => ({ status: status as TaskStatus, color })));

const tag = (status: TaskStatus) => renderToStaticMarkup(<StatusTag status={status} colorByStatus={CORES} />);
const prazo = (dueDate: string | undefined, status: TaskStatus) =>
  renderToStaticMarkup(<DueDateValue dueDate={dueDate} status={status} dateFormat="numerico" />);

const VENCIDA = "2020-01-15";
const FUTURA = "2099-12-31";

describe("atraso mora no prazo, não no status", () => {
  it("1. a tag de status mostra a etapa real mesmo com a data vencida", () => {
    const out = tag("em_criacao");
    expect(out).toContain("Em criação");
    expect(out).not.toContain("Atrasada");
  });

  it("2. nenhuma etapa da esteira é rotulada como atrasada", () => {
    for (const status of TASK_STATUSES) {
      expect(tag(status.value), status.value).toContain(status.label);
      expect(tag(status.value).toLowerCase(), status.value).not.toContain("atrasada");
    }
  });

  it("3. o prazo vencido é quem grita, e diz há quantos dias", () => {
    const out = prazo(VENCIDA, "em_criacao");
    expect(out).toContain("15/01/2020");
    expect(out).toContain("atrasada há");
    expect(out).toContain("dias");
  });

  it("4. prazo no futuro é só a data, sem alarme", () => {
    const out = prazo(FUTURA, "em_criacao");
    expect(out).toContain("31/12/2099");
    expect(out).not.toContain("atrasada");
  });

  it("5. nos status já entregues a data vencida não vira atraso", () => {
    // Mesma regra de DONE_STATUSES: o que falta é fator externo.
    for (const status of ["aprovado", "problema", "finalizado"] as TaskStatus[]) {
      expect(prazo(VENCIDA, status), status).not.toContain("atrasada");
    }
  });

  it("6. tarefa sem prazo não pode ser acusada de atraso", () => {
    const out = prazo(undefined, "em_criacao");
    expect(out).toContain("Sem prazo");
    expect(out).not.toContain("atrasada");
  });
});
