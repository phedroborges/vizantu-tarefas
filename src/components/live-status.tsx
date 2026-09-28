"use client";

// O aviso de que a tela está viva.
//
// Sem ele, a atualização automática é invisível: a pessoa continua sem saber
// se o que está na frente dela é de agora ou de vinte minutos atrás, que é
// exatamente a queixa que originou isso. O indicador responde essa pergunta
// e dá um jeito de forçar a atualização quando a pessoa não quer esperar.

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { describeFreshness, useLiveRefresh } from "@/lib/use-live-refresh";

export function LiveStatus() {
  const { lastRefresh, pending, refreshNow } = useLiveRefresh();

  // O relógio é que avança, não o rótulo. Assim o texto envelhece sozinho
  // ("agora" vira "há 2 min") sem precisar de setState dentro do efeito.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setAgora(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const rotulo = describeFreshness(lastRefresh, agora);

  return (
    <button
      type="button"
      className={`live-status${pending ? " live-status--pending" : ""}`}
      onClick={refreshNow}
      disabled={pending}
      title="Atualizar agora"
      aria-label={`Dados atualizados ${rotulo}. Clique para atualizar agora.`}
    >
      <RefreshCw size={13} aria-hidden />
      <span>{pending ? "Atualizando" : rotulo}</span>
    </button>
  );
}
