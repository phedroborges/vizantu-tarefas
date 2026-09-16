import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createDailyOverdueNotifications, listContracts, listPlanStages, listProjectPlanItems, listTaskSummaries, listTasks } from "@/lib/storage";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/lib/supabase-client", () => ({ getSupabase: getDb }));
let requests: URL[];
let respond: (url: URL) => unknown | Promise<unknown>;
beforeEach(() => {
  requests = [];
  respond = () => [];
  getDb.mockReturnValue(createClient("https://database.example", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input) => {
      const url = new URL(String(input));
      requests.push(url);
      return new Response(JSON.stringify(await respond(url)), { headers: { "Content-Type": "application/json" } });
    } },
  }));
});
const table = (url: URL) => url.pathname.split("/").at(-1);

describe("consultas proporcionais à tela", () => {
  it("aplica projeto e listas no banco, incluindo tarefas sem lista", async () => {
    await listTasks({ projectIds: ["project-a"], listKinds: ["criativa"] });
    expect(requests).toHaveLength(1);
    expect(requests[0].searchParams.get("project_id")).toBe('in.(project-a)');
    expect(requests[0].searchParams.get("or")).toBe('(lists.is.null,lists.eq.{},lists.ov.{criativa})');
  });
  it("sem projetos autorizados não busca tarefas de outros clientes", async () => {
    expect(await listTasks({ projectIds: [] })).toEqual([]);
    expect(await listTaskSummaries({ projectIds: [] })).toEqual([]);
    expect(requests).toHaveLength(0);
  });
  it("conta mais de 1000 tarefas sem baixar descrições, anexos e comentários", async () => {
    respond = (url) => Array.from({ length: url.searchParams.get("offset") === "0" ? 1000 : 1 }, () => ({ project_id: "a", status: "rascunho", due_date: null, lists: [] }));
    expect(await listTaskSummaries()).toHaveLength(1001);
    expect(requests).toHaveLength(2);
    expect(requests.every((url) => url.searchParams.get("select") === "id,project_id,status,due_date,lists")).toBe(true);
  });
  it("filtra contratos pelo projeto no banco", async () => {
    await listContracts("project-a");
    expect(requests[0].searchParams.get("project_id")).toBe("eq.project-a");
  });
  it("varredura só lê atrasadas com responsável, usando o dia solicitado", async () => {
    await createDailyOverdueNotifications("2026-09-16");
    expect(requests).toHaveLength(1);
    expect(requests[0].searchParams.get("select")).toBe("id,name,due_date,assignee_id");
    expect(requests[0].searchParams.get("due_date")).toBe("lt.2026-09-16");
    expect(requests[0].searchParams.get("assignee_id")).toBe("not.is.null");
    expect(requests[0].searchParams.get("status")).toBe("not.in.(aprovado,problema,finalizado)");
  });
  it("busca links e itens de planos simultaneamente", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    respond = async () => { await gate; return []; };
    const result = listPlanStages([{ id: "plan", projectId: "project" }]);
    try { await vi.waitFor(() => expect(requests.map(table).sort()).toEqual(["client_links", "tasks"])); }
    finally { release(); }
    await result;
  });
  it("busca pacotes, etiquetas, aprovações e agenda simultaneamente no portal", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    respond = async (url) => {
      if (table(url) === "plans") return [{ id: "p", kind: "content", title: "Plano" }];
      if (table(url) === "tasks") return [{ id: "t", plan_id: "p", name: "Conteúdo", status: "rascunho", format_tag_ids: ["f"], channel_tag_ids: [], category_tag_ids: [], updated_at: "2026-09-16" }];
      await gate; return [];
    };
    const result = listProjectPlanItems("project");
    try { await vi.waitFor(() => expect(requests.map(table)).toEqual(expect.arrayContaining(["plan_captacoes", "tags", "plan_item_approvals", "plan_events"]))); }
    finally { release(); }
    expect(await result).toHaveLength(1);
  });
});
