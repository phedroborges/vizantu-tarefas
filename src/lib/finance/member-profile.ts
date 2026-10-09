import { overdueDays } from "../dates";
import { TASK_STATUSES, type Member, type Task, type TaskStatus, type UserRole } from "../types";
import { compensationFor, monthAdd, productionLines, type ProductionLine } from "./calculations";
import { RATE_LABELS, type CompensationRule, type FinanceData, type RateKey } from "./types";

// O financeiro de UMA pessoa: o que ela produziu, quanto isso vale e o que
// está travando o trabalho dela. É a aba "Produção da equipe" do dono recortada
// para um responsável — a regra de cálculo é a mesma, de propósito: o número
// que a pessoa vê aqui tem que bater com o que o dono vê lá.
//
// Tudo é montado no servidor e só o resultado desta pessoa vai para a tela.
// Nada de receita, margem ou ganho de colega passa por aqui.

export type MemberFinanceSituation = "lancada" | "a_lancar" | "salario" | "sem_valor" | "cancelada";

export type MemberFinanceLine = {
  taskId: string;
  name: string;
  projectName: string;
  format: string | null;
  status: TaskStatus;
  deliveredDate: string;
  /** Centavos. `null` quando a demanda não gera valor por peça. */
  amount: number | null;
  situation: MemberFinanceSituation;
  note: string | null;
};

export type MemberFinanceTotals = {
  /** Ganho por demanda: o que já foi lançado mais o que ainda falta lançar. */
  earnings: number;
  launched: number;
  pending: number;
  /** Tarefas aprovadas ou finalizadas no período. */
  deliveries: number;
  /** Entregas que não geraram valor por falta de formato reconhecido. */
  unpriced: number;
};

export type MemberFinanceAttention = {
  key: string;
  tone: "red" | "amber" | "blue";
  title: string;
  detail: string;
  tasks: { id: string; name: string; projectName: string; meta?: string }[];
};

export type MemberFinanceProfile = {
  member: { id: string; name: string; role: UserRole; avatarUrl?: string | null };
  /** Como a pessoa é remunerada no fim do período (ou hoje). */
  paymentMode: CompensationRule["mode"];
  salary: number;
  totals: MemberFinanceTotals;
  /** Os mesmos totais no período anterior, quando há comparação. */
  previous?: MemberFinanceTotals;
  byFormat: { label: string; count: number; total: number }[];
  lines: MemberFinanceLine[];
  /** Tarefas com a pessoa que ainda não foram aprovadas. */
  inProgress: number;
  attention: MemberFinanceAttention[];
  /** Os últimos seis meses, do mais antigo para o atual. */
  history: { month: string; earnings: number; deliveries: number }[];
  /** Tabela de valores por formato; vazia para quem não recebe por demanda. */
  rates: { label: string; unit: number; pack: number | null }[];
};

type DayRange = { from: string; to: string };
type Source = Pick<FinanceData, "tasks" | "tags" | "settings" | "members" | "entries" | "projects">;

const STATUS_LABEL = new Map(TASK_STATUSES.map(({ value, label }) => [value, label]));
const UNRECOGNIZED = "Formato não reconhecido: corrija o formato da tarefa para ela gerar valor.";

export function buildMemberFinance({ data, memberId, range, previous, today }: {
  data: Source;
  memberId: string;
  /** Dias de calendário, inclusive. Sem período, entra o histórico inteiro. */
  range?: DayRange;
  previous?: DayRange;
  today: string;
}): MemberFinanceProfile | null {
  const member = data.members.find((candidate) => candidate.id === memberId);
  if (!member) return null;
  const projectNames = new Map(data.projects.map((project) => [project.id, project.name]));
  const projectName = (id: string) => projectNames.get(id) || "Projeto removido";
  // O preço de pacote depende do grupo inteiro, então as linhas são calculadas
  // com todas as tarefas e só depois recortadas para a pessoa.
  const own = productionLines(data.tasks, data.tags, data.settings, data.members).filter((line) => line.memberId === memberId);
  const delivered = own.filter((line): line is ProductionLine & { deliveredDate: string } => line.counted && Boolean(line.deliveredDate));
  const entryByTask = new Map(data.entries.filter((entry) => entry.sourceKey?.startsWith("production:")).map((entry) => [entry.sourceKey!.slice("production:".length), entry]));
  const modeIn = (month: string) => compensationFor(data.settings, member, month);

  const describe = (line: ProductionLine & { deliveredDate: string }): MemberFinanceLine => {
    const base = {
      taskId: line.taskId, name: line.name, projectName: projectName(line.projectId),
      format: line.rateKey ? RATE_LABELS[line.rateKey] : null, status: line.taskStatus ?? "aprovado", deliveredDate: line.deliveredDate,
    };
    const pay = modeIn(line.deliveredDate.slice(0, 7));
    if (pay.mode === "salary") return { ...base, amount: null, situation: "salario", note: "Incluída no salário fixo do mês." };
    if (!line.ready || line.producerId !== memberId) {
      return { ...base, amount: null, situation: "sem_valor", note: pay.mode === "none" ? "Sem remuneração por demanda configurada." : line.rateKey ? line.pendencia : UNRECOGNIZED };
    }
    const entry = entryByTask.get(line.taskId);
    if (entry?.cancelled) return { ...base, amount: null, situation: "cancelada", note: "Lançamento cancelado pelo financeiro." };
    if (entry) return { ...base, amount: entry.amount, situation: "lancada", note: null };
    return { ...base, amount: line.total, situation: "a_lancar", note: line.penalty ? "50% pela regra de prazo." : null };
  };

  const within = (range?: DayRange) => (range ? delivered.filter((line) => line.deliveredDate >= range.from && line.deliveredDate <= range.to) : delivered).map(describe);
  const totalsOf = (lines: MemberFinanceLine[]): MemberFinanceTotals => {
    const launched = lines.filter((line) => line.situation === "lancada").reduce((sum, line) => sum + (line.amount ?? 0), 0);
    const pending = lines.filter((line) => line.situation === "a_lancar").reduce((sum, line) => sum + (line.amount ?? 0), 0);
    return {
      earnings: launched + pending, launched, pending, deliveries: lines.length,
      unpriced: lines.filter((line) => line.situation === "sem_valor" && modeIn(line.deliveredDate.slice(0, 7)).mode === "demand").length,
    };
  };

  const lines = within(range).sort((a, b) => b.deliveredDate.localeCompare(a.deliveredDate) || a.name.localeCompare(b.name, "pt-BR"));
  const formats = new Map<string, { count: number; total: number }>();
  for (const line of lines) {
    if (line.amount === null || !line.format) continue;
    const current = formats.get(line.format) ?? { count: 0, total: 0 };
    formats.set(line.format, { count: current.count + 1, total: current.total + line.amount });
  }

  const currentMonth = today.slice(0, 7);
  const pay = modeIn((range?.to ?? today).slice(0, 7));
  const history = Array.from({ length: 6 }, (_, index) => {
    const month = monthAdd(`${currentMonth}-01`, index - 5).slice(0, 7);
    const ofMonth = totalsOf(delivered.filter((line) => line.deliveredDate.startsWith(month)).map(describe));
    const monthly = modeIn(month);
    return { month, earnings: ofMonth.earnings + (monthly.mode === "salary" ? monthly.salary : 0), deliveries: ofMonth.deliveries };
  });

  return {
    member: { id: member.id, name: member.name, role: member.role, avatarUrl: member.avatarUrl },
    paymentMode: pay.mode,
    salary: pay.mode === "salary" ? pay.salary : 0,
    totals: totalsOf(lines),
    previous: previous ? totalsOf(within(previous)) : undefined,
    byFormat: [...formats].map(([label, values]) => ({ label, ...values })).sort((a, b) => b.total - a.total),
    lines,
    inProgress: own.filter((line) => !line.counted && line.taskStatus !== "problema" && line.taskStatus !== "aprovado" && line.taskStatus !== "finalizado").length,
    attention: attentionPoints(data.tasks.filter((task) => task.assigneeId === memberId), own, member, projectName, today),
    history,
    rates: pay.mode === "demand" ? (Object.keys(data.settings.rates) as RateKey[]).map((key) => ({ label: RATE_LABELS[key], ...data.settings.rates[key] })) : [],
  };
}

