import { getSupabase } from "../supabase-client";
import { applyPatch, EMPTY_ONBOARDING, type OnboardingData, type OnboardingPatch } from "./checklist";

type Row = { checks: Record<string, string> | null; fields: OnboardingData["fields"] | null; notes: string | null; updated_at: string };

const toData = (row: Row): OnboardingData => ({ checks: row.checks ?? {}, fields: row.fields ?? {}, notes: row.notes ?? "", updatedAt: row.updated_at });

/** A data de hoje no fuso do time, para a data de cada marcação. */
export const todayInSaoPaulo = () => new Date().toLocaleDateString("sv", { timeZone: "America/Sao_Paulo" });

/** Cliente que ainda não começou o onboard volta vazio, sem erro. */
export async function getOnboarding(projectId: string): Promise<OnboardingData> {
  const { data, error } = await getSupabase().from("project_onboarding").select("checks, fields, notes, updated_at").eq("project_id", projectId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toData(data as Row) : EMPTY_ONBOARDING;
}

/** Aplica só o que mudou sobre o que está guardado: a tela manda uma marcação
 * por vez, então duas pessoas marcando itens diferentes não se sobrescrevem. */
export async function saveOnboarding(projectId: string, patch: OnboardingPatch): Promise<OnboardingData> {
  const next = applyPatch(await getOnboarding(projectId), patch, todayInSaoPaulo());
  const { data, error } = await getSupabase().from("project_onboarding")
    .upsert({ project_id: projectId, checks: next.checks, fields: next.fields, notes: next.notes, updated_at: new Date().toISOString() }, { onConflict: "project_id" })
    .select("checks, fields, notes, updated_at").single();
  if (error) throw new Error(error.message);
  return toData(data as Row);
}
