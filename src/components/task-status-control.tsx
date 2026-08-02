"use client";

import { ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { useMemo } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDuration, summarizeStatusDurations } from "@/lib/dates";
import { STATUS_GROUPS, TASK_STATUSES, type StatusHistoryEntry, type TaskStatus } from "@/lib/types";

const FLAT_STATUSES = TASK_STATUSES.map((status) => status.value);
// Base UI's <Select.Value> só resolve o rótulo se o Root receber esse mapa —
// sem isso ele exibe o value bruto (ex.: "em_criacao") em vez do label.
const STATUS_LABELS: Record<string, string> = Object.fromEntries(TASK_STATUSES.map((status) => [status.value, status.label]));

function step(current: TaskStatus, delta: 1 | -1): TaskStatus | null {
  const index = FLAT_STATUSES.indexOf(current);
  const next = index + delta;
  return next >= 0 && next < FLAT_STATUSES.length ? FLAT_STATUSES[next] : null;
}

export function TaskStatusControl({
  status,
  statusHistory,
  onChange,
}: {
  status: TaskStatus;
  statusHistory: StatusHistoryEntry[];
  onChange: (next: TaskStatus) => void;
}) {
  const previous = step(status, -1);
  const next = step(status, 1);

  const durations = useMemo(() => {
    const summary = summarizeStatusDurations(statusHistory);
    const byStatus = new Map(summary.map((entry) => [entry.status, entry]));
    return TASK_STATUSES.map((def) => ({ def, entry: byStatus.get(def.value) }));
  }, [statusHistory]);

  return (
    <div className="field">
      <label htmlFor="task-status-select">Status</label>
      <div className="status-control">
        <button
          type="button"
          className="icon-button"
          disabled={!previous}
          onClick={() => previous && onChange(previous)}
          aria-label="Voltar status"
        >
          <ChevronLeft size={15} />
        </button>
        <Select items={STATUS_LABELS} value={status} onValueChange={(value) => onChange(value as TaskStatus)}>
          <SelectTrigger id="task-status-select" className="status-select-trigger">
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
        <button
          type="button"
          className="icon-button"
          disabled={!next}
          onClick={() => next && onChange(next)}
          aria-label="Avançar status"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="status-timing">
        <span className="eyebrow" style={{ marginBottom: 6 }}>
          <Clock3 size={11} style={{ display: "inline", marginRight: 4, verticalAlign: -2 }} />
          Tempo em cada status
        </span>
        <ul className="status-timing-list">
          {durations.map(({ def, entry }) => {
            const isCurrent = def.value === status;
            return (
              <li key={def.value} className={`status-timing-row ${isCurrent ? "current" : ""}`}>
                <span>{def.label}</span>
                <span className="status-timing-value">
                  {entry ? formatDuration(entry.totalMs) : "—"}
                  {isCurrent ? (
                    <Tooltip>
                      <TooltipTrigger render={<span className="status-timing-live" />}>
                        <Clock3 size={10} />
                      </TooltipTrigger>
                      <TooltipContent>Status atual — ainda contando.</TooltipContent>
                    </Tooltip>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
