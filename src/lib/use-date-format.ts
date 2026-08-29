"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_DATE_FORMAT, isDateFormatKey, type DateFormatKey } from "./date-format";

// Preferência de quem está olhando, não do time — mora no navegador, igual às
// colunas visíveis (ver use-task-columns.ts, mesmo desenho).
const STORAGE_KEY = "vizantu-tarefas:date-format:v1";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): string | null {
  return window.localStorage.getItem(STORAGE_KEY);
}

// No servidor não existe localStorage — devolve null (== o padrão), igual ao
// primeiro render do cliente antes de hidratar.
function getServerSnapshot(): string | null {
  return null;
}

export function useDateFormat() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const format: DateFormatKey = isDateFormatKey(raw) ? raw : DEFAULT_DATE_FORMAT;

  const setFormat = useCallback((next: DateFormatKey) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    // O evento "storage" nativo só dispara em OUTRAS abas — esta precisa do
    // disparo manual pra reagir via useSyncExternalStore.
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  }, []);

  return { format, setFormat };
}
