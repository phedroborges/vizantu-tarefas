import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, podeAbrirProjeto, requireUser, semAcesso } from "@/lib/authz";
import { parsePatch } from "@/lib/onboarding/checklist";
import { getOnboarding, saveOnboarding } from "@/lib/onboarding/store";
import { ROLES_QUE_PLANEJAM } from "@/lib/permissions";

const NO_STORE = { "Cache-Control": "private, no-store" };

// Quem monta o trabalho do cliente é quem faz o onboard: ler e marcar seguem a
// mesma regra do resto da ficha do projeto.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_QUE_PLANEJAM);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  if (!podeAbrirProjeto(auth, id)) return semAcesso();
  try {
    return NextResponse.json({ onboarding: await getOnboarding(id) }, { headers: NO_STORE });
  } catch (error) {
    return apiFailure(error, "carregar o onboard do cliente");
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_QUE_PLANEJAM);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  if (!podeAbrirProjeto(auth, id)) return semAcesso();
  let patch;
  try {
    patch = parsePatch(await request.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Pedido inválido." }, { status: 400 });
  }
  try {
    return NextResponse.json({ onboarding: await saveOnboarding(id, patch) }, { headers: NO_STORE });
  } catch (error) {
    return apiFailure(error, "salvar o onboard do cliente");
  }
}
