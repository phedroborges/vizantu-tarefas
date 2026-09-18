import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
const { db } = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("@/lib/supabase-client", () => ({ getSupabase: db }));
import { createTask, updateTask } from "@/lib/storage";
import type { StatusHistoryEntry, Comment } from "@/lib/types";
let row: Record<string, unknown>;
beforeEach(() => {
  row = { id: "task", project_id: "project", name: "Reels", kind: "conteudo", status: "em_criacao", assignee_id: "erika", status_history: [{ status: "em_criacao", enteredAt: "2026-09-01T12:00:00Z", exitedAt: null }], comments: [], created_at: "2026-09-01T12:00:00Z", updated_at: "2026-09-01T12:00:00Z" };
  db.mockReturnValue(createClient("https://database.example", "test-key", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (_input, init) => {
    if (["PATCH", "POST"].includes(init?.method || "")) row = { ...row, ...JSON.parse(String(init?.body)) };
    return Response.json(row);
  } } }));
});
describe("responsável no instante da entrega", () => {
  it("guarda quem assumiu e entregou na mesma alteração e mantém após repasse", async () => {
    const delivered = await updateTask("task", { assigneeId: "luis", status: "para_aprovacao" }, "luis");
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
