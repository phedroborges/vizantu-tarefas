import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const { auth, task, activity } = vi.hoisted(() => ({ auth: vi.fn(), task: vi.fn(), activity: vi.fn() }));
vi.mock("@/lib/authz", () => ({ requireUser: auth, isResponse: (value: unknown) => value instanceof NextResponse }));
vi.mock("@/lib/storage", () => ({ getTask: task, listTaskActivity: activity }));
import { GET } from "@/app/api/tasks/[id]/route";
const read = () => GET(new NextRequest("http://localhost/api/tasks/t1?detail=1"), { params: Promise.resolve({ id: "t1" }) });
beforeEach(() => { vi.clearAllMocks(); auth.mockResolvedValue({ accessibleProjectIds: ["p1"], accessibleListKinds: ["criativa"] }); task.mockResolvedValue({ id: "t1", projectId: "p1", lists: ["criativa"], description: "Conteúdo completo" }); });
it("retorna conteúdo privado sem buscar histórico adicional", async () => {
  const response = await read();
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect((await response.json()).task.description).toBe("Conteúdo completo");
  expect(activity).not.toHaveBeenCalled();
});
it.each([{ accessibleProjectIds: [], accessibleListKinds: "all" }, { accessibleProjectIds: "all", accessibleListKinds: ["estrategica"] }])("recusa detalhes fora do acesso: %j", async (access) => {
  auth.mockResolvedValue(access);
  expect((await read()).status).toBe(403);
  expect(activity).not.toHaveBeenCalled();
});
it("sem sessão não consulta tarefas", async () => {
  auth.mockResolvedValue(NextResponse.json({}, { status: 401 }));
  expect((await read()).status).toBe(401);
  expect(task).not.toHaveBeenCalled();
});
