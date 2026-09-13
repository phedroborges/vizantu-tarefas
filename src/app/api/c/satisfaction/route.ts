import { NextRequest, NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/client-access";
import { addSatisfactionScore } from "@/lib/storage";

export async function POST(request: NextRequest) {
  const projectId = await requireClientAccess();
  if (projectId instanceof NextResponse) return projectId;

  const body = await request.json();
  const score = Number(body?.score);
  if (!Number.isInteger(score) || score < 0 || score > 10) {
    return NextResponse.json({ error: "Nota inválida." }, { status: 400 });
  }
  await addSatisfactionScore({ projectId, score });
  return NextResponse.json({ ok: true, score });
}
