import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { generateClientGuide } from "@/lib/guide-generation";
import { ROLES_QUE_PLANEJAM } from "@/lib/permissions";
import { getProject, getProjectProfile, listProjectSources, saveGeneratedGuide } from "@/lib/storage";

// Remonta o guia a partir de TODAS as fontes do projeto. É re-executável de
// propósito: entrou a quarta reunião, roda de novo e o guia inteiro é
// reescrito com o acumulado. Campo corrigido à mão fica intacto (o filtro
// está em saveGeneratedGuide).
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_QUE_PLANEJAM);
  if (isResponse(auth)) return auth;
  if (!auth.aiEnabled) {
    return NextResponse.json({ error: "O assistente de IA não está disponível para o seu usuário." }, { status: 403 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY não configurada no servidor. Adicione a chave em .env.local e reinicie o servidor." },
      { status: 500 },
    );
  }

  const { id } = await params;
  try {
    const [project, sources, profile] = await Promise.all([
      getProject(id),
      listProjectSources(id),
      getProjectProfile(id),
    ]);
    if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
    if (!sources.length) {
      return NextResponse.json({ error: "Adicione pelo menos uma reunião ou anotação antes de montar o guia." }, { status: 400 });
    }

    // Só os campos que a pessoa corrigiu à mão viram contexto obrigatório.
    const camposManuais: Record<string, string> = {};
    for (const chave of profile?.guideManualFields ?? []) {
      const valor = profile?.[chave as keyof typeof profile];
      if (typeof valor === "string" && valor.trim()) camposManuais[chave] = valor;
    }

    const resultado = await generateClientGuide({
      apiKey,
      projectName: project.name,
      clientName: project.client,
      sources,
      camposManuais,
    });

    const atualizado = await saveGeneratedGuide(id, resultado.guia);
    return NextResponse.json({
      profile: atualizado,
      camposPreenchidos: resultado.camposPreenchidos,
      fontesLidas: resultado.fontesLidas,
    });
  } catch (error) {
    return apiFailure(error, "montar o guia do cliente");
  }
}
