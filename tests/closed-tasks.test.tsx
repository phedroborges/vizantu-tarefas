import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TarefasView } from "@/components/tarefas-view";
import { defaultPreferences, type MemberPreferences } from "@/lib/preferences";
import type { Task, TaskStatus } from "@/lib/types";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));

const task = (status: TaskStatus, name: string): Task => ({
  id: status, name, status, projectId: "project", kind: "tarefa", lists: [], images: [],
  formatTagIds: [], channelTagIds: [], categoryTagIds: [], comments: [], statusHistory: [],
  createdAt: "2026-09-01T12:00:00Z", updatedAt: "2026-09-01T12:00:00Z",
});
const tasks = [task("problema", "Peça descartada"), task("finalizado", "Peça finalizada"), task("aprovado", "Peça aprovada"), task("em_criacao", "Peça em produção")];
function render(preferences: Partial<MemberPreferences> = {}, initialTaskId?: string) {
  return renderToStaticMarkup(<TarefasView initialTasks={tasks} initialProjects={[]} initialMembers={[]} initialFormatTags={[]} initialChannelTags={[]} initialStatusColors={[]} initialPreferences={{ ...defaultPreferences(), ...preferences }} initialTaskId={initialTaskId} />);
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
    const html = render({ taskFilters: { ...defaultPreferences().taskFilters, status: "problema" } });
    expect(html).toContain("Peça descartada");
    expect(html).not.toContain("Peça finalizada");
    expect(html).not.toContain("Peça em produção");
  });
  it("preserva a tarefa aberta pelo link direto", () => {
    expect(render({}, "problema")).toContain("Peça descartada");
  });
});
