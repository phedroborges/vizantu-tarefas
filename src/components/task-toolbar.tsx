"use client";

import { CalendarDays, ChevronDown, Eye, EyeOff, List, Settings2, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button, Check, IconButton, SearchInput, Segmented, Toolbar } from "@/components/vz";
import { StatusColorPicker } from "@/components/status-color-picker";
import { DATE_FORMATS, type DateFormatKey } from "@/lib/date-format";
import { STATUS_GROUPS, TASK_COLUMNS, TASK_LIST_KINDS, TASK_STATUSES, type StatusColor, type TaskColumnKey } from "@/lib/types";
import type { SavedTaskFilters } from "@/lib/preferences";
import type { Member, Project } from "@/lib/types";

// A barra tinha 4 selects soltos + busca + colunas + cores + 2 grupos de botões
// numa linha só, tudo com o mesmo peso visual. Agora: busca (que é o que mais
// se usa), um botão de filtros com contador do que está ativo, e uma
// engrenagem com o que é preferência de exibição. Mesma barra nas duas visões.

export type TaskFilters = SavedTaskFilters & { showFinalized: boolean };

type FilterOption = { value: string; label: string; group?: string };

function MultiFilterField({
  label,
  values,
  options,
  onChange,
}: {
  label: string;
  values: string[];
  options: FilterOption[];
  onChange: (values: string[]) => void;
}) {
  const selectedLabels = options.filter((option) => values.includes(option.value)).map((option) => option.label);
  const summary = values.length === 0
    ? "Todos"
    : selectedLabels.length === 0
      ? `${values.length} ${values.length === 1 ? "selecionado" : "selecionados"}`
    : selectedLabels.length <= 2
      ? selectedLabels.join(", ")
      : `${selectedLabels.length} selecionados`;
  return (
    <details className="toolbar-multifilter">
      <summary>
        <span><b>{label}</b><small>{summary}</small></span>
        <ChevronDown size={15} />
      </summary>
      <div className="toolbar-multifilter__options" role="group" aria-label={`Opções de ${label}`}>
        {values.length ? <button type="button" onClick={() => onChange([])}>Limpar seleção</button> : null}
        {options.map((option, index) => {
          const groupLabel = option.group && option.group !== options[index - 1]?.group ? option.group : null;
          return <div key={option.value}>
            {groupLabel ? <span className="toolbar-multifilter__group">{groupLabel}</span> : null}
            <Check
              label={option.label}
              checked={values.includes(option.value)}
              onChange={() => onChange(values.includes(option.value) ? values.filter((value) => value !== option.value) : [...values, option.value])}
            />
          </div>;
        })}
      </div>
    </details>
  );
}

export function countActiveFilters(filters: TaskFilters): number {
  // A busca não conta: ela já está visível na barra, com o texto à mostra.
  // "Mostrar finalizadas e descartadas" conta, porque muda o que aparece e fica escondido.
  return filters.projectIds.length + filters.assigneeIds.length + filters.statuses.length + filters.lists.length + (filters.showFinalized ? 1 : 0);
}

