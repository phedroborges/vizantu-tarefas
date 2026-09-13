import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/lib/finance/types";
import { validateSettings, mutateFinance } from "../src/lib/finance/storage";
import { vi } from "vitest";
vi.mock("@/lib/supabase-client", () => ({ getSupabase: () => ({}) }));
describe("entrada de dados financeiros",()=>{
  it("aceita a configuração inicial sem inventar alíquota",()=>{expect(validateSettings(DEFAULT_SETTINGS).taxRate).toBeNull();});
  it.each([{taxRate:100},{taxRate:-1},{targetMargin:NaN},{openingDate:"2026-02-31"},{deadlineMode:"invalid"},{penaltyMode:"invalid"},{extraCard:1.2}])("recusa configuração inválida %s",patch=>{expect(()=>validateSettings({...DEFAULT_SETTINGS,...patch})).toThrow();});
  it("recusa categoria incompatível com a direção antes de escrever",async()=>{await expect(mutateFinance({action:"entry",direction:"income",category:"retiradas"},"owner")).rejects.toThrow("Categoria inválida");});
});
