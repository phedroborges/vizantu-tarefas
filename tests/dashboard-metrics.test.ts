import { describe, expect, it } from "vitest";
import { buildDashboardMetrics, buildDashboardReport } from "../src/lib/dashboard-metrics";
import { dayRangeInstants, resolveDashboardPeriod } from "../src/lib/dashboard-period";
import type { Member, Project, Tag, Task } from "../src/lib/types";

const NOW = "2026-09-09T15:00:00.000Z";
// A Ana é da estratégia; o Beto e a Clara são da criação.
const members: Member[] = ["Ana", "Beto", "Clara"].map((name, index) => ({
  id: `m${index + 1}`, name, email: `${name.toLowerCase()}@teste.com`, role: index === 0 ? "social_media" : "diretor_criativo",
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
    // Duas visitas da mesma tarefa continuam sendo uma tarefa só na média.
    expect(ana.statusTasks.ajuste).toBe(1);
    expect(metrics.reworkTasks[0]).toMatchObject({ id: "t1", visits: 2, totalMs: 2 * 86_400_000 });
    // A base é quem entrou em criação (t1 e t2); o rascunho t3 não dilui a taxa.
    expect(metrics.creativeTasks).toBe(2);
    expect(metrics.reworkRate).toBe(50);
  });

  it("mede o ciclo criativo só depois que ele fecha em aprovado ou finalizado", () => {
    // t2: 7d22h em criação. A 1h aguardando aprovação é do cliente e fica
    // medida à parte, fora do tempo de quem criou.
    expect(metrics.slowestCreative).toMatchObject({ memberId: "m2", creativeDeliveries: 1, creativeAverageMs: 7 * 86_400_000 + 22 * 3_600_000, creativeClientAverageMs: 3_600_000 });
    expect(metrics.averageCreativeMs).toBe(7 * 86_400_000 + 22 * 3_600_000);
    expect(metrics.averageCreativeClientMs).toBe(3_600_000);
    // t1 ainda espera a aprovação do cliente: o ciclo não fechou e a tarefa
    // não entra na média.
    expect(metrics.members.find((member) => member.memberId === "m1")).toMatchObject({ creativeDeliveries: 0, creativeAverageMs: undefined });
    expect(metrics.creativeDeliveries).toBe(1);
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

  it("espera por aprovação não vira atraso ativo", () => {
    expect(metrics.overdueTasks).toBe(0);
    expect(metrics.delayBuckets.find((bucket) => bucket.label === "1 dia")?.count).toBe(0);
  });

  it("separa o tempo produzindo do tempo esperando na fila", () => {
    // t1 produz 5 dias (criação + duas voltas de ajuste + revisão) e t2 produz
    // 7d22h; a espera do time é o "pronto para criação" e os 7d3h do rascunho
    // t3, que não tem histórico e é medido desde a criação. O tempo aguardando
    // aprovação (2d3h de t1 + 1h de t2) é do cliente e não pesa na eficiência.
    // Finalizado fica fora de tudo.
    expect(metrics.flowEfficiency.workingMs).toBe(12 * 86_400_000 + 22 * 3_600_000);
    expect(metrics.flowEfficiency.waitingMs).toBe(8 * 86_400_000 + 3 * 3_600_000);
    expect(metrics.flowEfficiency.clientMs).toBe(2 * 86_400_000 + 4 * 3_600_000);
    expect(metrics.flowEfficiency.ratio).toBe(61);
    expect(metrics.flowEfficiency.tasks).toBe(3);
  });

  it("mede a espera pela aprovação do cliente, incluindo a que está aberta agora", () => {
    // t1 está parada com o cliente há 2d3h; t2 esperou 1h e já fechou.
    expect(metrics.clientWait.creative).toMatchObject({ tasks: 2, rounds: 2, waitingNow: 1, totalMs: 2 * 86_400_000 + 4 * 3_600_000, longestWaitingMs: 2 * 86_400_000 + 3 * 3_600_000 });
    expect(metrics.clientWait.text).toMatchObject({ tasks: 0, waitingNow: 0, averageMs: undefined });
    expect(metrics.clientWait.projects).toHaveLength(1);
    expect(metrics.clientWait.projects[0]).toMatchObject({ id: "p1", name: "Cliente", creative: { tasks: 2, waitingNow: 1 } });
    // A espera aparece na grade da Ana, mas não soma no tempo dela.
    const ana = metrics.members.find((member) => member.memberId === "m1")!;
    expect(ana.statusMs.para_aprovacao).toBe(2 * 86_400_000 + 3 * 3_600_000);
    expect(ana.clientMs).toBe(2 * 86_400_000 + 3 * 3_600_000);
    expect(ana.totalStatusMs).toBe(6 * 86_400_000);
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

  it("fotografa a distribuição entre fila, produção e entrega a cada semana", () => {
    expect(metrics.cumulativeFlow).toHaveLength(8);
    expect(metrics.cumulativeFlow.at(-1)).toMatchObject({ nao_iniciada: 1, em_andamento: 0, feita: 2, total: 3 });
    const meioDaProducao = metrics.cumulativeFlow.find((point) => point.start === "2026-09-06");
    expect(meioDaProducao).toMatchObject({ em_andamento: 2, feita: 0 });
  });

  it("resume a saúde de cada cliente pela carteira aberta", () => {
    expect(metrics.projectHealth).toHaveLength(1);
    expect(metrics.projectHealth[0]).toMatchObject({ id: "p1", total: 3, done: 1, open: 2, overdue: 0, rework: 1, progress: 33 });
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


it("descartada não é carga aberta, atraso ou pendência de informação", () => {
  const discarded = task({ id: "discarded", name: "Descartada", status: "problema", assigneeId: "m1", dueDate: "2020-01-01", formatTagIds: [], channelTagIds: [], statusHistory: [{ status: "problema", enteredAt: "2026-09-01T12:00:00Z", exitedAt: null }] });
  const metrics = buildDashboardMetrics({ tasks: [discarded], projects, members, tags, nowIso: NOW });
  expect(metrics.activeTasks).toBe(0);
  expect(metrics.overdueTasks).toBe(0);
  expect(metrics.members.find((member) => member.memberId === "m1")?.openTasks).toBe(0);
  // O relógio de uma tarefa encerrada não corre: nada de tempo acumulado.
  expect(metrics.members.find((member) => member.memberId === "m1")).toMatchObject({ totalStatusMs: 0, timedTasks: 0 });
  expect(metrics.cumulativeFlow.at(-1)?.total).toBe(0);
  expect(metrics.alerts).toEqual([]);
  expect(metrics.projectHealth[0]).toMatchObject({ open: 0, overdue: 0, done: 0 });
  expect(metrics.punctuality.delivered).toBe(0);
});

describe("uso do link pelo cliente", () => {
  const evento = (taskId: string, action: "approved" | "changes_requested" | "rejected" | "reopened", reviewerName?: string, comment?: string, createdAt = "2026-09-08T15:00:00.000Z") => ({ taskId, action, reviewerName, comment, createdAt });

  it("conta as respostas por cliente e por pessoa, sem as reaberturas do time", () => {
    const result = buildDashboardMetrics({
      tasks, projects, members, tags, nowIso: NOW,
      clientActivity: {
        events: [
          evento("t1", "approved", "Marina"),
          evento("t2", "changes_requested", " marina ", "Trocar a capa", "2026-09-09T02:00:00.000Z"),
          evento("t2", "rejected", "Otávio", "Fora da linha"),
          evento("t1", "reopened"),
          // Tarefa que a pessoa logada não enxerga: fica de fora.
          evento("oculta", "approved", "Marina"),
        ],
        links: [{ projectId: "p1", lastUsedAt: "2026-09-09T14:00:00.000Z" }, { projectId: "outro" }],
      },
    });
    expect(result.clientAdoption).toEqual([
      { id: "p1", name: "Cliente", actions: 3, approvals: 1, changes: 2, comments: 2, reviewers: 2, lastActionDate: "2026-09-08", lastAccessDate: "2026-09-09" },
    ]);
    // A mesma pessoa escrita de dois jeitos é uma só.
    expect(result.reviewers).toEqual([
      { key: "p1:marina", name: "Marina", projectName: "Cliente", actions: 2, approvals: 1, changes: 1, comments: 1, lastActionDate: "2026-09-08" },
      { key: "p1:otávio", name: "Otávio", projectName: "Cliente", actions: 1, approvals: 0, changes: 1, comments: 1, lastActionDate: "2026-09-08" },
    ]);
  });

  it("mostra o cliente que tem link e nunca respondeu", () => {
    const result = buildDashboardMetrics({ tasks, projects, members, tags, nowIso: NOW, clientActivity: { events: [], links: [{ projectId: "p1" }] } });
    expect(result.clientAdoption).toEqual([{ id: "p1", name: "Cliente", actions: 0, approvals: 0, changes: 0, comments: 0, reviewers: 0, lastActionDate: undefined, lastAccessDate: undefined }]);
    expect(result.reviewers).toEqual([]);
  });
});

describe("relógio do ciclo criativo", () => {
  const D = 86_400_000;
  const at = (day: number, hour = 12) => `2026-09-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000Z`;

  it("liga em pronto para criação, pausa com o cliente e fora da criação, para em aprovado e religa no ajuste", () => {
    const ciclo = task({
      id: "ciclo", name: "Vai e volta", status: "finalizado", assigneeId: "m1",
      statusHistory: [
        { status: "pronto_para_criacao", enteredAt: at(1), exitedAt: at(2) }, // 1d conta
        { status: "aprovacao_copy", enteredAt: at(2), exitedAt: at(4) }, // 2d pausado
        { status: "pronto_para_criacao", enteredAt: at(4), exitedAt: at(5) }, // 1d conta
        { status: "em_criacao", enteredAt: at(5), exitedAt: at(6) }, // 1d conta
        { status: "para_aprovacao", enteredAt: at(6), exitedAt: at(7) }, // 1d do cliente
        { status: "aprovado", enteredAt: at(7), exitedAt: at(8) }, // parado
        { status: "ajuste", enteredAt: at(8), exitedAt: at(8, 18) }, // 6h conta
        { status: "finalizado", enteredAt: at(8, 18), exitedAt: null },
      ],
    });
    const result = buildDashboardMetrics({ tasks: [ciclo], projects, members, tags, nowIso: NOW });
    expect(result.averageCreativeMs).toBe(3 * D + 6 * 3_600_000);
    expect(result.averageCreativeClientMs).toBe(D);
    expect(result.members.find((member) => member.memberId === "m1")).toMatchObject({ creativeDeliveries: 1, creativeAverageMs: 3 * D + 6 * 3_600_000, creativeClientAverageMs: D });
    // As duas aprovações são do cliente, mas de fases diferentes: a do texto
    // é estratégia, a da peça é criação.
    expect(result.clientWait.text).toMatchObject({ tasks: 1, rounds: 1, totalMs: 2 * D, averageMs: 2 * D, waitingNow: 0 });
    expect(result.clientWait.creative).toMatchObject({ tasks: 1, rounds: 1, totalMs: D, averageMs: D, waitingNow: 0 });
    // Depois de aprovada a demanda volta para a estratégia, que entrega.
    expect(result.phases).toEqual([
      { key: "estrategia", label: "Estratégia, antes da criação", tasks: 1, teamMs: 0, clientMs: 2 * D },
      { key: "criacao", label: "Criação", tasks: 1, teamMs: 3 * D + 6 * 3_600_000, clientMs: D },
      { key: "entrega", label: "Estratégia, entrega e postagem", tasks: 1, teamMs: D, clientMs: 0 },
    ]);
  });

  it("mede quem é da estratégia pelas etapas de estratégia, não pela criação", () => {
    // A Ana planejou (2d de rascunho), esperou o cliente aprovar o texto (3d)
    // e criou ela mesma (1d). Depois de aprovada, levou 1d para entregar.
    const planejada = task({
      id: "planejada", name: "Planejada", status: "finalizado", assigneeId: "m1",
      statusHistory: [
        { status: "rascunho", enteredAt: at(1), exitedAt: at(3) },
        { status: "aprovacao_copy", enteredAt: at(3), exitedAt: at(6) },
        { status: "em_criacao", enteredAt: at(6), exitedAt: at(7) },
        { status: "aprovado", enteredAt: at(7), exitedAt: at(8) },
        { status: "finalizado", enteredAt: at(8), exitedAt: null },
      ],
    });
    const result = buildDashboardMetrics({ tasks: [planejada], projects, members, tags, nowIso: NOW });
    expect(result.members.find((member) => member.memberId === "m1")).toMatchObject({ area: "estrategia", strategyTasks: 1, strategyAverageMs: 3 * D, strategyClientAverageMs: 3 * D });
    expect(result.members.find((member) => member.memberId === "m2")).toMatchObject({ area: "criacao", strategyTasks: 0, strategyAverageMs: undefined });
    // Ela fechou um ciclo criativo, mas não é da criação: fica fora do destaque.
    expect(result.slowestCreative).toBeUndefined();
  });

  it("dá a espera da entrega a quem criou, mesmo que outra pessoa segure a aprovação", () => {
    // O Beto criou em 1 dia; a Ana assumiu só para acompanhar a aprovação,
    // que levou 3 dias. Ela não criou nada e não pode aparecer na velocidade.
    const repassada = task({
      id: "repassada", name: "Repassada", status: "aprovado", assigneeId: "m1",
      statusHistory: [
        { status: "em_criacao", enteredAt: at(1), exitedAt: at(2) },
        { status: "para_aprovacao", enteredAt: at(2), exitedAt: at(5) },
        { status: "aprovado", enteredAt: at(5), exitedAt: null },
      ],
      comments: [{ id: "r1", author: "Sistema", authorMemberId: "m2", text: "", kind: "activity", fieldKey: "assigneeId", oldValue: "m2", newValue: "m1", createdAt: at(2) }],
    });
    const result = buildDashboardMetrics({ tasks: [repassada], projects, members, tags, nowIso: NOW });
    expect(result.members.find((member) => member.memberId === "m2")).toMatchObject({ creativeDeliveries: 1, creativeAverageMs: D, creativeClientAverageMs: 3 * D });
    expect(result.members.find((member) => member.memberId === "m1")).toMatchObject({ creativeDeliveries: 0, creativeAverageMs: undefined, clientMs: 3 * D });
  });

  it("cobra de cada pessoa só o tempo em que a tarefa estava com ela", () => {
    // A tarefa esperou 5 dias em "pronto" com a Ana; a Clara assumiu e
    // entregou em 1 dia. Os 5 dias não podem cair na conta da Clara.
    const herdada = task({
      id: "herdada", name: "Herdada", status: "aprovado", assigneeId: "m3",
      statusHistory: [
        { status: "pronto_para_criacao", enteredAt: at(1), exitedAt: at(6) },
        { status: "em_criacao", enteredAt: at(6), exitedAt: at(7) },
        { status: "aprovado", enteredAt: at(7), exitedAt: null },
      ],
      comments: [{ id: "h1", author: "Sistema", authorMemberId: "m1", text: "", kind: "activity", fieldKey: "assigneeId", oldValue: "m1", newValue: "m3", createdAt: at(6) }],
    });
    const result = buildDashboardMetrics({ tasks: [herdada], projects, members, tags, nowIso: NOW });
    expect(result.members.find((member) => member.memberId === "m3")!.creativeAverageMs).toBe(D);
    expect(result.members.find((member) => member.memberId === "m1")!.creativeAverageMs).toBe(5 * D);
    expect(result.averageCreativeMs).toBe(6 * D);
  });
});

describe("tempo por pessoa em cada status", () => {
  const D = 86_400_000;

  it("não deixa o tempo de finalizado crescer e separa a soma da média por tarefa", () => {
    const entregue = (id: string) => task({
      id, name: id, status: "finalizado", assigneeId: "m1",
      statusHistory: [
        { status: "pronto_para_criacao", enteredAt: "2026-08-01T12:00:00.000Z", exitedAt: "2026-08-03T12:00:00.000Z" },
        { status: "finalizado", enteredAt: "2026-08-03T12:00:00.000Z", exitedAt: null },
      ],
    });
    const result = buildDashboardMetrics({ tasks: [entregue("a"), entregue("b")], projects, members, tags, nowIso: NOW });
    const ana = result.members.find((member) => member.memberId === "m1")!;
    expect(ana.statusMs.finalizado).toBe(0);
    expect(ana.statusMs.pronto_para_criacao).toBe(4 * D);
    expect(ana.statusTasks.pronto_para_criacao).toBe(2);
    expect(ana.statusMaxMs.pronto_para_criacao).toBe(2 * D);
    expect(ana).toMatchObject({ totalStatusMs: 4 * D, timedTasks: 2 });
  });

  it("reconcilia o histórico quando o status foi trocado direto no banco", () => {
    // A entrada aberta diz "pronto", mas a tarefa já está finalizada: a troca
    // é datada pelo updatedAt e o relógio para ali.
    const forcada = task({
      id: "forcada", name: "Finalizada por fora", status: "finalizado", assigneeId: "m1",
      createdAt: "2026-09-01T12:00:00.000Z", updatedAt: "2026-09-03T12:00:00.000Z",
      statusHistory: [{ status: "pronto_para_criacao", enteredAt: "2026-09-01T12:00:00.000Z", exitedAt: null }],
    });
    const result = buildDashboardMetrics({ tasks: [forcada], projects, members, tags, nowIso: NOW });
    expect(result.members.find((member) => member.memberId === "m1")!.statusMs.pronto_para_criacao).toBe(2 * D);
    expect(result.leadTime).toMatchObject({ samples: 1, p50Ms: 2 * D });
    expect(result.averageCreativeMs).toBe(2 * D);
  });
});

it("usa o dia de São Paulo, e não o de Londres, para decidir atraso e pontualidade", () => {
  // 23h de 9/set em São Paulo já é 10/set em UTC.
  const noite = "2026-09-10T02:00:00.000Z";
  const venceHoje = task({ id: "hoje", name: "Vence hoje", status: "em_criacao", dueDate: "2026-09-09", statusHistory: [{ status: "em_criacao", enteredAt: "2026-09-08T12:00:00.000Z", exitedAt: null }] });
  const fechouHoje = task({
    id: "fechou", name: "Fechou no dia", status: "finalizado", dueDate: "2026-09-09",
    statusHistory: [
      { status: "em_criacao", enteredAt: "2026-09-08T12:00:00.000Z", exitedAt: "2026-09-10T01:00:00.000Z" },
      { status: "finalizado", enteredAt: "2026-09-10T01:00:00.000Z", exitedAt: null },
    ],
  });
  const result = buildDashboardMetrics({ tasks: [venceHoje, fechouHoje], projects, members, tags, nowIso: noite });
  expect(result.overdueTasks).toBe(0);
  expect(result.punctuality).toMatchObject({ delivered: 1, keptCurrent: 1, keptOriginal: 1 });
});

describe("período do dashboard", () => {
  it("resolve os atalhos e compara com a mesma quantidade de dias antes", () => {
    expect(resolveDashboardPeriod({ periodo: "7d" }, "2026-10-09")).toMatchObject({
      preset: "7d", days: 7, range: { from: "2026-10-03", to: "2026-10-09" }, previous: { from: "2026-09-26", to: "2026-10-02" }, endsInPast: false,
    });
    expect(resolveDashboardPeriod({ periodo: "mes-passado" }, "2026-10-09")).toMatchObject({
      days: 30, range: { from: "2026-09-01", to: "2026-09-30" }, previous: { from: "2026-08-02", to: "2026-08-31" }, endsInPast: true,
    });
    expect(resolveDashboardPeriod({ periodo: "tudo" }, "2026-10-09")).toEqual({ preset: "tudo", label: "Todo o período", endsInPast: false });
    expect(resolveDashboardPeriod({ periodo: "qualquer-coisa" }, "2026-10-09").preset).toBe("30d");
  });

  it("aceita intervalo livre, mesmo invertido ou passando de hoje", () => {
    expect(resolveDashboardPeriod({ de: "2026-10-20", ate: "2026-10-05" }, "2026-10-09")).toMatchObject({
      preset: "personalizado", days: 5, range: { from: "2026-10-05", to: "2026-10-09" }, previous: { from: "2026-09-30", to: "2026-10-04" },
    });
    expect(resolveDashboardPeriod({ de: "2026-02-31" }, "2026-10-09").preset).toBe("30d");
  });

  it("conta no período só o que aconteceu nele", () => {
    const { metrics, comparison } = buildDashboardReport({
      tasks, projects, members, tags, nowIso: NOW,
      window: dayRangeInstants({ from: "2026-09-08", to: "2026-09-09" }),
      previous: dayRangeInstants({ from: "2026-09-06", to: "2026-09-07" }),
    });
    // t2 fechou no dia 9: entra a entrega, com o ciclo inteiro.
    expect(metrics.periodTotals).toEqual({ created: 0, completed: 1 });
    expect(metrics.averageCreativeMs).toBe(7 * 86_400_000 + 22 * 3_600_000);
    // Do tempo em criação de t2, só as 31h a partir da 0h do dia 8.
    expect(metrics.flowEfficiency.workingMs).toBe(31 * 3_600_000);
    // O ajuste de t1 acabou no dia 7 e ela já estava com o cliente.
    expect(metrics.creativeTasks).toBe(1);
    expect(metrics.reworkedTasks).toBe(0);
    expect(metrics.bucketUnit).toBe("dia");
    expect(metrics.throughput).toHaveLength(7);
    // Nos dois dias anteriores nada fechou, e t1 estava em ajuste.
    expect(comparison).toMatchObject({ completed: 0, created: 0, averageCreativeMs: undefined, reworkRate: 50, overdueTasks: 0 });
  });

  it("volta as tarefas ao estado do fim de um período que já acabou", () => {
    const { metrics } = buildDashboardReport({ tasks, projects, members, tags, nowIso: NOW, window: dayRangeInstants({ from: "2026-09-01", to: "2026-09-03" }) });
    // No dia 3 nada tinha sido entregue nem remarcado, e as três estavam abertas.
    expect(metrics.activeTasks).toBe(3);
    expect(metrics.periodTotals).toEqual({ created: 3, completed: 0 });
    expect(metrics.reschedules).toEqual([]);
    expect(metrics.clientWait.creative.tasks).toBe(0);
    expect(metrics.members.find((member) => member.memberId === "m2")!.comments).toBe(0);
  });
});
