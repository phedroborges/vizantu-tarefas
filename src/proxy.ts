import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { timedSupabaseFetch } from "@/lib/supabase/timed-fetch";
import { abrePorLinkPublico } from "@/lib/public-links";

// O proxy renova a sessão das páginas. APIs autenticam no próprio handler.

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/auth/confirm", "/design-system"];

// /design-system é a documentação viva da interface: só tokens e componentes
// desenhados com dados de exemplo, sem uma linha de dado de cliente. Fica fora
// do login porque quem precisa dela (designer, dev, quem for revisar um layout)
// nem sempre tem conta no sistema.

// O painel do cliente (/c/[token]) e o formulário público (/p/[token]), com as
// rotas /api/c/* e /api/p/* que os alimentam, são abertos por natureza: quem
// entra é gente sem conta no sistema, com o link na mão. A lista mora em
// lib/public-links.ts, junto do teste que impede /planos e /pesquisas de
// entrarem de carona no prefixo "/p".

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Links externos não dependem da sessão da equipe, nem da renovação dela.
  if (abrePorLinkPublico(pathname) || pathname.startsWith("/api/")) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { fetch: timedSupabaseFetch("auth") },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Verifica a assinatura do JWT e renova cookies vencidos. A guarda da página
  // continua consultando getUser + members para revogação e permissões atuais.
  // https://supabase.com/docs/guides/auth/server-side/creating-a-client
  const { data, error } = await supabase.auth.getClaims();
  const user = !error && data?.claims;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/forgot-password")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  // /reset-password fica de fora dessa segunda checagem de propósito: o link
  // de recuperação de senha autentica o usuário (sessão de recovery) antes de
  // trocar a senha — redirecionar "autenticado ⇒ pra fora" aqui impediria a
  // pessoa de chegar no formulário de nova senha.

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|otf)$).*)"],
};
