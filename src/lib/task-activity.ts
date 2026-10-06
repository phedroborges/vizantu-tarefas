import { isKeyActivity } from "./task-timeline";
import type { Comment, TaskActivityEvent } from "./types";

export type TaskActivityChange = [fieldKey: string, oldValue: unknown, newValue: unknown];

export function isUserComment(comment: Comment): boolean {
  return comment.kind !== "activity";
}

export function createActivityComments(
  changes: TaskActivityChange[],
  actorMemberId: string | undefined,
  createdAt: string,
  createId: () => string,
): Comment[] {
  return changes.map(([fieldKey, oldValue, newValue]) => ({
    id: createId(), author: "Sistema", authorMemberId: actorMemberId, text: "", createdAt,
    kind: "activity", fieldKey, oldValue, newValue,
  }));
}

export function activityEventsFromComments(
  comments: Comment[], taskId: string, actorNames: Map<string, string>, limit = 100,
): TaskActivityEvent[] {
  return comments
    .filter((comment) => comment.kind === "activity" && comment.fieldKey)
    .slice(-limit)
    .reverse()
    .map((event) => ({
      id: event.id, taskId, actorMemberId: event.authorMemberId,
      actorName: event.authorMemberId ? actorNames.get(event.authorMemberId) || "Usuário" : "Sistema",
      fieldKey: event.fieldKey!, oldValue: event.oldValue, newValue: event.newValue, createdAt: event.createdAt,
    }));
}

/** Para a linha do tempo: as mudanças importantes vão inteiras; das edições
 * menores segue só quem, quando e em qual campo. Uma tarefa com centenas de
 * autosaves de descrição deixaria de mandar megabytes a cada abertura. */
export function trimMinorActivity(events: TaskActivityEvent[]): TaskActivityEvent[] {
  return events.map((event) => isKeyActivity(event) ? event : { ...event, oldValue: undefined, newValue: undefined, trimmed: true });
}
