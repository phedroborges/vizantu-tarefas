"use client";

// Manter a tela viva sem F5.
//
// Todas as páginas do admin são server components com force-dynamic, e o
// navegador nunca fala com o Supabase (a chave de service role é só do
// servidor, ver supabase-client.ts). Então Realtime do Supabase está fora:
// exigiria abrir RLS e expor as tabelas ao anon, que é uma troca ruim só pra
// economizar um poll.
//
// O que sobra é revalidar o server component. router.refresh() faz exatamente
// isso e preserva o estado de cliente, então formulário aberto, rascunho não
// salvo e popover não somem no meio do caminho.
//
// Três gatilhos, na ordem de importância:
// 1. Voltar pra aba. É o momento em que a tela está mais velha e é o que o
//    usuário percebe como "não atualiza".
// 2. Intervalo, só com a aba visível. Aba de fundo não gasta consulta.
// 3. Manual, pelo indicador no cabeçalho.
//
// E uma trava: enquanto a pessoa digita, não atualiza. router.refresh() não
// derruba o que já está no estado, mas re-renderizar a árvore embaixo do
// cursor é desconfortável o bastante pra valer o cuidado.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

/** 20s é o meio-termo entre o sino (60s) e o painel do cliente (15s). */
export const LIVE_REFRESH_MS = 20_000;

/** Enquanto o foco está num campo de texto, adiar. */
export function isEditing(element: Element | null): boolean {
  if (!element) return false;
  const tag = element.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return (element as HTMLElement).isContentEditable === true;
}

export type LiveRefresh = {
  /** Quando a tela foi revalidada pela última vez. */
  lastRefresh: number;
  /** Uma revalidação está em andamento. */
  pending: boolean;
  /** Dispara agora, ignorando a trava de digitação. */
  refreshNow: () => void;
};

export function useLiveRefresh(intervalMs: number = LIVE_REFRESH_MS): LiveRefresh {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lastRefresh, setLastRefresh] = useState(() => Date.now());

  // O refresh corre dentro de uma transition pra `pending` valer como sinal de
  // "carregando" no indicador. Sem isso não dá pra saber quando terminou.
  const run = useCallback(() => {
    startTransition(() => {
      router.refresh();
      setLastRefresh(Date.now());
    });
  }, [router]);

  // `run` depende só do router, que é estável, então entra direto na
  // dependência do efeito sem remontar os listeners a cada render.
  useEffect(() => {
    const auto = () => {
      if (document.visibilityState !== "visible") return;
      if (isEditing(document.activeElement)) return;
      run();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") auto();
    };

    window.addEventListener("focus", auto);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(auto, intervalMs);

    return () => {
      window.removeEventListener("focus", auto);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [intervalMs, run]);

  return { lastRefresh, pending, refreshNow: run };
}

/** "agora", "há 1 min", "há 12 min". Acima de uma hora vira hora cheia. */
export function describeFreshness(lastRefresh: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - lastRefresh) / 1000));
  if (seconds < 45) return "agora";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "há 1 hora" : `há ${hours} horas`;
}
