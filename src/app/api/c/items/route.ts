import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CLIENT_SESSION_COOKIE, verifyClientSession } from "@/lib/client-session";
import { listProjectPlanItems } from "@/lib/storage";

export async function GET() {
  const cookieStore = await cookies();
  const projectId = verifyClientSession(cookieStore.get(CLIENT_SESSION_COOKIE)?.value);
  if (!projectId) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  return NextResponse.json({ items: await listProjectPlanItems(projectId) }, { headers: { "Cache-Control": "private, no-store" } });
}
