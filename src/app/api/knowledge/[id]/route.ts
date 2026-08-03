import { NextRequest, NextResponse } from "next/server";
import { deleteKnowledgeDoc, updateKnowledgeDoc } from "@/lib/storage";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const doc = await updateKnowledgeDoc(id, { title: body.title, content: body.content });
  if (!doc) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  return NextResponse.json({ doc });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const removed = await deleteKnowledgeDoc(id);
  if (!removed) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
