"use client";

import { Check, CheckCheck, Circle, CircleDashed, CirclePlay, Clock, Eye, Loader, PenLine, Send, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { STATUS_ICON, readableTextOn, type StatusIconName } from "@/lib/status-visual";
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

const LABEL_BY_STATUS = new Map(TASK_STATUSES.map((status) => [status.value, status.label]));

export function statusColorMap(colors: StatusColor[]): Map<TaskStatus, string> {
  return new Map(colors.map((entry) => [entry.status, entry.color]));
}

// A tag inteira é pintada com a cor da etapa e o texto sai na cor que tiver
// contraste contra ela. É o que faz a cor escolhida no seletor aparecer de
// verdade — antes ela vivia só numa bolinha de 7px.
//
// Atrasada NÃO aparece aqui: passar do prazo não muda em que etapa a tarefa
// está. O aviso de atraso mora na coluna de entrega (ver DueDateValue).
export function StatusTag({
  status,
  colorByStatus,
  size = 11,
  className = "",
}: {
  status: TaskStatus;
  colorByStatus: Map<TaskStatus, string>;
  size?: number;
  className?: string;
}) {
  const background = colorByStatus.get(status) || "#aeb5ae";
  const color = readableTextOn(background);
  const Icon = ICONS[STATUS_ICON[status]] ?? Circle;
  const label = LABEL_BY_STATUS.get(status) || status;

  return (
    <span className={`status-tag ${className}`.trim()} style={{ background, color }} title={label}>
      <Icon size={size} strokeWidth={2.4} />
      <span>{label}</span>
    </span>
  );
}
