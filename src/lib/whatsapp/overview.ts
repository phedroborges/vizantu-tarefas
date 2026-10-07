// O retrato da comunicação com os clientes: o que saiu, quem já foi avisado e
// quem ainda falta. É o que a aba "Visão geral" mostra.
//
// A parte que decide a situação de cada cliente é pura (clientState), para
// poder ser testada sem banco.

import { isoDateInSaoPaulo } from "../dates";
import { getSupabase } from "../supabase-client";
import { startDeadlineClock } from "./messages";
import { listProjectCommunications } from "./queue";
import { pendingApprovalsByProject } from "./service";

const DAY = 86_400_000;

export type ClientState = "falta_avisar" | "avisado" | "sem_link" | "avisos_desligados" | "sem_grupo" | "em_dia";

/** Em que pé está a comunicação com um cliente. A ordem das perguntas importa:
 * primeiro o que impede qualquer aviso, depois se há o que avisar. */
export function clientState(input: { hasGroup: boolean; notifyEnabled: boolean; hasLink: boolean; waiting: number; notNotified: number }): ClientState {
  if (!input.hasGroup) return "sem_grupo";
  if (!input.notifyEnabled) return "avisos_desligados";
  if (!input.waiting) return "em_dia";
  if (!input.hasLink) return "sem_link";
  return input.notNotified > 0 ? "falta_avisar" : "avisado";
}

// Quem precisa de atenção aparece primeiro.
const STATE_ORDER: ClientState[] = ["falta_avisar", "sem_link", "avisado", "avisos_desligados", "sem_grupo", "em_dia"];

export type OverviewClient = {
  id: string;
  name: string;
  groupName?: string;
  state: ClientState;
  text: number;
  creative: number;
  /** Conteúdos pendentes que o grupo ainda não recebeu. */
  notNotified: number;
  lastNotice?: { kind: string; at: string };
  /** Quando vence o prazo do conteúdo avisado há mais tempo. */
  deadlineIso?: string;
  daysLeft?: number;
};

export type OverviewMessage = { id: string; projectName: string; kind: string; status: string; at: string; error?: string; body?: string };

export type CommunicationOverview = {
  totals: { sentToday: number; sent7d: number; queued: number; failed7d: number; clients: number; clientsWithGroup: number; clientsWaiting: number; clientsNotNotified: number; contentsWaiting: number };
  daily: { date: string; sent: number; failed: number }[];
  clients: OverviewClient[];
  recent: OverviewMessage[];
};

type MessageRow = { id: string; project_id: string | null; kind: string; status: string; body: string | null; error: string | null; scheduled_at: string; sent_at: string | null; created_at: string };

