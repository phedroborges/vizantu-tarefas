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
