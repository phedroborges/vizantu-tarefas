// O que roda sozinho: a fila de envio, os lembretes de aprovação, a aprovação
// por prazo e os comunicados para vários clientes.
//
// Tudo passa pela tabela whatsapp_messages. Uma mensagem só sai depois de ser
// "tomada" por um UPDATE que troca pending por sent — é isso que garante que
// ela vai uma vez só, mesmo que duas varreduras coincidam ou que o servidor
// reinicie no meio. Se o envio falhar depois de tomada, ela fica como failed e
// não é repetida: mandar de menos é melhor do que mandar em dobro num grupo de
// cliente.

import { AUTO_APPROVAL_REVIEWER } from "../approval-workflow";
import { isoDateInSaoPaulo } from "../dates";
import { horaEmSaoPaulo } from "../overdue-scheduler";
import { submitPlanApprovalResponse } from "../storage";
import { getSupabase } from "../supabase-client";
import type { StatusHistoryEntry, TaskStatus } from "../types";
import { composeMessage, insideSendWindow, isBusinessDay, nextGapMs, planBroadcast, reminderStep, shuffled, startDeadlineClock } from "./messages";
import { sendWhatsappMedia, sendWhatsappText, whatsappConfigured, type WhatsappMedia } from "./provider";
import { getAutomationSettings, listProjectCommunications, queueApprovalNotice, type ProjectCommunication } from "./queue";

const DAY = 86_400_000;

type MessageRow = {
  id: string; project_id: string | null; broadcast_id: string | null; kind: string; group_id: string; body: string | null;
  media_url: string | null; media_type: string | null; dedupe_key: string | null; status: string; error: string | null;
  scheduled_at: string; sent_at: string | null; created_at: string;
};

