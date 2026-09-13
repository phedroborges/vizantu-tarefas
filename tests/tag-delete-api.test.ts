import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const { requireUser, deleteTag } = vi.hoisted(() => ({ requireUser: vi.fn(), deleteTag: vi.fn() }));
vi.mock("@/lib/authz", () => ({ requireUser, isResponse: (value: unknown) => value instanceof NextResponse }));
vi.mock("@/lib/storage", () => ({ deleteTag }));
import { DELETE } from "../src/app/api/tags/[id]/route";
import { ROLES_DO_TIME } from "../src/lib/permissions";
const id = "48fe33ed-0230-46a3-9998-c7dd55c384aa";
const run = (tagId = id) => DELETE(new NextRequest(`http://localhost/api/tags/${tagId}`, { method: "DELETE" }), { params: Promise.resolve({ id: tagId }) });
beforeEach(() => { vi.clearAllMocks(); requireUser.mockResolvedValue({ id: "member" }); deleteTag.mockResolvedValue(true); });
describe("exclusão de etiquetas", () => {
  it("exige permissão do time antes de excluir", async () => {
    requireUser.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }));
    expect((await run()).status).toBe(403);
    expect(requireUser).toHaveBeenCalledWith(ROLES_DO_TIME);
    expect(deleteTag).not.toHaveBeenCalled();
  });
  it("valida o ID", async () => { expect((await run("invalid")).status).toBe(400); expect(deleteTag).not.toHaveBeenCalled(); });
  it("exclui a etiqueta", async () => { expect(await (await run()).json()).toEqual({ ok: true }); expect(deleteTag).toHaveBeenCalledWith(id); });
  it("retorna 404 quando já foi excluída", async () => { deleteTag.mockResolvedValue(false); expect((await run()).status).toBe(404); });
  it("retorna falha legível sem simular sucesso", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    deleteTag.mockRejectedValue(new Error("fetch failed"));
    const response = await run();
    expect(response.status).toBe(500);
    expect((await response.json()).error).toContain("Não foi possível excluir a etiqueta");
    log.mockRestore();
  });
});
