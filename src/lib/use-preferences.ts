"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mergePreferences, type MemberPreferences } from "./preferences";

// Substitui os antigos use-task-columns/use-date-format, que guardavam no
// localStorage — ou seja, no navegador. Agora o valor inicial vem do servidor
// junto com a página (nada de flash do padrão antes de hidratar) e a mudança
// sobe pra conta.
//
// A tela responde na hora e o PATCH vai atrás: marcar seis colunas seguidas
// são seis cliques, não seis idas ao servidor esperando resposta.
const SAVE_DELAY_MS = 400;

export function usePreferences(initial: MemberPreferences) {
  const [preferences, setPreferences] = useState(initial);
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef<Partial<MemberPreferences>>({});

  const flush = useCallback(() => {
    if (!Object.keys(pending.current).length) return;
    const body = pending.current;
    pending.current = {};
    void fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      }).then((response) => { if (!response.ok) pending.current = { ...body, ...pending.current }; })
        .catch(() => { pending.current = { ...body, ...pending.current }; });
  }, []);

  const update = useCallback((patch: Partial<MemberPreferences>) => {
    setPreferences((current) => mergePreferences(current, patch));
    pending.current = { ...pending.current, ...patch };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, SAVE_DELAY_MS);
  }, [flush]);

  useEffect(() => {
    const onPageHide = () => flush();
    window.addEventListener("pagehide", onPageHide);
    return () => { window.clearTimeout(timer.current); window.removeEventListener("pagehide", onPageHide); flush(); };
  }, [flush]);

  // Troca o conjunto inteiro sem disparar PATCH: usado pela migração do
  // localStorage, que já gravou no servidor antes de devolver o resultado.
  const replace = useCallback((next: MemberPreferences) => setPreferences(next), []);

  return { preferences, update, replace };
}
