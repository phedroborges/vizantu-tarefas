import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { deletePlanCaptacao, setCaptureSuggestion, updatePlanCaptacao } from "@/lib/storage";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json();
  if (body?.suggestedDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.suggestedDate)) return NextResponse.json({ error: "Data inválida." }, { status: 400 });
  if (body.packageKind !== undefined && body.packageKind !== "capture" && body.packageKind !== "creation") return NextResponse.json({ error: "Tipo de pacote inválido." }, { status: 400 });
  try {
    const event = body.suggestedDate !== undefined ? await setCaptureSuggestion(id, body.suggestedDate || undefined) : undefined;
    const captacao = body.packageKind !== undefined || body.recordingAssigneeId !== undefined || body.editingAssigneeId !== undefined
      ? await updatePlanCaptacao(id, { packageKind: body.packageKind, recordingAssigneeId: body.recordingAssigneeId, editingAssigneeId: body.editingAssigneeId })
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
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const removed = await deletePlanCaptacao(id);
  if (!removed) return NextResponse.json({ error: "Captação não encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
