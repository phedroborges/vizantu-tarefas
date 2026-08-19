import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { CLIENT_SESSION_COOKIE, verifyClientSession } from "@/lib/client-session";
import { requestTaskDateChange } from "@/lib/storage";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const projectId = verifyClientSession(cookieStore.get(CLIENT_SESSION_COOKIE)?.value);
  if (!projectId) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  const body = await request.json();
  if (!body?.taskId || typeof body.taskId !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.requestedDate || "")) {
    return NextResponse.json({ error: "Informe uma nova data válida." }, { status: 400 });
  }
  const task = await requestTaskDateChange({ projectId, taskId: body.taskId, reviewerName: String(body.reviewerName || "Cliente"), requestedDate: body.requestedDate, reason: String(body.reason || "") });
  if (!task) return NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
