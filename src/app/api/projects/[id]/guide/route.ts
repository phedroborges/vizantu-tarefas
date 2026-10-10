import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { generateClientGuide } from "@/lib/guide-generation";
import { systemSourcesForGuide, temMaterialDoSistema } from "@/lib/guide-system-sources";
import { podeGerenciarEquipe, podeVer, ROLES_QUE_PLANEJAM } from "@/lib/permissions";
import { getProject, getProjectProfile, listContracts, listMembers, listPlans, listProjectSources, listProjectTeam, listSurveys, listTags, listTasks, saveGeneratedGuide } from "@/lib/storage";

// Remonta o guia a partir de TODAS as fontes do projeto: as reuniões e
// anotações coladas e o que o sistema já guarda (contrato, planos, tarefas,
// pesquisas). Por isso funciona mesmo sem nenhuma reunião. É re-executável de
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
  if (auth.accessibleProjectIds !== "all" && !auth.accessibleProjectIds.includes(id)) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  }
  try {
    // O guia é lido por todo o time, então só entra nele o que quem está
    // montando pode ver: sem acesso a contratos, o contrato fica de fora.
    const [project, reunioes, profile, contracts, plans, tasks, surveys, tags, members, teamIds] = await Promise.all([
      getProject(id),
      listProjectSources(id),
      getProjectProfile(id),
      podeVer(auth.role, "contratos") ? listContracts(id) : Promise.resolve([]),
      listPlans(id),
      listTasks({ projectIds: [id], listKinds: auth.accessibleListKinds }),
      podeVer(auth.role, "pesquisas") ? listSurveys(id) : Promise.resolve([]),
      listTags(),
      listMembers(),
      podeGerenciarEquipe(auth.role) ? listProjectTeam(id) : Promise.resolve([]),
    ]);
    if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

    const doSistema = systemSourcesForGuide({
      project, profile, contracts, plans, surveys, tags,
      tasks: tasks.filter((task) => task.projectId === id),
      team: members.filter((member) => teamIds.includes(member.id)),
    });
    if (!reunioes.length && !temMaterialDoSistema(doSistema)) {
      return NextResponse.json({ error: "Ainda não há contrato, plano, tarefa, pesquisa nem reunião deste cliente para a IA ler. Adicione uma reunião ou anotação e monte de novo." }, { status: 400 });
    }
    const sources = [...reunioes, ...doSistema];

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
      blocosComErro: resultado.blocosComErro,
    });
  } catch (error) {
    return apiFailure(error, "montar o guia do cliente");
  }
}
