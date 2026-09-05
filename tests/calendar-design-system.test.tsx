import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TarefasView } from "../src/components/tarefas-view";
import { defaultPreferences } from "../src/lib/preferences";
import type { Task } from "../src/lib/types";

const task: Task = {
  id: "task-1", projectId: "project-1", name: "Conteúdo do calendário", kind: "conteudo", dueDate: "2026-09-05",
  assigneeId: "member-1", images: ["imagem.png"], driveLink: "https://example.com", formatTagIds: ["format-1"],
  channelTagIds: ["channel-1"], categoryTagIds: [], lists: [], status: "em_criacao", statusHistory: [],
  comments: [{ id: "comment-1", author: "Equipe", text: "Comentário", createdAt: "2026-09-01T00:00:00Z" }],
  createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z",
};

describe("calendário de tarefas segue o componente aprovado no design system", () => {
  it("renderiza cabeçalho, configurador, grade, cartão rico e legenda oficiais", () => {
    const preferences = { ...defaultPreferences(), taskView: "calendario" as const };
    const html = renderToStaticMarkup(<TarefasView initialTasks={[task]} initialProjects={[{ id: "project-1", name: "Cliente", avatarUrl: null, avatarColor: null, status: "ativo", createdAt: task.createdAt, updatedAt: task.updatedAt }]} initialMembers={[{ id: "member-1", name: "Pessoa", email: "pessoa@example.com", role: "editor", active: true, aiEnabled: false, avatarUrl: null, createdAt: task.createdAt }]} initialFormatTags={[{ id: "format-1", label: "Carrossel", kind: "formato", createdAt: task.createdAt }]} initialChannelTags={[{ id: "channel-1", label: "Instagram", kind: "canal", createdAt: task.createdAt }]} initialStatusColors={[]} initialPreferences={preferences} currentUserId="member-1" />);
    expect(html).toContain('class="vz-cal task-calendar"');
    expect(html).toContain("Mostrar no cartão");
    expect(html).toContain('class="vz-cal__grid"');
    expect(html).toContain("vz-cal-card vz-cal-card--blue");
    expect(html).toContain("vz-minitag--amber");
    expect(html).toContain('class="vz-cal__legend"');
    expect(html).toContain("Carrossel");
  });
});
