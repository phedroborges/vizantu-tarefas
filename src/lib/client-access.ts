import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CLIENT_SESSION_COOKIE, verifyClientSession } from "./client-session";
import { getSupabase } from "./supabase-client";

export async function isClientBlocked(projectId: string): Promise<boolean> {
  const { data, error } = await getSupabase().from("finance_project_blocks").select("blocked").eq("project_id", projectId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.blocked === true;
}
// Checado em toda requisição: bloquear também invalida sessões já abertas.
export async function requireClientAccess(): Promise<string | NextResponse> {
  const cookieStore = await cookies();
  const projectId = verifyClientSession(cookieStore.get(CLIENT_SESSION_COOKIE)?.value);
  if (!projectId) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  if (await isClientBlocked(projectId)) return NextResponse.json({ error: "Acesso ao plano suspenso. Entre em contato com a Vizantu.", code: "CLIENT_BLOCKED" }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
  return projectId;
}
