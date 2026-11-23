import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, podeAbrirProjeto, requireUser, semAcesso } from "@/lib/authz";
import { ROLES_QUE_ALIMENTAM_O_GUIA, ROLES_QUE_PLANEJAM } from "@/lib/permissions";
import { listMembers } from "@/lib/storage";
import { linhaDoTempoEmTexto, organizar, parseTimelineInput, TimelineInputError, type TimelineInput } from "@/lib/timeline/model";
import { createTimelineItem, deleteTimelineItem, listTimeline, updateTimelineItem } from "@/lib/timeline/store";
import { todayInSaoPaulo } from "@/lib/onboarding/store";

const NO_STORE = { "Cache-Control": "private, no-store" };

const falhou = (error: unknown, acao: string) => error instanceof TimelineInputError
  ? NextResponse.json({ error: error.message }, { status: 400 })
  : apiFailure(error, acao);

// A leitura devolve três formas do mesmo dado: a lista crua, os grupos por
// horizonte (o que a tela desenha) e o texto corrido (o que a IA lê melhor).
// Assim nenhum agente precisa recalcular "o que vale hoje".
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  const { id } = await params;
  if (!podeAbrirProjeto(auth, id)) return semAcesso();
  try {
    const [itens, membros] = await Promise.all([listTimeline(id), listMembers()]);
    const nomes = new Map(membros.map((membro) => [membro.id, membro.name]));
    const comNome = itens.map((item) => ({ ...item, createdByName: item.createdBy ? nomes.get(item.createdBy) : undefined }));
    const hoje = todayInSaoPaulo();
    return NextResponse.json({ hoje, itens: comNome, grupos: organizar(comNome, hoje), texto: linhaDoTempoEmTexto(comNome, hoje) }, { headers: NO_STORE });
  } catch (error) {
    return apiFailure(error, "ler a linha do tempo do cliente");
  }
}

// Criar e editar: quem planeja e os agentes de IA (o Totó registra o que sai das
// reuniões). Com "substitui": <id>, o item antigo vira substituído.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_QUE_ALIMENTAM_O_GUIA);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  if (!podeAbrirProjeto(auth, id)) return semAcesso();
  try {
    const body = await request.json();
    const input = parseTimelineInput(body) as TimelineInput;
    const substitui = typeof body?.substitui === "string" && body.substitui ? body.substitui : undefined;
    return NextResponse.json({ item: await createTimelineItem(id, input, auth.id, substitui) }, { status: 201 });
  } catch (error) {
    return falhou(error, "salvar na linha do tempo");
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_QUE_ALIMENTAM_O_GUIA);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  if (!podeAbrirProjeto(auth, id)) return semAcesso();
  const itemId = request.nextUrl.searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "Informe o item (itemId)." }, { status: 400 });
  try {
    return NextResponse.json({ item: await updateTimelineItem(id, itemId, parseTimelineInput(await request.json(), true)) });
  } catch (error) {
    return falhou(error, "editar a linha do tempo");
  }
}

// Apagar é só de quem planeja e só para corrigir erro de digitação. Mudança de
// rumo do cliente se registra substituindo, nunca apagando.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_QUE_PLANEJAM);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  if (!podeAbrirProjeto(auth, id)) return semAcesso();
  const itemId = request.nextUrl.searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "Informe o item (itemId)." }, { status: 400 });
  try {
    if (!(await deleteTimelineItem(id, itemId))) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiFailure(error, "apagar da linha do tempo");
  }
}
