// A configuração de cada cliente e a porta de entrada da fila.
//
// Fica separado do resto do WhatsApp porque é chamado de dentro do storage
// (quando uma tarefa entra em aprovação) e não pode depender dele de volta.

import { getSupabase } from "../supabase-client";
import { normalizeAutomation, type AutomationSettings } from "./messages";
import { whatsappConfigured } from "./provider";

export const DEFAULT_APPROVAL_DEADLINE_DAYS = 7;

// O aviso nunca sai no instante em que o status muda. Ele espera este tempo
// depois da última tarefa enviada, por dois motivos: quem colocou o status
// errado sem querer tem tempo de voltar atrás (na hora de enviar, só entra o
// que ainda está em aprovação), e enviar 20 conteúdos em sequência vira uma
// mensagem só, em vez de 20.
const DEBOUNCE_MS = 30_000;

export type ProjectCommunication = {
  projectId: string;
  whatsappGroupId?: string;
  whatsappGroupName?: string;
  notifyEnabled: boolean;
  approvalDeadlineDays: number;
};

type Row = { project_id: string; whatsapp_group_id: string | null; whatsapp_group_name: string | null; notify_enabled: boolean; approval_deadline_days: number };

const fromRow = (row: Row): ProjectCommunication => ({
  projectId: row.project_id,
  whatsappGroupId: row.whatsapp_group_id || undefined,
  whatsappGroupName: row.whatsapp_group_name || undefined,
  notifyEnabled: row.notify_enabled,
  approvalDeadlineDays: row.approval_deadline_days,
});

export async function getProjectCommunication(projectId: string): Promise<ProjectCommunication> {
  const { data, error } = await getSupabase().from("project_communication").select("*").eq("project_id", projectId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? fromRow(data as Row) : { projectId, notifyEnabled: true, approvalDeadlineDays: DEFAULT_APPROVAL_DEADLINE_DAYS };
}

export async function listProjectCommunications(): Promise<ProjectCommunication[]> {
  const { data, error } = await getSupabase().from("project_communication").select("*");
  if (error) throw new Error(error.message);
  return (data as Row[]).map(fromRow);
}

export async function saveProjectCommunication(projectId: string, patch: Partial<Omit<ProjectCommunication, "projectId">>): Promise<ProjectCommunication> {
  const current = await getProjectCommunication(projectId);
  const next = { ...current, ...patch };
  const days = Math.round(Number(next.approvalDeadlineDays));
  const { data, error } = await getSupabase().from("project_communication").upsert({
    project_id: projectId,
    whatsapp_group_id: next.whatsappGroupId?.trim() || null,
    whatsapp_group_name: next.whatsappGroupName?.trim() || null,
    notify_enabled: Boolean(next.notifyEnabled),
    approval_deadline_days: Number.isFinite(days) ? Math.min(60, Math.max(1, days)) : DEFAULT_APPROVAL_DEADLINE_DAYS,
    updated_at: new Date().toISOString(),
  }).select().single();
  if (error) throw new Error(error.message);
  return fromRow(data as Row);
}

export async function getAutomationSettings(): Promise<AutomationSettings> {
  const { data, error } = await getSupabase().from("whatsapp_settings").select("settings").eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  return normalizeAutomation((data as { settings: Partial<AutomationSettings> } | null)?.settings);
}

export async function saveAutomationSettings(input: Partial<AutomationSettings>): Promise<AutomationSettings> {
  const settings = normalizeAutomation(input);
  const { error } = await getSupabase().from("whatsapp_settings").upsert({ id: 1, settings, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  return settings;
}

/** Uma tarefa do cliente entrou em aprovação: agenda (ou adia) o aviso no
 * grupo. Nunca lança — falha de aviso não pode impedir a troca de status. */
export async function queueApprovalNotice(projectId: string): Promise<void> {
  try {
    if (!whatsappConfigured()) return;
    const automation = await getAutomationSettings();
    if (automation.paused || !automation.enabled) return;
    const settings = await getProjectCommunication(projectId);
    if (!settings.whatsappGroupId || !settings.notifyEnabled) return;
    const db = getSupabase();
    const key = `approval:${projectId}:pending`;
    const scheduledAt = new Date(Date.now() + DEBOUNCE_MS).toISOString();
    const postponed = await db.from("whatsapp_messages").update({ scheduled_at: scheduledAt }).eq("dedupe_key", key).eq("status", "pending").select("id");
    if (postponed.data?.length) return;
    await db.from("whatsapp_messages").upsert({
      id: crypto.randomUUID(), project_id: projectId, kind: "approval", group_id: settings.whatsappGroupId,
      dedupe_key: key, status: "pending", scheduled_at: scheduledAt,
    }, { onConflict: "dedupe_key", ignoreDuplicates: true });
  } catch (error) {
    console.error("[whatsapp] não foi possível agendar o aviso de aprovação:", error);
  }
}
