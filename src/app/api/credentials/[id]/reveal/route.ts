import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { decryptSecret, MissingSecretKeyError } from "@/lib/crypto-secrets";
import { readCredentialSecret } from "@/lib/storage";

// A única porta por onde uma senha sai do servidor.
//
// É POST e não GET de propósito: assim ela não entra em histórico de
// navegador, em log de acesso por URL nem em prefetch. E fica sendo uma
// AÇÃO, não uma leitura que acontece de passagem ao abrir a página.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  try {
    const found = await readCredentialSecret(id);
    if (!found) return NextResponse.json({ error: "Credencial não encontrada." }, { status: 404 });
    if (!found.secret) return NextResponse.json({ secret: "" });
    console.info(`[credenciais] ${auth.email} revelou a credencial ${id}`);
    return NextResponse.json({ secret: decryptSecret(found.secret) });
  } catch (error) {
    if (error instanceof MissingSecretKeyError) return NextResponse.json({ error: error.message }, { status: 503 });
    return apiFailure(error, "revelar a senha");
  }
}
