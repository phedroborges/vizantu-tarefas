import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { ROLES_QUE_PLANEJAM } from "@/lib/permissions";
import { createPlanCaptacao, createReadyPackage, getPlan } from "@/lib/storage";
import { isPlanClosed } from "@/lib/plan-month";
import { apiFailure } from "@/lib/api-error";

export async function POST(request: NextRequest) {
  const auth = await requireUser(ROLES_QUE_PLANEJAM);
  if (isResponse(auth)) return auth;
  const body = await request.json();
  if (!body?.planId || typeof body.planId !== "string") {
    return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  }
  if (!body?.label || typeof body.label !== "string" || !body.label.trim()) {
    return NextResponse.json({ error: "Informe o nome da captação." }, { status: 400 });
  }
  if (body.packageKind !== "capture" && body.packageKind !== "creation") return NextResponse.json({ error: "Escolha o tipo do pacote." }, { status: 400 });
  const plan = await getPlan(body.planId);
  if (!plan || (auth.accessibleProjectIds !== "all" && !auth.accessibleProjectIds.includes(plan.projectId))) return NextResponse.json({ error: "Plano indisponível." }, { status: 404 });
  if (isPlanClosed(plan)) return NextResponse.json({ error: "Este plano está encerrado." }, { status: 400 });
  if (body.itemCount !== undefined) {
    if (!Number.isInteger(body.itemCount) || body.itemCount < 1 || body.itemCount > 30 || typeof body.formatTagId !== "string" || !body.formatTagId) return NextResponse.json({ error: "Escolha um formato e de 1 a 30 conteúdos." }, { status: 400 });
    try {
      return NextResponse.json(await createReadyPackage({ planId: plan.id, label: body.label, packageKind: body.packageKind, itemCount: body.itemCount, formatTagId: body.formatTagId, editingAssigneeId: body.editingAssigneeId, recordingAssigneeId: body.recordingAssigneeId, actorId: auth.id }), { status: 201 });
    } catch (error) { return apiFailure(error, "criar o pacote com seus conteúdos"); }
  }
  const captacao = await createPlanCaptacao({ planId: body.planId, label: body.label, packageKind: body.packageKind, sequenceOrder: body.sequenceOrder, recordingAssigneeId: body.recordingAssigneeId, editingAssigneeId: body.editingAssigneeId });
  return NextResponse.json({ captacao }, { status: 201 });
}
