import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ db: vi.fn(), contracts: vi.fn(), projects: vi.fn(), members: vi.fn(), tasks: vi.fn(), tags: vi.fn(), notifications: vi.fn(), generated: vi.fn() }));
vi.mock("@/lib/supabase-client", () => ({ getSupabase: mocks.db }));
vi.mock("@/lib/storage", () => ({ listContracts: mocks.contracts, listProjects: mocks.projects, listMembers: mocks.members, listTasks: mocks.tasks, listTags: mocks.tags, createNotifications: mocks.notifications }));
vi.mock("@/lib/finance/calculations", async (importOriginal) => ({ ...await importOriginal<object>(), contractEntries: mocks.generated }));
import { loadFinance, loadFinanceProduction, mutateFinance } from "@/lib/finance/storage";
import { varrerAvisosFinanceiros } from "@/lib/finance/alerts";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/finance/types";
let writes: unknown[];
let stored: Record<string, unknown>[];
let settings: Settings;
let settingsTimestamp: string | undefined;
let staleWrite: boolean;
const entry = { direction: "income", category: "servicos", description: "Parcela", amount: 10000, competence: "2026-09", projectId: "project", memberId: null, recurring: true, seriesId: "contract", sourceKey: "contract:contract:1", notes: "" };
beforeEach(() => {
  vi.clearAllMocks(); writes = []; stored = []; settingsTimestamp = undefined; staleWrite = false;
  settings = { ...DEFAULT_SETTINGS, importedContractIds: ["contract"] };
  mocks.contracts.mockResolvedValue([{ id: "contract", status: "assinado" }]);
  mocks.members.mockResolvedValue([{ id: "owner", role: "dono", active: true }]);
  mocks.projects.mockResolvedValue([]); mocks.tasks.mockResolvedValue([]); mocks.tags.mockResolvedValue([]);
  mocks.generated.mockReturnValue({ entries: [entry] });
  mocks.db.mockReturnValue(createClient("https://database.example", "test-key", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, init) => {
    const url = new URL(String(input));
    const table = url.pathname.split("/").at(-1);
    if (init?.method === "PATCH") {
      const row = JSON.parse(String(init.body)); writes.push(row);
      if (table === "finance_settings") {
        expect(url.searchParams.get("updated_at")).toBe(`eq.${settingsTimestamp}`);
        if (staleWrite) return Response.json([]);
        settings = row.data; settingsTimestamp = row.updated_at; return Response.json([{ id: true }]);
      }
      if (table === "finance_entries") stored = stored.map((entry) => ({ ...entry, ...row }));
      return new Response(null, { status: 204 });
    }
    if (init?.method === "POST") { const rows = JSON.parse(String(init.body)); writes.push(rows); if (table === "finance_settings") settings = rows.data; else if (table?.startsWith("finance_cancel")) { stored = stored.map((row) => ({ ...row, cancelled: true })); return Response.json(1); } else stored = (Array.isArray(rows) ? rows : [rows]).map((row: object) => ({ id: "entry", cancelled: false, ...row })); return new Response(null, { status: 201 }); }
    return new Response(JSON.stringify(table === "finance_settings" ? { data: settings, updated_at: settingsTimestamp } : table === "finance_entries" ? stored : table === "finance_audit" && writes.length ? [{ id: "audit-new", entity_id: "entry", action: "insert", actor_id: "owner", created_at: "2026-09-16" }] : []), { headers: { "Content-Type": "application/json" } });
  } } }));
});
describe("carregamento financeiro", () => {
  it("não importa contratos novos sem uma escolha do dono", async () => {
    settings = { ...DEFAULT_SETTINGS };
    const result = await loadFinance("owner");
    expect(result.entries).toEqual([]); expect(writes).toEqual([]);
  });
  it("não importa nem recria parcelas de contrato excluído", async () => {
    settings.excludedContractIds = ["contract"];
    await loadFinance("owner"); expect(writes).toEqual([]);
  });
  it("visão geral carrega os dados necessários para computar equipe a lançar", async () => {
    await loadFinance("owner");
    expect(mocks.tasks).toHaveBeenCalledWith({ all: true, projection: "production" });
    expect(mocks.tags).toHaveBeenCalledOnce();
  });
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

it("visão geral não depende das tarefas de produção", async () => {
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

it("fechamento do servidor lança a despesa para o responsável atual", async () => {
  const erika = "11111111-1111-4111-8111-111111111111";
  const luis = "22222222-2222-4222-8222-222222222222";
  mocks.members.mockResolvedValue([{ id: erika, role: "diretor_criativo" }, { id: luis, role: "diretor_criativo" }]);
  mocks.tasks.mockResolvedValue([{ id: "task", name: "Reels", projectId: "project", assigneeId: luis, createdAt: "2026-09-01T12:00:00Z", formatTagIds: [], status: "aprovado", statusHistory: [{ status: "aprovado", enteredAt: "2026-09-05T12:00:00Z", exitedAt: null, assigneeId: erika }], comments: [] }]);
  await mutateFinance({ action: "productionClosing", memberId: luis, competence: "2026-09" }, "owner");
  expect(writes).toEqual([expect.arrayContaining([expect.objectContaining({ member_id: luis, source_key: "production:task", amount: 7000 })])]);
  expect(mocks.contracts).not.toHaveBeenCalled();
});

it("configura salário, registra uma vez e preserva preferências ao salvar impostos", async () => {
  const memberId = "11111111-1111-4111-8111-111111111111";
  mocks.members.mockResolvedValue([{ id: memberId, role: "social_media", name: "Social", active: true }]);
  await mutateFinance({ action: "compensation", memberId, fromMonth: "2026-09", mode: "salary", salary: 180000 }, "owner");
  expect(settings.compensationRules).toEqual([{ memberId, fromMonth: "2026-09", mode: "salary", salary: 180000 }]);
  await mutateFinance({ action: "settings", settings: { ...DEFAULT_SETTINGS, taxRate: 7 } }, "owner");
  expect(settings.compensationRules).toHaveLength(1); expect(settings.importedContractIds).toEqual(["contract"]);
  await mutateFinance({ action: "salary", memberId, competence: "2026-09", amount: 1 }, "owner");
  expect(stored[0]).toMatchObject({ amount: 180000, member_id: memberId, source_key: `salary:${memberId}:2026-09` });
  await expect(mutateFinance({ action: "salary", memberId, competence: "2026-09" }, "owner")).rejects.toThrow("Nenhum salário pendente");
});

it("inclui contrato somente após a escolha e exclui sem recriar parcelas", async () => {
  const contractId = "22222222-2222-4222-8222-222222222222";
  settings = { ...DEFAULT_SETTINGS };
  mocks.contracts.mockResolvedValue([{ id: contractId, status: "assinado" }]);
  mocks.generated.mockReturnValue({ entries: [{ ...entry, seriesId: contractId, sourceKey: `contract:${contractId}:0` }] });
  await loadFinance("owner"); expect(stored).toEqual([]);
  await mutateFinance({ action: "importContract", contractId }, "owner");
  expect(stored[0].source_key).toBe(`contract:${contractId}:0`);
  await loadFinance("owner");
  await mutateFinance({ action: "removeContract", seriesId: contractId }, "owner");
  expect(settings.excludedContractIds).toContain(contractId);
  expect(stored[0].cancelled).toBe(true);
  const before = writes.length;
  await loadFinance("owner"); expect(writes).toHaveLength(before);
});


it("reativa um contrato somente pela ação explícita e mantém o valor editado", async () => {
  const contractId = "22222222-2222-4222-8222-222222222222";
  mocks.contracts.mockResolvedValue([{ id: contractId, status: "assinado" }]);
  mocks.generated.mockReturnValue({ entries: [{ ...entry, seriesId: contractId, sourceKey: `contract:${contractId}:0` }] });
  stored = [{ id: "entry", source_key: `contract:${contractId}:0`, series_id: contractId, cancelled: true, amount: 12000 }];
  settings.excludedContractIds = [contractId];
  await mutateFinance({ action: "importContract", contractId, restore: true }, "owner");
  expect(stored[0]).toMatchObject({ cancelled: false, amount: 12000 });
  expect(settings.excludedContractIds).not.toContain(contractId);
});

it("atualiza preferências sem sobrescrever outra sessão", async () => {
  settingsTimestamp = "2026-10-06T10:00:00Z";
  await mutateFinance({ action: "settings", settings: { ...DEFAULT_SETTINGS, taxRate: 7 } }, "owner");
  expect(settings.taxRate).toBe(7); expect(settings.importedContractIds).toEqual(["contract"]);
  staleWrite = true;
  await expect(mutateFinance({ action: "settings", settings: { ...DEFAULT_SETTINGS, taxRate: 8 } }, "owner")).rejects.toThrow("outra sessão");
  expect(settings.taxRate).toBe(7);
});
