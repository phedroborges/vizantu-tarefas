"use client";

import { AlarmClock } from "lucide-react";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { Avatar } from "@/components/avatar";
import { hoursUntilDue, isOverdue, timeUntilDueLabel } from "@/lib/dates";
import { DONE_STATUSES, type Project, type Task } from "@/lib/types";

const DONE = new Set<string>(DONE_STATUSES);
const QUANTAS = 5;

// O relógio é uma fonte externa ao React, igual ao localStorage: o minuto atual
// entra por useSyncExternalStore. Assim o servidor renderiza sem hora (nada a
// divergir na hidratação) e o contador anda sozinho, sem setState em efeito.
function subscribeMinuto(callback: () => void) {
  const id = setInterval(callback, 60_000);
  return () => clearInterval(id);
}

function minutoAtual(): number {
  return Math.floor(Date.now() / 60_000);
}

function minutoNoServidor(): null {
  return null;
}

function urgencia(horas: number): string {
  if (horas < 0) return "vencido";
  if (horas <= 24) return "urgente";
  if (horas <= 72) return "perto";
  return "calmo";
}

// As 5 demandas mais próximas de vencer, com o tempo que resta. Reconta sozinho
// de minuto em minuto: um contador que só atualiza no F5 engana mais do que
// ajuda quando falta pouco.
export function DueCountdown({
  tasks,
  projectById,
}: {
  tasks: Task[];
  projectById: Map<string, Project>;
}) {
  const minuto = useSyncExternalStore(subscribeMinuto, minutoAtual, minutoNoServidor);
  const agora = minuto === null ? null : new Date(minuto * 60_000);

  const proximas = useMemo(() => {
    return tasks
      .filter((task) => task.dueDate && !DONE.has(task.status))
      .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
      .slice(0, QUANTAS);
  }, [tasks]);

  if (!proximas.length) {
    return (
      <div className="due-countdown">
        <div className="due-countdown-head"><AlarmClock size={15} /> Próximas a vencer</div>
        <p className="due-countdown-empty">Nenhuma demanda com prazo em aberto.</p>
      </div>
    );
  }

  return (
    <div className="due-countdown">
      <div className="due-countdown-head">
        <AlarmClock size={15} /> Próximas a vencer
        <small>atualiza a cada minuto</small>
      </div>
      {proximas.map((task) => {
        const project = projectById.get(task.projectId);
        // Antes de montar não há relógio: o servidor renderiza sem o tempo pra
        // não gerar um valor diferente do primeiro render no navegador.
        const horas = agora ? hoursUntilDue(task.dueDate!, agora) : null;
        const rotulo = agora ? timeUntilDueLabel(task.dueDate!, agora) : "—";
        const classe = horas === null ? "calmo" : urgencia(horas);
        return (
          <Link className="due-countdown-row" key={task.id} href={`/tarefas/${task.id}`}>
            <div className="due-countdown-main">
              <strong>{task.name}</strong>
              <span>
                {project ? <Avatar name={project.name} imageUrl={project.avatarUrl} color={project.avatarColor} size={14} /> : null}
                {project?.name || "Sem projeto"}
              </span>
            </div>
            <span className={`due-countdown-time ${isOverdue(task.dueDate, task.status) ? "vencido" : classe}`}>{rotulo}</span>
          </Link>
        );
      })}
    </div>
  );
}
