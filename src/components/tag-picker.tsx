"use client";

import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const options = useMemo(() => catalog.filter((tag) => tag.kind === kind), [catalog, kind]);
  const selectedTags = useMemo(() => options.filter((tag) => selectedIds.includes(tag.id)), [options, selectedIds]);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleOptions = useMemo(
    () => options.filter((tag) => !normalizedQuery || tag.label.toLowerCase().includes(normalizedQuery)),
    [options, normalizedQuery],
  );
  const exactMatch = options.some((tag) => tag.label.toLowerCase() === normalizedQuery);

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  }

  function remove(id: string) {
    onChange(selectedIds.filter((item) => item !== id));
  }

  async function createAndSelect() {
    if (!query.trim() || isCreating) return;
    setIsCreating(true);
    const response = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, label: query }),
    });
    const result = await response.json();
    setIsCreating(false);
    if (!response.ok) return;
    onCatalogUpdate(result.tag);
    onChange([...selectedIds, result.tag.id]);
    setQuery("");
  }

  return (
    <div className="field">
      <label>{label}</label>
      <div className="tag-picker">
        {selectedTags.length ? (
          <div className="tag-picker-chips">
            {selectedTags.map((tag) => (
              <Badge key={tag.id} variant="secondary" className="tag-chip">
                {tag.label}
                <button type="button" className="tag-chip-remove" onClick={() => remove(tag.id)} aria-label={`Remover ${tag.label}`}>
                  <X size={11} />
                </button>
              </Badge>
            ))}
          </div>
        ) : null}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={<button type="button" className="secondary-button tag-picker-trigger" />}>
            <Plus size={13} /> Adicionar {label.toLowerCase()}
          </PopoverTrigger>
          <PopoverContent align="start" className="tag-picker-content">
            <Command shouldFilter={false}>
              <CommandInput value={query} onValueChange={setQuery} placeholder={`Buscar ${label.toLowerCase()}...`} />
              <CommandList>
                <CommandEmpty>Nenhuma etiqueta encontrada.</CommandEmpty>
                <CommandGroup>
                  {visibleOptions.map((tag) => (
                    <CommandItem key={tag.id} data-checked={selectedIds.includes(tag.id)} onSelect={() => toggle(tag.id)}>
                      {tag.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
                {query.trim() && !exactMatch ? (
                  <CommandGroup>
                    <CommandItem onSelect={createAndSelect} disabled={isCreating}>
                      <Plus size={13} /> Criar &quot;{query.trim()}&quot;
                    </CommandItem>
                  </CommandGroup>
                ) : null}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
