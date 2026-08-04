import { NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { createAssistantConversation, listAssistantConversations } from "@/lib/storage";

export async function GET() {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  if (!auth.aiEnabled) return NextResponse.json({ error: "O assistente de IA não está disponível para o seu usuário." }, { status: 403 });
  const conversations = await listAssistantConversations();
  return NextResponse.json({
    conversations: conversations.map((conversation) => ({ id: conversation.id, title: conversation.title, updatedAt: conversation.updatedAt })),
  });
}

export async function POST() {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  if (!auth.aiEnabled) return NextResponse.json({ error: "O assistente de IA não está disponível para o seu usuário." }, { status: 403 });
  const conversation = await createAssistantConversation();
  return NextResponse.json({ conversation }, { status: 201 });
}
