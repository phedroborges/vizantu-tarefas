import { NextRequest, NextResponse } from "next/server";
import { filterTasksByAccess, filterTasksByListAccess, isResponse, requireUser } from "@/lib/authz";
import { createTask, listTasks } from "@/lib/storage";
import { TASK_LIST_KINDS, TASK_STATUSES } from "@/lib/types";

function isValidLists(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => TASK_LIST_KINDS.some((kind) => kind.value === item));
}

export async function GET() {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  const tasks = await listTasks();
  const byProject = filterTasksByAccess(tasks, auth.accessibleProjectIds);
  return NextResponse.json({ tasks: filterTasksByListAccess(byProject, auth.accessibleListKinds) });
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
  if (body.lists !== undefined && !isValidLists(body.lists)) {
    return NextResponse.json({ error: "Lista inválida." }, { status: 400 });
  }
  const task = await createTask({
    projectId: body.projectId,
    name: body.name,
    dueDate: body.dueDate,
    assigneeId: body.assigneeId,
    description: body.description,
    images: body.images,
    driveLink: body.driveLink,
    formatTagIds: body.formatTagIds,
    channelTagIds: body.channelTagIds,
    lists: body.lists,
    status: body.status,
  });
  return NextResponse.json({ task }, { status: 201 });
}
