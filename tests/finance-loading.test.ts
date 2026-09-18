import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ db: vi.fn(), contracts: vi.fn(), projects: vi.fn(), members: vi.fn(), tasks: vi.fn(), tags: vi.fn(), notifications: vi.fn(), generated: vi.fn() }));
vi.mock("@/lib/supabase-client", () => ({ getSupabase: mocks.db }));
vi.mock("@/lib/storage", () => ({ listContracts: mocks.contracts, listProjects: mocks.projects, listMembers: mocks.members, listTasks: mocks.tasks, listTags: mocks.tags, createNotifications: mocks.notifications }));
vi.mock("@/lib/finance/calculations", async (importOriginal) => ({ ...await importOriginal<object>(), contractEntries: mocks.generated }));
import { loadFinance, loadFinanceProduction, mutateFinance } from "@/lib/finance/storage";
import { varrerAvisosFinanceiros } from "@/lib/finance/alerts";
import { DEFAULT_SETTINGS } from "@/lib/finance/types";
let writes: unknown[];
let stored: object[];
const entry = { direction: "income", category: "servicos", description: "Parcela", amount: 10000, competence: "2026-09", projectId: "project", memberId: null, recurring: true, seriesId: "contract", sourceKey: "contract:c:1", notes: "" };
beforeEach(() => {
  vi.clearAllMocks(); writes = []; stored = [];
  mocks.contracts.mockResolvedValue([{ id: "contract", status: "assinado" }]);
  mocks.members.mockResolvedValue([{ id: "owner", role: "dono", active: true }]);
  mocks.projects.mockResolvedValue([]); mocks.tasks.mockResolvedValue([]); mocks.tags.mockResolvedValue([]);
  mocks.generated.mockReturnValue({ entries: [entry] });
  mocks.db.mockReturnValue(createClient("https://database.example", "test-key", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, init) => {
    const url = new URL(String(input));
    const table = url.pathname.split("/").at(-1);
    if (init?.method === "POST") { const rows = JSON.parse(String(init.body)); writes.push(rows); stored = rows.map((row: object) => ({ id: "entry", cancelled: false, ...row })); return new Response(null, { status: 201 }); }
    return new Response(JSON.stringify(table === "finance_settings" ? { data: DEFAULT_SETTINGS } : table === "finance_entries" ? stored : table === "finance_audit" && writes.length ? [{ id: "audit-new", entity_id: "entry", action: "insert", actor_id: "owner", created_at: "2026-09-16" }] : []), { headers: { "Content-Type": "application/json" } });
  } } }));
});
describe("carregamento financeiro", () => {
  it("contrato já importado não reescreve parcelas ou desfaz cancelamentos", async () => {
    stored = [{ id: "entry", source_key: entry.sourceKey, direction: "income", amount: 9000, competence: "2026-09", project_id: "project", cancelled: true }];
    const result = await loadFinance("owner");
    expect(writes).toEqual([]);
    expect(result.entries[0]).toMatchObject({ amount: 9000, cancelled: true });
    expect(result.warnings).toHaveLength(1);
  });
  it("gera a parcela ausente uma vez e retorna o lançamento persistido", async () => {
    const first = await loadFinance("owner");
    expect(first.entries[0].sourceKey).toBe(entry.sourceKey);
    expect(first.audit[0].id).toBe("audit-new");
    expect(writes).toHaveLength(1);
    await loadFinance("owner");
    expect(writes).toHaveLength(1);
  });
  it("avisos de contrato não carregam tarefas nem escrevem no financeiro", async () => {
    mocks.contracts.mockResolvedValue([]);
    await varrerAvisosFinanceiros("2026-09-16");
    expect(mocks.contracts).toHaveBeenCalledOnce();
    expect(mocks.projects).toHaveBeenCalledOnce();
    expect(mocks.tasks).not.toHaveBeenCalled();
    expect(mocks.db).not.toHaveBeenCalled();
  });
});

it("visão geral não depende das tarefas nem das conferências de produção", async () => {
  mocks.tasks.mockRejectedValue(new Error("Tarefas indisponíveis"));
  const result = await loadFinance("owner", { includeProduction: false });
  expect(result.entries).toHaveLength(1);
  expect(mocks.tasks).not.toHaveBeenCalled();
  expect(mocks.tags).not.toHaveBeenCalled();
});
it("produção funciona sem consultar ou importar contratos", async () => {
  mocks.contracts.mockRejectedValue(new Error("Contratos indisponíveis"));
  const result = await loadFinanceProduction();
  expect(result.members[0].id).toBe("owner");
  expect(mocks.tasks).toHaveBeenCalledWith({ all: true, projection: "production" });
  expect(mocks.contracts).not.toHaveBeenCalled();
  expect(writes).toEqual([]);
});

it("fechamento do servidor lança a despesa para quem assumiu e entregou", async () => {
  const erika = "11111111-1111-4111-8111-111111111111";
  const luis = "22222222-2222-4222-8222-222222222222";
  mocks.members.mockResolvedValue([{ id: erika, role: "diretor_criativo" }, { id: luis, role: "diretor_criativo" }]);
  mocks.tasks.mockResolvedValue([{ id: "task", name: "Reels", projectId: "project", assigneeId: luis, createdAt: "2026-09-01T12:00:00Z", formatTagIds: [], status: "aprovado", statusHistory: [{ status: "para_aprovacao", enteredAt: "2026-09-05T12:00:00Z", exitedAt: null }], comments: [{ kind: "activity", fieldKey: "assigneeId", oldValue: erika, newValue: luis, createdAt: "2026-09-04T12:00:00Z" }] }]);
  await mutateFinance({ action: "productionClosing", memberId: luis, competence: "2026-09" }, "owner");
  expect(writes).toEqual([expect.arrayContaining([expect.objectContaining({ member_id: luis, source_key: "production:task", amount: 7000 })])]);
  expect(mocks.contracts).not.toHaveBeenCalled();
});
