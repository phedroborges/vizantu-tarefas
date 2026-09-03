import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { filterTasksByAccess, filterTasksByListAccess, isResponse, requireUser } from "@/lib/authz";
import { createTask, listTasks } from "@/lib/storage";
import { TASK_KINDS, TASK_STATUSES } from "@/lib/types";

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
  if (body.kind !== undefined && !TASK_KINDS.some((kind) => kind.value === body.kind)) {
    return NextResponse.json({ error: "Tipo de tarefa inválido." }, { status: 400 });
  }
  try {
    const task = await createTask({
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
    });
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return apiFailure(error, "criar a tarefa");
  }
}
