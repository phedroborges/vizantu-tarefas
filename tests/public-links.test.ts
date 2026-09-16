import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy, config } from "@/proxy";
import { abrePorLinkPublico } from "@/lib/public-links";

const { getClaims, createServerClient } = vi.hoisted(() => {
  const getClaims = vi.fn();
  return { getClaims, createServerClient: vi.fn(() => ({ auth: { getClaims } })) };
});
vi.mock("@supabase/ssr", () => ({ createServerClient }));

beforeEach(() => {
  vi.clearAllMocks();
  getClaims.mockResolvedValue({ data: null, error: null });
});

describe("acesso por link público", () => {
  it.each(["/p/token", "/api/p/token", "/c/token", "/api/c/items"])("libera %s sem consultar login", async (path) => {
    getClaims.mockRejectedValue(new Error("Auth indisponível"));
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
    expect(getClaims).toHaveBeenCalledOnce();
  });
});


describe("proxy sem trabalho duplicado", () => {
  it("deixa a API autenticar e renovar os próprios cookies, sem redirect", async () => {
    const response = await proxy(new NextRequest("https://example.com/api/tasks"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(createServerClient).not.toHaveBeenCalled();
  });
  it("não intercepta fontes, mas continua protegendo páginas", () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    expect(matcher.test("/fonts/mona-sans-latin.woff2")).toBe(false);
    expect(matcher.test("/tarefas")).toBe(true);
  });
  it("aceita claims verificados para navegar e redireciona o login", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "member" } }, error: null });
    expect((await proxy(new NextRequest("https://example.com/tarefas"))).headers.get("location")).toBeNull();
    expect((await proxy(new NextRequest("https://example.com/login"))).headers.get("location")).toBe("https://example.com/");
  });
  it("não aceita claims quando a verificação falha", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "member" } }, error: { message: "Invalid signature" } });
    expect((await proxy(new NextRequest("https://example.com/tarefas"))).headers.get("location")).toContain("/login");
  });
});
