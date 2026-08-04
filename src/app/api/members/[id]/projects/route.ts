import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { listProjectAccess, setProjectAccess } from "@/lib/storage";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const projectIds = await listProjectAccess(id);
  return NextResponse.json({ projectIds });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json();
  if (!Array.isArray(body?.projectIds)) {
    return NextResponse.json({ error: "Envie a lista de projetos." }, { status: 400 });
  }
  await setProjectAccess(id, body.projectIds);
  return NextResponse.json({ ok: true });
}
