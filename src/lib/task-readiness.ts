import { type TagKind, type TaskKind, type TaskStatus } from "./types";

// A mesma regra precisa valer nos dois lugares: no aviso que o time vê dentro
// da tarefa e na contagem que o gestor vê no dashboard. Duplicar a regra em
// dois arquivos garantiria que um dia o painel cobrasse uma coisa e a tarefa
// outra — por isso as duas telas leem daqui.

// Do momento em que a demanda entra na fila criativa até sair para aprovação,
// o link é o material: antes é a referência para quem cria, depois é o arquivo
// que o cliente precisa abrir. Sem ele a etapa seguinte trava.
const NEEDS_LINK = new Set<TaskStatus>(["pronto_para_criacao", "em_criacao", "revisao", "ajuste", "para_aprovacao"]);

export type TaskGapType = "link" | "responsavel" | "prazo" | "formato" | "canal";

export type TaskGap = {
  type: TaskGapType;
  /** Rótulo curto, para tabelas e cards do painel. */
  label: string;
  /** Instrução para quem está com a tarefa na mão. */
  message: string;
  /** Crítico = a etapa atual já depende dessa informação para avançar. */
  critical: boolean;
};

export type TaskReadinessInput = {
  status: TaskStatus;
  kind: TaskKind;
  driveLink?: string | null;
  assigneeId?: string | null;
  dueDate?: string | null;
  formatTagIds: string[];
  channelTagIds: string[];
};

function hasTagOfKind(ids: string[], kind: TagKind, tagKinds: Map<string, TagKind>): boolean {
  // Quando o catálogo não foi carregado, qualquer id marcado já conta: é
  // melhor deixar de avisar do que acusar falta de formato numa tarefa que tem.
  if (!tagKinds.size) return ids.length > 0;
  return ids.some((id) => tagKinds.get(id) === kind);
}

export function findTaskGaps(task: TaskReadinessInput, tags: { id: string; kind: TagKind }[] = []): TaskGap[] {
  if (task.status === "finalizado") return [];
  const tagKinds = new Map(tags.map((tag) => [tag.id, tag.kind]));
  const gaps: TaskGap[] = [];

  if (NEEDS_LINK.has(task.status) && !task.driveLink?.trim()) {
    const atApproval = task.status === "para_aprovacao";
    gaps.push({
      type: "link",
      label: "Sem link do material",
      message: atApproval
        ? "Cole o link do material antes de deixar em Para aprovação, porque quem aprova precisa abrir o arquivo."
        : "Cole o link do material para quem for criar encontrar a referência sem precisar perguntar.",
      critical: atApproval,
    });
  }
  if (!task.assigneeId) {
    gaps.push({
      type: "responsavel",
      label: "Sem responsável",
      message: "Escolha um responsável, senão a tarefa não entra na carteira de ninguém e ninguém é cobrado por ela.",
      critical: false,
    });
  }
  if (!task.dueDate) {
    gaps.push({
      type: "prazo",
      label: "Sem data de entrega",
      message: "Defina a data de entrega, senão a tarefa fica de fora do controle de atraso do time.",
      critical: false,
    });
  }
  if (task.kind === "conteudo" && !hasTagOfKind(task.formatTagIds, "formato", tagKinds)) {
    gaps.push({
      type: "formato",
      label: "Sem formato",
      message: "Marque o formato do conteúdo para o material ser medido junto com os do mesmo tipo.",
      critical: false,
    });
  }
  if (task.kind === "conteudo" && !hasTagOfKind(task.channelTagIds, "canal", tagKinds)) {
    gaps.push({
      type: "canal",
      label: "Sem canal",
      message: "Marque o canal de publicação para a tarefa aparecer no planejamento do cliente.",
      critical: false,
    });
  }
  return gaps;
}
