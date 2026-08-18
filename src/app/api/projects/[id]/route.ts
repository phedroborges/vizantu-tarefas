import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { deleteProject, updateProject } from "@/lib/storage";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json();
  const project = await updateProject(id, {
    name: body.name,
    client: body.client,
    clientRole: body.clientRole,
    clientCity: body.clientCity,
    clientInstagram: body.clientInstagram,
    status: body.status,
  });
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  return NextResponse.json({ project });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const removed = await deleteProject(id);
  if (!removed) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
