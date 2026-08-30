"use client";

import { useCallback, useRef, useState } from "react";
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

  const update = useCallback((patch: Partial<MemberPreferences>) => {
    setPreferences((current) => mergePreferences(current, patch));
    pending.current = { ...pending.current, ...patch };

    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const body = pending.current;
      pending.current = {};
      // Falha de rede não desfaz o que está na tela: a pessoa continua vendo o
      // que escolheu, e o próximo ajuste tenta salvar de novo. Perder a
      // preferência por um blip de conexão seria pior que salvar tarde.
      void fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => {});
    }, SAVE_DELAY_MS);
  }, []);

  // Troca o conjunto inteiro sem disparar PATCH: usado pela migração do
  // localStorage, que já gravou no servidor antes de devolver o resultado.
  const replace = useCallback((next: MemberPreferences) => setPreferences(next), []);

  return { preferences, update, replace };
}
