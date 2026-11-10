// Para onde a pessoa vai depois de entrar: o link que ela abriu (?next=), desde
// que seja uma página deste app. "//site" e "https://" ficam de fora para o
// login não virar redirecionamento para fora.
export function destinoDoLogin(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (next === "/login" || next.startsWith("/login?")) return "/";
  return next;
}
