"use client";

import { TriangleAlert } from "lucide-react";
import { formatTaskDate, type DateFormatKey } from "@/lib/date-format";
import { overdueDays } from "@/lib/dates";
import type { TaskStatus } from "@/lib/types";

// Atraso é informação de PRAZO, não de status: quem está atrasada continua
// "Em criação" ou "Aprovação de texto" — só passou da data. Por isso o aviso
// mora aqui, na coluna de entrega, e a tag de status nunca é substituída.
export function DueDateValue({
  dueDate,
  status,
  dateFormat,
}: {
  dueDate?: string;
  status: TaskStatus;
  dateFormat: DateFormatKey;
}) {
  const label = formatTaskDate(dueDate, dateFormat);
  const late = overdueDays(dueDate, status);
  // Sempre num <span> com classe, mesmo no prazo: sem elemento pra estilizar,
  // "daqui 5 dias" quebrava em duas linhas na coluna estreita e esticava a
  // altura da linha inteira da tabela.
  if (!late) return <span className="due-value">{label}</span>;

  const dias = `${late} ${late === 1 ? "dia" : "dias"}`;
  return (
    <span className="due-value overdue" title={`Atrasada há ${dias}`}>
      <span className="due-value-date">
        <TriangleAlert size={12} strokeWidth={2.4} />
        {label}
      </span>
      <small>atrasada há {dias}</small>
    </span>
  );
}
