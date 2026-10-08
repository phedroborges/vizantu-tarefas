import { getSupabase } from "../supabase-client";
import type { ProjectResult, ResultsReport } from "./types";

type Row = { id: string; project_id: string; title: string; report: ResultsReport; created_at: string };

/** Os relatórios de um cliente, do mais novo para o mais antigo. */
export async function listProjectResults(projectId: string): Promise<ProjectResult[]> {
  const { data, error } = await getSupabase().from("project_results").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Row[]).map((row) => ({ id: row.id, projectId: row.project_id, title: row.title, report: row.report, createdAt: row.created_at }));
}
