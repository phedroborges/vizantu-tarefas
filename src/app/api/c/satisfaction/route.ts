import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { CLIENT_SESSION_COOKIE, verifyClientSession } from "@/lib/client-session";
import { addSatisfactionScore } from "@/lib/storage";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const projectId = verifyClientSession(cookieStore.get(CLIENT_SESSION_COOKIE)?.value);
  if (!projectId) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  const body = await request.json();
  const score = Number(body?.score);
  if (!Number.isInteger(score) || score < 0 || score > 10) {
    return NextResponse.json({ error: "Nota inválida." }, { status: 400 });
  }
  await addSatisfactionScore({ projectId, score });
  return NextResponse.json({ ok: true, score });
}
