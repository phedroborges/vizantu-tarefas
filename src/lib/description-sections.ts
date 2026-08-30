// Padrão de descrição de TODA tarefa — item de plano, etapa de marca ou tarefa
// avulsa: as mesmas seções, na mesma ordem, sempre. Não é markdown que alguém
// precisa lembrar de digitar. A UI mostra um bloco por seção; aqui só fica a
// conversão entre esse formato estruturado e o texto salvo em
// tasks.description (que precisa continuar sendo texto puro, porque a IA
// lê/escreve nele e o vizantu-planos mostra pro cliente).
//
// "scope" é o que muda de tela pra tela — nunca o formato salvo. Direcionamento
// e Referência valem pra qualquer entrega: um Briefing de marca também tem "o
// que precisa acontecer" e "no que se basear". Roteiro e Legenda só existem
// quando a entrega é uma publicação — plataforma de marca, manual, identidade
// visual e passo de processo não têm roteiro nem legenda.

import type { PlanKind, TaskKind } from "./types";

export const DESCRIPTION_SECTIONS = [
  { key: "direcionamento", label: "Direcionamento", scope: "sempre", placeholder: "O que precisa acontecer nesse conteúdo, o contexto, o que gravar/fazer" },
  { key: "roteiro", label: "Roteiro", scope: "conteudo", placeholder: "Cena, fala, lettering — o roteiro em si" },
  { key: "legenda", label: "Legenda", scope: "conteudo", placeholder: "Texto complementar da publicação e CTA" },
  { key: "referencia", label: "Referência", scope: "sempre", placeholder: "Links ou descrição do que serve de referência" },
] as const;

export type DescriptionSection = (typeof DESCRIPTION_SECTIONS)[number];
export type DescriptionSectionKey = DescriptionSection["key"];
export type DescriptionSections = Record<DescriptionSectionKey, string> & { livre: string };

const LABEL_TO_KEY = new Map<string, DescriptionSectionKey>(
  DESCRIPTION_SECTIONS.map((s) => [s.label.toLowerCase(), s.key]),
);

const HEADING_LINE = /^\s*\*\*(.+?)\*\*\s*$/;

// Aceita variações antigas sem misturar conteúdos de seções diferentes.
const ALIASES: Record<string, DescriptionSectionKey> = {
  ideia: "roteiro",
  referencias: "referencia",
  "referência": "referencia",
};

function normalizeHeading(raw: string): DescriptionSectionKey | null {
  const clean = raw.trim().toLowerCase().replace(/:$/, "");
  return LABEL_TO_KEY.get(clean) ?? ALIASES[clean] ?? null;
}

// Qual seção uma linha do texto salvo abre, se abrir alguma. Fica exportado
// porque quem renderiza a descrição também precisa achar o cabeçalho de uma
// seção específica (o do roteiro, pra pendurar o botão de copiar nele) sem
// remontar essa regra por fora.
export function descriptionHeadingKey(line: string): DescriptionSectionKey | null {
  const heading = HEADING_LINE.exec(line);
  return heading ? normalizeHeading(heading[1]) : null;
}

export function emptySections(): DescriptionSections {
  return { direcionamento: "", roteiro: "", legenda: "", referencia: "", livre: "" };
}

// Lê o texto salvo e separa nas seções conhecidas. Qualquer coisa escrita
// antes da primeira seção (ou num item antigo, sem seção nenhuma) cai em
// "livre" — nada é descartado.
export function parseDescription(text: string | undefined): DescriptionSections {
  const result = emptySections();
  if (!text?.trim()) return result;

  const lines = text.split("\n");
  let current: DescriptionSectionKey | "livre" = "livre";
  const buffers: Record<string, string[]> = { direcionamento: [], roteiro: [], legenda: [], referencia: [], livre: [] };

  for (const line of lines) {
    const key = descriptionHeadingKey(line);
    if (key) {
      current = key;
      continue;
    }
    buffers[current].push(line);
  }

  for (const key of Object.keys(buffers)) {
    result[key as keyof DescriptionSections] = buffers[key].join("\n").trim();
  }
  return result;
}

// Volta pro formato de texto salvo no banco. Seção vazia não vira cabeçalho
// órfão — o cliente não vê "Roteiro" sem roteiro embaixo.
export function serializeDescription(sections: DescriptionSections): string {
  const parts: string[] = [];
  if (sections.livre.trim()) parts.push(sections.livre.trim());
  for (const section of DESCRIPTION_SECTIONS) {
    const value = sections[section.key]?.trim();
    if (value) parts.push(`**${section.label}**\n${value}`);
  }
  return parts.join("\n\n");
}

// ---------- Quais seções cada tela mostra ----------
// Duas fontes, nessa ordem, e nunca as duas ao mesmo tempo:
//
// 1. Dentro de um plano, o PLANO manda. Todo item de um plano de conteúdo é
//    conteúdo; etapa de marca e passo de processo não são, e não adianta
//    marcar o contrário numa tarefa só. Por isso o seletor nem aparece ali.
// 2. Fora de um plano, o SELETOR manda — é o único lugar onde a resposta não
//    está em lugar nenhum, então quem cria diz. O padrão é "tarefa": começa em
//    direcionamento e referência, e vira conteúdo quando alguém disser que é.
export function hasContentSections(task: { planKind?: PlanKind; kind?: TaskKind }): boolean {
  return task.planKind ? task.planKind === "content" : task.kind === "conteudo";
}

// O seletor só faz sentido onde ele decide alguma coisa: numa tarefa de plano
// a resposta já vem do plano, e um seletor que não muda nada é pior que
// nenhum. Os botões "+ Roteiro" continuam sendo a saída pro caso excepcional.
export function taskKindIsEditable(task: { planKind?: PlanKind }): boolean {
  return !task.planKind;
}

// Seção de conteúdo escondida que JÁ tem texto continua aparecendo: numa marca
// antiga (que herdou Roteiro/Legenda de quando a estrutura era igual pra todo
// item de plano) ou quando alguém revelou o bloco de propósito. A tela nunca
// esconde o que alguém escreveu — e o serialize continua salvando tudo.
export function descriptionLayout(
  sections: DescriptionSections,
  options: { content: boolean; revealed?: readonly DescriptionSectionKey[] },
): { visible: DescriptionSection[]; hidden: DescriptionSection[] } {
  const visible: DescriptionSection[] = [];
  const hidden: DescriptionSection[] = [];
  for (const section of DESCRIPTION_SECTIONS) {
    const show =
      section.scope === "sempre" ||
      options.content ||
      options.revealed?.includes(section.key) ||
      Boolean(sections[section.key]?.trim());
    (show ? visible : hidden).push(section);
  }
  return { visible, hidden };
}
