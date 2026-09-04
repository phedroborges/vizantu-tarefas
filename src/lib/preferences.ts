// Preferências de exibição de CADA PESSOA — como ela gosta de ver o app.
// Moram no banco (member_preferences), atreladas à conta e não ao navegador,
// então trocar de máquina não zera o jeito de trabalhar de ninguém.
//
// O que NÃO entra aqui: as cores dos status. Aquilo é padrão da casa, vale pro
// time inteiro e só o dono muda (ver /api/status-colors). Cor não é gosto de
// quem olha, é código visual compartilhado — se cada um pintasse o seu, duas
// pessoas olhando a mesma tela veriam coisas diferentes.
//
// Também ficam de fora a busca e os filtros de projeto/responsável/status: são
// recortes do momento ("o que a Erika tem pra hoje"), não jeito de trabalhar.
// Um filtro grudado entre sessões faz a pessoa achar que sumiram tarefas.

import { DEFAULT_DATE_FORMAT, isDateFormatKey, type DateFormatKey } from "./date-format";
import { TASK_COLUMNS, type TaskColumnKey } from "./types";

export type TaskView = "lista" | "calendario";

export type MemberPreferences = {
  taskView: TaskView;
  taskColumns: TaskColumnKey[];
  /** Largura em px de cada coluna que a pessoa arrastou. O que não está aqui
      usa a largura padrão da coluna. Mora junto das outras preferências, e não
      no navegador, pelo mesmo motivo delas: trocar de máquina não pode zerar
      o jeito de trabalhar de ninguém. */
  taskColumnWidths: Partial<Record<TaskColumnKey | "name", number>>;
  dateFormat: DateFormatKey;
  showFinalized: boolean;
};

const KNOWN_COLUMNS = new Set(TASK_COLUMNS.map((column) => column.key));
const DEFAULT_COLUMNS = TASK_COLUMNS.filter((column) => column.defaultVisible).map((column) => column.key);

export function defaultPreferences(): MemberPreferences {
  return {
    taskView: "lista",
    taskColumns: [...DEFAULT_COLUMNS],
    taskColumnWidths: {},
    dateFormat: DEFAULT_DATE_FORMAT,
    showFinalized: false,
  };
}

function normalizeColumns(value: unknown): TaskColumnKey[] {
  if (!Array.isArray(value)) return [...DEFAULT_COLUMNS];
  const filtered = value.filter((key): key is TaskColumnKey => KNOWN_COLUMNS.has(key as TaskColumnKey));
  // Lista vazia é escolha legítima (a pessoa desmarcou tudo e só quer o nome
  // da tarefa) — só cai no padrão o que não é lista de verdade.
  return Array.from(new Set(filtered));
}

// Largura salva é número solto vindo do banco: uma coluna com -4000px ou com
// "muito" gravado quebraria a tabela inteira. Fica presa entre 72 e 720.
const LARGURA_MIN = 72;
const LARGURA_MAX = 720;

function normalizeWidths(value: unknown): MemberPreferences["taskColumnWidths"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const saida: MemberPreferences["taskColumnWidths"] = {};
  for (const [chave, largura] of Object.entries(value as Record<string, unknown>)) {
    if (chave !== "name" && !KNOWN_COLUMNS.has(chave as TaskColumnKey)) continue;
    if (typeof largura !== "number" || !Number.isFinite(largura)) continue;
    saida[chave as TaskColumnKey | "name"] = Math.min(LARGURA_MAX, Math.max(LARGURA_MIN, Math.round(largura)));
  }
  return saida;
}

// Toda leitura passa por aqui: o jsonb do banco é dado solto, e uma coluna
// removida numa versão futura não pode quebrar a tela de quem tinha ela salva.
export function normalizePreferences(raw: unknown): MemberPreferences {
  const base = defaultPreferences();
  if (!raw || typeof raw !== "object") return base;
  const value = raw as Record<string, unknown>;

  return {
    taskView: value.taskView === "calendario" || value.taskView === "lista" ? value.taskView : base.taskView,
    taskColumns: value.taskColumns === undefined ? base.taskColumns : normalizeColumns(value.taskColumns),
    taskColumnWidths: normalizeWidths(value.taskColumnWidths),
    dateFormat: isDateFormatKey(value.dateFormat) ? value.dateFormat : base.dateFormat,
    showFinalized: typeof value.showFinalized === "boolean" ? value.showFinalized : base.showFinalized,
  };
}

// Aceita só as chaves conhecidas, uma a uma — um PATCH não pode enfiar campo
// arbitrário no jsonb nem sobrescrever o que não veio no corpo.
export function mergePreferences(current: MemberPreferences, patch: unknown): MemberPreferences {
  if (!patch || typeof patch !== "object") return current;
  const value = patch as Record<string, unknown>;
  // Cada chave é listada de propósito, e não um spread: um patch vindo da rede
  // não pode injetar campo que o tipo não conhece. Quem adicionar preferência
  // nova precisa lembrar de listá-la AQUI também — foi o que faltou para a
  // largura de coluna, que era descartada em silêncio.
  return normalizePreferences({
    taskView: value.taskView ?? current.taskView,
    taskColumns: value.taskColumns ?? current.taskColumns,
    taskColumnWidths: value.taskColumnWidths ?? current.taskColumnWidths,
    dateFormat: value.dateFormat ?? current.dateFormat,
    showFinalized: value.showFinalized ?? current.showFinalized,
  });
}

export function toggleColumn(columns: TaskColumnKey[], key: TaskColumnKey): TaskColumnKey[] {
  return columns.includes(key) ? columns.filter((item) => item !== key) : [...columns, key];
}
