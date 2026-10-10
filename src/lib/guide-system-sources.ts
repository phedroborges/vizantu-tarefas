// O que o sistema já sabe sobre o cliente, no formato de fonte do guia.
//
// O guia nasceu dependendo de alguém colar a anotação da reunião, e esse passo
// quase nunca acontecia: o botão da IA ficava apagado e o guia, vazio. Só que
// contrato, planos, tarefas e pesquisas já contam boa parte da história. Aqui
// eles viram texto que a geração lê junto com as reuniões, quando existirem.
//
// Função pura de propósito: quem decide o que cada cargo pode ver é a rota,
// que só passa para cá o que a pessoa enxerga.

import { CONTRACT_TEMPLATES } from "./contract-templates";
import { CONTRACT_STATUSES, PLAN_KINDS, TASK_STATUSES, type Contract, type Member, type Plan, type Project, type ProjectProfile, type Survey, type Tag, type Task } from "./types";

export type GuideSource = { title: string; kind: string; content: string; happenedOn?: string; createdAt: string };

// Só o que descreve o trabalho combinado. Documento, endereço, e-mail e CPF do
// contrato não ajudam a equipe a produzir e não têm por que sair do sistema.
const CAMPOS_DO_CONTRATO: [string, string][] = [
  ["marca", "Marca ou pessoa atendida"],
  ["vigencia_inicio", "Início da vigência"],
  ["vigencia_meses", "Vigência em meses"],
  ["qtd_estaticos", "Posts estáticos por mês"],
  ["qtd_carrosseis", "Carrosséis por mês"],
  ["qtd_videos", "Vídeos por mês"],
  ["verba_minima", "Verba mínima de tráfego em R$"],
  ["prazo_entrega_marca", "Prazo de entrega da marca"],
];

const MAX_TAREFAS = 60;
const MAX_CHARS_DESCRICAO = 500;

const linha = (rotulo: string, valor?: string | null) => (valor?.trim() ? `${rotulo}: ${valor.trim()}` : "");
const juntar = (linhas: string[]) => linhas.filter(Boolean).join("\n");

export function systemSourcesForGuide(input: {
  project: Project;
  profile?: Partial<ProjectProfile> | null;
  contracts: Contract[];
  plans: Plan[];
  tasks: Task[];
  surveys: Survey[];
  tags: Tag[];
  team: Member[];
}): GuideSource[] {
  const { project, profile } = input;
  const fontes: GuideSource[] = [];
  // Sem data: na ordenação da geração ficam depois das reuniões, que são o
  // relato de primeira mão e ganham quando o espaço aperta.
  const fonte = (title: string, content: string) => { if (content.trim()) fontes.push({ title, kind: "registro do sistema", content, createdAt: "" }); };

  fonte("Cadastro do cliente", juntar([
    linha("Projeto", project.name),
    linha("Cliente", project.client),
    linha("Profissão ou cargo", project.clientRole),
    linha("Cidade", project.clientCity || profile?.cidade),
    linha("Instagram", project.clientInstagram),
    linha("Segmento", profile?.segmento),
    linha("Site", profile?.site),
    linha("Quem decide", profile?.responsavelNome),
    linha("Equipe da agência neste cliente", input.team.map((member) => member.name).join(", ")),
  ]));

  fonte("Contratos", input.contracts.map((contract) => juntar([
    `Contrato "${contract.title}" (${CONTRACT_TEMPLATES.find((item) => item.id === contract.templateId)?.label || "modelo próprio"}, ${CONTRACT_STATUSES.find((item) => item.value === contract.status)?.label || contract.status})`,
    ...CAMPOS_DO_CONTRATO.map(([chave, rotulo]) => linha(rotulo, contract.fields[chave])),
  ])).join("\n\n"));

  fonte("Planos", input.plans.map((plan) => `- ${plan.title} (${PLAN_KINDS.find((item) => item.value === plan.kind)?.label || plan.kind}), criado em ${plan.createdAt.slice(0, 10)}`).join("\n"));

  const rotuloDaTag = new Map(input.tags.map((tag) => [tag.id, tag.label]));
  const tarefas = [...input.tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, MAX_TAREFAS);
  fonte("Tarefas e conteúdos produzidos", tarefas.map((task) => {
    const tags = [...task.formatTagIds, ...task.channelTagIds].map((id) => rotuloDaTag.get(id)).filter(Boolean).join(", ");
    const descricao = task.description?.replace(/\s+/g, " ").trim().slice(0, MAX_CHARS_DESCRICAO);
    return juntar([
      `- ${task.name} (${TASK_STATUSES.find((item) => item.value === task.status)?.label || task.status}${task.dueDate ? `, prazo ${task.dueDate}` : ""}${tags ? `, ${tags}` : ""})`,
      descricao ? `  ${descricao}` : "",
    ]);
  }).join("\n"));

  fonte("Pesquisas respondidas pelo cliente", input.surveys.filter((survey) => survey.responses.length).map((survey) => {
    const pergunta = new Map(survey.questions.map((question) => [question.id, question.title]));
    const respostas = survey.responses.map((response) => juntar([
      `Resposta de ${response.respondentName || "cliente"} em ${response.createdAt.slice(0, 10)}`,
      ...response.answers.map((answer) => {
        const valor = Array.isArray(answer.value) ? answer.value.join(", ") : String(answer.value ?? "");
        return valor.trim() ? `- ${pergunta.get(answer.questionId) || "Pergunta"}: ${valor}` : "";
      }),
    ]));
    return `Pesquisa "${survey.title}"\n\n${respostas.join("\n\n")}`;
  }).join("\n\n"));

  return fontes;
}

/** Só o cadastro não sustenta um guia: sem contrato, plano, tarefa ou pesquisa
 * a IA teria o nome do cliente e mais nada. */
export function temMaterialDoSistema(fontes: GuideSource[]): boolean {
  return fontes.some((fonte) => fonte.title !== "Cadastro do cliente");
}
