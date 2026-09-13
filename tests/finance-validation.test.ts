import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/lib/finance/types";
import { validateSettings, mutateFinance } from "../src/lib/finance/storage";
import { vi } from "vitest";
vi.mock("@/lib/supabase-client", () => ({ getSupabase: () => ({}) }));
describe("entrada de dados financeiros",()=>{
  // A Vizantu paga 6% sobre o faturamento, e isso é premissa da empresa, não
  // palpite do código: o padrão já nasce com a alíquota informada. Continuar
  // aceitando null importa — é assim que uma instalação diz "ainda não sei", e
  // o painel responde "indisponível" em vez de inventar imposto.
  it("nasce com os 6% informados pela empresa",()=>{expect(validateSettings(DEFAULT_SETTINGS).taxRate).toBe(6);});
  it("continua aceitando alíquota em branco como 'não configurado'",()=>{expect(validateSettings({...DEFAULT_SETTINGS,taxRate:null}).taxRate).toBeNull();});
  it("guarda o reajuste anual de contrato",()=>{expect(validateSettings({...DEFAULT_SETTINGS,annualAdjustment:7.5}).annualAdjustment).toBe(7.5);});
  it.each([{taxRate:100},{taxRate:-1},{targetMargin:NaN},{openingDate:"2026-02-31"},{deadlineMode:"invalid"},{penaltyMode:"invalid"},{extraCard:1.2},{annualAdjustment:-1},{annualAdjustment:101},{annualAdjustment:NaN}])("recusa configuração inválida %s",patch=>{expect(()=>validateSettings({...DEFAULT_SETTINGS,...patch})).toThrow();});
  it("recusa categoria incompatível com a direção antes de escrever",async()=>{await expect(mutateFinance({action:"entry",direction:"income",category:"retiradas"},"owner")).rejects.toThrow("Categoria inválida");});
});
