import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, podeAbrirProjeto, podeAbrirTarefa, requireUser, semAcesso } from "@/lib/authz";
import { ROLES_DO_TIME } from "@/lib/permissions";
import { duplicateTask, getTask } from "@/lib/storage";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_DO_TIME);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  try {
    const existing = await getTask(id);
    if (!existing) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
    if (!podeAbrirTarefa(auth, existing) || !podeAbrirProjeto(auth, existing.projectId)) return semAcesso();
    const task = await duplicateTask(id, auth.id);
    if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return apiFailure(error, "duplicar a tarefa");
  }
}
