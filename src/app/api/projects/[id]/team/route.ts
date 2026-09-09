import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { ROLES_DE_GESTAO } from "@/lib/permissions";
import { listProjectTeam, setProjectTeam } from "@/lib/storage";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_DE_GESTAO);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  return NextResponse.json({ memberIds: await listProjectTeam(id) });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_DE_GESTAO);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json();
  if (!Array.isArray(body?.memberIds)) {
    return NextResponse.json({ error: "Envie a lista de pessoas da equipe." }, { status: 400 });
  }
  await setProjectTeam(id, body.memberIds);
  return NextResponse.json({ ok: true });
}
