"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type PageContextValue = {
  page: string;
  detail: string;
  setDetail: (detail: string) => void;
};

const PageContext = createContext<PageContextValue>({ page: "", detail: "", setDetail: () => {} });

export function PageContextProvider({ page, children }: { page: string; children: ReactNode }) {
  const [detail, setDetail] = useState("");
  const value = useMemo(() => ({ page, detail, setDetail }), [page, detail]);
  return <PageContext.Provider value={value}>{children}</PageContext.Provider>;
}

// Texto completo pra mandar pro assistente: nome da página + o que a view
// específica souber (ex.: qual tarefa está aberta agora).
export function usePageContextText(): string {
  const { page, detail } = useContext(PageContext);
  return detail ? `${page} ${detail}` : page;
}

// Views chamam isso pra declarar o que está na tela agora (tarefa aberta,
// filtro ativo etc.). Roda em efeito — nunca durante a renderização de outro
// componente — e limpa sozinho ao desmontar/trocar de valor.
export function useSetPageDetail(detail: string) {
  const { setDetail } = useContext(PageContext);
  useEffect(() => {
    setDetail(detail);
    return () => setDetail("");
  }, [detail, setDetail]);
}
