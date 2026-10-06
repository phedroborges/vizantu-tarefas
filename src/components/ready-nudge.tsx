"use client";

import { Hourglass } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { StartTaskButton } from "@/components/start-task-button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDuration } from "@/lib/dates";
import { READY_NUDGE_SNOOZE_HOURS } from "@/lib/ready-nudge";

type NudgeTask = { id: string; name: string; projectName: string; waitingMs: number };

const SNOOZE_KEY = "vz:ready-nudge-snooze";
const REFRESH_MS = 30 * 60_000;

// O adiamento é conveniência de quem está vendo: mora no navegador e, se o
// armazenamento falhar, o aviso só volta a aparecer antes.
function readSnoozes(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(SNOOZE_KEY) || "{}") as Record<string, number>; } catch { return {}; }
}

function snooze(ids: string[]) {
  try {
    const now = Date.now();
    const kept = Object.fromEntries(Object.entries(readSnoozes()).filter(([, until]) => until > now));
    for (const id of ids) kept[id] = now + READY_NUDGE_SNOOZE_HOURS * 3_600_000;
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(kept));
  } catch { /* sem armazenamento, o aviso volta na próxima página */ }
}

// Renderizado uma vez em AdminShell. Pergunta ao responsável sobre as demandas
// que passaram do limite em "Pronto para criação" sem ninguém dar play: ou o
// trabalho começou e o status ficou para trás, ou a demanda está parada.
export function ReadyNudge() {
  const [tasks, setTasks] = useState<NudgeTask[]>([]);
  const [failed, setFailed] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = () => fetch("/api/tasks/ready-nudge")
      .then((response) => (response.ok ? response.json() : { tasks: [] }))
      .then((data) => {
        if (cancelled || !Array.isArray(data.tasks)) return;
        const snoozes = readSnoozes();
        const now = Date.now();
        setTasks((data.tasks as NudgeTask[]).filter((task) => !(snoozes[task.id] > now)));
      })
      .catch(() => {});
    void load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  if (!tasks.length) return null;

  function later() {
    snooze(tasks.map((task) => task.id));
    setTasks([]);
  }

  async function start(id: string) {
    setFailed("");
    const response = await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "em_criacao" }) }).catch(() => null);
    if (!response?.ok) return setFailed("Não foi possível iniciar a tarefa. Tente de novo.");
    setTasks((current) => current.filter((task) => task.id !== id));
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) later(); }}>
      <DialogContent className="!max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Hourglass size={17} /> {tasks.length === 1 ? "Essa tarefa já foi feita?" : "Essas tarefas já foram feitas?"}</DialogTitle>
          <DialogDescription>
            {tasks.length === 1 ? "Ela está" : "Elas estão"} em “Pronto para criação” há mais de um dia sem play. Se você já começou, aperte o play; se já terminou, abra a tarefa e envie para aprovação.
          </DialogDescription>
        </DialogHeader>
        <ul className="ready-nudge">
          {tasks.map((task) => (
            <li key={task.id}>
              <div><strong>{task.name}</strong><small>{task.projectName ? `${task.projectName} · ` : ""}há {formatDuration(task.waitingMs)} em Pronto</small></div>
              <StartTaskButton label onStart={() => start(task.id)} />
              <Link className="secondary-button" href={`/tarefas/${task.id}`} onClick={() => { snooze([task.id]); setTasks((current) => current.filter((item) => item.id !== task.id)); }}>Já terminei</Link>
            </li>
          ))}
        </ul>
        {failed ? <p className="ready-nudge__error" role="alert">{failed}</p> : null}
        <button type="button" className="ghost-button" style={{ width: "100%" }} onClick={later}>Ainda não comecei — lembrar mais tarde</button>
      </DialogContent>
    </Dialog>
  );
}
