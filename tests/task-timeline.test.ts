import { describe, expect, it } from "vitest";
import { trimMinorActivity } from "../src/lib/task-activity";
import { buildTimeline, isWhitespaceOnlyChange, restorePayload } from "../src/lib/task-timeline";
import type { Comment, TaskActivityEvent } from "../src/lib/types";

const at = (minute: number) => `2026-10-06T12:${String(minute).padStart(2, "0")}:00.000Z`;

function event(id: string, fieldKey: string, minute: number, oldValue: unknown = "a", newValue: unknown = "b"): TaskActivityEvent {
  return { id, taskId: "t1", actorName: "Phedro", actorMemberId: "m1", fieldKey, oldValue, newValue, createdAt: at(minute) };
}

function comment(id: string, minute: number): Comment {
  return { id, author: "Erika", text: "Olha isso", createdAt: at(minute) };
}

describe("linha do tempo da tarefa", () => {
  it("destaca status, responsável e prazo e recolhe o resto em um grupo", () => {
    const timeline = buildTimeline([
      event("d1", "description", 1), event("d2", "description", 2), event("n1", "name", 3),
      event("s1", "status", 4, "rascunho", "em_criacao"),
      event("d3", "description", 5), event("g1", "formatTagIds", 6),
      event("a1", "assigneeId", 7, null, "m2"), event("p1", "dueDate", 8, null, "2026-10-10"),
    ], []);
    expect(timeline.map((item) => item.kind)).toEqual(["event", "event", "minor", "event", "minor"]);
    expect(timeline.map((item) => item.kind === "minor" ? item.events.map((entry) => entry.id) : item.kind === "event" ? item.event.id : "")).toEqual([
      "p1", "a1", ["g1", "d3"], "s1", ["n1", "d2", "d1"],
    ]);
  });

  it("um comentário no meio separa as edições menores em dois grupos", () => {
    const timeline = buildTimeline([event("d1", "description", 1), event("d2", "description", 3)], [comment("c1", 2)]);
    expect(timeline.map((item) => item.kind)).toEqual(["minor", "comment", "minor"]);
  });

  it("trinta e quatro autosaves viram uma linha só", () => {
    const edits = Array.from({ length: 34 }, (_, index) => event(`d${index}`, "description", index));
    const timeline = buildTimeline(edits, []);
    expect(timeline).toHaveLength(1);
    expect(timeline[0]).toMatchObject({ kind: "minor", createdAt: at(33) });
    expect(timeline[0].kind === "minor" && timeline[0].events).toHaveLength(34);
  });

  it("manda a edição menor sem os valores e a importante inteira", () => {
    const [minor, key] = trimMinorActivity([event("d1", "description", 1, "texto enorme", "texto enorme 2"), event("s1", "status", 2, "rascunho", "ajuste")]);
    expect(minor).toMatchObject({ id: "d1", fieldKey: "description", trimmed: true, oldValue: undefined, newValue: undefined });
    expect(key).toMatchObject({ oldValue: "rascunho", newValue: "ajuste" });
    expect(key.trimmed).toBeUndefined();
  });
});

describe("restaurar pelo histórico", () => {
  it("devolve o campo ao valor de antes da alteração", () => {
    expect(restorePayload(event("d", "description", 1, "Versão boa", "Versão errada"))).toEqual({ description: "Versão boa" });
    expect(restorePayload(event("s", "status", 1, "em_criacao", "finalizado"))).toEqual({ status: "em_criacao" });
    expect(restorePayload(event("t", "formatTagIds", 1, ["a", "b"], []))).toEqual({ formatTagIds: ["a", "b"] });
    expect(restorePayload(event("f", "seasonal", 1, false, true))).toEqual({ seasonal: false });
  });

  it("restaurar para vazio limpa o campo em vez de ignorar", () => {
    expect(restorePayload(event("d", "description", 1, null, "Texto"))).toEqual({ description: "" });
    expect(restorePayload(event("p", "dueDate", 1, null, "2026-10-10"))).toEqual({ dueDate: "" });
    expect(restorePayload(event("a", "assigneeId", 1, null, "m2"))).toEqual({ assigneeId: null });
    expect(restorePayload(event("l", "driveLink", 1, null, "https://drive.test"))).toEqual({ driveLink: "" });
  });

  it("não oferece restauração quando o registro não guarda o valor", () => {
    // Imagens gravam só a contagem; criação não tem "antes"; nome vazio não salva.
    expect(restorePayload(event("i", "images", 1, 2, 3))).toBeNull();
    expect(restorePayload(event("c", "created", 1, null, "Tarefa"))).toBeNull();
    expect(restorePayload(event("n", "name", 1, "", "Novo nome"))).toBeNull();
    expect(restorePayload(event("s", "status", 1, null, "rascunho"))).toBeNull();
  });

  it("reconhece a edição que só mexeu em espaço em branco", () => {
    expect(isWhitespaceOnlyChange(event("d", "description", 1, "Um texto", "Um  texto\n"))).toBe(true);
    expect(isWhitespaceOnlyChange(event("d", "description", 1, "Um texto", "Um texto novo"))).toBe(false);
    expect(isWhitespaceOnlyChange(event("s", "seasonal", 1, false, true))).toBe(false);
  });
});
