"use client";

import { ChevronDown, Clock3 } from "lucide-react";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDuration, summarizeStatusDurations } from "@/lib/dates";
import { STATUS_GROUPS, TASK_STATUSES, type StatusHistoryEntry, type TaskStatus } from "@/lib/types";

// Base UI's <Select.Value> só resolve o rótulo se o Root receber esse mapa —
// sem isso ele exibe o value bruto (ex.: "em_criacao") em vez do label.
const STATUS_LABELS: Record<string, string> = Object.fromEntries(TASK_STATUSES.map((status) => [status.value, status.label]));

export function TaskStatusControl({
  status,
  statusHistory,
  onChange,
}: {
  status: TaskStatus;
  statusHistory: StatusHistoryEntry[];
  onChange: (next: TaskStatus) => void;
}) {
  const [showTiming, setShowTiming] = useState(false);
  // Uma tarefa nova ainda não tem histórico — não faz sentido mostrar tempo
  // de um status que ainda nem começou a contar.
  const hasHistory = statusHistory.length > 0;

  const visitedDurations = useMemo(() => {
    if (!hasHistory) return [];
    const summary = summarizeStatusDurations(statusHistory);
    const byStatus = new Map(summary.map((entry) => [entry.status, entry]));
    return TASK_STATUSES.filter((def) => byStatus.has(def.value)).map((def) => ({ def, entry: byStatus.get(def.value)! }));
  }, [statusHistory, hasHistory]);

  const currentEntry = hasHistory ? visitedDurations.find(({ def }) => def.value === status)?.entry : undefined;

  return (
    <div className="meta-row">
      <span className="meta-row-label">Status</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <Select items={STATUS_LABELS} value={status} onValueChange={(value) => onChange(value as TaskStatus)}>
          <SelectTrigger className="meta-trigger">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_GROUPS.map((group) => (
              <SelectGroup key={group.value}>
                <SelectLabel>{group.label}</SelectLabel>
                {TASK_STATUSES.filter((item) => item.group === group.value).map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        {currentEntry ? (
          <span style={{ color: "var(--muted-text)", fontSize: 10.5 }}>há {formatDuration(currentEntry.totalMs)}</span>
        ) : null}
        {hasHistory ? (
          <button type="button" className="status-timing-toggle" onClick={() => setShowTiming((current) => !current)} style={{ marginTop: 0 }}>
            <Clock3 size={10} />
            Tempo por status
            <ChevronDown size={10} style={{ transform: showTiming ? "rotate(180deg)" : undefined }} />
          </button>
        ) : null}
      </div>
      {showTiming && hasHistory ? (
        <div className="status-timing" style={{ gridColumn: "1 / -1" }}>
          <ul className="status-timing-list">
            {visitedDurations.map(({ def, entry }) => (
              <li key={def.value} className={`status-timing-row ${def.value === status ? "current" : ""}`}>
                <span>{def.label}</span>
                <span className="status-timing-value">{formatDuration(entry.totalMs)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
