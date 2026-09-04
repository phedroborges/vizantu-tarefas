"use client";

import { TriangleAlert } from "lucide-react";
import { stageProgress } from "@/lib/status-visual";
import { TASK_STATUSES, type StatusColor, type TaskStatus } from "@/lib/types";

const LABEL_BY_STATUS = new Map(TASK_STATUSES.map((status) => [status.value, status.label]));

export function statusColorMap(colors: StatusColor[]): Map<TaskStatus, string> {
  return new Map(colors.map((entry) => [entry.status, entry.color]));
}

// Anel de progresso da esteira. Desenhado com stroke-dasharray sobre um círculo
// girado -90°, então 0% começa no topo e não às 3 horas.
function Ring({ value, size }: { value: number; size: number }) {
  const stroke = 2.4;
  const raio = (size - stroke) / 2;
  const volta = 2 * Math.PI * raio;
  return (
    <svg className="status-tag__ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={raio} fill="none" strokeWidth={stroke} stroke="currentColor" opacity="0.24" />
        <circle
          cx={size / 2} cy={size / 2} r={raio} fill="none" strokeWidth={stroke} strokeLinecap="round" stroke="currentColor"
          strokeDasharray={volta}
          strokeDashoffset={volta * (1 - Math.min(1, Math.max(0, value / 100)))}
        />
      </g>
    </svg>
  );
}

// A cor escolhida no seletor é a TINTA da tag, e o fundo é derivado dela como
// um tinte claro (ver .status-tag no globals.css). Antes ela pintava a tag
// inteira de sólido: com doze etapas na mesma tela a lista virava um vitral e
// o olho não conseguia eleger o que importa. Continua sendo a mesma cor
// customizável — o que mudou é o papel que ela exerce.
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
  const cor = colorByStatus.get(status) || "#6b7280";
  const label = LABEL_BY_STATUS.get(status) || status;
  const progresso = stageProgress(TASK_STATUSES, status);

  return (
    <span
      className={`status-tag ${className}`.trim()}
      style={{ "--status-color": cor } as React.CSSProperties}
      title={progresso === null ? label : `${label} — ${progresso}% da esteira`}
    >
      {progresso === null
        ? <TriangleAlert size={size + 2} strokeWidth={2.4} />
        : <Ring value={progresso} size={size + 3} />}
      <span>{label}</span>
    </span>
  );
}
