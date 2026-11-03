import { NextRequest, NextResponse } from "next/server";
import { isResponse, requirePlanAccess, requireUser } from "@/lib/authz";
import type { CurrentUser } from "@/lib/current-user";
import { ROLES_QUE_PLANEJAM } from "@/lib/permissions";
import { deletePlanCaptacao, planIdOfCaptacao, setCaptureSuggestion, updatePlanCaptacao } from "@/lib/storage";

// O pacote vale pelo plano em que está, e o plano pelo cliente dele.
async function pacoteVisivel(auth: CurrentUser, id: string): Promise<NextResponse | undefined> {
  const planId = await planIdOfCaptacao(id);
  if (!planId) return NextResponse.json({ error: "Captação não encontrada." }, { status: 404 });
  const plan = await requirePlanAccess(auth, planId);
  return isResponse(plan) ? plan : undefined;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_QUE_PLANEJAM);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const blocked = await pacoteVisivel(auth, id);
  if (blocked) return blocked;
  const body = await request.json();
  if (body?.suggestedDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.suggestedDate)) return NextResponse.json({ error: "Data inválida." }, { status: 400 });
  if (body.packageKind !== undefined && body.packageKind !== "capture" && body.packageKind !== "creation") return NextResponse.json({ error: "Tipo de pacote inválido." }, { status: 400 });
  if (body.label !== undefined && (typeof body.label !== "string" || !body.label.trim())) return NextResponse.json({ error: "Informe o nome do pacote." }, { status: 400 });
  if (typeof body.label === "string" && body.label.trim().length > 140) return NextResponse.json({ error: "O nome do pacote tem no máximo 140 caracteres." }, { status: 400 });
  try {
    const event = body.suggestedDate !== undefined ? await setCaptureSuggestion(id, body.suggestedDate || undefined) : undefined;
    const captacao = body.label !== undefined || body.packageKind !== undefined || body.recordingAssigneeId !== undefined || body.editingAssigneeId !== undefined
      ? await updatePlanCaptacao(id, { label: body.label, packageKind: body.packageKind, recordingAssigneeId: body.recordingAssigneeId, editingAssigneeId: body.editingAssigneeId })
      : undefined;
    return NextResponse.json({ event: event || null, captacao: captacao || null });
  } catch (error) {
    console.error("[/api/plan-captacoes/:id] falha ao atualizar captação:", error);
    const missingMigration = error instanceof Error && /package_kind|recording_assignee_id|editing_assignee_id|assignee_source/.test(error.message);
    return NextResponse.json(
      { error: missingMigration ? "A atualização do banco para responsáveis de captação ainda não foi aplicada." : "Não foi possível atualizar a captação." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_QUE_PLANEJAM);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const blocked = await pacoteVisivel(auth, id);
  if (blocked) return blocked;
  const removed = await deletePlanCaptacao(id);
  if (!removed) return NextResponse.json({ error: "Captação não encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
