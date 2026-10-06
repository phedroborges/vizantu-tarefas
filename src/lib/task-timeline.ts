import type { Comment, TaskActivityEvent } from "./types";

// O que conta a história da tarefa para quem bate o olho: mudou de etapa,
// mudou de mão, mudou de prazo. Todo o resto (texto, tags, link) continua
// registrado e restaurável no histórico completo, mas na linha do tempo vira
// um grupo recolhido — uma descrição salva a cada pausa de digitação
// soterrava as três coisas que importam.
export const KEY_ACTIVITY_FIELDS = new Set(["created", "status", "assigneeId", "dueDate"]);

export function isKeyActivity(event: Pick<TaskActivityEvent, "fieldKey">): boolean {
  return KEY_ACTIVITY_FIELDS.has(event.fieldKey);
}

export type TimelineItem =
  | { kind: "comment"; id: string; createdAt: string; comment: Comment }
  | { kind: "event"; id: string; createdAt: string; event: TaskActivityEvent }
  | { kind: "minor"; id: string; createdAt: string; events: TaskActivityEvent[] };

/** Linha do tempo da mais recente para a mais antiga. Edições menores
 * seguidas, sem um comentário ou uma mudança importante entre elas, viram um
 * grupo só. */
export function buildTimeline(activity: TaskActivityEvent[], comments: Comment[]): TimelineItem[] {
  const entries = [
    ...activity.map((event) => ({ at: new Date(event.createdAt).getTime(), event, comment: undefined })),
    ...comments.map((comment) => ({ at: new Date(comment.createdAt).getTime(), event: undefined, comment })),
  ].toSorted((a, b) => b.at - a.at);
  const items: TimelineItem[] = [];
  for (const entry of entries) {
    if (entry.comment) {
      items.push({ kind: "comment", id: `comment-${entry.comment.id}`, createdAt: entry.comment.createdAt, comment: entry.comment });
    } else if (isKeyActivity(entry.event)) {
      items.push({ kind: "event", id: `activity-${entry.event.id}`, createdAt: entry.event.createdAt, event: entry.event });
    } else {
      const last = items.at(-1);
      if (last?.kind === "minor") last.events.push(entry.event);
      else items.push({ kind: "minor", id: `minor-${entry.event.id}`, createdAt: entry.event.createdAt, events: [entry.event] });
    }
  }
  return items;
}

/** A mudança não alterou nada além de espaços e quebras de linha. */
export function isWhitespaceOnlyChange(event: Pick<TaskActivityEvent, "oldValue" | "newValue">): boolean {
  if (typeof event.oldValue !== "string" && typeof event.newValue !== "string") return false;
  const squeeze = (value: unknown) => (typeof value === "string" ? value.replace(/\s+/g, "") : "");
  return squeeze(event.oldValue) === squeeze(event.newValue);
}

// Campos de texto e escolha única voltam como string vazia quando o valor
// antigo era "nenhum": é assim que o PATCH da tarefa entende "limpar".
const RESTORABLE_TEXT = new Set(["name", "description", "dueDate", "driveLink", "captacaoId"]);
const RESTORABLE_LISTS = new Set(["formatTagIds", "channelTagIds", "categoryTagIds"]);
const RESTORABLE_AS_IS = new Set(["status", "kind", "projectId"]);

/** O corpo do PATCH que devolve o campo ao valor que ele tinha ANTES desta
 * mudança. `null` quando o registro não guarda o bastante para restaurar
 * (imagens gravam só a contagem; criação não tem "antes"). */
export function restorePayload(event: Pick<TaskActivityEvent, "fieldKey" | "oldValue">): Record<string, unknown> | null {
  const { fieldKey, oldValue } = event;
  if (RESTORABLE_TEXT.has(fieldKey)) {
    // Uma tarefa sem nome não salva: não há o que restaurar.
    if (fieldKey === "name" && (typeof oldValue !== "string" || !oldValue.trim())) return null;
    return { [fieldKey]: typeof oldValue === "string" ? oldValue : "" };
  }
  if (RESTORABLE_LISTS.has(fieldKey)) return Array.isArray(oldValue) ? { [fieldKey]: oldValue } : null;
  if (RESTORABLE_AS_IS.has(fieldKey)) return typeof oldValue === "string" && oldValue ? { [fieldKey]: oldValue } : null;
  if (fieldKey === "assigneeId") return { assigneeId: typeof oldValue === "string" && oldValue ? oldValue : null };
  if (fieldKey === "seasonal") return typeof oldValue === "boolean" ? { seasonal: oldValue } : null;
  return null;
}
