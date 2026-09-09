import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, podeAbrirProjeto, requireUser } from "@/lib/authz";
import { ROLES_QUE_GERENCIAM_CREDENCIAIS, ROLES_QUE_VEEM_CREDENCIAIS } from "@/lib/permissions";
import { encryptSecret, MissingSecretKeyError } from "@/lib/crypto-secrets";
import { createProjectCredential, listProjectCredentials } from "@/lib/storage";
import { CREDENTIAL_KINDS } from "@/lib/types";

// Credencial de cliente é acesso à casa dele: quem publica precisa entrar na
// conta, então lê; cadastrar e apagar continua sendo do dono.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_QUE_VEEM_CREDENCIAIS);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  if (!podeAbrirProjeto(auth, id)) return NextResponse.json({ error: "Você não trabalha neste cliente." }, { status: 403 });
  return NextResponse.json({ credentials: await listProjectCredentials(id) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_QUE_GERENCIAM_CREDENCIAIS);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json();

  const kind = CREDENTIAL_KINDS.some((item) => item.value === body.kind) ? body.kind : "outro";
  const label = CREDENTIAL_KINDS.find((item) => item.value === kind)?.label || "Outro acesso";
  if (![body.username, body.secret, body.url, body.notes].some((value) => typeof value === "string" && value.trim())) {
    return NextResponse.json({ error: "Informe pelo menos usuário, senha, link ou observação." }, { status: 400 });
  }

  try {
    // A senha é cifrada AQUI, na entrada. Ela nunca chega ao banco em texto.
    const secretEncrypted = body.secret ? encryptSecret(String(body.secret)) : undefined;
    const credential = await createProjectCredential({
      projectId: id, label, kind,
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
