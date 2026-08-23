import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { createBrandWorkflow } from "@/lib/storage";

export async function POST(request: NextRequest) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const body = await request.json();
  if (!body?.title || typeof body.title !== "string" || !body.title.trim()) return NextResponse.json({ error: "Informe o nome da marca." }, { status: 400 });
  if (!body?.projectId || typeof body.projectId !== "string") return NextResponse.json({ error: "Selecione um projeto." }, { status: 400 });
  const result = await createBrandWorkflow({ projectId: body.projectId, title: body.title.trim(), createdBy: auth.id });
  return NextResponse.json(result, { status: 201 });
}
