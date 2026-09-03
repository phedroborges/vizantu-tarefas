"use client";

import { ArrowRight, Loader2, Wand2 } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDueDate } from "@/lib/dates";
import { networkError, responseError } from "@/lib/request-error";
import type { ScheduleMove, WeekDiagnosis } from "@/lib/plan-schedule";
import type { Task } from "@/lib/types";

// Reorganizar o calendário pelo que o cliente já aprovou.
//
// Sempre em dois passos: primeiro a simulação, depois a aplicação. Reescrever
// as datas do mês inteiro de um cliente é a última coisa que deveria acontecer
// com um clique só e sem ninguém ver o que vai mudar.

const NOMES: Record<string, string> = { video: "vídeo", carrossel: "carrossel", estatico: "estático" };

export function PlanRescheduleButton({ planId, onApplied }: { planId: string; onApplied: (tasks: Task[]) => void }) {
  const [previa, setPrevia] = useState<{ moves: ScheduleMove[]; weeks: WeekDiagnosis[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState("");

  async function simular() {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/plans/${planId}/reschedule`);
      if (!response.ok) return setError(await responseError(response, "simular a reorganização"));
      setPrevia(await response.json());
    } catch {
      setError(networkError("simular a reorganização"));
    } finally {
      setIsLoading(false);
    }
  }

  async function aplicar() {
    setIsApplying(true);
    try {
      const response = await fetch(`/api/plans/${planId}/reschedule`, { method: "POST" });
      if (!response.ok) return setError(await responseError(response, "reorganizar o plano"));
      const { tasks } = await response.json();
      onApplied(tasks);
      setPrevia(null);
    } catch {
      setError(networkError("reorganizar o plano"));
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <>
      <button type="button" className="secondary-button" onClick={simular} disabled={isLoading}>
        {isLoading ? <Loader2 size={13} className="ai-spin" /> : <Wand2 size={13} />} Reorganizar pelo aprovado
      </button>
      {error ? <span className="form-message">{error}</span> : null}

      {previa ? (
        <Dialog open onOpenChange={(open) => !open && setPrevia(null)}>
          <DialogContent className="!max-w-[640px] w-[calc(100%-2rem)]">
            <DialogHeader className="modal-head">
              <DialogTitle>Reorganizar o calendário</DialogTitle>
            </DialogHeader>
            <div className="modal-body">
              <p className="qt-hint">
                As datas do plano continuam as mesmas. O que muda é quem ocupa cada uma: o que o cliente já aprovou
                sobe para as datas mais próximas, e o que ainda está em aprovação desce. Conteúdo de data fixa não sai
                do lugar.
              </p>

              {previa.moves.length ? (
                <ul className="reschedule-list">
                  {previa.moves.map((move) => (
                    <li key={move.id}>
                      <strong>{move.name}</strong>
                      <span>{formatDueDate(move.from)} <ArrowRight size={11} /> {formatDueDate(move.to)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="contrato-pronto">O calendário já está na ordem certa. Nada a mudar.</p>
              )}

              {previa.weeks.some((semana) => semana.missing.length) ? (
                <div className="reschedule-weeks">
                  <h4>Semanas abaixo do mínimo combinado</h4>
                  <ul>
                    {previa.weeks.filter((semana) => semana.missing.length).map((semana) => (
                      <li key={semana.weekStart}>
                        Semana de {formatDueDate(semana.weekStart)}: falta{" "}
                        {semana.missing.map((falta) => `${falta.quantidade} ${NOMES[falta.family]}`).join(", ")}
                      </li>
                    ))}
                  </ul>
                  <small>Reorganizar não cria conteúdo. Isso é uma leitura do plano, não um erro a corrigir aqui.</small>
                </div>
              ) : null}
            </div>
            <footer className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setPrevia(null)}>Cancelar</button>
              <button type="button" className="primary-button" onClick={aplicar} disabled={isApplying || !previa.moves.length}>
                {isApplying ? "Aplicando..." : `Aplicar ${previa.moves.length} ${previa.moves.length === 1 ? "mudança" : "mudanças"}`}
              </button>
            </footer>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
