import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, podeAbrirProjeto, requireUser } from "@/lib/authz";
import type { CurrentUser } from "@/lib/current-user";
import { ROLES_QUE_GERENCIAM_CREDENCIAIS } from "@/lib/permissions";
import { encryptSecret, MissingSecretKeyError } from "@/lib/crypto-secrets";
import { deleteProjectCredential, readCredentialSecret, updateProjectCredential } from "@/lib/storage";
import { CREDENTIAL_KINDS } from "@/lib/types";

// A rota recebe o id da credencial, não o do cliente — sem esta checagem, quem
// tivesse um id na mão alteraria ou apagaria o acesso de um cliente que não é
// dele.
async function recusaForaDoCliente(auth: CurrentUser, id: string) {
  const found = await readCredentialSecret(id);
  if (!found) return NextResponse.json({ error: "Credencial não encontrada." }, { status: 404 });
  if (!podeAbrirProjeto(auth, found.projectId)) return NextResponse.json({ error: "Você não trabalha neste cliente." }, { status: 403 });
  return undefined;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_QUE_GERENCIAM_CREDENCIAIS);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json();
  try {
    const recusa = await recusaForaDoCliente(auth, id);
    if (recusa) return recusa;
    // Campo de senha em branco significa "não mexi na senha", não "apague".
    // Apagar de propósito é o clearSecret explícito.
    const secretEncrypted =
      body.clearSecret ? null : body.secret ? encryptSecret(String(body.secret)) : undefined;
    const credential = await updateProjectCredential(id, {
      label: body.label,
      kind: CREDENTIAL_KINDS.some((item) => item.value === body.kind) ? body.kind : undefined,
      username: body.username, url: body.url, notes: body.notes, secretEncrypted,
    });
    if (!credential) return NextResponse.json({ error: "Credencial não encontrada." }, { status: 404 });
    return NextResponse.json({ credential });
  } catch (error) {
    if (error instanceof MissingSecretKeyError) return NextResponse.json({ error: error.message }, { status: 503 });
    return apiFailure(error, "salvar a credencial");
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_QUE_GERENCIAM_CREDENCIAIS);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  try {
    const recusa = await recusaForaDoCliente(auth, id);
    if (recusa) return recusa;
    const removed = await deleteProjectCredential(id);
    if (!removed) return NextResponse.json({ error: "Credencial não encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiFailure(error, "excluir a credencial");
  }
}
