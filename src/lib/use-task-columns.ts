"use client";

import { useCallback, useSyncExternalStore } from "react";
import { TASK_COLUMNS, type TaskColumnKey } from "./types";

const STORAGE_KEY = "vizantu-tarefas:task-columns:v1";
const DEFAULT_VISIBLE = TASK_COLUMNS.filter((column) => column.defaultVisible).map((column) => column.key);
const KNOWN_KEYS = new Set(TASK_COLUMNS.map((column) => column.key));

function parseStored(raw: string | null): TaskColumnKey[] {
  if (!raw) return DEFAULT_VISIBLE;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_VISIBLE;
    const filtered = parsed.filter((key): key is TaskColumnKey => KNOWN_KEYS.has(key as TaskColumnKey));
    return filtered.length ? filtered : DEFAULT_VISIBLE;
  } catch {
    return DEFAULT_VISIBLE;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): string | null {
  return window.localStorage.getItem(STORAGE_KEY);
}

// No servidor não existe localStorage — retorna null (== DEFAULT_VISIBLE),
// igual ao primeiro render do client antes de hidratar. Evita o erro de
// hidratação que ler localStorage direto no useState causava.
function getServerSnapshot(): string | null {
  return null;
}

export function useTaskColumns() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const visible = parseStored(raw);

  const toggle = useCallback((key: TaskColumnKey) => {
    const current = parseStored(window.localStorage.getItem(STORAGE_KEY));
    const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    // O evento nativo "storage" só dispara em OUTRAS abas — disparamos manualmente
    // pra esta aba também reagir à mudança via useSyncExternalStore.
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  }, []);

  return { visible, toggle };
}
