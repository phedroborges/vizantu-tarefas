import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { abrePorLinkPublico } from "@/lib/public-links";

const { getUser, createServerClient } = vi.hoisted(() => {
  const getUser = vi.fn();
  return { getUser, createServerClient: vi.fn(() => ({ auth: { getUser } })) };
});
vi.mock("@supabase/ssr", () => ({ createServerClient }));

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: null } });
});

describe("acesso por link público", () => {
  it.each(["/p/token", "/api/p/token", "/c/token", "/api/c/items"])("libera %s sem consultar login", async (path) => {
    getUser.mockRejectedValue(new Error("Auth indisponível"));
    const response = await proxy(new NextRequest(`https://example.com${path}`));
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("libera envio de respostas sem sessão", async () => {
    const response = await proxy(new NextRequest("https://example.com/api/p/token", { method: "POST" }));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it.each(["/planos", "/pesquisas", "/projetos", "/tarefas", "/configuracoes"])("mantém %s protegido", async (path) => {
    expect(abrePorLinkPublico(path)).toBe(false);
    const response = await proxy(new NextRequest(`https://example.com${path}`));
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
    expect(getUser).toHaveBeenCalledOnce();
  });
});
