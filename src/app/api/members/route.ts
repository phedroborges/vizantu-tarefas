import { NextRequest, NextResponse } from "next/server";
import { createMember, listMembers } from "@/lib/storage";

export async function GET() {
  const members = await listMembers();
  return NextResponse.json({ members });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body?.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Informe o nome do membro." }, { status: 400 });
  }
  const member = await createMember({ name: body.name });
  return NextResponse.json({ member }, { status: 201 });
}
