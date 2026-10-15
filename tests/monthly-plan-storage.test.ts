import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/lib/supabase-client", () => ({ getSupabase: getDb }));
vi.mock("@/lib/whatsapp/queue", () => ({ queueApprovalNotice: vi.fn(), queueStandaloneNotice: vi.fn() }));
import { clientPlanView, createTask, submitPlanApprovalResponse, updateTask } from "@/lib/storage";

type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
const plan = (id: string, month: string | null, project = "client") => ({ id, project_id: project, title: id, kind: "content", status: "draft", source: "native", period_month: month });
const task = (id: string, planId: string) => ({ id, project_id: "client", plan_id: planId, name: id, kind: "conteudo", status: "rascunho", due_date: "2026-09-10", format_tag_ids: [], channel_tag_ids: [], category_tag_ids: [], comments: [], status_history: [], created_at: "2026-09-01T12:00:00Z", updated_at: "2026-09-01T12:00:00Z" });
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
  tables = {
    projects: [{ id: "client", name: "Casa Caramelo" }],
    plans: [plan("september", "2026-09"), plan("october", "2026-10"), plan("november", "2026-11"), plan("december", "2026-12"), plan("campaign", null), plan("foreign", "2026-10", "other")],
    tasks: [task("old", "september"), task("current", "october"), task("future", "november")],
  };
  getDb.mockReturnValue(createClient("https://database.example", "test", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, init) => {
    const url = new URL(String(input)); const table = url.pathname.split("/").at(-1)!;
    const rows = tables[table] ||= [];
    const matches = (row: Row) => [...url.searchParams].every(([key, value]) => {
      if (value.startsWith("eq.")) return String(row[key]) === value.slice(3);
      if (value.startsWith("in.(")) return value.slice(4, -1).split(",").includes(String(row[key]));
      if (value.startsWith("neq.")) return String(row[key]) !== value.slice(4);
      return true;
    });
    let result = rows.filter(matches);
    if (init?.method === "PATCH") {
      const patch = JSON.parse(String(init.body)); result.forEach(row => Object.assign(row, patch));
    } else if (init?.method === "POST") {
      const payload = JSON.parse(String(init.body)); result = (Array.isArray(payload) ? payload : [payload]).map(row => ({ id: crypto.randomUUID(), ...row })); rows.push(...result);
    }
    const single = new Headers(init?.headers).get("accept")?.includes("vnd.pgrst.object");
    return Response.json(single ? result[0] || null : result);
  } } }));
});
afterEach(() => vi.useRealTimers());

describe("planos na persistência e no portal", () => {
  it("cria qualquer tarefa no mês atual e preserva plano explícito", async () => {
    const automatic = await createTask({ projectId: "client", name: "Sem prazo" });
    expect(automatic.planId).toBe("october");
    const selected = await createTask({ projectId: "client", name: "Novembro", planId: "november", dueDate: "2026-10-20" });
    expect(selected.planId).toBe("november");
    await expect(createTask({ projectId: "client", name: "Inválida", planId: "foreign" })).rejects.toThrow("deste cliente");
  });
  it("trocar prazo não transfere; transferir preserva prazo e registra histórico", async () => {
    expect((await updateTask("current", { dueDate: "2026-12-01" }))?.planId).toBe("october");
    const moved = await updateTask("old", { planId: "october" }, "author");
    expect(moved?.planId).toBe("october"); expect(moved?.dueDate).toBe("2026-09-10");
    expect(moved?.comments).toEqual(expect.arrayContaining([expect.objectContaining({ fieldKey: "planId", oldValue: "september", newValue: "october" })]));
  });
  it("impede edição e aprovação de mês encerrado, inclusive com link antigo", async () => {
    await expect(updateTask("old", { status: "aprovacao_copy" })).rejects.toThrow("encerrado");
    await expect(submitPlanApprovalResponse({ projectId: "client", taskId: "old", status: "approved", reviewerName: "Maria" })).rejects.toThrow("encerrado");
    await expect(updateTask("current", { planId: "september" })).rejects.toThrow("encerrado");
  });
  it("o servidor entrega somente o mês atual ou o plano escolhido e nunca mistura clientes", async () => {
    const view = await clientPlanView("client");
    expect(view.items.map(i => i.id)).toEqual(["current"]);
    expect(view.plans.map(p => p.id)).not.toContain("september");
    expect(view.plans.map(p => p.id)).not.toContain("foreign");
    expect((await clientPlanView("client", "november")).items.map(i => i.id)).toEqual(["future"]);
    expect((await clientPlanView("client", "foreign")).items.map(i => i.id)).toEqual(["current"]);
  });
});
