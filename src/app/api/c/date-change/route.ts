import { NextRequest, NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/client-access";
import { requestTaskDateChange } from "@/lib/storage";

export async function POST(request: NextRequest) {
  const projectId = await requireClientAccess();
  if (projectId instanceof NextResponse) return projectId;
  const body = await request.json();
  if (!body?.taskId || typeof body.taskId !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.requestedDate || "")) {
    return NextResponse.json({ error: "Informe uma nova data válida." }, { status: 400 });
  }
  const task = await requestTaskDateChange({ projectId, taskId: body.taskId, reviewerName: String(body.reviewerName || "Cliente"), requestedDate: body.requestedDate, reason: String(body.reason || "") });
  if (!task) return NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
