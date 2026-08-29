"use client";

import { Check, CheckCheck, Circle, CircleDashed, CirclePlay, Clock, Eye, Loader, PenLine, Send, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { OVERDUE_ICON, STATUS_ICON, readableTextOn, type StatusIconName } from "@/lib/status-visual";
import { TASK_STATUSES, type StatusColor, type TaskStatus } from "@/lib/types";

const ICONS: Record<StatusIconName, LucideIcon> = {
  Circle,
  CircleDashed,
  Clock,
  CirclePlay,
  Loader,
  Eye,
  PenLine,
  Send,
  Check,
  CheckCheck,
  TriangleAlert,
};

// Atrasada é estado sintético (derivado do prazo, não uma etapa escolhida),
// então tem cor própria e nunca é sobrescrita pelo seletor de cores.
const OVERDUE_COLOR = "#c8452c";
const OVERDUE_LABEL = "Atrasada";

const LABEL_BY_STATUS = new Map(TASK_STATUSES.map((status) => [status.value, status.label]));

export function statusColorMap(colors: StatusColor[]): Map<TaskStatus, string> {
  return new Map(colors.map((entry) => [entry.status, entry.color]));
}

// A tag inteira é pintada com a cor da etapa e o texto sai na cor que tiver
// contraste contra ela. É o que faz a cor escolhida no seletor aparecer de
// verdade — antes ela vivia só numa bolinha de 7px.
export function StatusTag({
  status,
  overdue = false,
  colorByStatus,
  size = 11,
  className = "",
}: {
  status: TaskStatus;
  overdue?: boolean;
  colorByStatus: Map<TaskStatus, string>;
  size?: number;
  className?: string;
}) {
  const background = overdue ? OVERDUE_COLOR : colorByStatus.get(status) || "#aeb5ae";
  const color = readableTextOn(background);
  const Icon = ICONS[overdue ? OVERDUE_ICON : STATUS_ICON[status]] ?? Circle;
  const label = overdue ? OVERDUE_LABEL : LABEL_BY_STATUS.get(status) || status;

  return (
    <span className={`status-tag ${className}`.trim()} style={{ background, color }} title={label}>
      <Icon size={size} strokeWidth={2.4} />
      <span>{label}</span>
    </span>
  );
}
