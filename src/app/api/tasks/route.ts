import { NextRequest, NextResponse } from "next/server";
import { filterTasksByAccess, isResponse, requireUser } from "@/lib/authz";
import { createTask, listTasks } from "@/lib/storage";
import { TASK_STATUSES } from "@/lib/types";

export async function GET() {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  const tasks = await listTasks();
  return NextResponse.json({ tasks: filterTasksByAccess(tasks, auth.accessibleProjectIds) });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const body = await request.json();
  if (!body?.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Informe o nome da tarefa." }, { status: 400 });
  }
  if (!body?.projectId || typeof body.projectId !== "string") {
    return NextResponse.json({ error: "Selecione um projeto." }, { status: 400 });
  }
  if (body.status !== undefined && !TASK_STATUSES.some((status) => status.value === body.status)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }
  const task = await createTask({
    projectId: body.projectId,
    name: body.name,
    dueDate: body.dueDate,
    assigneeId: body.assigneeId,
    description: body.description,
    driveLink: body.driveLink,
    formatTagIds: body.formatTagIds,
    channelTagIds: body.channelTagIds,
    status: body.status,
  });
  return NextResponse.json({ task }, { status: 201 });
}