function unwrap<T>(result: { data: unknown; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export async function communicationOverview(projects: { id: string; name: string }[], now = new Date()): Promise<CommunicationOverview> {
  const db = getSupabase();
  const since = new Date(now.getTime() - 7 * DAY).toISOString();
  const columns = "id, project_id, kind, status, body, error, scheduled_at, sent_at, created_at";
  const [communications, pending, recentMessages, queuedMessages, notices, links] = await Promise.all([
    listProjectCommunications(),
    pendingApprovalsByProject(),
    db.from("whatsapp_messages").select(columns).gte("created_at", since).order("created_at", { ascending: false }).limit(500).then((result) => unwrap<MessageRow[]>(result)),
    // O que está na fila entra mesmo que tenha sido criado há mais de 7 dias.
    db.from("whatsapp_messages").select(columns).eq("status", "pending").lt("created_at", since).then((result) => unwrap<MessageRow[]>(result)),
    // Todos os avisos já enviados, sem limite de data: um conteúdo pode estar
    // esperando há mais de uma semana.
    db.from("whatsapp_messages").select("project_id, kind, sent_at").eq("status", "sent").in("kind", ["approval", "reminder", "last_day"]).then((result) => unwrap<{ project_id: string | null; kind: string; sent_at: string | null }[]>(result)),
    db.from("client_links").select("project_id, revoked_at, expires_at").then((result) => unwrap<{ project_id: string; revoked_at: string | null; expires_at: string | null }[]>(result)),
  ]);

  const messages = [...recentMessages, ...queuedMessages];
  const settings = new Map(communications.map((item) => [item.projectId, item]));
  const withLink = new Set(links.filter((link) => !link.revoked_at && (!link.expires_at || new Date(link.expires_at).getTime() > now.getTime())).map((link) => link.project_id));
  const names = new Map(projects.map((project) => [project.id, project.name]));

  const clients: OverviewClient[] = projects.map((project) => {
    const setting = settings.get(project.id);
    const waiting = pending.get(project.id) || [];
    const sent = notices.filter((notice) => notice.project_id === project.id && notice.sent_at).sort((a, b) => a.sent_at!.localeCompare(b.sent_at!));
    const { notified, unnotified } = startDeadlineClock(waiting, sent.map((notice) => new Date(notice.sent_at!).getTime()));
    const last = sent.at(-1);
    const clock = notified.length ? Math.min(...notified.map((item) => item.since)) : undefined;
    const deadlineMs = clock === undefined ? undefined : clock + (setting?.approvalDeadlineDays ?? 7) * DAY;
    return {
      id: project.id,
      name: project.name,
      groupName: setting?.whatsappGroupId ? setting.whatsappGroupName || setting.whatsappGroupId : undefined,
      state: clientState({ hasGroup: Boolean(setting?.whatsappGroupId), notifyEnabled: setting?.notifyEnabled !== false, hasLink: withLink.has(project.id), waiting: waiting.length, notNotified: unnotified.length }),
      text: waiting.filter((item) => item.stage === "text").length,
      creative: waiting.filter((item) => item.stage === "creative").length,
      notNotified: unnotified.length,
      lastNotice: last ? { kind: last.kind, at: last.sent_at! } : undefined,
      deadlineIso: deadlineMs === undefined ? undefined : new Date(deadlineMs).toISOString(),
      daysLeft: deadlineMs === undefined ? undefined : Math.ceil((deadlineMs - now.getTime()) / DAY),
    };
  }).sort((a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state) || (b.text + b.creative) - (a.text + a.creative) || a.name.localeCompare(b.name, "pt-BR"));

  const today = isoDateInSaoPaulo(now.getTime());
  const days = Array.from({ length: 7 }, (_, index) => isoDateInSaoPaulo(now.getTime() - (6 - index) * DAY));
  const dayOf = (message: MessageRow) => isoDateInSaoPaulo(new Date(message.sent_at || message.created_at).getTime());
  const sentMessages = messages.filter((message) => message.status === "sent");
  const failedMessages = messages.filter((message) => message.status === "failed");

  return {
    totals: {
      sentToday: sentMessages.filter((message) => dayOf(message) === today).length,
      sent7d: sentMessages.filter((message) => days.includes(dayOf(message))).length,
      queued: messages.filter((message) => message.status === "pending").length,
      failed7d: failedMessages.filter((message) => days.includes(dayOf(message))).length,
      clients: clients.length,
      clientsWithGroup: clients.filter((client) => client.groupName).length,
      clientsWaiting: clients.filter((client) => client.text + client.creative > 0).length,
      clientsNotNotified: clients.filter((client) => client.state === "falta_avisar").length,
      contentsWaiting: clients.reduce((sum, client) => sum + client.text + client.creative, 0),
    },
    daily: days.map((date) => ({ date, sent: sentMessages.filter((message) => dayOf(message) === date).length, failed: failedMessages.filter((message) => dayOf(message) === date).length })),
    clients,
    recent: messages.slice(0, 25).map((message) => ({
      id: message.id,
      projectName: (message.project_id && names.get(message.project_id)) || "Cliente removido",
      kind: message.kind,
      status: message.status,
      at: message.sent_at || message.scheduled_at,
      error: message.error || undefined,
      body: message.body || undefined,
    })),
  };
}
