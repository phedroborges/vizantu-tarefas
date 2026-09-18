import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const { auth, load, production, mutate, session, blocked, from } = vi.hoisted(() => ({ auth: vi.fn(), load: vi.fn(), production: vi.fn(), mutate: vi.fn(), session: vi.fn(), blocked: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/authz", () => ({ requireUser: auth, isResponse: (value: unknown) => value instanceof NextResponse }));
vi.mock("@/lib/finance/storage", () => ({ loadFinance: load, loadFinanceProduction: production, mutateFinance: mutate, FinanceInputError: class extends Error {} }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "signed" }) }) }));
vi.mock("@/lib/client-session", () => ({ CLIENT_SESSION_COOKIE: "client", verifyClientSession: session }));
vi.mock("@/lib/supabase-client", () => ({ getSupabase: () => ({ from }) }));
import { GET, POST } from "../src/app/api/financeiro/route";
import { requireClientAccess } from "../src/lib/client-access";
import { rolesQueVeem } from "../src/lib/permissions";
const post = (body: object) => POST(new NextRequest("http://localhost/api/financeiro", { method: "POST", body: JSON.stringify(body) }));
beforeEach(() => {
  vi.clearAllMocks(); auth.mockResolvedValue({ id:"owner",role:"dono" }); session.mockReturnValue("project");
  blocked.mockResolvedValue({ data: null, error: null });
  from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: blocked }) }) });
});
describe("financeiro exclusivo do dono", () => {
  it("somente dono tem acesso no menu e guarda de página", () => { expect(rolesQueVeem("financeiro")).toEqual(["dono"]); });
  it.each([401,403])("não carrega nem altera dados sem permissão (%s)", async (status) => {
    auth.mockResolvedValue(NextResponse.json({ error: "Sem acesso" },{ status }));
    expect((await GET()).status).toBe(status); expect((await post({ action:"payment" })).status).toBe(status);
    expect(load).not.toHaveBeenCalled(); expect(mutate).not.toHaveBeenCalled(); expect(auth).toHaveBeenCalledWith(["dono"]);
  });
  it("usa o ator autenticado e não o enviado no corpo", async () => {
    mutate.mockResolvedValue(undefined);
    expect((await post({ action:"settings", actor:"other" })).status).toBe(200);
    expect(mutate).toHaveBeenCalledWith({ action:"settings",actor:"other" },"owner");
  });
});
describe("bloqueio do portal", () => {
  it("barra sessões que já estavam autenticadas", async () => {
    blocked.mockResolvedValue({ data:{ blocked:true },error:null });
    const response = await requireClientAccess();
    expect(response).toBeInstanceOf(NextResponse); expect((response as NextResponse).status).toBe(403);
    expect((await (response as NextResponse).json()).code).toBe("CLIENT_BLOCKED");
  });
  it("desbloquear libera a sessão existente", async () => { expect(await requireClientAccess()).toBe("project"); });
  it("sem cookie não consulta dados financeiros", async () => { session.mockReturnValue(null); expect((await requireClientAccess() as NextResponse).status).toBe(401); expect(from).not.toHaveBeenCalled(); });
  it("falha do banco não libera o cliente por acidente", async () => { blocked.mockResolvedValue({ data:null,error:{ message:"unavailable" } }); await expect(requireClientAccess()).rejects.toThrow("unavailable"); });
});

it("seções mantêm autorização e executam somente seu carregamento", async () => {
  load.mockResolvedValue({ entries: [] }); production.mockResolvedValue({ tasks: [] });
  expect((await GET(new NextRequest("http://localhost/api/financeiro?section=overview"))).status).toBe(200);
  expect(load).toHaveBeenCalledWith("owner", { includeProduction: false });
  expect(production).not.toHaveBeenCalled();
  expect((await GET(new NextRequest("http://localhost/api/financeiro?section=production"))).status).toBe(200);
  expect(production).toHaveBeenCalledOnce();
  auth.mockResolvedValue(NextResponse.json({ error: "Sem acesso" }, { status: 403 }));
  expect((await GET(new NextRequest("http://localhost/api/financeiro?section=production"))).status).toBe(403);
  expect(production).toHaveBeenCalledOnce();
});
