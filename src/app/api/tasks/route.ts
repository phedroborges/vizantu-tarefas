import { NextRequest, NextResponse } from "next/server";
import { createTask, listTasks } from "@/lib/storage";

export async function GET() {
  const tasks = await listTasks();
  return NextResponse.json({ tasks });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body?.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Informe o nome da tarefa." }, { status: 400 });
  }
  if (!body?.projectId || typeof body.projectId !== "string") {
    return NextResponse.json({ error: "Selecione um projeto." }, { status: 400 });
  }
  const task = await createTask({
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
  return NextResponse.json({ task }, { status: 201 });
}
