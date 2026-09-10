// ---------- Rotas que se abrem por link, sem conta no sistema ----------
//
// Quem entra por aqui é gente de fora: o cliente com o link mágico do painel
// (/c) e quem responde um formulário (/p). A autorização dessas rotas é o token
// que vem na própria URL — sessão própria do cliente em lib/client-session.ts
// para /c, status "published" da pesquisa para /p —, nunca o login do time.
//
// Esquecer uma rota nesta lista não quebra nada que o time consiga ver: nós
// entramos logados e a página abre normalmente. Quem descobre é o cliente, que
// recebe o link e cai numa tela pedindo e-mail e senha que ele não tem. Foi
// exatamente assim que /p ficou fechado sem ninguém perceber. Por isso a lista
// tem teste, e o teste inclui as rotas que NÃO podem abrir.
export const ROTAS_DE_LINK_PUBLICO = ["/c", "/api/c", "/p", "/api/p"] as const;

// Prefixo casa a rota exata ou o que vem depois da barra — e só. Comparar por
// `startsWith(prefixo)` cru abriria /planos, /pesquisas e /projetos para o
// mundo inteiro por causa do "/p".
export function abrePorLinkPublico(pathname: string): boolean {
  return ROTAS_DE_LINK_PUBLICO.some((prefixo) => pathname === prefixo || pathname.startsWith(`${prefixo}/`));
}
