// Linha do tempo do cliente: para onde ele quer ir e como isso muda.
//
// Não é um plano formal nem um contrato de metas. É o registro do que o cliente
// busca — o sonho, o objetivo de cada período, o número que ele quer ver, o que
// aconteceu no caminho — com a data em que foi dito e o período em que vale.
// Serve para alinhar expectativa: a equipe e os agentes olham e sabem o que vale
// agora e o que é para depois.
//
// Dois tempos convivem aqui e não se misturam: quando foi dito (saidOn) e para
// quando vale (startsOn/endsOn). Uma meta de março dita em novembro é do
// "próximo trimestre", não de agora.
//
// Nada se apaga quando o cliente muda de ideia: o item antigo vira "substituído"
// e aponta para o novo. É isso que deixa a mudança visível.

export const TIMELINE_KINDS = [
  { value: "sonho", label: "Sonho", hint: "Onde ele quer chegar, mesmo sem prazo." },
  { value: "objetivo", label: "Objetivo", hint: "O que ele busca num período." },
  { value: "meta", label: "Meta", hint: "Um número que ele quer ver." },
  { value: "marco", label: "Marco", hint: "Algo que aconteceu ou vai acontecer: lançamento, mudança, evento." },
] as const;

export const TIMELINE_STATUSES = [
  { value: "vigente", label: "Vigente" },
  { value: "alcancado", label: "Alcançado" },
  { value: "substituido", label: "Substituído" },
  { value: "abandonado", label: "Abandonado" },
] as const;

export type TimelineKind = (typeof TIMELINE_KINDS)[number]["value"];
export type TimelineStatus = (typeof TIMELINE_STATUSES)[number]["value"];

export type TimelineItem = {
  id: string;
  projectId: string;
  kind: TimelineKind;
  title: string;
  detail: string;
  /** Quando passa a valer (AAAA-MM-DD). Vazio = desde já ou sem prazo. */
  startsOn?: string;
  /** Até quando vale (AAAA-MM-DD). Vazio = sem fim definido. */
  endsOn?: string;
  /** Quando o cliente disse (AAAA-MM-DD). */
  saidOn?: string;
  status: TimelineStatus;
  /** O item que tomou o lugar deste, quando ele foi substituído. */
  replacedById?: string;
  /** Fonte do guia de onde veio (reunião, anotação), se houver. */
  sourceId?: string;
  /** De onde veio, em texto: "Reunião de alinhamento 23/11", "dito pelo Phedro". */
  sourceLabel?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
};

export type Horizonte = "agora" | "proximos_3_meses" | "6_meses" | "1_ano" | "mais_adiante" | "sem_prazo" | "historico";

export const HORIZONTES: { value: Horizonte; titulo: string; resumo: string }[] = [
  { value: "sem_prazo", titulo: "Sem prazo", resumo: "O norte: onde ele quer chegar." },
  { value: "agora", titulo: "Agora", resumo: "O que vale hoje. É por aqui que a equipe trabalha." },
  { value: "proximos_3_meses", titulo: "Próximos 3 meses", resumo: "Começa em até 3 meses." },
  { value: "6_meses", titulo: "Em 6 meses", resumo: "Começa entre 3 e 6 meses." },
  { value: "1_ano", titulo: "Em 1 ano", resumo: "Começa entre 6 meses e 1 ano." },
  { value: "mais_adiante", titulo: "Mais adiante", resumo: "Começa daqui a mais de 1 ano." },
  { value: "historico", titulo: "O que já passou", resumo: "Alcançado, substituído, abandonado ou com prazo vencido." },
];

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Meses inteiros entre duas datas AAAA-MM-DD (b depois de a dá positivo). */
function mesesEntre(a: string, b: string): number {
  return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7)));
}

/** Em que horizonte o item está, olhando para hoje (AAAA-MM-DD). */
export function horizonteDe(item: Pick<TimelineItem, "kind" | "status" | "startsOn" | "endsOn">, hoje: string): Horizonte {
  if (item.status !== "vigente") return "historico";
  if (item.endsOn && item.endsOn < hoje) return "historico";
  // Marco é um acontecimento: depois que a data passou, ele é história.
  if (item.kind === "marco" && item.startsOn && item.startsOn < hoje && !item.endsOn) return "historico";
  if (!item.startsOn && !item.endsOn) return "sem_prazo";
  if (!item.startsOn || item.startsOn <= hoje) return "agora";
  const meses = mesesEntre(hoje, item.startsOn);
  if (meses <= 3) return "proximos_3_meses";
  if (meses <= 6) return "6_meses";
  if (meses <= 12) return "1_ano";
  return "mais_adiante";
}

