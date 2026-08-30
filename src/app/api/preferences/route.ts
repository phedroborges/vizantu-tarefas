import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { getMemberPreferences, saveMemberPreferences } from "@/lib/storage";

// Preferência é sempre a de QUEM ESTÁ LOGADO. O member_id vem da sessão e
// nunca do corpo da requisição — não existe caminho pra editar o jeito de ver
// de outra pessoa, nem pro dono. Cada um manda no seu.
export async function GET() {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  return NextResponse.json({ preferences: await getMemberPreferences(auth.id) });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Envie as preferências a salvar." }, { status: 400 });
  }
  // saveMemberPreferences normaliza e faz merge: chave desconhecida é
  // descartada, e o que não veio no corpo continua como estava.
  return NextResponse.json({ preferences: await saveMemberPreferences(auth.id, body) });
}
