import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { updateMember } from "@/lib/storage";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json();
  const member = await updateMember(id, {
    name: body.name,
    active: body.active,
    role: body.role,
    aiEnabled: body.aiEnabled,
  });
  if (!member) return NextResponse.json({ error: "Membro não encontrado." }, { status: 404 });
  return NextResponse.json({ member });
}
