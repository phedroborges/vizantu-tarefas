import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { addComment } from "@/lib/storage";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json();
  if (!body?.text || typeof body.text !== "string" || !body.text.trim()) {
    return NextResponse.json({ error: "Escreva um comentário." }, { status: 400 });
  }
  try {
    const task = await addComment(id, { author: auth.name, authorMemberId: auth.id, mentionedMemberIds: Array.isArray(body.mentionedMemberIds) ? body.mentionedMemberIds : [], text: body.text });
    if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return apiFailure(error, "enviar o comentário");
  }
}
