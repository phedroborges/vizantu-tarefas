import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { listMemberListAccess, setMemberListAccess } from "@/lib/storage";
import { TASK_LIST_KINDS } from "@/lib/types";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const listKinds = await listMemberListAccess(id);
  return NextResponse.json({ listKinds });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json();
  if (!Array.isArray(body?.listKinds) || !body.listKinds.every((item: unknown) => TASK_LIST_KINDS.some((kind) => kind.value === item))) {
    return NextResponse.json({ error: "Envie a lista de listas liberadas." }, { status: 400 });
  }
  await setMemberListAccess(id, body.listKinds);
  return NextResponse.json({ ok: true });
}
