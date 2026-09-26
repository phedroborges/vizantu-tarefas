import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TarefasView } from "@/components/tarefas-view";
import { defaultPreferences, type MemberPreferences } from "@/lib/preferences";
import type { Task, TaskStatus } from "@/lib/types";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));

const task = (status: TaskStatus, name: string, overrides: Partial<Task> = {}): Task => ({
  id: status, name, status, projectId: "project", kind: "tarefa", lists: [], images: [],
  formatTagIds: [], channelTagIds: [], categoryTagIds: [], comments: [], statusHistory: [],
  createdAt: "2026-09-01T12:00:00Z", updatedAt: "2026-09-01T12:00:00Z",
  ...overrides,
});
const tasks = [task("problema", "Peça descartada"), task("finalizado", "Peça finalizada"), task("aprovado", "Peça aprovada"), task("em_criacao", "Peça em produção")];
function render(preferences: Partial<MemberPreferences> = {}, initialTaskId?: string, initialTasks = tasks) {
  return renderToStaticMarkup(<TarefasView currentUserId="member" initialTasks={initialTasks} initialProjects={[]} initialMembers={[]} initialFormatTags={[]} initialChannelTags={[]} initialStatusColors={[]} initialPreferences={{ ...defaultPreferences(), ...preferences }} initialTaskId={initialTaskId} />);
}
describe("tarefas encerradas na lista", () => {
  it("oculta problema e finalizado por padrão, mantendo aprovado e em criação", () => {
    const html = render();
    expect(html).not.toContain("Peça descartada");
    expect(html).not.toContain("Peça finalizada");
    expect(html).toContain("Peça aprovada");
    expect(html).toContain("Peça em produção");
  });
  it("permite consultar ambas pela opção de mostrar encerradas", () => {
    const html = render({ showFinalized: true });
    expect(html).toContain("Peça descartada");
    expect(html).toContain("Peça finalizada");
  });
  it("o filtro Problema mostra somente as descartadas mesmo com encerradas ocultas", () => {
    const html = render({ taskFilters: { ...defaultPreferences().taskFilters, statuses: ["problema"] } });
    expect(html).toContain("Peça descartada");
    expect(html).not.toContain("Peça finalizada");
    expect(html).not.toContain("Peça em produção");
  });
  it("combina vários status com OU dentro do mesmo filtro", () => {
    const html = render({ taskFilters: { ...defaultPreferences().taskFilters, statuses: ["problema", "em_criacao"] } });
    expect(html).toContain("Peça descartada");
    expect(html).toContain("Peça em produção");
    expect(html).not.toContain("Peça finalizada");
    expect(html).not.toContain("Peça aprovada");
  });
  it("preserva a tarefa aberta pelo link direto", () => {
    expect(render({}, "problema")).toContain("Peça descartada");
  });
  it("usa OU dentro de cada categoria e E entre categorias", () => {
    const mixed = [
      task("em_criacao", "Combina A", { id: "a", projectId: "p1", assigneeId: "m1", lists: ["criativa"] }),
      task("revisao", "Combina B", { id: "b", projectId: "p2", assigneeId: "m2", lists: ["estrategica"] }),
      task("revisao", "Fora do projeto", { id: "c", projectId: "p3", assigneeId: "m2", lists: ["criativa"] }),
      task("revisao", "Fora do responsável", { id: "d", projectId: "p2", assigneeId: "m3", lists: ["criativa"] }),
    ];
    const html = render({ taskFilters: {
      query: "",
      projectIds: ["p1", "p2"],
      assigneeIds: ["m1", "m2"],
      statuses: ["em_criacao", "revisao"],
      lists: ["criativa", "estrategica"],
    } }, undefined, mixed);
    expect(html).toContain("Combina A");
    expect(html).toContain("Combina B");
    expect(html).not.toContain("Fora do projeto");
    expect(html).not.toContain("Fora do responsável");
  });
});
