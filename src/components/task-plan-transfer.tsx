"use client";

import { useState } from "react";
import { isPlanClosed, planDisplayName } from "@/lib/plan-month";
import { networkError, responseError } from "@/lib/request-error";
import type { Plan, Task } from "@/lib/types";

export function TaskPlanTransfer({ task, plans, onMoved }: { task: Task; plans: Plan[]; onMoved: (task: Task) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const targets = plans.filter(p => p.projectId === task.projectId && p.id !== task.planId && !isPlanClosed(p) && (p.kind === "content" || p.kind === "process"));
  if (!targets.length) return null;
  async function transfer(planId: string) {
    if (!planId || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId }) });
      if (!response.ok) return setError(await responseError(response, "trocar o plano"));
      onMoved((await response.json()).task);
    } catch { setError(networkError("trocar o plano")); }
    finally { setBusy(false); }
  }
  return <div onClick={event => event.stopPropagation()}>
    <select className="vz-select vz-select--sm" aria-label={`Trocar plano de ${task.name}`} value="" disabled={busy} onChange={event => transfer(event.target.value)}>
      <option value="">{busy ? "Transferindo…" : "Trocar plano…"}</option>
      {targets.map(p => <option key={p.id} value={p.id}>{planDisplayName(p)}</option>)}
    </select>{error ? <p role="alert">{error}</p> : null}
  </div>;
}
