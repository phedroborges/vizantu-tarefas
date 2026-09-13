"use client";

import { Check, Plus, Radio, Shapes, Trash2, Tag as TagIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { removeTagFromCatalog, useVisibleTags } from "@/lib/tag-catalog";
import { MetaRow } from "@/components/meta-row";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Tag, TagKind } from "@/lib/types";

const KIND_ICON = { formato: Shapes, canal: Radio, categoria: TagIcon };

// Núcleo reutilizado tanto pelo TagPicker do modal (dentro de um MetaRow) quanto
// pela edição inline na tabela de tarefas — só muda o que aciona o popover.
export function TagPickerPopover({
  kind,
  catalog,
  selectedIds,
  onChange,
  onCatalogUpdate,
  trigger,
  triggerClassName = "meta-value-trigger",
  align = "start",
}: {
  kind: TagKind;
  catalog: Tag[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onCatalogUpdate: (tag: Tag) => void;
  trigger: React.ReactNode;
  triggerClassName?: string;
  align?: "start" | "center" | "end";
}) {
  const router = useRouter();
  const visibleCatalog = useVisibleTags(catalog);
  const [deleteCandidate, setDeleteCandidate] = useState<Tag | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const options = useMemo(() => visibleCatalog.filter((tag) => tag.kind === kind), [visibleCatalog, kind]);

  async function confirmDelete() {
    if (!deleteCandidate || isDeleting) return;
    setIsDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/tags/${deleteCandidate.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok && response.status !== 404) throw new Error(result.error || "Não foi possível excluir a etiqueta.");
      removeTagFromCatalog(deleteCandidate.id);
      if (selectedIds.includes(deleteCandidate.id)) onChange(selectedIds.filter((id) => id !== deleteCandidate.id));
      setDeleteCandidate(null);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível excluir. Tente novamente.");
    } finally {
      setIsDeleting(false);
    }
  }

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
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) { cancelAdd(); setDeleteCandidate(null); setError(""); }
      }}
    >
      <PopoverTrigger className={triggerClassName} onClick={(event) => event.stopPropagation()}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent className="!w-60 !rounded-none !p-0 !gap-0" align={align}>
        <div className="tag-popover-list">
          {options.map((tag) => {
            const isSelected = selectedIds.includes(tag.id);
            return (
              <div className="tag-popover-option" key={tag.id}>
              <button
                type="button"
                className={`tag-popover-row ${isSelected ? "selected" : ""}`}
                disabled={isDeleting}
                onClick={() => toggle(tag.id)}
              >
                {tag.label}
                {isSelected ? <Check size={13} /> : null}
              </button>
              {kind !== "categoria" ? <button type="button" className="tag-popover-delete" aria-label={`Excluir etiqueta ${tag.label}`} title={`Excluir ${tag.label}`} disabled={isDeleting} onClick={(event) => { event.stopPropagation(); setError(""); setDeleteCandidate(tag); }}><Trash2 size={13} /></button> : null}
              </div>
            );
          })}
          {options.length === 0 ? <p className="tag-popover-empty">Nenhuma etiqueta ainda.</p> : null}
        </div>
        {deleteCandidate ? <div className="tag-popover-confirm" role="group" aria-label="Confirmar exclusão de etiqueta">
          <p>Excluir <strong>{deleteCandidate.label}</strong>? Ela deixará de aparecer em todas as tarefas.</p>
          <div><button type="button" disabled={isDeleting} onClick={() => { setDeleteCandidate(null); setError(""); }}>Cancelar</button><button type="button" disabled={isDeleting} onClick={confirmDelete}>{isDeleting ? "Excluindo..." : "Excluir etiqueta"}</button></div>
        </div> : null}
        {error ? <p className="tag-popover-error" role="alert">{error}</p> : null}
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
            <button type="button" className="tag-popover-add-button" onClick={(event) => { event.stopPropagation(); setIsAdding(true); }}>
              <Plus size={12} /> Nova etiqueta
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

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
  const visibleCatalog = useVisibleTags(catalog);
  const options = useMemo(() => visibleCatalog.filter((tag) => tag.kind === kind), [visibleCatalog, kind]);
  const selected = useMemo(() => options.filter((tag) => selectedIds.includes(tag.id)), [options, selectedIds]);
  const Icon = KIND_ICON[kind];
  const badgeClass = kind === "formato" ? "badge format" : "badge channel";

  return (
    <MetaRow icon={<Icon size={13} />} label={label}>
      <TagPickerPopover
        kind={kind}
        catalog={catalog}
        selectedIds={selectedIds}
        onChange={onChange}
        onCatalogUpdate={onCatalogUpdate}
        trigger={
          selected.length ? (
            <span className="pill-inline-list">
              {selected.map((tag) => (
                <span key={tag.id} className={badgeClass}>{tag.label}</span>
              ))}
            </span>
          ) : (
            <span className="meta-empty">Vazio</span>
          )
        }
      />
    </MetaRow>
  );
}
