import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { deleteAssistantConversation, getAssistantConversation, renameAssistantConversation } from "@/lib/storage";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  if (!auth.aiEnabled) return NextResponse.json({ error: "O assistente de IA não está disponível para o seu usuário." }, { status: 403 });
  const { id } = await params;
  const conversation = await getAssistantConversation(id);
  if (!conversation) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  return NextResponse.json({ conversation });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  if (!auth.aiEnabled) return NextResponse.json({ error: "O assistente de IA não está disponível para o seu usuário." }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  if (!body?.title || typeof body.title !== "string") {
    return NextResponse.json({ error: "Informe um título." }, { status: 400 });
  }
  const conversation = await renameAssistantConversation(id, body.title);
  if (!conversation) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  return NextResponse.json({ conversation });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  if (!auth.aiEnabled) return NextResponse.json({ error: "O assistente de IA não está disponível para o seu usuário." }, { status: 403 });
  const { id } = await params;
  const removed = await deleteAssistantConversation(id);
  if (!removed) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
