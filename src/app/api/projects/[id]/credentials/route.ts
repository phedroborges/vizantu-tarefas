import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { encryptSecret, MissingSecretKeyError } from "@/lib/crypto-secrets";
import { createProjectCredential, listProjectCredentials } from "@/lib/storage";
import { CREDENTIAL_KINDS } from "@/lib/types";

// Credencial de cliente é acesso à casa dele. Fica com o dono, e só.
const ROLES = ["dono"] as const;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser([...ROLES]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  return NextResponse.json({ credentials: await listProjectCredentials(id) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser([...ROLES]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json();

  if (!body?.label || typeof body.label !== "string" || !body.label.trim()) {
    return NextResponse.json({ error: "Dê um nome para esse acesso." }, { status: 400 });
  }
  const kind = CREDENTIAL_KINDS.some((item) => item.value === body.kind) ? body.kind : "outro";

  try {
    // A senha é cifrada AQUI, na entrada. Ela nunca chega ao banco em texto.
    const secretEncrypted = body.secret ? encryptSecret(String(body.secret)) : undefined;
    const credential = await createProjectCredential({
      projectId: id, label: body.label, kind,
      username: body.username, url: body.url, notes: body.notes,
      secretEncrypted, createdBy: auth.id,
    });
    return NextResponse.json({ credential }, { status: 201 });
  } catch (error) {
    // Sem chave o servidor RECUSA. Gravar aberto seria trocar uma falha
    // visível por um vazamento silencioso.
    if (error instanceof MissingSecretKeyError) return NextResponse.json({ error: error.message }, { status: 503 });
    return apiFailure(error, "salvar a credencial");
  }
}
