import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { deleteTask, getTask, listTaskActivity, notifyTaskAssigned, updateTask } from "@/lib/storage";
import { TASK_KINDS, TASK_STATUSES } from "@/lib/types";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json();
  if (body.status !== undefined && !TASK_STATUSES.some((status) => status.value === body.status)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }
  if (body.kind !== undefined && !TASK_KINDS.some((kind) => kind.value === body.kind)) {
    return NextResponse.json({ error: "Tipo de tarefa inválido." }, { status: 400 });
  }
  try {
    const previous = body.assigneeId !== undefined ? await getTask(id) : undefined;
    const task = await updateTask(id, {
      projectId: body.projectId,
      name: body.name,
      kind: body.kind,
      dueDate: body.dueDate,
      assigneeId: body.assigneeId,
      assigneeSource: body.assigneeSource,
      description: body.description,
      seasonal: body.seasonal,
      images: body.images,
      driveLink: body.driveLink,
      formatTagIds: body.formatTagIds,
      channelTagIds: body.channelTagIds,
      categoryTagIds: body.categoryTagIds,
      status: body.status,
      planId: body.planId,
      captacaoId: body.captacaoId,
      sequenceOrder: body.sequenceOrder,
    }, auth.id);
    if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
    await notifyTaskAssigned(task, auth.id, previous?.assigneeId);
    return NextResponse.json({ task });
  } catch (error) {
    return apiFailure(error, "salvar a tarefa");
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  const { id } = await params;
  try {
    const task = await getTask(id);
    if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
    if (auth.accessibleProjectIds !== "all" && !auth.accessibleProjectIds.includes(task.projectId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    if (auth.accessibleListKinds !== "all" && task.lists.length && !task.lists.some((list) => auth.accessibleListKinds.includes(list))) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    return NextResponse.json({ activity: await listTaskActivity(id) });
  } catch (error) {
    return apiFailure(error, "carregar o histórico da tarefa");
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  try {
    const removed = await deleteTask(id);
    if (!removed) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiFailure(error, "excluir a tarefa");
  }
}
