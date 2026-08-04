import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server-client";

// Recebe o link do e-mail de recuperação de senha. Usa verifyOtp com
// token_hash (não exchangeCodeForSession com "code") de propósito: o
// token_hash prova a posse do link em si, verificado no servidor — funciona
// mesmo se o e-mail for aberto num dispositivo diferente de onde a
// redefinição foi pedida. O "code" do fluxo PKCE exigiria o mesmo navegador.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/reset-password";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=link_invalido`);
}