const ORDEM_DO_TIPO: Record<TimelineKind, number> = { sonho: 0, objetivo: 1, meta: 2, marco: 3 };

/** Os itens agrupados por horizonte, na ordem da tela; grupos vazios ficam de fora.
 * Dentro de cada grupo: o que começa antes primeiro; no histórico, o mais recente. */
export function organizar(itens: TimelineItem[], hoje: string): { horizonte: Horizonte; titulo: string; resumo: string; itens: TimelineItem[] }[] {
  return HORIZONTES.map(({ value, titulo, resumo }) => {
    const doGrupo = itens.filter((item) => horizonteDe(item, hoje) === value);
    doGrupo.sort((a, b) => {
      if (value === "historico") return (b.endsOn || b.updatedAt).localeCompare(a.endsOn || a.updatedAt);
      return (a.startsOn || "").localeCompare(b.startsOn || "") || ORDEM_DO_TIPO[a.kind] - ORDEM_DO_TIPO[b.kind] || a.createdAt.localeCompare(b.createdAt);
    });
    return { horizonte: value, titulo, resumo, itens: doGrupo };
  }).filter((grupo) => grupo.itens.length);
}

/** Quando o item acontece no caminho: o início, ou o fim se só houver fim. Sem nenhum dos dois, não tem lugar no caminho. */
export const dataNoCaminho = (item: Pick<TimelineItem, "startsOn" | "endsOn">) => item.startsOn || item.endsOn || "";

export type AnoDoCaminho = { ano: number; antesDeHoje: TimelineItem[]; depoisDeHoje: TimelineItem[]; temHoje: boolean };

/** A linha do tempo de verdade: do ano em que o cliente entrou até o futuro, ano a ano,
 * com o "hoje" marcado no ano corrente. O que não tem data (o sonho) é o destino, no fim. */
