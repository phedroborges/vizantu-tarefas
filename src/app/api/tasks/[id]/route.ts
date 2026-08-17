import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { DueDateLockedError, deleteTask, updateTask } from "@/lib/storage";
import { TASK_STATUSES } from "@/lib/types";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json();
  if (body.status !== undefined && !TASK_STATUSES.some((status) => status.value === body.status)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }
  try {
    const task = await updateTask(id, {
      projectId: body.projectId,
      name: body.name,
      dueDate: body.dueDate,
      assigneeId: body.assigneeId,
      description: body.description,
      images: body.images,
      driveLink: body.driveLink,
      formatTagIds: body.formatTagIds,
      channelTagIds: body.channelTagIds,
      categoryTagIds: body.categoryTagIds,
      status: body.status,
      planId: body.planId,
      captacaoId: body.captacaoId,
      sequenceOrder: body.sequenceOrder,
    });
    if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
    return NextResponse.json({ task });
  } catch (error) {
    if (error instanceof DueDateLockedError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const removed = await deleteTask(id);
  if (!removed) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
