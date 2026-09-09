import { describe, expect, it } from "vitest";
import { buildDashboardMetrics } from "../src/lib/dashboard-metrics";
import type { Member, Project, Tag, Task } from "../src/lib/types";

const NOW = "2026-09-09T15:00:00.000Z";
const members: Member[] = ["Ana", "Beto", "Clara"].map((name, index) => ({
  id: `m${index + 1}`, name, email: `${name.toLowerCase()}@teste.com`, role: "social_media",
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

  it("separa o tempo produzindo do tempo esperando na fila", () => {
    // t1 produz 5 dias (criação + duas voltas de ajuste + revisão) e t2 produz
    // 7d22h; a espera é o "pronto para criação" e o tempo parado aguardando
    // aprovação. Finalizado fica fora dos dois lados.
    expect(metrics.flowEfficiency.workingMs).toBe(12 * 86_400_000 + 22 * 3_600_000);
    expect(metrics.flowEfficiency.waitingMs).toBe(3 * 86_400_000 + 4 * 3_600_000);
    expect(metrics.flowEfficiency.ratio).toBe(80);
  });

  it("mede o prazo real de fechamento com mediana, P85 e distribuição", () => {
    expect(metrics.leadTime.samples).toBe(1);
    expect(metrics.leadTime.p50Ms).toBe(7 * 86_400_000 + 23 * 3_600_000);
    expect(metrics.leadTime.p85Ms).toBe(metrics.leadTime.p50Ms);
    expect(metrics.leadTime.histogram.find((bucket) => bucket.label === "7–14d")?.count).toBe(1);
    expect(metrics.leadTime.histogram.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(1);
  });

  it("compara a entrega com a data prometida e com a data remarcada", () => {
    expect(metrics.punctuality).toMatchObject({ delivered: 1, keptOriginal: 1, keptCurrent: 1, originalRate: 100, currentRate: 100, averageSlipDays: 0 });
  });

  it("penaliza a promessa original quando a entrega só coube depois de remarcar", () => {
    const remarcada = task({
      id: "remarcada", name: "Fechou depois de empurrar", status: "finalizado", dueDate: "2026-09-08",
      statusHistory: [
        { status: "em_criacao", enteredAt: "2026-09-01T12:00:00.000Z", exitedAt: "2026-09-08T12:00:00.000Z" },
        { status: "finalizado", enteredAt: "2026-09-08T12:00:00.000Z", exitedAt: null },
      ],
      comments: [{ id: "r1", author: "Sistema", authorMemberId: "m1", text: "", kind: "activity", fieldKey: "dueDate", oldValue: "2026-09-04", newValue: "2026-09-08", createdAt: "2026-09-03T12:00:00.000Z" }],
    });
    const result = buildDashboardMetrics({ tasks: [remarcada], projects, members, tags, nowIso: NOW });
    expect(result.punctuality).toMatchObject({ delivered: 1, keptCurrent: 1, keptOriginal: 0, currentRate: 100, originalRate: 0, averageSlipDays: 4 });
  });

  it("envelhece a tarefa aberta pelo tempo parado no status atual", () => {
    expect(metrics.aging).toHaveLength(1);
    expect(metrics.aging[0]).toMatchObject({ taskId: "t1", status: "para_aprovacao", days: 2.1, overdue: true, assigneeName: "Ana" });
    // O limite saudável nasce do P85 do prazo real, não de um número escolhido.
    expect(metrics.agingThresholdDays).toBe(8);
  });

  it("fotografa a distribuição entre fila, produção e entrega a cada semana", () => {
    expect(metrics.cumulativeFlow).toHaveLength(8);
    expect(metrics.cumulativeFlow.at(-1)).toMatchObject({ nao_iniciada: 0, em_andamento: 0, feita: 2, total: 2 });
    const meioDaProducao = metrics.cumulativeFlow.find((point) => point.start === "2026-09-06");
    expect(meioDaProducao).toMatchObject({ em_andamento: 2, feita: 0 });
  });

  it("resume a saúde de cada cliente pela carteira aberta", () => {
    expect(metrics.projectHealth).toHaveLength(1);
    expect(metrics.projectHealth[0]).toMatchObject({ id: "p1", total: 3, done: 1, open: 2, overdue: 1, rework: 1, progress: 33 });
    expect(metrics.projectHealth[0].alerts).toBe(metrics.alerts.length);
  });

  it("aponta quem não registrou nenhuma ação e não tem carteira", () => {
    expect(metrics.idleMembers.map((member) => member.memberId)).toEqual(["m3"]);
  });

  it("leva a instrução do aviso junto com o rótulo", () => {
    const semLink = metrics.alerts.find((alert) => alert.id === "t1:link")!;
    expect(semLink.message).toContain("Cole o link");
    expect(metrics.alerts.filter((alert) => alert.taskId === "t3").map((alert) => alert.type)).toEqual(["responsavel", "prazo", "formato", "canal"]);
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
