"use client";

import { Check, Plus, Radio, Shapes } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { MetaRow } from "@/components/meta-row";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Tag, TagKind } from "@/lib/types";

const KIND_ICON = { formato: Shapes, canal: Radio };

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
  const [open, setOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const options = useMemo(() => catalog.filter((tag) => tag.kind === kind), [catalog, kind]);
  const selected = useMemo(() => options.filter((tag) => selectedIds.includes(tag.id)), [options, selectedIds]);
  const Icon = KIND_ICON[kind];
  const badgeClass = kind === "formato" ? "badge format" : "badge channel";

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
    <MetaRow icon={<Icon size={13} />} label={label}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) cancelAdd();
        }}
      >
        <PopoverTrigger className="meta-value-trigger">
          {selected.length ? (
            <span className="pill-inline-list">
              {selected.map((tag) => (
                <span key={tag.id} className={badgeClass}>{tag.label}</span>
              ))}
            </span>
          ) : (
            <span className="meta-empty">Vazio</span>
          )}
        </PopoverTrigger>
        <PopoverContent className="!w-60 !rounded-none !p-0 !gap-0" align="start">
          <div className="tag-popover-list">
            {options.map((tag) => {
              const isSelected = selectedIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  className={`tag-popover-row ${isSelected ? "selected" : ""}`}
                  onClick={() => toggle(tag.id)}
                >
                  {tag.label}
                  {isSelected ? <Check size={13} /> : null}
                </button>
              );
            })}
            {options.length === 0 ? <p className="tag-popover-empty">Nenhuma etiqueta ainda.</p> : null}
          </div>
          <div className="tag-popover-add">
            {isAdding ? (
              <input
                ref={inputRef}
                autoFocus
                className="meta-inline-input"
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitNew();
                  }
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    cancelAdd();
                  }
                }}
                onBlur={cancelAdd}
                placeholder="Nova etiqueta"
                maxLength={40}
              />
            ) : (
              <button type="button" className="tag-popover-add-button" onClick={() => setIsAdding(true)}>
                <Plus size={12} /> Nova etiqueta
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </MetaRow>
  );
}
