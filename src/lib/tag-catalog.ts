"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { Tag } from "./types";

let deletedIds: ReadonlySet<string> = new Set();
const initialDeletedIds: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export function removeTagFromCatalog(id: string) {
  deletedIds = new Set([...deletedIds, id]);
  listeners.forEach((listener) => listener());
}

// Sincroniza seletores e etiquetas da tabela mesmo quando o catálogo recebido
// por props ainda é o anterior à atualização do servidor.
export function useVisibleTags(catalog: Tag[]) {
  const deleted = useSyncExternalStore(subscribe, () => deletedIds, () => initialDeletedIds);
  return useMemo(() => catalog.filter((tag) => !deleted.has(tag.id)), [catalog, deleted]);
}
