"use client";

import { CalendarDays, Eye, EyeOff, List, Settings2, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button, Check, IconButton, SearchInput, Segmented, Select as VzSelect, Toolbar } from "@/components/vz";
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
              <label className="toolbar-field">
                <span>Projeto</span>
                <VzSelect value={filters.projectId} onChange={(e) => onFiltersChange({ projectId: e.target.value })}>
                  <option value="">Todos os projetos</option>
                  {projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
                </VzSelect>
              </label>
              <label className="toolbar-field">
                <span>Responsável</span>
                <VzSelect value={filters.assigneeId} onChange={(e) => onFiltersChange({ assigneeId: e.target.value })}>
                  <option value="">Todos os responsáveis</option>
                  {members.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}
                </VzSelect>
              </label>
              <label className="toolbar-field">
                <span>Status</span>
                <VzSelect value={filters.status} onChange={(e) => onFiltersChange({ status: e.target.value })}>
                  <option value="">Todos os status</option>
                  {STATUS_GROUPS.map((group) => (
                    <optgroup label={group.label} key={group.value}>
                      {TASK_STATUSES.filter((status) => status.group === group.value).map((status) => (
                        <option value={status.value} key={status.value}>{status.label}</option>
                      ))}
                    </optgroup>
                  ))}
                  <option value="atrasada">Atrasada</option>
                </VzSelect>
              </label>
              <label className="toolbar-field">
                <span>Lista</span>
                <VzSelect value={filters.list} onChange={(e) => onFiltersChange({ list: e.target.value as TaskListKind | "" })}>
                  <option value="">Todas as listas</option>
                  {TASK_LIST_KINDS.map((kind) => <option value={kind.value} key={kind.value}>{kind.label}</option>)}
                </VzSelect>
              </label>
              <Button type="button" variant={filters.showFinalized ? "soft" : "secondary"} onClick={() => onFiltersChange({ showFinalized: !filters.showFinalized })} aria-pressed={filters.showFinalized}>
                {filters.showFinalized ? <EyeOff size={14} /> : <Eye size={14} />}
                {filters.showFinalized ? "Ocultar finalizadas" : "Mostrar finalizadas"}
              </Button>
              {activeCount ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onFiltersChange({ projectId: "", assigneeId: "", status: "", list: "", showFinalized: false })}
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
