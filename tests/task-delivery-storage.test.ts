import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
const { db } = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("@/lib/supabase-client", () => ({ getSupabase: db }));
const { notice } = vi.hoisted(() => ({ notice: vi.fn() }));
vi.mock("@/lib/whatsapp/queue", () => ({ queueTaskNotice: notice }));
import { createTask, updateTask } from "@/lib/storage";
import type { StatusHistoryEntry, Comment } from "@/lib/types";
let row: Record<string, unknown>;
beforeEach(() => {
  notice.mockClear();
  row = { id: "task", project_id: "project", name: "Reels", kind: "conteudo", status: "em_criacao", assignee_id: "erika", due_date: "2026-11-20", format_tag_ids: ["reels"], description: "**Direcionamento**\nGravar\n\n**Roteiro**\nFala\n\n**Legenda**\nTexto", status_history: [{ status: "em_criacao", enteredAt: "2026-09-01T12:00:00Z", exitedAt: null }], comments: [], created_at: "2026-09-01T12:00:00Z", updated_at: "2026-09-01T12:00:00Z" };
  db.mockReturnValue(createClient("https://database.example", "test-key", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (_input, init) => {
    const url = new URL(String(_input));
    if (url.pathname.endsWith("/rpc/append_task_comments")) {
      row = { ...row, comments: [...(row.comments as unknown[]), ...JSON.parse(String(init?.body)).p_comments] };
      return Response.json([row]);
    }
    if (url.pathname.endsWith("/plans")) {
      const plan = { id: "plan", project_id: "project", kind: "content", status: "draft" };
      return Response.json(url.searchParams.get("id")?.startsWith("in.") ? [plan] : plan);
    }
    if (url.pathname.endsWith("/plan_item_approvals")) return Response.json(null);
    if (["PATCH", "POST"].includes(init?.method || "")) row = { ...row, ...JSON.parse(String(init?.body)) };
    return Response.json(row);
  } } }));
});
describe("responsável no instante da entrega", () => {
  // É o link que o cliente abre para revisar; sem ele o aviso no grupo nem sai.
  it("não deixa a tarefa incompleta ir para aprovação e diz o que falta", async () => {
    await expect(updateTask("task", { status: "para_aprovacao" }, "luis")).rejects.toThrow("falta: link do material");
    await expect(updateTask("task", { status: "para_aprovacao", driveLink: "   " }, "luis")).rejects.toThrow("falta: link do material");
    row = { ...row, description: "**Direcionamento**\nGravar", due_date: null };
    await expect(updateTask("task", { status: "para_aprovacao", driveLink: "https://drive.google.com/x" }, "luis")).rejects.toThrow("falta: data, roteiro, legenda");
    expect(row.status).toBe("em_criacao");
    expect(notice).not.toHaveBeenCalled();
  });

  it("tarefa completa vai para aprovação e agenda o aviso no grupo do cliente", async () => {
    await updateTask("task", { status: "para_aprovacao", driveLink: "https://drive.google.com/x" }, "luis");
    expect(notice).toHaveBeenCalledWith("project", "task");
  });

  it("guarda quem assumiu e entregou na mesma alteração e mantém após repasse", async () => {
    const delivered = await updateTask("task", { assigneeId: "luis", status: "para_aprovacao", driveLink: "https://drive.google.com/drive/folders/material" }, "luis");
    const event = delivered!.statusHistory.at(-1)!;
    expect(event).toMatchObject({ status: "para_aprovacao", assigneeId: "luis" });
    const assignment = delivered!.comments.find(c => c.fieldKey === "assigneeId")!;
    expect(assignment.createdAt).toBe(event.enteredAt);
    const forwarded = await updateTask("task", { assigneeId: "social", status: "aprovado" }, "social");
    expect(forwarded!.statusHistory.find(e => e.status === "para_aprovacao")).toEqual(expect.objectContaining({ assigneeId: "luis" }));
    expect(forwarded!.assigneeId).toBe("social");
  });
  it("tarefas criadas aprovadas também registram responsável da entrega", async () => {
    await createTask({ projectId: "project", name: "Reels", status: "aprovado", assigneeId: "josiano" });
    expect((row.status_history as StatusHistoryEntry[])[0]).toMatchObject({ assigneeId: "josiano", status: "aprovado" });
    expect((row.comments as Comment[])).toEqual([]);
  });
});
