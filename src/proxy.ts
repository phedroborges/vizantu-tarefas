import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Next.js 16 descontinuou middleware.ts em favor de proxy.ts (exporta
// proxy(), não middleware()) — um middleware.ts aqui seria ignorado
// silenciosamente no build, e a proteção de rota simplesmente não entraria em
// vigor, sem erro nenhum. Fica no mesmo nível de app/ (dentro de src/).

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/auth/confirm"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() renova o token se necessário (grava via setAll acima) — roda
  // pra toda rota que casar o matcher, inclusive /api/**.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (isApi) {
    // /api/** só recebe o cookie renovado aqui — 401/403 é responsabilidade de
    // cada route handler (requireUser), nunca um redirect HTML numa chamada fetch.
    return response;
  }

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
