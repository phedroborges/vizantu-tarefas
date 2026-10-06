import { describe, expect, it } from "vitest";
import { READY_NUDGE_HOURS, readySince, staleReadyTasks, type ReadyTask } from "../src/lib/ready-nudge";

const NOW = new Date("2026-10-06T15:00:00.000Z").getTime();
const HOUR = 3_600_000;

function ready(input: Partial<ReadyTask> & Pick<ReadyTask, "id">): ReadyTask {
  return { name: input.id, projectId: "p1", status: "pronto_para_criacao", assigneeId: "m1", statusHistory: [], updatedAt: "2026-10-01T12:00:00.000Z", ...input };
}

const since = (hoursAgo: number) => new Date(NOW - hoursAgo * HOUR).toISOString();

describe("aviso de tarefa parada em pronto para criação", () => {
  it("conta o tempo desde a entrada aberta em pronto, e não desde a primeira visita", () => {
    const task = ready({
      id: "voltou",
      statusHistory: [
        { status: "pronto_para_criacao", enteredAt: since(200), exitedAt: since(100) },
        { status: "ajuste", enteredAt: since(100), exitedAt: since(3) },
        { status: "pronto_para_criacao", enteredAt: since(3), exitedAt: null },
      ],
    });
    expect(readySince(task)).toBe(NOW - 3 * HOUR);
    expect(staleReadyTasks([task], "m1", NOW)).toEqual([]);
  });

  it("avisa só depois do limite e só o responsável", () => {
    const velha = ready({ id: "velha", statusHistory: [{ status: "pronto_para_criacao", enteredAt: since(READY_NUDGE_HOURS + 1), exitedAt: null }] });
    const nova = ready({ id: "nova", statusHistory: [{ status: "pronto_para_criacao", enteredAt: since(READY_NUDGE_HOURS - 1), exitedAt: null }] });
    const deOutro = ready({ id: "outro", assigneeId: "m2", statusHistory: [{ status: "pronto_para_criacao", enteredAt: since(90), exitedAt: null }] });
    expect(staleReadyTasks([velha, nova, deOutro], "m1", NOW).map(({ task }) => task.id)).toEqual(["velha"]);
    expect(staleReadyTasks([velha, nova, deOutro], "m2", NOW).map(({ task }) => task.id)).toEqual(["outro"]);
  });

  it("some assim que a tarefa sai de pronto para criação", () => {
    const iniciada = ready({ id: "iniciada", status: "em_criacao", statusHistory: [{ status: "pronto_para_criacao", enteredAt: since(90), exitedAt: since(1) }, { status: "em_criacao", enteredAt: since(1), exitedAt: null }] });
    expect(readySince(iniciada)).toBeUndefined();
    expect(staleReadyTasks([iniciada], "m1", NOW)).toEqual([]);
  });

  it("ordena da que espera há mais tempo e usa o updatedAt quando falta histórico", () => {
    const semHistorico = ready({ id: "sem-historico", updatedAt: since(50) });
    const maisVelha = ready({ id: "mais-velha", statusHistory: [{ status: "pronto_para_criacao", enteredAt: since(80), exitedAt: null }] });
    const result = staleReadyTasks([semHistorico, maisVelha], "m1", NOW);
    expect(result.map(({ task }) => task.id)).toEqual(["mais-velha", "sem-historico"]);
    expect(result[1].waitingMs).toBe(50 * HOUR);
  });
});