export function caminhoPorAno(itens: TimelineItem[], hoje: string): { anos: AnoDoCaminho[]; destino: TimelineItem[] } {
  const comData = itens.filter((item) => dataNoCaminho(item));
  const destino = itens.filter((item) => !dataNoCaminho(item)).sort((a, b) => ORDEM_DO_TIPO[a.kind] - ORDEM_DO_TIPO[b.kind] || a.createdAt.localeCompare(b.createdAt));
  const anoHoje = Number(hoje.slice(0, 4));
  if (!comData.length) return { anos: [], destino };
  comData.sort((a, b) => dataNoCaminho(a).localeCompare(dataNoCaminho(b)) || ORDEM_DO_TIPO[a.kind] - ORDEM_DO_TIPO[b.kind]);
  const anosComItem = comData.map((item) => Number(dataNoCaminho(item).slice(0, 4)));
  const primeiro = Math.min(...anosComItem, anoHoje);
  const ultimo = Math.max(...anosComItem, anoHoje);
  const anos: AnoDoCaminho[] = [];
  for (let ano = primeiro; ano <= ultimo; ano++) {
    const doAno = comData.filter((item) => Number(dataNoCaminho(item).slice(0, 4)) === ano);
    anos.push({
      ano,
      antesDeHoje: doAno.filter((item) => dataNoCaminho(item) <= hoje),
      depoisDeHoje: doAno.filter((item) => dataNoCaminho(item) > hoje),
      temHoje: ano === anoHoje,
    });
  }
  return { anos, destino };
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesAno = (data: string) => `${MESES[Number(data.slice(5, 7)) - 1]}/${data.slice(0, 4)}`;
function diaMes(data: string) { return `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`; }

/** O período em português: "nov/2026 a mar/2027", "a partir de jan/2027", "até dez/2026", "sem prazo".
 * Marco é um acontecimento, então leva o dia: "em 05/11/2026". */
export function periodoEmTexto(item: Pick<TimelineItem, "startsOn" | "endsOn"> & { kind?: TimelineKind }): string {
  if (item.kind === "marco" && item.startsOn && !item.endsOn) return `em ${diaMes(item.startsOn)}`;
  if (item.startsOn && item.endsOn) return mesAno(item.startsOn) === mesAno(item.endsOn) ? mesAno(item.startsOn) : `${mesAno(item.startsOn)} a ${mesAno(item.endsOn)}`;
  if (item.startsOn) return `a partir de ${mesAno(item.startsOn)}`;
  if (item.endsOn) return `até ${mesAno(item.endsOn)}`;
  return "sem prazo";
}

export const rotuloDoTipo = (kind: TimelineKind) => TIMELINE_KINDS.find((tipo) => tipo.value === kind)?.label ?? kind;
export const rotuloDaSituacao = (status: TimelineStatus) => TIMELINE_STATUSES.find((s) => s.value === status)?.label ?? status;

/** A linha do tempo em texto corrido, do jeito que a IA lê melhor: por horizonte,
 * cada item com tipo, período, quando foi dito e de onde veio. */
export function linhaDoTempoEmTexto(itens: TimelineItem[], hoje: string): string {
  if (!itens.length) return "";
  const porId = new Map(itens.map((item) => [item.id, item]));
  return organizar(itens, hoje).map((grupo) => {
    const linhas = grupo.itens.map((item) => {
      const partes = [`- ${rotuloDoTipo(item.kind)}: ${item.title}`, `(${periodoEmTexto(item)})`];
      if (item.status !== "vigente") partes.push(`[${rotuloDaSituacao(item.status)}${item.replacedById && porId.get(item.replacedById) ? ` por "${porId.get(item.replacedById)!.title}"` : ""}]`);
      const origem = [item.saidOn ? `dito em ${diaMes(item.saidOn)}` : "", item.sourceLabel || ""].filter(Boolean).join(", ");
      if (origem) partes.push(`— ${origem}`);
      return partes.join(" ") + (item.detail.trim() ? `\n  ${item.detail.trim().replace(/\n+/g, " ")}` : "");
    });
    return `${grupo.titulo}:\n${linhas.join("\n")}`;
  }).join("\n\n");
}

export class TimelineInputError extends Error {}

export type TimelineInput = {
  kind: TimelineKind;
  title: string;
  detail: string;
  startsOn: string | null;
  endsOn: string | null;
  saidOn: string | null;
  status: TimelineStatus;
  sourceId: string | null;
  sourceLabel: string | null;
};

function data(valor: unknown, nome: string): string | null {
  if (valor === undefined || valor === null || valor === "") return null;
  if (typeof valor !== "string" || !DATA.test(valor) || Number.isNaN(Date.parse(valor))) throw new TimelineInputError(`${nome} precisa estar no formato AAAA-MM-DD.`);
  return valor;
}

/** Valida o que chega da tela ou de um agente. `parcial` aceita só os campos que vieram (edição). */
export function parseTimelineInput(body: unknown, parcial = false): Partial<TimelineInput> {
  if (!body || typeof body !== "object") throw new TimelineInputError("Pedido inválido.");
  const b = body as Record<string, unknown>;
  const out: Partial<TimelineInput> = {};

  if (b.kind !== undefined || !parcial) {
    if (!TIMELINE_KINDS.some((tipo) => tipo.value === b.kind)) throw new TimelineInputError("Tipo inválido: use sonho, objetivo, meta ou marco.");
    out.kind = b.kind as TimelineKind;
  }
  if (b.title !== undefined || !parcial) {
    if (typeof b.title !== "string" || !b.title.trim()) throw new TimelineInputError("Escreva o que é.");
    out.title = b.title.trim().slice(0, 300);
  }
  if (b.detail !== undefined) {
    if (typeof b.detail !== "string") throw new TimelineInputError("Detalhe inválido.");
    out.detail = b.detail.trim().slice(0, 4000);
  } else if (!parcial) out.detail = "";
  if (b.status !== undefined) {
    if (!TIMELINE_STATUSES.some((s) => s.value === b.status)) throw new TimelineInputError("Situação inválida: use vigente, alcancado, substituido ou abandonado.");
    out.status = b.status as TimelineStatus;
  } else if (!parcial) out.status = "vigente";
  if (b.startsOn !== undefined || !parcial) out.startsOn = data(b.startsOn, "O início");
  if (b.endsOn !== undefined || !parcial) out.endsOn = data(b.endsOn, "O fim");
  if (b.saidOn !== undefined || !parcial) out.saidOn = data(b.saidOn, "A data em que foi dito");
  if (out.startsOn && out.endsOn && out.endsOn < out.startsOn) throw new TimelineInputError("O fim não pode ser antes do início.");
  if (b.sourceId !== undefined || !parcial) out.sourceId = typeof b.sourceId === "string" && b.sourceId.trim() ? b.sourceId.trim() : null;
  if (b.sourceLabel !== undefined || !parcial) out.sourceLabel = typeof b.sourceLabel === "string" && b.sourceLabel.trim() ? b.sourceLabel.trim().slice(0, 200) : null;
  return out;
}
