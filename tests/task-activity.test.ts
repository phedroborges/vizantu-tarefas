import { describe, expect, it } from "vitest";
import { activityEventsFromComments, createActivityComments, isUserComment } from "@/lib/task-activity";
import type { Comment } from "@/lib/types";

describe("histórico da tarefa", () => {
  it("cria eventos para cada campo alterado e preserva o autor", () => {
    let id = 0;
    const events = createActivityComments(
      [["status", "rascunho", "em_criacao"], ["description", "antes", "depois"]],
      "member-1",
      "2026-09-07T10:00:00.000Z",
      () => `event-${++id}`,
    );

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      kind: "activity", fieldKey: "status", authorMemberId: "member-1",
      oldValue: "rascunho", newValue: "em_criacao",
    });
  });

  it("separa a conversa e entrega o histórico mais recente primeiro", () => {
    const comments: Comment[] = [
      { id: "comment", author: "Phedro", text: "Comentário normal", createdAt: "2026-09-07T09:00:00.000Z" },
      { id: "old", author: "Sistema", authorMemberId: "member-1", text: "", kind: "activity", fieldKey: "name", oldValue: "A", newValue: "B", createdAt: "2026-09-07T10:00:00.000Z" },
      { id: "new", author: "Sistema", authorMemberId: "member-1", text: "", kind: "activity", fieldKey: "status", oldValue: "rascunho", newValue: "aprovado", createdAt: "2026-09-07T11:00:00.000Z" },
    ];

    expect(comments.filter(isUserComment).map((comment) => comment.id)).toEqual(["comment"]);
    expect(activityEventsFromComments(comments, "task-1", new Map([["member-1", "Phedro"]]))).toEqual([
      expect.objectContaining({ id: "new", actorName: "Phedro", fieldKey: "status" }),
      expect.objectContaining({ id: "old", actorName: "Phedro", fieldKey: "name" }),
    ]);
  });
});
