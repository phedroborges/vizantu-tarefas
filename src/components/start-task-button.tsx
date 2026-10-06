"use client";

import { Play } from "lucide-react";
import { useState } from "react";

// O play da demanda: aparece enquanto ela está em "Pronto para criação" e, ao
// ser apertado, leva para "Em criação". O status só troca depois da animação,
// para a pessoa ver o botão responder antes de ele sumir.
const ANIMATION_MS = 420;

export function StartTaskButton({ onStart, label = false, className = "" }: { onStart: () => void | Promise<void>; label?: boolean; className?: string }) {
  const [starting, setStarting] = useState(false);

  function start(event: React.MouseEvent) {
    // Na lista o botão mora dentro de uma linha clicável que abre a tarefa.
    event.stopPropagation();
    if (starting) return;
    setStarting(true);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(async () => {
      try { await onStart(); } finally { setStarting(false); }
    }, reduced ? 0 : ANIMATION_MS);
  }

  return (
    <button type="button" className={`start-task${label ? " has-label" : ""}${starting ? " is-starting" : ""} ${className}`.trim()} onClick={start} disabled={starting} title="Começar: leva a tarefa para Em criação" aria-label="Começar a tarefa (leva para Em criação)">
      <span className="start-task__icon"><Play size={11} fill="currentColor" strokeWidth={0} /></span>
      {label ? <span>{starting ? "Começando…" : "Começar"}</span> : null}
    </button>
  );
}
