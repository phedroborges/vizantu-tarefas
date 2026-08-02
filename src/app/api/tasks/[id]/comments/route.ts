import { NextRequest, NextResponse } from "next/server";
import { addComment } from "@/lib/storage";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  if (!body?.text || typeof body.text !== "string" || !body.text.trim()) {
    return NextResponse.json({ error: "Escreva um comentário." }, { status: 400 });
  }
  const task = await addComment(id, { author: body.author || "Equipe", text: body.text });
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  return NextResponse.json({ task }, { status: 201 });
}
