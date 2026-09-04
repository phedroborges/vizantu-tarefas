"use client";

// O gesto de arrastar a divisória de uma coluna, sem opinião sobre ONDE a
// largura é guardada.
//
// Existem dois lugares que precisam dele com persistências diferentes: a
// vitrine do design system (localStorage, porque não há usuário) e a tabela de
// tarefas (as preferências da pessoa, no banco). O gesto é idêntico; só o
// destino muda — então o gesto mora aqui e o destino entra por callback.

import * as React from "react";

export const LARGURA_MINIMA = 72;

export function useArrastoDeColuna({
  larguras,
  onLargura,
  onFim,
}: {
  larguras: Record<string, number>;
  onLargura: (chave: string, largura: number) => void;
  onFim: (larguras: Record<string, number>) => void;
}) {
  const [arrastando, setArrastando] = React.useState<string | null>(null);

  const iniciar = React.useCallback((evento: React.PointerEvent, chave: string, padrao: number, minimo = LARGURA_MINIMA) => {
    evento.preventDefault();
    const alvo = evento.currentTarget as HTMLElement;
    alvo.setPointerCapture(evento.pointerId);
    const xInicial = evento.clientX;
    const larguraInicial = larguras[chave] ?? padrao;
    setArrastando(chave);
    // A classe no body trava o cursor de redimensionar e mata a seleção de
    // texto: sem isso, arrastar sobre a tabela seleciona as células.
    document.body.classList.add("vz-resizing");

    let ultimas = { ...larguras };
    const mover = (movimento: PointerEvent) => {
      const largura = Math.max(minimo, Math.round(larguraInicial + (movimento.clientX - xInicial)));
      ultimas = { ...ultimas, [chave]: largura };
      onLargura(chave, largura);
    };
    const soltar = () => {
      alvo.removeEventListener("pointermove", mover);
      alvo.removeEventListener("pointerup", soltar);
      alvo.removeEventListener("pointercancel", soltar);
      document.body.classList.remove("vz-resizing");
      setArrastando(null);
      // Só grava ao SOLTAR: gravar a cada pixel movido geraria uma escrita por
      // quadro de animação (e, no app, uma requisição por quadro).
      onFim(ultimas);
    };
    alvo.addEventListener("pointermove", mover);
    alvo.addEventListener("pointerup", soltar);
    alvo.addEventListener("pointercancel", soltar);
  }, [larguras, onLargura, onFim]);

  return { arrastando, iniciar };
}
