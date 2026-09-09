import { describe, expect, it } from "vitest";
import { buildDashboardMetrics } from "../src/lib/dashboard-metrics";
import type { Member, Project, Tag, Task } from "../src/lib/types";

const NOW = "2026-09-09T15:00:00.000Z";
const members: Member[] = ["Ana", "Beto", "Clara"].map((name, index) => ({
  id: `m${index + 1}`, name, email: `${name.toLowerCase()}@teste.com`, role: "editor",
  aiEnabled: false, active: true, createdAt: NOW, updatedAt: NOW,
}));
const projects: Project[] = [{ id: "p1", name: "Cliente", status: "ativo", createdAt: NOW, updatedAt: NOW }];
const tags: Tag[] = [
  { id: "formato", kind: "formato", label: "Reels", createdAt: NOW },
  { id: "canal", kind: "canal", label: "Instagram", createdAt: NOW },
];

function task(input: Partial<Task> & Pick<Task, "id" | "name" | "status">): Task {
  return {
    projectId: "p1", kind: "conteudo", images: [], formatTagIds: ["formato"], channelTagIds: ["canal"],
    categoryTagIds: [], lists: ["criativa"], statusHistory: [], comments: [], createdAt: "2026-09-02T12:00:00.000Z",
    updatedAt: NOW, ...input,
  };
}

const tasks: Task[] = [
  task({
    id: "t1", name: "Duas voltas em ajuste", status: "para_aprovacao", assigneeId: "m1", createdBy: "m1", dueDate: "2026-09-08",
    statusHistory: [
      { status: "pronto_para_criacao", enteredAt: "2026-09-01T12:00:00.000Z", exitedAt: "2026-09-02T12:00:00.000Z" },
      { status: "em_criacao", enteredAt: "2026-09-02T12:00:00.000Z", exitedAt: "2026-09-04T12:00:00.000Z" },
      { status: "ajuste", enteredAt: "2026-09-04T12:00:00.000Z", exitedAt: "2026-09-05T12:00:00.000Z" },
      { status: "revisao", enteredAt: "2026-09-05T12:00:00.000Z", exitedAt: "2026-09-06T12:00:00.000Z" },
      { status: "ajuste", enteredAt: "2026-09-06T12:00:00.000Z", exitedAt: "2026-09-07T12:00:00.000Z" },
      { status: "para_aprovacao", enteredAt: "2026-09-07T12:00:00.000Z", exitedAt: null },
    ],
    comments: [
      { id: "c1", author: "Beto", authorMemberId: "m2", text: "Vamos ajustar", createdAt: "2026-09-05T13:00:00.000Z" },
      { id: "a1", author: "Sistema", authorMemberId: "m1", text: "", kind: "activity", fieldKey: "dueDate", oldValue: "2026-09-05", newValue: "2026-09-08", createdAt: "2026-09-06T13:00:00.000Z" },
    ],
  }),
  task({
    id: "t2", name: "Ciclo mais lento", status: "finalizado", assigneeId: "m2", createdBy: "m2", dueDate: "2026-09-09", driveLink: "https://drive.test/material",
    statusHistory: [
      { status: "em_criacao", enteredAt: "2026-09-01T12:00:00.000Z", exitedAt: "2026-09-09T10:00:00.000Z" },
      { status: "para_aprovacao", enteredAt: "2026-09-09T10:00:00.000Z", exitedAt: "2026-09-09T11:00:00.000Z" },
      { status: "finalizado", enteredAt: "2026-09-09T11:00:00.000Z", exitedAt: null },
    ],
  }),
  task({ id: "t3", name: "Sem dados", status: "rascunho", kind: "conteudo", formatTagIds: [], channelTagIds: [] }),
];

describe("dashboard gerencial", () => {
  const metrics = buildDashboardMetrics({ tasks, projects, members, tags, nowIso: NOW });

  it("soma todas as visitas ao status de ajuste", () => {
    const ana = metrics.members.find((member) => member.memberId === "m1")!;
    expect(ana.statusMs.ajuste).toBe(2 * 86_400_000);
    expect(metrics.reworkTasks[0]).toMatchObject({ id: "t1", visits: 2, totalMs: 2 * 86_400_000 });
    expect(metrics.reworkRate).toBe(33);
  });

  it("mede lentidão pelo ciclo até a entrega, e não pela quantidade", () => {
    expect(metrics.slowestCreative).toMatchObject({ memberId: "m2", creativeDeliveries: 1 });
    expect(metrics.slowestCreative!.creativeAverageMs).toBeGreaterThan(metrics.members[0].creativeAverageMs!);
  });

  it("separa criação, alterações e comentários e mantém pessoas sem atividade", () => {
    expect(metrics.members.find((member) => member.memberId === "m1")).toMatchObject({ created: 1, changes: 1, comments: 0 });
    expect(metrics.members.find((member) => member.memberId === "m2")).toMatchObject({ created: 1, changes: 0, comments: 1 });
    expect(metrics.members.find((member) => member.memberId === "m3")).toMatchObject({ totalActivity: 0, openTasks: 0 });
  });

  it("distingue comentários humanos e destaca falta crítica de link", () => {
    expect(metrics.topCommented[0]).toMatchObject({ id: "t1", count: 1 });
    expect(metrics.alerts.find((alert) => alert.id === "t1:link")).toMatchObject({ critical: true });
    expect(metrics.criticalAlerts).toBe(1);
  });

  it("preserva prazo original, atual e número de mudanças", () => {
    expect(metrics.reschedules[0]).toMatchObject({ taskId: "t1", originalDate: "2026-09-05", currentDate: "2026-09-08", changes: 1, movedDays: 3 });
  });

  it("segmenta atraso ativo por gravidade", () => {
    expect(metrics.overdueTasks).toBe(1);
    expect(metrics.delayBuckets.find((bucket) => bucket.label === "1 dia")?.count).toBe(1);
  });

  it("atribui o tempo histórico à pessoa responsável naquele momento", () => {
    const reassigned = task({
      id: "troca", name: "Trocou de responsável", status: "revisao", assigneeId: "m2",
      statusHistory: [
        { status: "em_criacao", enteredAt: "2026-09-01T12:00:00.000Z", exitedAt: "2026-09-04T12:00:00.000Z" },
        { status: "revisao", enteredAt: "2026-09-04T12:00:00.000Z", exitedAt: null },
      ],
      comments: [{ id: "troca-1", author: "Sistema", authorMemberId: "m2", text: "", kind: "activity", fieldKey: "assigneeId", oldValue: "m1", newValue: "m2", createdAt: "2026-09-03T12:00:00.000Z" }],
    });
    const result = buildDashboardMetrics({ tasks: [reassigned], projects, members, tags, nowIso: NOW });
    expect(result.members.find((member) => member.memberId === "m1")!.statusMs.em_criacao).toBe(2 * 86_400_000);
    expect(result.members.find((member) => member.memberId === "m2")!.statusMs.em_criacao).toBe(86_400_000);
    expect(result.members.find((member) => member.memberId === "m2")!.statusMs.revisao).toBe(5 * 86_400_000 + 3 * 3_600_000);
  });
});
