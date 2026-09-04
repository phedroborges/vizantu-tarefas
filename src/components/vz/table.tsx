"use client";

// Colunas redimensionáveis, com a largura salva sozinha.
//
// O problema que isto resolve: título de conteúdo quebrando em duas linhas e
// desalinhando a tabela inteira. A regra passa a ser "título nunca quebra —
// trunca", e quem precisa de mais espaço arrasta a divisória da coluna.
//
// A largura persiste. Aqui, na vitrine, em localStorage; no app ela vai pro
// mesmo /api/preferences que já guarda quais colunas ficam visíveis (ver
// lib/use-preferences.ts) — é a mesma preferência de tabela, por usuário.

import * as React from "react";

export type ColunaDef = { key: string; label: string; largura: number; min?: number; alinhar?: "esquerda" | "direita" };

const MIN_PADRAO = 72;

// O localStorage é uma fonte de dados EXTERNA ao React, e é assim que ele
// entra aqui: useSyncExternalStore devolve o valor salvo já no primeiro render,
// com um snapshot de servidor separado (null) pra hidratação bater. Ler no
// useState quebraria o SSR; ler num useEffect e chamar setState causaria um
// render em cascata — os dois caminhos que a versão anterior tentou.
function assinar(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function useColunasRedimensionaveis(chave: string, colunas: ColunaDef[]) {
  const padrao = React.useMemo(
    () => Object.fromEntries(colunas.map((coluna) => [coluna.key, coluna.largura])),
    [colunas],
  );

  const salvo = React.useSyncExternalStore(
    assinar,
    () => {
      try {
        return window.localStorage.getItem(`vz-colunas:${chave}`);
      } catch {
        return null; // Janela anônima ou storage bloqueado.
      }
    },
    () => null,
  );

  // O que o usuário está arrastando AGORA tem precedência sobre o que está
  // salvo; enquanto ninguém arrasta, vale o salvo (ou o padrão).
  const [rascunho, setRascunho] = React.useState<Record<string, number> | null>(null);
  const [arrastando, setArrastando] = React.useState<string | null>(null);

  const larguras = React.useMemo(() => {
    if (rascunho) return rascunho;
    if (!salvo) return padrao;
    try {
      return { ...padrao, ...(JSON.parse(salvo) as Record<string, number>) };
    } catch {
      return padrao;
    }
  }, [rascunho, salvo, padrao]);

  const salvar = React.useCallback((proximas: Record<string, number>) => {
    try {
      window.localStorage.setItem(`vz-colunas:${chave}`, JSON.stringify(proximas));
    } catch {
      // Não conseguir salvar não pode quebrar o arrasto.
    }
  }, [chave]);

  const iniciarArrasto = React.useCallback((evento: React.PointerEvent, coluna: ColunaDef) => {
    evento.preventDefault();
    const alvo = evento.currentTarget as HTMLElement;
    alvo.setPointerCapture(evento.pointerId);
    const xInicial = evento.clientX;
    const larguraInicial = larguras[coluna.key] ?? coluna.largura;
    const minimo = coluna.min ?? MIN_PADRAO;
    setArrastando(coluna.key);
    document.body.classList.add("vz-resizing");

    let ultimas = larguras;
    const mover = (movimento: PointerEvent) => {
      const largura = Math.max(minimo, Math.round(larguraInicial + (movimento.clientX - xInicial)));
      ultimas = { ...ultimas, [coluna.key]: largura };
      setRascunho(ultimas);
    };
    const soltar = () => {
      alvo.removeEventListener("pointermove", mover);
      alvo.removeEventListener("pointerup", soltar);
      alvo.removeEventListener("pointercancel", soltar);
      document.body.classList.remove("vz-resizing");
      setArrastando(null);
      salvar(ultimas);
    };
    alvo.addEventListener("pointermove", mover);
    alvo.addEventListener("pointerup", soltar);
    alvo.addEventListener("pointercancel", soltar);
  }, [larguras, salvar]);

  const redefinir = React.useCallback(() => {
    setRascunho(padrao);
    salvar(padrao);
  }, [padrao, salvar]);

  return { larguras, arrastando, iniciarArrasto, redefinir };
}

// O <th> com a alça de arrasto. Duplo clique devolve a largura padrão —
// o mesmo gesto de planilha, que é onde as pessoas aprenderam isto.
export function ColunaHeader({
  coluna,
  largura,
  arrastando,
  onArrastar,
  onRedefinir,
}: {
  coluna: ColunaDef;
  largura: number;
  arrastando: boolean;
  onArrastar: (evento: React.PointerEvent, coluna: ColunaDef) => void;
  onRedefinir?: () => void;
}) {
  return (
    <th style={{ width: largura }} className={coluna.alinhar === "direita" ? "vz-table__num" : undefined}>
      {coluna.label}
      <button
        type="button"
        className="vz-table__resizer"
        data-dragging={arrastando}
        aria-label={`Redimensionar coluna ${coluna.label}`}
        onPointerDown={(evento) => onArrastar(evento, coluna)}
        onDoubleClick={onRedefinir}
      />
    </th>
  );
}
