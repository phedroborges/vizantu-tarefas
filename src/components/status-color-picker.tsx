"use client";

import { Palette } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { STATUS_GROUPS, TASK_STATUSES } from "@/lib/types";
import type { StatusColor, TaskStatus } from "@/lib/types";

export function StatusColorPicker({
  colors,
  onSaved,
}: {
  colors: StatusColor[];
  onSaved: (colors: StatusColor[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<TaskStatus, string>>(() => Object.fromEntries(colors.map((c) => [c.status, c.color])) as Record<TaskStatus, string>);
  const [isSaving, setIsSaving] = useState(false);
  // Antes o erro era engolido: clicar em salvar não fazia nada e não dizia nada.
  const [error, setError] = useState("");

  function openPicker(next: boolean) {
    setOpen(next);
    if (next) setError("");
    if (next) setDraft(Object.fromEntries(colors.map((c) => [c.status, c.color])) as Record<TaskStatus, string>);
  }

  async function save() {
    setIsSaving(true);
    setError("");
    try {
      const response = await fetch("/api/status-colors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colors: draft }),
      });
      // Uma resposta que não é JSON (erro de proxy, página de erro do
      // servidor) explodia aqui e o botão ficava preso em "Salvando...".
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || `Não foi possível salvar (erro ${response.status}).`);
        return;
      }
      onSaved(result.colors);
      setOpen(false);
    } catch {
      setError("Falha de conexão — tente de novo.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={openPicker}>
      <PopoverTrigger render={<button type="button" className="secondary-button" />}>
        <Palette size={14} /> Cores
      </PopoverTrigger>
      <PopoverContent className="!w-72 !rounded-none !p-0 !gap-0" align="end">
        <div className="status-color-list">
          {STATUS_GROUPS.map((group) => (
            <div className="status-color-group" key={group.value}>
              <span className="status-color-group-label">{group.label}</span>
              {TASK_STATUSES.filter((status) => status.group === group.value).map((status) => (
                <label className="status-color-row" key={status.value}>
                  <span>{status.label}</span>
                  <input
                    type="color"
                    value={draft[status.value] || "#aeb5ae"}
                    onChange={(e) => setDraft((current) => ({ ...current, [status.value]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
          ))}
        </div>
        <div className="status-color-actions">
          {error ? <p className="status-color-error" role="alert">{error}</p> : null}
          <button type="button" className="primary-button" onClick={save} disabled={isSaving} style={{ width: "100%" }}>
            {isSaving ? "Salvando..." : "Salvar cores"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
