import { getSupabase } from "../supabase-client";
import { TimelineInputError, type TimelineInput, type TimelineItem } from "./model";

type Row = {
  id: string; project_id: string; kind: TimelineItem["kind"]; title: string; detail: string | null;
  starts_on: string | null; ends_on: string | null; said_on: string | null; status: TimelineItem["status"];
  replaced_by: string | null; source_id: string | null; source_label: string | null;
  created_by: string | null; created_at: string; updated_at: string;
};

const toItem = (row: Row): TimelineItem => ({
  id: row.id, projectId: row.project_id, kind: row.kind, title: row.title, detail: row.detail ?? "",
  startsOn: row.starts_on ?? undefined, endsOn: row.ends_on ?? undefined, saidOn: row.said_on ?? undefined,
  status: row.status, replacedById: row.replaced_by ?? undefined, sourceId: row.source_id ?? undefined,
  sourceLabel: row.source_label ?? undefined, createdBy: row.created_by ?? undefined,
  createdAt: row.created_at, updatedAt: row.updated_at,
});

const COLUNAS: Record<keyof TimelineInput, string> = {
  kind: "kind", title: "title", detail: "detail", startsOn: "starts_on", endsOn: "ends_on",
  saidOn: "said_on", status: "status", sourceId: "source_id", sourceLabel: "source_label",
};

function paraLinha(input: Partial<TimelineInput>): Record<string, unknown> {
  const linha: Record<string, unknown> = {};
  for (const [chave, coluna] of Object.entries(COLUNAS)) {
    const valor = input[chave as keyof TimelineInput];
    if (valor !== undefined) linha[coluna] = valor;
  }
  return linha;
}

export async function listTimeline(projectId: string): Promise<TimelineItem[]> {
  const { data, error } = await getSupabase().from("project_timeline").select("*").eq("project_id", projectId).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as Row[]).map(toItem);
}

async function getItem(projectId: string, itemId: string): Promise<TimelineItem | undefined> {
  const { data, error } = await getSupabase().from("project_timeline").select("*").eq("project_id", projectId).eq("id", itemId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toItem(data as Row) : undefined;
}

/** Cria um item. Com `substitui`, o item antigo vira "substituído" e passa a
 * apontar para o novo: é assim que uma mudança de objetivo fica registrada. */
export async function createTimelineItem(projectId: string, input: TimelineInput, createdBy: string, substitui?: string): Promise<TimelineItem> {
  const antigo = substitui ? await getItem(projectId, substitui) : undefined;
  if (substitui && !antigo) throw new TimelineInputError("O item a substituir não existe neste cliente.");
  const { data, error } = await getSupabase().from("project_timeline")
    .insert({ ...paraLinha(input), project_id: projectId, created_by: createdBy }).select("*").single();
  if (error) throw new Error(error.message);
  const novo = toItem(data as Row);
  if (antigo) await updateTimelineItem(projectId, antigo.id, { status: "substituido" }, novo.id);
  return novo;
}

export async function updateTimelineItem(projectId: string, itemId: string, patch: Partial<TimelineInput>, replacedBy?: string): Promise<TimelineItem> {
  const atual = await getItem(projectId, itemId);
  if (!atual) throw new TimelineInputError("Item não encontrado neste cliente.");
  const inicio = patch.startsOn !== undefined ? patch.startsOn : atual.startsOn;
  const fim = patch.endsOn !== undefined ? patch.endsOn : atual.endsOn;
  if (inicio && fim && fim < inicio) throw new TimelineInputError("O fim não pode ser antes do início.");
  const linha: Record<string, unknown> = { ...paraLinha(patch), updated_at: new Date().toISOString() };
  if (replacedBy !== undefined) linha.replaced_by = replacedBy;
  // Voltar a vigente desfaz a substituição: o link para o "novo" deixa de fazer sentido.
  if (patch.status === "vigente") linha.replaced_by = null;
  const { data, error } = await getSupabase().from("project_timeline").update(linha).eq("project_id", projectId).eq("id", itemId).select("*").single();
  if (error) throw new Error(error.message);
  return toItem(data as Row);
}

export async function deleteTimelineItem(projectId: string, itemId: string): Promise<boolean> {
  const { data, error } = await getSupabase().from("project_timeline").delete().eq("project_id", projectId).eq("id", itemId).select("id");
  if (error) throw new Error(error.message);
  return Boolean(data?.length);
}
