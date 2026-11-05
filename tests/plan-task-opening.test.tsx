// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { TaskModal } from "@/components/task-modal";
import type { Task } from "@/lib/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

it("opens a planned content task with its text", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ activity: [] }) })));
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const task = { id: "task", name: "V4 · Condicionantes", projectId: "project", planId: "plan", kind: "conteudo", status: "aprovacao_copy", description: "**Roteiro**\nSua empresa tem licença?", comments: [
    { id: "legacy", type: "activity", text: "Calendário ajustado", createdAt: "2026-11-03T14:55:50.645347+00:00" },
    { id: "unknown", text: "Nota sem autor", createdAt: "2026-11-03T15:00:00Z" },
    { id: "client", author: "Cliente", text: "Texto aprovado", createdAt: "2026-11-04T15:00:00Z" },
  ], statusHistory: [], images: [], formatTagIds: [], channelTagIds: [], categoryTagIds: [] } as unknown as Task;
  try {
    await act(async () => root.render(<TaskModal task={task} projects={[]} members={[]} formatTags={[]} channelTags={[]} statusColors={[]} defaultProjectId="project" currentUserId="user" onClose={vi.fn()} onSaved={vi.fn()} onDeleted={vi.fn()} onDuplicated={vi.fn()} onTagCreated={vi.fn()} />));
    expect(document.body.textContent).toContain("V4 · Condicionantes");
    expect(document.body.textContent).toContain("Sistema");
    expect(document.body.textContent).toContain("Calendário ajustado");
    expect(document.body.textContent).toContain("Autor não identificado");
    expect(document.body.textContent).toContain("Texto aprovado");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
