import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { encryptSecret, MissingSecretKeyError } from "@/lib/crypto-secrets";
import { deleteProjectCredential, updateProjectCredential } from "@/lib/storage";
import { CREDENTIAL_KINDS } from "@/lib/types";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json();
  try {
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
  const auth = await requireUser(["dono"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  try {
    const removed = await deleteProjectCredential(id);
    if (!removed) return NextResponse.json({ error: "Credencial não encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiFailure(error, "excluir a credencial");
  }
}
