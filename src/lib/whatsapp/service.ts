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
import { approvalMessage, autoApprovedMessage, isBusinessDay, lastDayMessage, planBroadcast, reminderMessage, reminderStep, type PendingApprovals } from "./messages";
import { sendWhatsappMedia, sendWhatsappText, whatsappConfigured, type WhatsappMedia } from "./provider";
import { listProjectCommunications, type ProjectCommunication } from "./queue";

const DAY = 86_400_000;
const HORA_DOS_LEMBRETES = 9;

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

type Waiting = { taskId: string; name: string; stage: "text" | "creative"; since: number };

/** Conteúdos de plano parados com o cliente, por projeto. */
export async function pendingApprovalsByProject(): Promise<Map<string, Waiting[]>> {
  const rows = unwrap<{ id: string; project_id: string; name: string; status: TaskStatus; drive_link: string | null; status_history: StatusHistoryEntry[] | null; updated_at: string }[]>(
    await getSupabase().from("tasks").select("id, project_id, name, status, drive_link, status_history, updated_at").not("plan_id", "is", null).in("status", ["aprovacao_copy", "para_aprovacao"]),
  );
  const byProject = new Map<string, Waiting[]>();
  for (const row of rows) {
    // Criativo sem link do material não tem o que o cliente revisar.
    if (row.status === "para_aprovacao" && !row.drive_link?.trim()) continue;
    const entered = (row.status_history ?? []).filter((entry) => entry.status === row.status).map((entry) => new Date(entry.enteredAt).getTime()).filter(Number.isFinite);
    const since = entered.length ? Math.max(...entered) : new Date(row.updated_at).getTime();
    byProject.set(row.project_id, [...(byProject.get(row.project_id) || []), { taskId: row.id, name: row.name, stage: row.status === "para_aprovacao" ? "creative" : "text", since }]);
  }
  return byProject;
}

function summarize(waiting: Waiting[]): PendingApprovals {
  return {
    text: waiting.filter((item) => item.stage === "text").length,
    creative: waiting.filter((item) => item.stage === "creative").length,
    singleName: waiting.length === 1 ? waiting[0].name : undefined,
  };
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
    const waiting = (await pendingApprovalsByProject()).get(row.project_id) || [];
    const link = await clientPortalLink(row.project_id);
    const freeKey = `approval:${row.project_id}:${row.id}`;
    if (!waiting.length) return finish(row.id, { status: "skipped", error: "Nada pendente na hora do envio.", dedupe_key: freeKey });
    if (!link) return finish(row.id, { status: "skipped", error: "Cliente sem link de aprovação ativo.", dedupe_key: freeKey });
    const settings = (await listProjectCommunications()).find((item) => item.projectId === row.project_id);
    const oldest = Math.min(...waiting.map((item) => item.since));
    body = approvalMessage({ pending: summarize(waiting), link, deadlineIso: new Date(oldest + (settings?.approvalDeadlineDays ?? 7) * DAY).toISOString() });
    // Libera a chave para o próximo aviso deste cliente.
    await finish(row.id, { body, dedupe_key: freeKey });
  }
  const media: WhatsappMedia | undefined = row.media_url && (row.media_type === "image" || row.media_type === "video" || row.media_type === "document") ? { url: row.media_url, type: row.media_type } : undefined;
  if (media) await sendWhatsappMedia(row.group_id, media, body);
  else await sendWhatsappText(row.group_id, body);
}

/** Envia o que está na hora. Poucas por vez: é uma conta de WhatsApp comum,
 * não um canal de disparo. */
export async function processOutbox(limit = 3): Promise<number> {
  if (!whatsappConfigured()) return 0;
  const db = getSupabase();
  const due = unwrap<{ id: string }[]>(await db.from("whatsapp_messages").select("id").eq("status", "pending").lte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(limit));
  let sent = 0;
  for (const { id } of due) {
    const claimed = unwrap<MessageRow[]>(await db.from("whatsapp_messages").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", id).eq("status", "pending").select());
    if (!claimed.length) continue;
    try {
      await deliver(claimed[0]);
      sent += 1;
    } catch (error) {
      await finish(id, { status: "failed", error: error instanceof Error ? error.message.slice(0, 500) : "Falha no envio." }).catch(() => {});
    }
  }
  return sent;
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

/** A rotina de uma vez por dia útil: aprova o que venceu depois do aviso de
 * último dia e manda o lembrete do dia para quem ainda deve resposta. */
export async function runDailyApprovalRoutine(now = new Date()): Promise<void> {
  if (!whatsappConfigured() || !isBusinessDay(now) || horaEmSaoPaulo(now) < HORA_DOS_LEMBRETES) return;
  const today = isoDateInSaoPaulo(now);
  const pending = await pendingApprovalsByProject();
  const settingsByProject = new Map((await listProjectCommunications()).map((item): [string, ProjectCommunication] => [item.projectId, item]));
  for (const [projectId, waiting] of pending) {
    const settings = settingsByProject.get(projectId);
    if (!settings?.whatsappGroupId || !settings.notifyEnabled) continue;
    const link = await clientPortalLink(projectId);
    if (!link) continue;
    const deadlineMs = settings.approvalDeadlineDays * DAY;

    // Só vence o que o cliente foi avisado: precisa existir um aviso de último
    // dia enviado há pelo menos um dia, e o conteúdo já tinha que estar com ele
    // quando o aviso saiu.
    const lastDay = unwrap<{ sent_at: string }[]>(await getSupabase().from("whatsapp_messages").select("sent_at").eq("project_id", projectId).eq("kind", "last_day").eq("status", "sent").order("sent_at", { ascending: false }).limit(1))[0];
    const warnedAt = lastDay ? new Date(lastDay.sent_at).getTime() : undefined;
    if (warnedAt !== undefined && now.getTime() - warnedAt >= 20 * 3_600_000) {
      const overdue = waiting.filter((item) => item.since < warnedAt && now.getTime() - item.since >= deadlineMs);
      if (overdue.length) {
        const approved = await autoApprove(projectId, overdue);
        if (approved) await enqueue({ projectId, kind: "auto_approved", groupId: settings.whatsappGroupId, body: autoApprovedMessage({ count: approved, link }), dedupeKey: `auto:${projectId}:${today}` });
        continue;
      }
    }

    const oldest = waiting.reduce((first, item) => item.since < first.since ? item : first);
    const daysWaiting = Math.floor((now.getTime() - oldest.since) / DAY);
    const step = reminderStep(daysWaiting, settings.approvalDeadlineDays);
    if (step === "last_day") {
      await enqueue({ projectId, kind: "last_day", groupId: settings.whatsappGroupId, body: lastDayMessage({ pending: summarize(waiting), link, deadlineDays: settings.approvalDeadlineDays }), dedupeKey: `last_day:${projectId}:${oldest.taskId}:${oldest.since}` });
    } else if (step === "reminder") {
      await enqueue({ projectId, kind: "reminder", groupId: settings.whatsappGroupId, body: reminderMessage({ pending: summarize(waiting), link, daysLeft: settings.approvalDeadlineDays - daysWaiting }), dedupeKey: `reminder:${projectId}:${today}` });
    }
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
  if (lastDailyRun !== today && isBusinessDay(now) && horaEmSaoPaulo(now) >= HORA_DOS_LEMBRETES) {
    lastDailyRun = today;
    await runDailyApprovalRoutine(now).catch((error) => console.error("[whatsapp] rotina diária falhou:", error));
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
