// Os avisos da equipe, do banco até a fila.
//
// Uma vez por dia útil, na hora configurada, o grupo do time recebe o que está
// atrasado (com o responsável), o que está travado por falta de informação
// (por pessoa) e, quando a liderança muda, quem é o mais rápido na criação.
// Tudo entra em whatsapp_messages com kind "team" e sai pela mesma fila
// espaçada dos clientes: janela do dia, intervalo mínimo e parada de
// emergência valem igual.

import { buildDashboardReport } from "../dashboard-metrics";
import { dayRangeInstants, shiftDay } from "../dashboard-period";
import { isoDateInSaoPaulo, overdueDays } from "../dates";
import { listMembers, listProjects, listTags, listTasks } from "../storage";
import { getSupabase } from "../supabase-client";
import { TASK_STATUSES, type TaskKind, type TaskStatus } from "../types";
import { getAutomationSettings } from "./queue";
import { whatsappConfigured } from "./provider";
import { RANKING_DAYS, composeFastestNotice, composeMissingInfoDigest, composeOverdueDigest, missingInfo, speedRanking, type InfoGroup, type OverdueItem } from "./team-notices";

function unwrap<T>(result: { data: unknown; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export type TeamNotice = { type: "overdue" | "info" | "fastest"; title: string; body: string; dedupeKey: string };

type OpenTask = {
  id: string; project_id: string; name: string; kind: TaskKind | null; status: TaskStatus; due_date: string | null; assignee_id: string | null;
  drive_link: string | null; format_tag_ids: string[] | null; channel_tag_ids: string[] | null; description: string | null; plan_id: string | null;
};

async function openTasks(): Promise<OpenTask[]> {
  const rows: OpenTask[] = [];
  for (let offset = 0; ; offset += 1000) {
    const page = unwrap<OpenTask[]>(await getSupabase().from("tasks")
      .select("id, project_id, name, kind, status, due_date, assignee_id, drive_link, format_tag_ids, channel_tag_ids, description, plan_id")
      .not("status", "in", "(finalizado,problema)").order("id").range(offset, offset + 999));
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

const STATUS_LABEL = new Map(TASK_STATUSES.map(({ value, label }) => [value, label]));
const tasksLink = () => {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  return base ? `${base}/tarefas` : undefined;
};

/** Quem liderava da última vez que o aviso saiu. O id do líder vai na chave da
 * mensagem, então o histórico da fila é a memória: não precisa de outra tabela. */
async function previousLeader(): Promise<string | undefined> {
  const rows = unwrap<{ dedupe_key: string | null }[]>(await getSupabase().from("whatsapp_messages").select("dedupe_key")
    .eq("kind", "team").like("dedupe_key", "team:fastest:%").in("status", ["sent", "pending"]).order("created_at", { ascending: false }).limit(1));
  return rows[0]?.dedupe_key?.split(":")[2];
}

/** Os avisos que sairiam agora. `always` devolve o do mais rápido mesmo sem
 * troca de liderança: é o que a prévia e o envio manual mostram. */
export async function buildTeamNotices(now = new Date(), options: { always?: boolean } = {}): Promise<TeamNotice[]> {
  const { team } = await getAutomationSettings();
  const today = isoDateInSaoPaulo(now);
  const db = getSupabase();
  const [tasks, projects, members, plans, access] = await Promise.all([
    openTasks(), listProjects(), listMembers(),
    db.from("plans").select("id, kind").then((result) => unwrap<{ id: string; kind: string }[]>(result)),
    db.from("project_access").select("project_id, member_id").then((result) => unwrap<{ project_id: string; member_id: string }[]>(result)),
  ]);
  const projectName = new Map(projects.map((project) => [project.id, project.name]));
  const memberById = new Map(members.filter((member) => member.active).map((member) => [member.id, member]));
  const contentPlans = new Set(plans.filter((plan) => plan.kind === "content").map((plan) => plan.id));
  const link = tasksLink();
  const notices: TeamNotice[] = [];

  if (team.overdue) {
    const items: OverdueItem[] = tasks.flatMap((task) => {
      const lateDays = overdueDays(task.due_date || undefined, task.status, today);
      return lateDays > 0 ? [{
        name: task.name, projectName: projectName.get(task.project_id) || "Projeto removido", lateDays,
        statusLabel: STATUS_LABEL.get(task.status) || task.status, assigneeName: task.assignee_id ? memberById.get(task.assignee_id)?.name : undefined,
      }] : [];
    });
    const body = composeOverdueDigest(items, link);
    if (body) notices.push({ type: "overdue", title: "Demandas atrasadas", body, dedupeKey: `team:overdue:${today}` });
  }

  if (team.missingInfo) {
    // Informação é de quem planeja. Se a tarefa está com alguém da criação,
    // quem resolve é o social media do cliente, e não quem está criando.
    const plannerOf = (projectId: string) => access.filter((row) => row.project_id === projectId).map((row) => memberById.get(row.member_id)).find((member) => member?.role === "social_media");
    const groups = new Map<string, InfoGroup>();
    for (const task of tasks) {
      const missing = missingInfo({
        status: task.status, kind: task.kind ?? "tarefa", planContent: Boolean(task.plan_id && contentPlans.has(task.plan_id)), description: task.description,
        driveLink: task.drive_link, assigneeId: task.assignee_id, dueDate: task.due_date, formatTagIds: task.format_tag_ids ?? [], channelTagIds: task.channel_tag_ids ?? [],
      });
      if (!missing.length) continue;
      const assignee = task.assignee_id ? memberById.get(task.assignee_id) : undefined;
      const owner = assignee && assignee.role !== "diretor_criativo" ? assignee : plannerOf(task.project_id);
      const group = groups.get(owner?.id ?? "") ?? { person: owner?.name, items: [] };
      group.items.push({ name: task.name, projectName: projectName.get(task.project_id) || "Projeto removido", missing });
      groups.set(owner?.id ?? "", group);
    }
    const body = composeMissingInfoDigest([...groups.values()], link);
    if (body) notices.push({ type: "info", title: "Demandas sem informação", body, dedupeKey: `team:info:${today}` });
  }

  if (team.fastest) {
    const [history, tags] = await Promise.all([listTasks({ all: true, projection: "production" }), listTags()]);
    const { metrics } = buildDashboardReport({
      tasks: history, projects, members, tags, nowIso: now.toISOString(),
      window: dayRangeInstants({ from: shiftDay(today, -(RANKING_DAYS - 1)), to: today }),
    });
    const ranking = speedRanking(metrics.members.filter((member) => member.area === "criacao").map((member) => ({
      memberId: member.memberId, name: member.name, averageMs: member.creativeAverageMs, deliveries: member.creativeDeliveries,
    })));
    const body = composeFastestNotice(ranking, options.always ? undefined : await previousLeader());
    if (body && ranking[0]) notices.push({ type: "fastest", title: "O mais rápido da equipe", body, dedupeKey: `team:fastest:${ranking[0].memberId}:${today}` });
  }
  return notices;
}

async function enqueue(groupId: string, notices: TeamNotice[], suffix = ""): Promise<number> {
  if (!notices.length) return 0;
  const inserted = unwrap<{ id: string }[]>(await getSupabase().from("whatsapp_messages").upsert(notices.map((notice) => ({
    id: crypto.randomUUID(), project_id: null, kind: "team", group_id: groupId, body: notice.body,
    dedupe_key: `${notice.dedupeKey}${suffix}`, status: "pending", scheduled_at: new Date().toISOString(),
  })), { onConflict: "dedupe_key", ignoreDuplicates: true }).select("id"));
  return inserted.length;
}

/** A rotina do dia. Rodar de novo no mesmo dia não repete nada: a chave de
 * cada aviso leva a data, e o banco recusa a segunda tentativa. */
export async function runDailyTeamRoutine(now = new Date()): Promise<number> {
  if (!whatsappConfigured()) return 0;
  const automation = await getAutomationSettings();
  if (automation.paused || !automation.team.enabled || !automation.team.groupId) return 0;
  return enqueue(automation.team.groupId, await buildTeamNotices(now));
}

/** O que impede o envio e pode ser dito a quem está na tela. */
export class TeamNoticeError extends Error {}

/** "Enviar agora": coloca na fila os avisos do momento, mesmo que os de hoje
 * já tenham saído. */
export async function sendTeamNoticesNow(now = new Date()): Promise<number> {
  if (!whatsappConfigured()) throw new TeamNoticeError("O WhatsApp ainda não está configurado no servidor.");
  const automation = await getAutomationSettings();
  if (automation.paused) throw new TeamNoticeError("Os envios do WhatsApp estão pausados pela parada de emergência.");
  if (!automation.team.groupId) throw new TeamNoticeError("Escolha e salve o grupo da equipe antes de enviar.");
  return enqueue(automation.team.groupId, await buildTeamNotices(now, { always: true }), `:manual-${now.getTime()}`);
}
