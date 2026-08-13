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

  function openPicker(next: boolean) {
    setOpen(next);
    if (next) setDraft(Object.fromEntries(colors.map((c) => [c.status, c.color])) as Record<TaskStatus, string>);
  }

  async function save() {
    setIsSaving(true);
    const response = await fetch("/api/status-colors", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colors: draft }),
    });
    const result = await response.json();
    setIsSaving(false);
    if (!response.ok) return;
    onSaved(result.colors);
    setOpen(false);
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
          <button type="button" className="primary-button" onClick={save} disabled={isSaving} style={{ width: "100%" }}>
            {isSaving ? "Salvando..." : "Salvar cores"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