function unwrap<T>(result: { data: unknown; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

// ---------- O que cada cliente tem para aprovar ----------

type Waiting = { taskId: string; name: string; stage: "text" | "creative"; since: number; format?: string };

/** Conteúdos de plano parados com o cliente, por projeto. */
export async function pendingApprovalsByProject(): Promise<Map<string, Waiting[]>> {
  const db = getSupabase();
  const rows = unwrap<{ id: string; project_id: string; name: string; status: TaskStatus; drive_link: string | null; format_tag_ids: string[] | null; status_history: StatusHistoryEntry[] | null; updated_at: string }[]>(
    await db.from("tasks").select("id, project_id, name, status, drive_link, format_tag_ids, status_history, updated_at").not("plan_id", "is", null).in("status", ["aprovacao_copy", "para_aprovacao"]),
  );
  // O formato vai na frente do nome na mensagem: "Carrossel - Como começar".
  const formatIds = [...new Set(rows.flatMap((row) => row.format_tag_ids ?? []))];
  const formats = new Map(formatIds.length ? unwrap<{ id: string; label: string }[]>(await db.from("tags").select("id, label").eq("kind", "formato").in("id", formatIds)).map((tag): [string, string] => [tag.id, tag.label]) : []);
  const byProject = new Map<string, Waiting[]>();
  for (const row of rows) {
    // Criativo sem link do material não tem o que o cliente revisar.
    if (row.status === "para_aprovacao" && !row.drive_link?.trim()) continue;
    const entered = (row.status_history ?? []).filter((entry) => entry.status === row.status).map((entry) => new Date(entry.enteredAt).getTime()).filter(Number.isFinite);
    const since = entered.length ? Math.max(...entered) : new Date(row.updated_at).getTime();
    const format = (row.format_tag_ids ?? []).map((id) => formats.get(id)).find(Boolean);
    byProject.set(row.project_id, [...(byProject.get(row.project_id) || []), { taskId: row.id, name: row.name, stage: row.status === "para_aprovacao" ? "creative" : "text", since, format }]);
  }
  return byProject;
}

async function clientName(projectId: string): Promise<string | undefined> {
  const project = unwrap<{ name: string; client: string | null } | null>(await getSupabase().from("projects").select("name, client").eq("id", projectId).maybeSingle());
  return project?.client?.trim() || project?.name;
}

/** O endereço do portal daquele cliente. Sem link ativo não há para onde
 * mandar a pessoa, então nenhuma mensagem de aprovação sai. */
export async function clientPortalLink(projectId: string): Promise<string | undefined> {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (!base) return undefined;
  const links = unwrap<{ token: string; expires_at: string | null }[]>(
    await getSupabase().from("client_links").select("token, expires_at").eq("project_id", projectId).is("revoked_at", null).order("created_at", { ascending: false }),
  );
  const active = links.find((link) => !link.expires_at || new Date(link.expires_at).getTime() > Date.now());
  return active ? `${base}/c/${active.token}` : undefined;
}

/** Quando este cliente foi avisado de que tinha material para aprovar. */
async function noticeTimes(projectId: string): Promise<number[]> {
  const rows = unwrap<{ sent_at: string | null }[]>(
    await getSupabase().from("whatsapp_messages").select("sent_at").eq("project_id", projectId).eq("status", "sent").in("kind", ["approval", "reminder", "last_day"]),
  );
  return rows.flatMap((row) => row.sent_at ? [new Date(row.sent_at).getTime()] : []);
}

// ---------- Fila ----------

async function enqueue(message: { projectId: string; kind: string; groupId: string; body: string; dedupeKey: string }): Promise<boolean> {
  const inserted = unwrap<{ id: string }[]>(await getSupabase().from("whatsapp_messages").upsert({
    id: crypto.randomUUID(), project_id: message.projectId, kind: message.kind, group_id: message.groupId, body: message.body,
    dedupe_key: message.dedupeKey, status: "pending", scheduled_at: new Date().toISOString(),
  }, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("id"));
  return inserted.length > 0;
}

async function finish(id: string, patch: Partial<Pick<MessageRow, "status" | "error" | "body" | "dedupe_key">>): Promise<void> {
  unwrap(await getSupabase().from("whatsapp_messages").update(patch).eq("id", id));
}

async function deliver(row: MessageRow): Promise<void> {
  let body = row.body ?? "";
  if (row.kind === "approval" && row.project_id) {
    // O texto é montado na hora de enviar: conta o que está pendente agora,
    // não o que estava quando a primeira tarefa entrou em aprovação.
    const freeKey = `approval:${row.project_id}:${row.id}`;
    const automation = await getAutomationSettings();
    if (!automation.enabled) return finish(row.id, { status: "skipped", error: "Avisos automáticos desligados.", dedupe_key: freeKey });
    const waiting = (await pendingApprovalsByProject()).get(row.project_id) || [];
    const link = await clientPortalLink(row.project_id);
    if (!waiting.length) return finish(row.id, { status: "skipped", error: "Nada pendente na hora do envio.", dedupe_key: freeKey });
    if (!link) return finish(row.id, { status: "skipped", error: "Cliente sem link de aprovação ativo.", dedupe_key: freeKey });
    const days = (await listProjectCommunications()).find((item) => item.projectId === row.project_id)?.approvalDeadlineDays ?? 7;
    // Esta mensagem já conta como aviso: para o que ainda não tinha sido
    // avisado, o prazo começa agora.
    const { notified } = startDeadlineClock(waiting, await noticeTimes(row.project_id));
    const clock = notified.length ? Math.min(...notified.map((item) => item.since)) : Date.now();
    body = composeMessage("approval", automation, {
      items: waiting, link, clientName: await clientName(row.project_id), deadlineDays: days,
      deadlineIso: new Date(clock + days * DAY).toISOString(), daysLeft: Math.max(0, days - Math.floor((Date.now() - clock) / DAY)),
    });
    // Libera a chave para o próximo aviso deste cliente.
    await finish(row.id, { body, dedupe_key: freeKey });
  }
  const media: WhatsappMedia | undefined = row.media_url && (row.media_type === "image" || row.media_type === "video" || row.media_type === "document") ? { url: row.media_url, type: row.media_type } : undefined;
  if (media) await sendWhatsappMedia(row.group_id, media, body);
  else await sendWhatsappText(row.group_id, body);
}

// Lembrete escrito de manhã não pode sair de noite, nem no dia seguinte, com
// "faltam 3 dias" já errado. O que ficou tempo demais na fila é descartado.
const STALE_MS = 20 * 3_600_000;
let nextSendAt = 0;

/** Envia a próxima mensagem da fila, se já passou o intervalo desde a última.
 * Uma por vez, espaçadas: é uma conta de WhatsApp comum, não um canal de
 * disparo, e várias mensagens seguidas para grupos diferentes dão bloqueio. */
export async function processOutbox(): Promise<number> {
  if (!whatsappConfigured()) return 0;
  const automation = await getAutomationSettings();
  if (automation.paused) return 0;
  const db = getSupabase();
  const now = Date.now();
  unwrap(await db.from("whatsapp_messages").update({ status: "skipped", error: "Ficou tempo demais na fila." }).eq("status", "pending").in("kind", ["reminder", "last_day", "auto_approved"]).lt("scheduled_at", new Date(now - STALE_MS).toISOString()));

  if (now < nextSendAt) return 0;
  // Depois de reiniciar o servidor a memória do último envio se perde: o
  // banco diz quando foi, e o intervalo mínimo continua valendo.
  const last = unwrap<{ sent_at: string | null }[]>(await db.from("whatsapp_messages").select("sent_at").eq("status", "sent").order("sent_at", { ascending: false }).limit(1))[0];
  if (last?.sent_at && now - new Date(last.sent_at).getTime() < automation.minGapMinutes * 60_000) return 0;

  // Comunicado é decisão de quem enviou e sai na hora combinada; aviso
  // automático respeita a janela do dia.
  const windowOpen = insideSendWindow(new Date(now), automation);
  const due = unwrap<{ id: string; kind: string }[]>(await db.from("whatsapp_messages").select("id, kind").eq("status", "pending").lte("scheduled_at", new Date(now).toISOString()).order("scheduled_at").limit(20));
  const next = due.find((message) => message.kind === "broadcast" || windowOpen);
  if (!next) return 0;
  const claimed = unwrap<MessageRow[]>(await db.from("whatsapp_messages").update({ status: "sent", sent_at: new Date(now).toISOString() }).eq("id", next.id).eq("status", "pending").select());
  if (!claimed.length) return 0;
  nextSendAt = now + nextGapMs(automation.minGapMinutes);
  try {
    await deliver(claimed[0]);
    return 1;
  } catch (error) {
    await finish(next.id, { status: "failed", error: error instanceof Error ? error.message.slice(0, 500) : "Falha no envio." }).catch(() => {});
    return 0;
  }
}

/** Quantas mensagens estão esperando para sair. */
export async function countPendingMessages(): Promise<number> {
  const { count, error } = await getSupabase().from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("status", "pending");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// ---------- Lembretes e prazo ----------

async function autoApprove(projectId: string, overdue: Waiting[]): Promise<number> {
  const approvals = unwrap<{ task_id: string; review_version: number }[]>(
    await getSupabase().from("plan_item_approvals").select("task_id, review_version").in("task_id", overdue.map((item) => item.taskId)),
  );
  const versionByTask = new Map(approvals.map((approval) => [approval.task_id, approval.review_version]));
  let approved = 0;
  for (const item of overdue) {
    try {
      await submitPlanApprovalResponse({ projectId, taskId: item.taskId, reviewerName: AUTO_APPROVAL_REVIEWER, status: "approved", reviewVersion: versionByTask.get(item.taskId) });
      approved += 1;
    } catch (error) {
      console.error("[whatsapp] aprovação por prazo não aplicada:", item.taskId, error);
    }
  }
  return approved;
}

/** A rotina de uma vez por dia: aprova o que venceu depois do aviso de último
 * dia e manda o lembrete do dia para quem ainda deve resposta. */
export async function runDailyApprovalRoutine(now = new Date()): Promise<void> {
  if (!whatsappConfigured()) return;
  const automation = await getAutomationSettings();
  if (automation.paused || !automation.enabled || (automation.weekdaysOnly && !isBusinessDay(now)) || horaEmSaoPaulo(now) < automation.sendHour) return;
  const today = isoDateInSaoPaulo(now);
  const pending = await pendingApprovalsByProject();
  const settingsByProject = new Map((await listProjectCommunications()).map((item): [string, ProjectCommunication] => [item.projectId, item]));
  // Ordem sorteada a cada dia; o espaçamento entre os envios é da fila.
  for (const [projectId, waiting] of shuffled([...pending])) {
    const settings = settingsByProject.get(projectId);
    if (!settings?.whatsappGroupId || !settings.notifyEnabled) continue;
    const link = await clientPortalLink(projectId);
    if (!link) continue;
    const deadlineDays = settings.approvalDeadlineDays;
    const deadlineMs = deadlineDays * DAY;

    // O relógio do prazo é o do primeiro aviso recebido. O que nunca foi
    // avisado gera o aviso de material novo e só começa a contar a partir dele.
    const { notified, unnotified } = startDeadlineClock(waiting, await noticeTimes(projectId));
    if (unnotified.length) await queueApprovalNotice(projectId);
    if (!notified.length) continue;
    const name = await clientName(projectId);

    // Só vence o que o cliente foi avisado: precisa existir um aviso de último
    // dia enviado há pelo menos um dia, e o conteúdo já tinha que estar com ele
    // quando o aviso saiu.
    const lastDay = unwrap<{ sent_at: string }[]>(await getSupabase().from("whatsapp_messages").select("sent_at").eq("project_id", projectId).eq("kind", "last_day").eq("status", "sent").order("sent_at", { ascending: false }).limit(1))[0];
    const warnedAt = lastDay ? new Date(lastDay.sent_at).getTime() : undefined;
    if (warnedAt !== undefined && now.getTime() - warnedAt >= 20 * 3_600_000) {
      const overdue = notified.filter((item) => item.since < warnedAt && now.getTime() - item.since >= deadlineMs);
      if (overdue.length) {
        const approved = await autoApprove(projectId, overdue);
        if (approved) await enqueue({ projectId, kind: "auto_approved", groupId: settings.whatsappGroupId, body: composeMessage("auto_approved", automation, { items: [], link, clientName: name, deadlineDays, approvedCount: approved }), dedupeKey: `auto:${projectId}:${today}` });
        continue;
      }
    }

    const oldest = notified.reduce((first, item) => item.since < first.since ? item : first);
    const daysWaiting = Math.floor((now.getTime() - oldest.since) / DAY);
    const step = reminderStep(daysWaiting, deadlineDays, automation.reminderEveryDays);
    if (!step) continue;
    const body = composeMessage(step, automation, { items: waiting, link, clientName: name, deadlineDays, deadlineIso: new Date(oldest.since + deadlineMs).toISOString(), daysLeft: deadlineDays - daysWaiting });
    await enqueue({ projectId, kind: step, groupId: settings.whatsappGroupId, body, dedupeKey: step === "last_day" ? `last_day:${projectId}:${oldest.taskId}:${oldest.since}` : `reminder:${projectId}:${today}` });
  }
}

// ---------- Comunicados ----------

export type Broadcast = {
  id: string; title: string; variations: string[]; mediaUrl?: string; mediaType?: WhatsappMedia["type"]; intervalSeconds: number;
  status: "sending" | "done" | "cancelled"; createdAt: string;
  deliveries: { projectId: string; status: string; scheduledAt: string; sentAt?: string; error?: string }[];
};

/** O que impede um comunicado de sair e pode ser dito a quem está na tela. */
export class BroadcastError extends Error {}

export async function createBroadcast(input: { title: string; variations: string[]; media?: WhatsappMedia; projectIds: string[]; intervalSeconds: number; createdBy?: string }): Promise<{ id: string; queued: number; withoutGroup: string[] }> {
  if (!whatsappConfigured()) throw new BroadcastError("O WhatsApp ainda não está configurado no servidor.");
  if ((await getAutomationSettings()).paused) throw new BroadcastError("Os envios do WhatsApp estão pausados pela parada de emergência.");
  const variations = input.variations.map((text) => text.trim()).filter(Boolean);
  if (!variations.length && !input.media) throw new BroadcastError("Escreva a mensagem ou anexe uma mídia.");
  const settings = new Map((await listProjectCommunications()).map((item): [string, ProjectCommunication] => [item.projectId, item]));
  const targets = input.projectIds.filter((id) => settings.get(id)?.whatsappGroupId);
  const withoutGroup = input.projectIds.filter((id) => !settings.get(id)?.whatsappGroupId);
  if (!targets.length) throw new BroadcastError("Nenhum dos clientes escolhidos tem grupo de WhatsApp configurado.");
  const db = getSupabase();
  const id = crypto.randomUUID();
  const intervalSeconds = Math.min(3600, Math.max(20, Math.round(input.intervalSeconds) || 90));
  unwrap(await db.from("whatsapp_broadcasts").insert({
    id, title: input.title.trim() || "Comunicado", variations, media_url: input.media?.url || null, media_type: input.media?.type || null,
    project_ids: targets, interval_seconds: intervalSeconds, status: "sending", created_by: input.createdBy || null,
  }));
  const plan = planBroadcast(targets, variations.length ? variations : [""], intervalSeconds, Date.now());
  unwrap(await db.from("whatsapp_messages").insert(plan.map((entry) => ({
    id: crypto.randomUUID(), project_id: entry.target, broadcast_id: id, kind: "broadcast", group_id: settings.get(entry.target)!.whatsappGroupId!,
    body: entry.body, media_url: input.media?.url || null, media_type: input.media?.type || null,
    dedupe_key: `broadcast:${id}:${entry.target}`, status: "pending", scheduled_at: entry.scheduledAt,
  }))));
  return { id, queued: targets.length, withoutGroup };
}

export async function listBroadcasts(limit = 20): Promise<Broadcast[]> {
  const db = getSupabase();
  const rows = unwrap<{ id: string; title: string; variations: string[]; media_url: string | null; media_type: WhatsappMedia["type"] | null; interval_seconds: number; status: Broadcast["status"]; created_at: string }[]>(
    await db.from("whatsapp_broadcasts").select("*").order("created_at", { ascending: false }).limit(limit),
  );
  if (!rows.length) return [];
  const messages = unwrap<MessageRow[]>(await db.from("whatsapp_messages").select("*").in("broadcast_id", rows.map((row) => row.id)).order("scheduled_at"));
  return rows.map((row) => {
    const deliveries = messages.filter((message) => message.broadcast_id === row.id).map((message) => ({
      projectId: message.project_id || "", status: message.status, scheduledAt: message.scheduled_at, sentAt: message.sent_at || undefined, error: message.error || undefined,
    }));
    // "Enviando" só enquanto ainda há o que sair.
    const status = row.status === "sending" && deliveries.every((delivery) => delivery.status !== "pending") ? "done" : row.status;
    return { id: row.id, title: row.title, variations: row.variations, mediaUrl: row.media_url || undefined, mediaType: row.media_type || undefined, intervalSeconds: row.interval_seconds, status, createdAt: row.created_at, deliveries };
  });
}

export async function cancelBroadcast(id: string): Promise<number> {
  const db = getSupabase();
  const stopped = unwrap<{ id: string }[]>(await db.from("whatsapp_messages").update({ status: "skipped", error: "Comunicado cancelado." }).eq("broadcast_id", id).eq("status", "pending").select("id"));
  unwrap(await db.from("whatsapp_broadcasts").update({ status: "cancelled" }).eq("id", id));
  return stopped.length;
}

// ---------- Agendamento ----------

let running: Promise<void> | undefined;
let lastDailyRun = "";

async function tick(): Promise<void> {
  if (!whatsappConfigured()) return;
  const now = new Date();
  const today = isoDateInSaoPaulo(now);
  // A hora e os dias vêm da configuração, então são lidos a cada volta: ligar
  // os avisos ou mudar o horário vale sem reiniciar o servidor.
  if (lastDailyRun !== today) {
    const automation = await getAutomationSettings().catch(() => undefined);
    if (automation?.enabled && !automation.paused && (!automation.weekdaysOnly || isBusinessDay(now)) && horaEmSaoPaulo(now) >= automation.sendHour) {
      lastDailyRun = today;
      await runDailyApprovalRoutine(now).catch((error) => console.error("[whatsapp] rotina diária falhou:", error));
    }
  }
  await processOutbox().catch((error) => console.error("[whatsapp] fila falhou:", error));
}

let scheduled = false;
export function agendarWhatsapp(): void {
  if (scheduled) return;
  scheduled = true;
  const run = () => { if (!running) running = tick().finally(() => { running = undefined; }); };
  run();
  setInterval(run, 60_000).unref?.();
}
