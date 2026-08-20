export type AssigneeSource = "manual" | "captacao" | undefined;

export function inheritsCaptureEditor(assigneeId: string | undefined, source: AssigneeSource): boolean {
  return source === "captacao" || (!assigneeId && source !== "manual");
}