// Pontos de atenção são sempre o estado de AGORA, e não do período filtrado:
// uma tarefa atrasada hoje precisa aparecer mesmo com o filtro em "mês passado".
function attentionPoints(tasks: Task[], lines: ProductionLine[], member: Member, projectName: (id: string) => string, today: string): MemberFinanceAttention[] {
  const row = (task: { id: string; name: string; projectId: string }, meta?: string) => ({ id: task.id, name: task.name, projectName: projectName(task.projectId), meta });
  const points: MemberFinanceAttention[] = [];
  const add = (point: MemberFinanceAttention) => { if (point.tasks.length) points.push(point); };
  const days = (count: number) => `${count} ${count === 1 ? "dia" : "dias"}`;

  const overdue = tasks.map((task) => ({ task, late: overdueDays(task.dueDate, task.status, today) })).filter(({ late }) => late > 0).sort((a, b) => b.late - a.late);
  add({ key: "atrasadas", tone: "red", title: "Tarefas atrasadas", detail: "Passaram do prazo e ainda não foram enviadas para aprovação.", tasks: overdue.map(({ task, late }) => row(task, `há ${days(late)} · ${STATUS_LABEL.get(task.status)}`)) });

  add({ key: "ajuste", tone: "amber", title: "Em ajuste", detail: "Voltaram para ajuste e estão com você. Enquanto não forem aprovadas, não entram no seu financeiro.", tasks: tasks.filter((task) => task.status === "ajuste").map((task) => row(task)) });

  const overdueIds = new Set(overdue.map(({ task }) => task.id));
  const byLine = new Map(lines.map((line) => [line.taskId, line]));
  add({
    key: "producao", tone: "amber", title: "Criação além do prazo de produção", detail: "Estão em criação há mais tempo que o prazo combinado para produzir.",
    tasks: tasks.filter((task) => byLine.get(task.id)?.late && !overdueIds.has(task.id)).map((task) => row(task)),
  });

  if (member.role === "diretor_criativo") {
    add({ key: "fila", tone: "blue", title: "Prontas esperando você começar", detail: "Já têm tudo para a criação e ainda não foram iniciadas.", tasks: tasks.filter((task) => task.status === "pronto_para_criacao").map((task) => row(task)) });
  }

  add({
    key: "sem_valor", tone: "blue", title: "Entregas sem valor calculado", detail: "Foram aprovadas, mas o formato da tarefa não foi reconhecido e por isso não geram pagamento. Peça para corrigirem o formato.",
    tasks: lines.filter((line) => line.counted && line.producerId === member.id && !line.rateKey && line.pendencia?.includes("formato")).map((line) => row({ id: line.taskId, name: line.name, projectId: line.projectId })),
  });

  add({
    key: "sem_data", tone: "blue", title: "Aprovadas sem data registrada", detail: "Estão aprovadas ou finalizadas, mas sem o registro de quando isso aconteceu, então não entraram em nenhum mês. Avise o financeiro.",
    tasks: lines.filter((line) => (line.taskStatus === "aprovado" || line.taskStatus === "finalizado") && !line.deliveredDate).map((line) => row({ id: line.taskId, name: line.name, projectId: line.projectId })),
  });
  return points;
}
