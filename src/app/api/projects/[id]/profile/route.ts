import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, podeAbrirProjeto, requireUser, semAcesso } from "@/lib/authz";
import { ROLES_QUE_PLANEJAM } from "@/lib/permissions";
import { getProjectProfile, saveProjectProfile } from "@/lib/storage";

// O guia do cliente em JSON, para os agentes de IA lerem sem raspar a tela.
// Quem abre o cliente na tela já lê o mesmo guia ali.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  const { id } = await params;
  if (!podeAbrirProjeto(auth, id)) return semAcesso();
  try {
    return NextResponse.json({ profile: (await getProjectProfile(id)) ?? null });
  } catch (error) {
    return apiFailure(error, "ler o guia do cliente");
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_QUE_PLANEJAM);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  if (!podeAbrirProjeto(auth, id)) return semAcesso();
  const body = await request.json();
  try {
    return NextResponse.json({ profile: await saveProjectProfile(id, body) });
  } catch (error) {
    return apiFailure(error, "salvar o perfil do cliente");
  }
}
