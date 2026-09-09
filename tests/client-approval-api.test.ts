import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { submit, session } = vi.hoisted(() => ({ submit: vi.fn(), session: vi.fn((): string | null => "project-1") }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "signed" }) }) }));
vi.mock("@/lib/client-session", () => ({ CLIENT_SESSION_COOKIE: "client", verifyClientSession: session }));
vi.mock("@/lib/storage", async (original) => ({ ...await original<typeof import("@/lib/storage")>(), submitPlanApprovalResponse: submit }));
import { POST } from "../src/app/api/c/approve/route";
import { ApprovalResponseError } from "../src/lib/storage";
const decision = { taskId: "task-1", reviewerName: "Maria", status: "approved", reviewVersion: 100 };
const post = (body: object) => POST(new NextRequest("http://localhost/api/c/approve", { method: "POST", body: JSON.stringify(body) }));
beforeEach(() => { submit.mockReset(); session.mockReturnValue("project-1"); });
describe("API de decisão do cliente", () => {
  it.each(["rejected", "changes_requested"])("recusa %s sem um motivo válido", async (status) => {
    for (const comment of [undefined, "   ", { invalid: true }]) expect((await post({ ...decision, status, comment })).status).toBe(400);
    expect(submit).not.toHaveBeenCalled();
  });
  it("envia a rodada e o projeto do cookie para persistência", async () => {
    submit.mockResolvedValue({ status: "approved", reviewVersion: 100, taskStatus: "aprovado" });
    expect((await post({ ...decision, projectId: "foreign-project" })).status).toBe(200);
    expect(submit).toHaveBeenCalledWith({ ...decision, projectId: "project-1", comment: undefined });
  });
  it("recusa sessão ausente", async () => {
    session.mockReturnValue(null);
    expect((await post(decision)).status).toBe(401);
    expect(submit).not.toHaveBeenCalled();
  });
  it("retorna conflito legível quando a rodada foi encerrada ou mudou", async () => {
    submit.mockRejectedValue(new ApprovalResponseError("Este conteúdo mudou de rodada."));
    const response = await post(decision);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Este conteúdo mudou de rodada." });
  });
});
