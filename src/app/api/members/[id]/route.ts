import { NextRequest, NextResponse } from "next/server";
import { updateMember } from "@/lib/storage";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const member = await updateMember(id, { name: body.name, active: body.active });
  if (!member) return NextResponse.json({ error: "Membro não encontrado." }, { status: 404 });
  return NextResponse.json({ member });
}
