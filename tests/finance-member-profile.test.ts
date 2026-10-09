import { describe, expect, it } from "vitest";
import { buildMemberFinance } from "../src/lib/finance/member-profile";
import { DEFAULT_SETTINGS, type Entry, type Settings } from "../src/lib/finance/types";
import { podeVer, podeVerFinanceiroDe } from "../src/lib/permissions";
import type { Member, Project, Task } from "../src/lib/types";

const NOW = "2026-09-25T15:00:00.000Z";
const TODAY = "2026-09-25";
const members: Member[] = [["m1", "Ana", "social_media"], ["m2", "Beto", "diretor_criativo"], ["m3", "Clara", "diretor_criativo"]].map(([id, name, role]) => ({
  id, name, email: `${id}@teste.com`, role: role as Member["role"], aiEnabled: false, active: true, createdAt: NOW, updatedAt: NOW,
}));
const projects: Project[] = [{ id: "p1", name: "Cliente", status: "ativo", createdAt: NOW, updatedAt: NOW }];

function task(input: Partial<Task> & Pick<Task, "id" | "name" | "status">, approvedAt?: string): Task {
  return {
    projectId: "p1", kind: "conteudo", images: [], formatTagIds: [], channelTagIds: [], categoryTagIds: [], lists: ["criativa"],
    statusHistory: approvedAt ? [{ status: input.status, enteredAt: approvedAt, exitedAt: null }] : [], comments: [],
    assigneeId: "m2", createdAt: "2026-08-01T12:00:00.000Z", updatedAt: NOW, ...input,
  };
}

const tasks: Task[] = [
  task({ id: "a", name: "Reels de lançamento", status: "aprovado" }, "2026-09-05T12:00:00.000Z"),
  task({ id: "b", name: "Estático de oferta", status: "finalizado" }, "2026-09-20T12:00:00.000Z"),
  task({ id: "c", name: "Peça sem tipo", status: "aprovado" }, "2026-09-10T12:00:00.000Z"),
  task({ id: "d", name: "Reels de agosto", status: "aprovado" }, "2026-08-28T12:00:00.000Z"),
  task({ id: "e", name: "Carrossel voltou", status: "ajuste", dueDate: "2026-09-01" }),
  task({ id: "f", name: "Reels da Clara", status: "aprovado", assigneeId: "m3" }, "2026-09-06T12:00:00.000Z"),
];
const entries: Entry[] = [{
  id: "e1", direction: "expense", category: "producao", description: "Estático de oferta", amount: 4500, competence: "2026-09",
  projectId: "p1", memberId: "m2", recurring: false, seriesId: null, sourceKey: "production:b", cancelled: false, notes: "", createdAt: NOW,
}];
const range = { from: "2026-09-01", to: "2026-09-30" };
const previous = { from: "2026-08-02", to: "2026-08-31" };
const build = (settings: Settings = DEFAULT_SETTINGS, memberId = "m2") =>
  buildMemberFinance({ data: { tasks, tags: [], settings, members, entries, projects }, memberId, range, previous, today: TODAY })!;

describe("financeiro de cada pessoa", () => {
  it("soma só as demandas da pessoa, separando o lançado do que falta lançar", () => {
    const profile = build();
    expect(profile.paymentMode).toBe("demand");
    // Reels a lançar pela tabela (R$ 70) + estático já lançado por R$ 45.
    expect(profile.totals).toEqual({ earnings: 11500, launched: 4500, pending: 7000, deliveries: 3, unpriced: 1 });
    expect(profile.previous).toMatchObject({ earnings: 7000, deliveries: 1 });
    expect(profile.lines.map((line) => line.taskId)).toEqual(["b", "c", "a"]);
    expect(profile.lines.map((line) => line.situation)).toEqual(["lancada", "sem_valor", "a_lancar"]);
    expect(profile.byFormat.map((row) => [row.label, row.total])).toEqual([["Reels", 7000], ["Estático (feed/story)", 4500]]);
    expect(profile.history.at(-1)).toEqual({ month: "2026-09", earnings: 11500, deliveries: 3 });
    expect(profile.history.at(-2)).toEqual({ month: "2026-08", earnings: 7000, deliveries: 1 });
    expect(profile.inProgress).toBe(1);
  });

  it("não deixa passar nada de outra pessoa", () => {
    const serialized = JSON.stringify(build());
    expect(serialized).not.toContain("Reels da Clara");
    expect(serialized).not.toContain("Clara");
    expect(build(DEFAULT_SETTINGS, "m3").lines.map((line) => line.taskId)).toEqual(["f"]);
    expect(buildMemberFinance({ data: { tasks, tags: [], settings: DEFAULT_SETTINGS, members, entries, projects }, memberId: "ninguem", today: TODAY })).toBeNull();
  });

  it("aponta o que pede ação agora", () => {
    const attention = build().attention;
    expect(attention.map((point) => point.key)).toEqual(["atrasadas", "ajuste", "sem_valor"]);
    expect(attention[0].tasks).toEqual([{ id: "e", name: "Carrossel voltou", projectName: "Cliente", meta: "há 24 dias · Ajuste" }]);
    expect(attention[2].tasks.map((item) => item.id)).toEqual(["c"]);
  });

  it("no salário fixo as demandas contam, mas não geram valor por peça", () => {
    const profile = build({ ...DEFAULT_SETTINGS, compensationRules: [{ memberId: "m2", fromMonth: "2026-09", mode: "salary", salary: 300000 }] });
    expect(profile.paymentMode).toBe("salary");
    expect(profile.salary).toBe(300000);
    expect(profile.totals).toMatchObject({ earnings: 0, deliveries: 3, unpriced: 0 });
    expect(profile.lines.every((line) => line.situation === "salario")).toBe(true);
    expect(profile.rates).toEqual([]);
    // Agosto ainda era por demanda; setembro já é o salário.
    expect(profile.history.at(-2)?.earnings).toBe(7000);
    expect(profile.history.at(-1)?.earnings).toBe(300000);
  });

  it("cada um abre só o seu; o dono abre o de qualquer pessoa", () => {
    expect(podeVer("diretor_criativo", "meu_financeiro")).toBe(true);
    expect(podeVer("social_media", "meu_financeiro")).toBe(true);
    expect(podeVer("gestor", "meu_financeiro")).toBe(false);
    expect(podeVerFinanceiroDe("diretor_criativo", "m2", "m2")).toBe(true);
    expect(podeVerFinanceiroDe("diretor_criativo", "m2", "m3")).toBe(false);
    expect(podeVerFinanceiroDe("gestor", "m9", "m9")).toBe(false);
    expect(podeVerFinanceiroDe("dono", "m0", "m3")).toBe(true);
  });
});
