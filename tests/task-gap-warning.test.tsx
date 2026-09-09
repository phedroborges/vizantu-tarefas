// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskModal } from "../src/components/task-modal";
import { DEFAULT_STATUS_COLORS, TASK_STATUSES, type Member, type Project, type StatusColor, type Tag, type Task, type TaskStatus } from "../src/lib/types";

// O aviso do dashboard só serve se ele também aparecer na frente de quem pode
// resolver. Este teste trava a ponte: a mesma regra que conta bloqueio no
// painel precisa virar recado dentro da tarefa.

const NOW = "2026-09-09T12:00:00.000Z";
const projects: Project[] = [{ id: "p1", name: "Cliente", status: "ativo", createdAt: NOW, updatedAt: NOW }];
const members: Member[] = [{ id: "m1", name: "Ana", email: "ana@teste.com", role: "editor", aiEnabled: false, active: true, createdAt: NOW, updatedAt: NOW }];
const formatTags: Tag[] = [{ id: "f1", kind: "formato", label: "Reels", createdAt: NOW }];
const channelTags: Tag[] = [{ id: "c1", kind: "canal", label: "Instagram", createdAt: NOW }];
const statusColors: StatusColor[] = TASK_STATUSES.map(({ value }) => ({ status: value, color: DEFAULT_STATUS_COLORS[value] }));

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1", projectId: "p1", name: "Post do lançamento", kind: "conteudo", status: "para_aprovacao",
    assigneeId: "m1", dueDate: "2026-09-12", images: [], formatTagIds: ["f1"], channelTagIds: ["c1"],
    categoryTagIds: [], lists: ["criativa"], statusHistory: [], comments: [], createdAt: NOW, updatedAt: NOW,
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root;

function render(current: Task | null) {
  act(() => {
    root.render(
      <TaskModal
        task={current} projects={projects} members={members} formatTags={formatTags} channelTags={channelTags}
        statusColors={statusColors} defaultProjectId="p1" currentUserId="m1"
        onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} onDuplicated={() => {}} onTagCreated={() => {}}
      />,
    );
  });
  return document.body.textContent || "";
}

const avisos = () => [...document.body.querySelectorAll(".task-gap")].map((node) => node.className);

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ activity: [] }), { status: 200 })));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("aviso de informação em falta dentro da tarefa", () => {
  it("manda colocar o link quando a tarefa está em Para aprovação sem material", () => {
    const texto = render(task({ driveLink: undefined }));
    expect(texto).toContain("Sem link do material");
    expect(texto).toContain("Cole o link do material antes de deixar em Para aprovação");
    expect(avisos()).toEqual([expect.stringContaining("is-critical")]);
  });

  it("cala quando a informação está lá", () => {
    render(task({ driveLink: "https://drive.test/arquivo" }));
    expect(avisos()).toEqual([]);
  });

  it("avisa sem gritar quando a falta ainda não trava a etapa", () => {
    render(task({ status: "em_criacao" as TaskStatus, driveLink: undefined }));
    expect(document.body.textContent).toContain("Cole o link do material para quem for criar");
    expect(avisos()).toEqual([expect.not.stringContaining("is-critical")]);
  });

  it("não cobra nada de uma tarefa que ainda está sendo escrita", () => {
    render(null);
    expect(avisos()).toEqual([]);
  });
});
