import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, podeAbrirTarefa, requireUser, semAcesso } from "@/lib/authz";
import { ROLES_DO_TIME } from "@/lib/permissions";
import { addComment, getTask } from "@/lib/storage";
import { MAX_COMMENT_LENGTH } from "@/lib/types";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_DO_TIME);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json();
  const text = typeof body?.text === "string" ? body.text : "";
  const hasAttachments = Array.isArray(body?.attachments) && body.attachments.length > 0;
  // Um áudio ou uma imagem sozinhos já são um comentário.
  if (!text.trim() && !hasAttachments) {
    return NextResponse.json({ error: "Escreva um comentário ou anexe uma imagem ou um áudio." }, { status: 400 });
  }
  if (text.length > MAX_COMMENT_LENGTH) {
    return NextResponse.json({ error: `O comentário tem no máximo ${MAX_COMMENT_LENGTH} caracteres.` }, { status: 400 });
  }
  try {
    const existing = await getTask(id);
    if (!existing) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
    if (!podeAbrirTarefa(auth, existing)) return semAcesso();
    const task = await addComment(id, { author: auth.name, authorMemberId: auth.id, mentionedMemberIds: Array.isArray(body.mentionedMemberIds) ? body.mentionedMemberIds : [], text, attachments: body.attachments });
    if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return apiFailure(error, "enviar o comentário");
  }
}
