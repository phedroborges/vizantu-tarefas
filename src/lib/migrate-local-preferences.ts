"use client";

import { normalizePreferences, type MemberPreferences } from "./preferences";

// Sobras das versões em que a preferência morava no navegador. Nada mais lê
// essas chaves — elas só existem pra serem recolhidas e apagadas.
const LEGACY_COLUMNS_KEY = "vizantu-tarefas:task-columns:v1";
const LEGACY_DATE_FORMAT_KEY = "vizantu-tarefas:date-format:v1";

function readLegacy(): Partial<MemberPreferences> | null {
  const rawColumns = window.localStorage.getItem(LEGACY_COLUMNS_KEY);
  const rawFormat = window.localStorage.getItem(LEGACY_DATE_FORMAT_KEY);
  if (!rawColumns && !rawFormat) return null;

  const patch: Record<string, unknown> = {};
  if (rawColumns) {
    try {
      const parsed: unknown = JSON.parse(rawColumns);
      if (Array.isArray(parsed)) patch.taskColumns = parsed;
    } catch {
      // Chave corrompida é a mesma coisa que chave ausente: segue sem ela.
    }
  }
  if (rawFormat) patch.dateFormat = rawFormat;
  return Object.keys(patch).length ? (normalizePreferences({ ...normalizePreferences(null), ...patch }) as Partial<MemberPreferences>) : null;
}

function forget() {
  window.localStorage.removeItem(LEGACY_COLUMNS_KEY);
  window.localStorage.removeItem(LEGACY_DATE_FORMAT_KEY);
}

// Roda uma vez por navegador. Quem já configurava colunas e formato de data não
// perde nada na virada; quem já tem preferência salva na conta só tem a chave
// velha apagada, porque o que vale é o que está na conta.
export async function migrateLocalPreferences(alreadySaved: boolean): Promise<MemberPreferences | null> {
  const legacy = readLegacy();
  if (!legacy) return null;
  if (alreadySaved) {
    forget();
    return null;
  }

  try {
    const response = await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(legacy),
    });
    if (!response.ok) return null; // Tenta de novo na próxima carga.
    forget();
    return (await response.json()).preferences as MemberPreferences;
  } catch {
    return null;
  }
}
