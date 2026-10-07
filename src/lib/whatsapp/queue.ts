// A configuração de cada cliente e a porta de entrada da fila.
//
// Fica separado do resto do WhatsApp porque é chamado de dentro do storage
// (quando uma tarefa entra em aprovação) e não pode depender dele de volta.

import { getSupabase } from "../supabase-client";
import { normalizeAutomation, type AutomationSettings } from "./messages";
import { whatsappConfigured } from "./provider";

export const DEFAULT_APPROVAL_DEADLINE_DAYS = 7;

// Quando alguém coloca um conteúdo em aprovação, o grupo do cliente é avisado
// em seguida. A espera é só o bastante para dois casos: quem clicou no status
// errado consegue voltar atrás (na hora de enviar, só entra o que ainda está em
// aprovação), e vários conteúdos colocados em sequência viram uma mensagem só.
const DEBOUNCE_MS = 5_000;

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

/** Material esperando o cliente: agenda o aviso no grupo. Nunca lança — falha
 * de aviso não pode impedir a troca de status.
 *
 * "instant" é quando alguém acabou de colocar o conteúdo em aprovação: sai em
 * segundos, sem esperar a fila. "paced" é o aviso atrasado de material que já
 * estava parado quando os avisos foram ligados: vai pela fila, espaçado como
 * os lembretes, porque são vários clientes de uma vez. */
export async function queueApprovalNotice(projectId: string, mode: "instant" | "paced" = "instant"): Promise<void> {
  try {
    if (!whatsappConfigured()) return;
    const automation = await getAutomationSettings();
    if (automation.paused || !automation.enabled) return;
    const settings = await getProjectCommunication(projectId);
    if (!settings.whatsappGroupId || !settings.notifyEnabled) return;
    const db = getSupabase();
    const key = `approval:${projectId}:${mode === "instant" ? "pending" : "catchup"}`;
    const scheduledAt = new Date(Date.now() + (mode === "instant" ? DEBOUNCE_MS : 0)).toISOString();
    const waiting = await db.from("whatsapp_messages").update(mode === "instant" ? { scheduled_at: scheduledAt } : {}).eq("dedupe_key", key).eq("status", "pending").select("id");
    if (!waiting.data?.length) {
      await db.from("whatsapp_messages").upsert({
        id: crypto.randomUUID(), project_id: projectId, kind: "approval", group_id: settings.whatsappGroupId,
        dedupe_key: key, status: "pending", scheduled_at: scheduledAt,
      }, { onConflict: "dedupe_key", ignoreDuplicates: true });
    }
    if (mode === "instant") {
      // Não espera a próxima volta da fila: dispara assim que a espera acaba.
      // (Import dinâmico porque o serviço depende do storage, que depende daqui.)
      setTimeout(() => {
        void import("./service").then((service) => service.processApprovalNotices()).catch((error) => console.error("[whatsapp] aviso de aprovação falhou:", error));
      }, DEBOUNCE_MS + 400).unref?.();
    }
  } catch (error) {
    console.error("[whatsapp] não foi possível agendar o aviso de aprovação:", error);
  }
}
