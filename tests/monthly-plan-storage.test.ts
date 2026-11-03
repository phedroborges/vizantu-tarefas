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
    if (table === "append_task_comments") {
      const { p_task_id, p_comments } = JSON.parse(String(init?.body));
      const target = tables.tasks.find((row) => row.id === p_task_id);
      if (target) target.comments = [...(target.comments as unknown[]), ...p_comments];
      return Response.json(target ? [target] : []);
    }
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
      const payload = JSON.parse(String(init.body));
      const incoming = (Array.isArray(payload) ? payload : [payload]).map(row => ({ id: crypto.randomUUID(), ...row }));
      const mergeKey = table === "plan_item_approvals" ? "task_id" : table === "project_communication" ? "project_id" : "id";
      if (new Headers(init.headers).get("prefer")?.includes("resolution=merge-duplicates")) {
        result = incoming.map(row => {
          const current = rows.find(existing => existing[mergeKey] === row[mergeKey]);
          if (current) { Object.assign(current, row); return current; }
          rows.push(row); return row;
        });
      } else { result = incoming; rows.push(...result); }
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

  it("abrir o portal não aprova sozinho o que passou do prazo sem o cliente ser avisado", async () => {
    tables.project_communication = [{ project_id: "client", approval_deadline_days: 7 }];
    tables.tasks.push({
      ...task("expired", "october"), status: "aprovacao_copy", updated_at: "2026-10-01T12:00:00Z",
      status_history: [{ status: "aprovacao_copy", enteredAt: "2026-10-01T12:00:00Z", exitedAt: null }],
    });
    tables.plan_item_approvals = [{ task_id: "expired", status: "pending", review_version: 1, updated_at: "2026-10-01T12:00:00Z" }];
    await clientPlanView("client");
    expect(tables.tasks.find(row => row.id === "expired")?.status).toBe("aprovacao_copy");
    expect(tables.plan_item_approvals[0].status).toBe("pending");
  });

  it("duas respostas ao mesmo tempo viram uma só; a outra recebe o aviso", async () => {
    tables.tasks.push({ ...task("twice", "october"), status: "aprovacao_copy", status_history: [{ status: "aprovacao_copy", enteredAt: "2026-10-14T12:00:00Z", exitedAt: null }] });
    tables.plan_item_approvals = [{ task_id: "twice", status: "pending", review_version: 1, updated_at: "2026-10-14T12:00:00Z" }];
    tables.plan_approval_responses = [];
    tables.plan_approval_events = [];
    const answer = (status: "approved" | "rejected") => submitPlanApprovalResponse({ projectId: "client", taskId: "twice", status, reviewerName: "Maria", comment: "Ok", reviewVersion: 1 });
    const results = await Promise.allSettled([answer("approved"), answer("rejected")]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find(result => result.status === "rejected")).toMatchObject({ reason: { message: "Este conteúdo já foi revisado nesta rodada." } });
    expect(tables.plan_approval_responses).toHaveLength(1);
    expect(tables.plan_approval_events.filter(event => event.action !== "reopened")).toHaveLength(1);
  });
});
