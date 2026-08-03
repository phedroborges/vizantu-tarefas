"use client";

import { Check, Plus } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { Tag, TagKind } from "@/lib/types";

export function TagPicker({
  kind,
  label,
  catalog,
  selectedIds,
  onChange,
  onCatalogUpdate,
}: {
  kind: TagKind;
  label: string;
  catalog: Tag[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onCatalogUpdate: (tag: Tag) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const options = useMemo(() => catalog.filter((tag) => tag.kind === kind), [catalog, kind]);

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  }

  function cancelAdd() {
    setIsAdding(false);
    setNewLabel("");
  }

  async function submitNew() {
    const trimmed = newLabel.trim();
    if (!trimmed || isCreating) return cancelAdd();
    const existing = options.find((tag) => tag.label.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      if (!selectedIds.includes(existing.id)) onChange([...selectedIds, existing.id]);
      return cancelAdd();
    }
    setIsCreating(true);
    const response = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, label: trimmed }),
    });
    const result = await response.json();
    setIsCreating(false);
    if (!response.ok) return cancelAdd();
    onCatalogUpdate(result.tag);
    onChange([...selectedIds, result.tag.id]);
    cancelAdd();
  }

  return (
    <div className="field">
      <label>{label}</label>
      <div className="pill-row">
        {options.map((tag) => {
          const selected = selectedIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              className={`tag-pill ${selected ? "selected" : ""}`}
              onClick={() => toggle(tag.id)}
              aria-pressed={selected}
            >
              {selected ? <Check size={10} /> : null}
              {tag.label}
            </button>
          );
        })}
        {isAdding ? (
          <input
            ref={inputRef}
            autoFocus
            className="tag-pill-input"
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitNew();
              }
              if (event.key === "Escape") cancelAdd();
            }}
            onBlur={cancelAdd}
            placeholder="Nova etiqueta"
            maxLength={40}
          />
        ) : (
          <button type="button" className="tag-pill-add" onClick={() => setIsAdding(true)}>
            <Plus size={10} /> Nova
          </button>
        )}
      </div>
    </div>
  );
}
