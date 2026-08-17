import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { createPlanClient, listPlanClients } from "@/lib/storage";

export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  const projectId = new URL(request.url).searchParams.get("projectId") || undefined;
  const clients = await listPlanClients(projectId);
  return NextResponse.json({ clients });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const body = await request.json();
  if (!body?.projectId || typeof body.projectId !== "string") {
    return NextResponse.json({ error: "Selecione um projeto." }, { status: 400 });
  }
  if (!body?.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Informe o nome do cliente." }, { status: 400 });
  }
  const client = await createPlanClient({
    projectId: body.projectId,
    name: body.name,
    roleTitle: body.roleTitle,
    city: body.city,
    instagramHandle: body.instagramHandle,
  });
  return NextResponse.json({ client }, { status: 201 });
}
