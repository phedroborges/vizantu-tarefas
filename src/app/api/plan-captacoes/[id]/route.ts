import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { deletePlanCaptacao } from "@/lib/storage";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const removed = await deletePlanCaptacao(id);
  if (!removed) return NextResponse.json({ error: "Captação não encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
