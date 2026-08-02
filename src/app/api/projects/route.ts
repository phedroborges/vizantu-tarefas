import { NextRequest, NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/storage";

export async function GET() {
  const projects = await listProjects();
  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body?.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Informe o nome do projeto." }, { status: 400 });
  }
  const project = await createProject({ name: body.name, client: body.client, status: body.status });
  return NextResponse.json({ project }, { status: 201 });
}
