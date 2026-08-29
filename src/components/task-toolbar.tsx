"use client";

import { CalendarDays, Eye, EyeOff, List, Search, Settings2, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusColorPicker } from "@/components/status-color-picker";
import { DATE_FORMATS, type DateFormatKey } from "@/lib/date-format";
import { STATUS_GROUPS, TASK_COLUMNS, TASK_LIST_KINDS, TASK_STATUSES, type StatusColor, type TaskColumnKey, type TaskListKind } from "@/lib/types";
import type { Member, Project } from "@/lib/types";

// A barra tinha 4 selects soltos + busca + colunas + cores + 2 grupos de botões
// numa linha só, tudo com o mesmo peso visual. Agora: busca (que é o que mais
// se usa), um botão de filtros com contador do que está ativo, e uma
// engrenagem com o que é preferência de exibição. Mesma barra nas duas visões.

export type TaskFilters = {
  query: string;
  projectId: string;
  assigneeId: string;
  status: string;
  list: TaskListKind | "";
  showFinalized: boolean;
};

export function countActiveFilters(filters: TaskFilters): number {
  // A busca não conta: ela já está visível na barra, com o texto à mostra.
  // "Mostrar finalizadas" conta, porque muda o que aparece e fica escondido.
  return [filters.projectId, filters.assigneeId, filters.status, filters.list].filter(Boolean).length + (filters.showFinalized ? 1 : 0);
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
  canEdit,
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
  canEdit: boolean;
}) {
  const activeCount = countActiveFilters(filters);

  return (
    <div className="toolbar">
      <div className="search">
        <Search size={16} />
        <input
          value={filters.query}
          onChange={(e) => onFiltersChange({ query: e.target.value })}
          placeholder="Buscar por tarefa, canal ou responsável"
          aria-label="Buscar tarefas"
        />
      </div>

      <div className="toolbar-actions">
        <Popover>
          <PopoverTrigger render={<button type="button" className={`toolbar-button ${activeCount ? "is-active" : ""}`} aria-label="Filtros" />}>
            <SlidersHorizontal size={15} /> Filtros
            {activeCount ? <span className="toolbar-count">{activeCount}</span> : null}
          </PopoverTrigger>
          <PopoverContent className="!w-72 !rounded-none !p-0 !gap-0" align="end">
            <div className="toolbar-menu">
              <label className="toolbar-field">
                <span>Projeto</span>
                <select value={filters.projectId} onChange={(e) => onFiltersChange({ projectId: e.target.value })}>
                  <option value="">Todos os projetos</option>
                  {projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
                </select>
              </label>
              <label className="toolbar-field">
                <span>Responsável</span>
                <select value={filters.assigneeId} onChange={(e) => onFiltersChange({ assigneeId: e.target.value })}>
                  <option value="">Todos os responsáveis</option>
                  {members.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}
                </select>
              </label>
              <label className="toolbar-field">
                <span>Status</span>
                <select value={filters.status} onChange={(e) => onFiltersChange({ status: e.target.value })}>
                  <option value="">Todos os status</option>
                  {STATUS_GROUPS.map((group) => (
                    <optgroup label={group.label} key={group.value}>
                      {TASK_STATUSES.filter((status) => status.group === group.value).map((status) => (
                        <option value={status.value} key={status.value}>{status.label}</option>
                      ))}
                    </optgroup>
                  ))}
                  <option value="atrasada">Atrasada</option>
                </select>
              </label>
              <label className="toolbar-field">
                <span>Lista</span>
                <select value={filters.list} onChange={(e) => onFiltersChange({ list: e.target.value as TaskListKind | "" })}>
                  <option value="">Todas as listas</option>
                  {TASK_LIST_KINDS.map((kind) => <option value={kind.value} key={kind.value}>{kind.label}</option>)}
                </select>
              </label>
              <button type="button" className="toolbar-toggle" onClick={() => onFiltersChange({ showFinalized: !filters.showFinalized })} aria-pressed={filters.showFinalized}>
                {filters.showFinalized ? <EyeOff size={14} /> : <Eye size={14} />}
                {filters.showFinalized ? "Ocultar finalizadas" : "Mostrar finalizadas"}
              </button>
              {activeCount ? (
                <button
                  type="button"
                  className="toolbar-clear"
                  onClick={() => onFiltersChange({ projectId: "", assigneeId: "", status: "", list: "", showFinalized: false })}
                >
                  Limpar filtros
                </button>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger render={<button type="button" className="toolbar-button icon-only" aria-label="Exibição" />}>
            <Settings2 size={15} />
          </PopoverTrigger>
          <PopoverContent className="!w-72 !rounded-none !p-0 !gap-0" align="end">
            <div className="toolbar-menu">
              <div className="toolbar-section">
                <span className="toolbar-section-label">Formato da data</span>
                {DATE_FORMATS.map((format) => (
                  <label className="toolbar-radio" key={format.key}>
                    <input
                      type="radio"
                      name="date-format"
                      checked={dateFormat === format.key}
                      onChange={() => onDateFormatChange(format.key)}
                    />
                    <span>{format.label}</span>
                    <small>{format.hint}</small>
                  </label>
                ))}
              </div>
              {view === "lista" ? (
                <div className="toolbar-section">
                  <span className="toolbar-section-label">Colunas visíveis</span>
                  {TASK_COLUMNS.map((column) => (
                    <label className="toolbar-check" key={column.key}>
                      <input type="checkbox" checked={visibleColumns.includes(column.key)} onChange={() => onToggleColumn(column.key)} />
                      <span>{column.label}</span>
                    </label>
                  ))}
                </div>
              ) : null}
              {canEdit ? (
                <div className="toolbar-section">
                  <span className="toolbar-section-label">Cores dos status</span>
                  <StatusColorPicker colors={statusColors} onSaved={onStatusColorsSaved} />
                </div>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>

        <div className="view-toggle" role="tablist" aria-label="Alternar visualização">
          <button type="button" role="tab" aria-selected={view === "lista"} className={view === "lista" ? "active" : ""} onClick={() => onViewChange("lista")}>
            <List size={14} /> Lista
          </button>
          <button type="button" role="tab" aria-selected={view === "calendario"} className={view === "calendario" ? "active" : ""} onClick={() => onViewChange("calendario")}>
            <CalendarDays size={14} /> Calendário
          </button>
        </div>
      </div>
    </div>
  );
}
