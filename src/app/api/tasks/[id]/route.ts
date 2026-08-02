import { NextRequest, NextResponse } from "next/server";
import { deleteTask, updateTask } from "@/lib/storage";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const task = await updateTask(id, {
    projectId: body.projectId,
    name: body.name,
    dueDate: body.dueDate,
    assignee: body.assignee,
    description: body.description,
    driveLink: body.driveLink,
    format: body.format,
    channel: body.channel,
    status: body.status,
  });
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  return NextResponse.json({ task });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const removed = await deleteTask(id);
  if (!removed) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