export function TaskToolbar({
  filters,
  onFiltersChange,
  projects,
  members,
  view,
  onViewChange,
  visibleColumns,
  onToggleColumn,
  dateFormat,
  onDateFormatChange,
  statusColors,
  onStatusColorsSaved,
  canEditStatusColors = false,
}: {
  filters: TaskFilters;
  onFiltersChange: (next: Partial<TaskFilters>) => void;
  projects: Project[];
  members: Member[];
  view: "lista" | "calendario";
  onViewChange: (view: "lista" | "calendario") => void;
  visibleColumns: TaskColumnKey[];
  onToggleColumn: (key: TaskColumnKey) => void;
  dateFormat: DateFormatKey;
  onDateFormatChange: (format: DateFormatKey) => void;
  statusColors: StatusColor[];
  onStatusColorsSaved: (colors: StatusColor[]) => void;
  // Cor de status é padrão do time, não gosto de quem olha: só o dono muda.
  // O resto deste menu (formato de data, colunas) é preferência de cada um.
  canEditStatusColors?: boolean;
}) {
  const activeCount = countActiveFilters(filters);

  return (
    <Toolbar className="task-toolbar">
      <div className="vz-toolbar__search">
        <SearchInput
          value={filters.query}
          onChange={(e) => onFiltersChange({ query: e.target.value })}
          placeholder="Buscar por tarefa, canal ou responsável"
          aria-label="Buscar tarefas"
          shortcut={null}
        />
      </div>

      <div className="toolbar-actions">
        <Popover>
          <PopoverTrigger render={<Button type="button" variant={activeCount ? "soft" : "secondary"} aria-label="Filtros" />}>
            <SlidersHorizontal size={15} /> Filtros
            {activeCount ? <span className="toolbar-count">{activeCount}</span> : null}
          </PopoverTrigger>
          <PopoverContent className="!w-72 !p-0 !gap-0" align="end">
            <div className="toolbar-menu">
              <MultiFilterField label="Projeto" values={filters.projectIds} options={projects.map((project) => ({ value: project.id, label: project.name }))} onChange={(projectIds) => onFiltersChange({ projectIds })} />
              <MultiFilterField label="Responsável" values={filters.assigneeIds} options={members.map((member) => ({ value: member.id, label: member.name }))} onChange={(assigneeIds) => onFiltersChange({ assigneeIds })} />
              <MultiFilterField
                label="Status"
                values={filters.statuses}
                options={[
                  { value: "atrasada", label: "Atrasada", group: "Prazo" },
                  ...STATUS_GROUPS.flatMap((group) => TASK_STATUSES.filter((status) => status.group === group.value).map((status) => ({ value: status.value, label: status.label, group: group.label }))),
                ]}
                onChange={(statuses) => onFiltersChange({ statuses: statuses as SavedTaskFilters["statuses"] })}
              />
              <MultiFilterField label="Lista" values={filters.lists} options={TASK_LIST_KINDS.map((kind) => ({ value: kind.value, label: kind.label }))} onChange={(lists) => onFiltersChange({ lists: lists as SavedTaskFilters["lists"] })} />
              <Button type="button" variant={filters.showFinalized ? "soft" : "secondary"} onClick={() => onFiltersChange({ showFinalized: !filters.showFinalized })} aria-pressed={filters.showFinalized}>
                {filters.showFinalized ? <EyeOff size={14} /> : <Eye size={14} />}
                {filters.showFinalized ? "Ocultar finalizadas e descartadas" : "Mostrar finalizadas e descartadas"}
              </Button>
              {activeCount ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onFiltersChange({ projectIds: [], assigneeIds: [], statuses: [], lists: [], showFinalized: false })}
                >
                  Limpar filtros
                </Button>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger render={<IconButton type="button" aria-label="Exibição" />}>
            <Settings2 size={15} />
          </PopoverTrigger>
          <PopoverContent className="!w-72 !p-0 !gap-0" align="end">
            <div className="toolbar-menu">
              <div className="toolbar-section">
                <span className="toolbar-section-label">Formato da data</span>
                {DATE_FORMATS.map((format) => (
                  <Check
                    type="radio"
                    label={`${format.label} · ${format.hint}`}
                    key={format.key}
                    name="date-format"
                    checked={dateFormat === format.key}
                    onChange={() => onDateFormatChange(format.key)}
                  />
                ))}
              </div>
              {view === "lista" ? (
                <div className="toolbar-section">
                  <span className="toolbar-section-label">Colunas visíveis</span>
                  {TASK_COLUMNS.map((column) => (
                    <Check key={column.key} label={column.label} checked={visibleColumns.includes(column.key)} onChange={() => onToggleColumn(column.key)} />
                  ))}
                </div>
              ) : null}
              {canEditStatusColors ? (
                <div className="toolbar-section">
                  <span className="toolbar-section-label">Cores dos status</span>
                  <StatusColorPicker colors={statusColors} onSaved={onStatusColorsSaved} />
                  <small className="toolbar-section-hint">Vale pro time inteiro.</small>
                </div>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>

        <Segmented value={view} onChange={onViewChange} options={[
          { value: "lista", label: "Lista", icon: <List size={14} /> },
          { value: "calendario", label: "Calendário", icon: <CalendarDays size={14} /> },
        ]} />
      </div>
    </Toolbar>
  );
}
