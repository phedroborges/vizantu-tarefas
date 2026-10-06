"use client";

import { History, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/dates";
import { responseError } from "@/lib/request-error";
import { isWhitespaceOnlyChange, restorePayload } from "@/lib/task-timeline";
import type { Task, TaskActivityEvent } from "@/lib/types";

const ALL = "all";

// O histórico completo de edições da tarefa: cada alteração de cada campo, com
// o antes e o depois. É aqui — e não na linha do tempo — que mora o nível de
// detalhe de "mudei um espaço no texto", e é daqui que se desfaz um erro.
export function TaskHistoryDialog({ taskId, labels, formatValue, canEdit, onClose, onRestored }: {
  taskId: string;
  labels: Record<string, string>;
  /** Valor legível e curto de um campo (nome do responsável, rótulo do status…). */
  formatValue: (field: string, value: unknown) => string;
  canEdit: boolean;
  onClose: () => void;
  onRestored: (task: Task) => void;
}) {
  const [events, setEvents] = useState<TaskActivityEvent[] | null>(null);
  const [field, setField] = useState(ALL);
  const [open, setOpen] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [problem, setProblem] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    fetch(`/api/tasks/${taskId}?history=all`)
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) return setProblem(await responseError(response, "carregar o histórico da tarefa"));
        setEvents((await response.json()).activity || []);
      })
      .catch(() => { if (active) setProblem("Não foi possível carregar o histórico. Verifique a conexão."); });
    return () => { active = false; };
  }, [taskId, reload]);

  const fields = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events || []) counts.set(event.fieldKey, (counts.get(event.fieldKey) || 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [events]);
  const visible = (events || []).filter((event) => field === ALL || event.fieldKey === field);

  async function restore(event: TaskActivityEvent) {
    const payload = restorePayload(event);
    if (!payload || restoring) return;
    setRestoring(true);
    setProblem("");
    try {
      const response = await fetch(`/api/tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) return setProblem(await responseError(response, "restaurar a versão"));
      onRestored((await response.json()).task);
      setConfirming(null);
      setReload((count) => count + 1);
    } catch {
      setProblem("Não foi possível restaurar. Verifique a conexão.");
    } finally {
      setRestoring(false);
    }
  }

  const full = (value: unknown) => value === null || value === undefined || value === "" ? "(vazio)" : typeof value === "string" ? value : JSON.stringify(value);

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="!max-w-[760px] w-[calc(100%-2rem)] max-h-[min(820px,calc(100vh-3rem))] flex flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="task-history-head">
          <DialogTitle className="flex items-center gap-2"><History size={16} /> Histórico de edições</DialogTitle>
          <DialogDescription>Todas as alterações da tarefa, da mais recente para a mais antiga. Restaurar devolve o campo ao valor de antes daquela alteração — e a restauração também fica registrada aqui.</DialogDescription>
          {fields.length > 1 ? <div className="task-history-filters" role="group" aria-label="Filtrar por campo">
            <button type="button" aria-pressed={field === ALL} onClick={() => setField(ALL)}>Tudo <b>{events?.length}</b></button>
            {fields.map(([key, count]) => <button type="button" key={key} aria-pressed={field === key} onClick={() => setField(key)}>{labels[key] || key} <b>{count}</b></button>)}
          </div> : null}
        </DialogHeader>
        {problem ? <p className="task-history-problem" role="alert">{problem}</p> : null}
        <div className="task-history-list">
          {events === null && !problem ? <p className="task-history-empty">Carregando o histórico…</p> : null}
          {events && !visible.length ? <p className="task-history-empty">Nenhuma alteração registrada.</p> : null}
          {visible.map((event) => {
            const payload = event.fieldKey === "created" ? null : restorePayload(event);
            const expanded = open === event.id;
            const long = [event.oldValue, event.newValue].some((value) => typeof value === "string" && value.length > 70);
            return <article key={event.id} className="task-history-item">
              <header>
                <div><strong>{labels[event.fieldKey] || event.fieldKey}</strong>{isWhitespaceOnlyChange(event) && event.fieldKey !== "created" ? <em>só espaços</em> : null}<span>{event.actorName} · {formatDateTime(event.createdAt)}</span></div>
                {canEdit && payload ? (confirming === event.id
                  ? <span className="task-history-confirm"><button type="button" className="primary-button" disabled={restoring} onClick={() => restore(event)}>{restoring ? "Restaurando…" : "Confirmar"}</button><button type="button" className="ghost-button" disabled={restoring} onClick={() => setConfirming(null)}>Cancelar</button></span>
                  : <button type="button" className="secondary-button" onClick={() => setConfirming(event.id)} title="Devolve o campo ao valor de antes desta alteração"><RotateCcw size={12} /> Restaurar o anterior</button>) : null}
              </header>
              {event.fieldKey === "created" ? <p className="task-history-note">Tarefa criada.</p> : expanded ? (
                <div className="task-history-full"><div><small>Antes</small><pre>{full(event.oldValue)}</pre></div><div><small>Depois</small><pre>{full(event.newValue)}</pre></div></div>
              ) : (
                <p className="task-activity-change"><del>{formatValue(event.fieldKey, event.oldValue)}</del><em>→</em><ins>{formatValue(event.fieldKey, event.newValue)}</ins></p>
              )}
              {long ? <button type="button" className="task-history-toggle" onClick={() => setOpen(expanded ? null : event.id)}>{expanded ? "Recolher" : "Ver o texto completo"}</button> : null}
            </article>;
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
