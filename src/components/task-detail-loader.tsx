"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { TaskModal } from "./task-modal";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { Button } from "./vz";
import { responseError } from "@/lib/request-error";
import type { Task } from "@/lib/types";

// Nunca deixa uma linha resumida entrar no formulário: salvar arrays/descrição
// vazios por acidente apagaria o conteúdo que a lista não precisou baixar.
export function TaskDetailLoader(props: ComponentProps<typeof TaskModal>) {
  const id = props.task?.id;
  const preview = props.task?.preview;
  const [loaded, setLoaded] = useState<Task | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!id || !preview) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/tasks/${id}?detail=1`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]), cache: "no-store" });
        if (!response.ok) throw new Error(await responseError(response, "abrir a tarefa"));
        const data = await response.json();
        if (!data.task || data.task.id !== id || data.task.preview) throw new Error("O servidor não retornou a tarefa completa.");
        if (!controller.signal.aborted) setLoaded(data.task);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error && error.name !== "TimeoutError" ? error.message : "A tarefa demorou para responder. Tente novamente.");
      }
    }
    void load();
    return () => controller.abort();
  }, [id, preview, attempt]);
  if (!preview) return <TaskModal {...props} />;
  if (loaded?.id === id) return <TaskModal {...props} task={loaded} />;
  return <Dialog open onOpenChange={(open) => { if (!open) props.onClose(); }}><DialogContent>
    <DialogTitle>{props.task?.name || "Tarefa"}</DialogTitle>
    <DialogDescription>{error || "Carregando descrição e histórico…"}</DialogDescription>
    {error ? <Button onClick={() => { setError(""); setAttempt((value) => value + 1); }}>Tentar novamente</Button> : null}
    <Button variant="secondary" onClick={props.onClose}>Fechar</Button>
  </DialogContent></Dialog>;
}
