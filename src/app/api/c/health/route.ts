import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-client";

export const dynamic = "force-dynamic";

// Diagnóstico do pipeline nativo (dashboard do cliente). A rota é pública, então
// a resposta diz só se está pronto; o que falta (variável, erro do banco) vai
// para o log do servidor, não para quem chamou.
export async function GET() {
  let ready = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!ready) console.error("[/api/c/health] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.");
  else {
    try {
      const { error } = await getSupabase().from("client_links").select("id").limit(1);
      if (error) throw new Error(error.message);
    } catch (err) {
      ready = false;
      console.error("[/api/c/health] banco não respondeu:", err);
    }
  }
  return NextResponse.json({ ready }, { status: ready ? 200 : 503 });
}
