import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { createProject, listProjects } from "@/lib/storage";

export async function GET() {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  const projects = await listProjects();
  const visible = auth.accessibleProjectIds === "all" ? projects : projects.filter((p) => (auth.accessibleProjectIds as string[]).includes(p.id));
  return NextResponse.json({ projects: visible });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const body = await request.json();
  if (!body?.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Informe o nome do projeto." }, { status: 400 });
  }
  const project = await createProject({
    name: body.name, client: body.client, clientRole: body.clientRole, clientCity: body.clientCity,
    clientInstagram: body.clientInstagram, avatarUrl: body.avatarUrl, avatarColor: body.avatarColor, status: body.status,
  });
  return NextResponse.json({ project }, { status: 201 });
}
