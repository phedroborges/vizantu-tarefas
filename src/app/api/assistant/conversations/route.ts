import { NextResponse } from "next/server";
import { createAssistantConversation, listAssistantConversations } from "@/lib/storage";

export async function GET() {
  const conversations = await listAssistantConversations();
  return NextResponse.json({
    conversations: conversations.map((conversation) => ({ id: conversation.id, title: conversation.title, updatedAt: conversation.updatedAt })),
  });
}

export async function POST() {
  const conversation = await createAssistantConversation();
  return NextResponse.json({ conversation }, { status: 201 });
}
