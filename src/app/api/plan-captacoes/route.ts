import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { createPlanCaptacao } from "@/lib/storage";

export async function POST(request: NextRequest) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const body = await request.json();
  if (!body?.planId || typeof body.planId !== "string") {
    return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  }
  if (!body?.label || typeof body.label !== "string" || !body.label.trim()) {
    return NextResponse.json({ error: "Informe o nome da captação." }, { status: 400 });
  }
  if (body.packageKind !== "capture" && body.packageKind !== "creation") return NextResponse.json({ error: "Escolha o tipo do pacote." }, { status: 400 });
  const captacao = await createPlanCaptacao({ planId: body.planId, label: body.label, packageKind: body.packageKind, sequenceOrder: body.sequenceOrder, recordingAssigneeId: body.recordingAssigneeId, editingAssigneeId: body.editingAssigneeId });
  return NextResponse.json({ captacao }, { status: 201 });
}
