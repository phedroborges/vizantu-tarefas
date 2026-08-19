import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { deletePlanCaptacao, setCaptureSuggestion } from "@/lib/storage";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json();
  if (body?.suggestedDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.suggestedDate)) return NextResponse.json({ error: "Data inválida." }, { status: 400 });
  const event = await setCaptureSuggestion(id, body?.suggestedDate || undefined);
  return NextResponse.json({ event: event || null });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const removed = await deletePlanCaptacao(id);
  if (!removed) return NextResponse.json({ error: "Captação não encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
