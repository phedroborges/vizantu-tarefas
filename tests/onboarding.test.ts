import { describe, expect, it } from "vitest";
import { applyPatch, EMPTY_ONBOARDING, itemApplies, parsePatch, progressOf, SECTIONS } from "../src/lib/onboarding/checklist";

const todos = SECTIONS.flatMap((section) => section.items);

describe("a lista do onboard", () => {
  it("cada item tem uma chave só, porque é por ela que a marcação fica guardada", () => {
    const chaves = todos.map((item) => item.key);
    expect(new Set(chaves).size).toBe(chaves.length);
    for (const section of SECTIONS) for (const item of section.items) expect(item.key.startsWith(`${section.id}.`), item.key).toBe(true);
  });

  it("tem as áreas que o processo exige, ERP incluído", () => {
    const ids = SECTIONS.map((section) => section.id);
    for (const id of ["meta", "gmn", "site", "wa", "trg", "crm", "erp", "acc", "zr", "sec", "fin"]) expect(ids).toContain(id);
  });
});

describe("o que vale para cada cliente", () => {
  const vale = (fields: Parameters<typeof itemApplies>[1]) => todos.filter((item) => itemApplies(item, fields)).map((item) => item.key);

  it("sem resposta na ficha, o cliente conta como quem tem site e a lista fica completa", () => {
    const keys = vale({});
    expect(keys).toContain("site.dominio");
    expect(keys).not.toContain("site.oferecer");
    expect(keys).not.toContain("crm.chatwoot");
  });

  it("sem site, some o que depende do site e entra o de oferecer", () => {
    const keys = vale({ site: "nao" });
    expect(keys).toContain("site.oferecer");
    expect(keys).not.toContain("site.clarity");
    expect(keys).not.toContain("zr.clarity");
    expect(keys).toContain("zr.tintim");
  });

  it("sem ERP ou sem CRM, esses blocos saem da conta; com Chatwoot, entra o dele", () => {
    expect(vale({ erp: "nao" }).some((key) => key.startsWith("erp."))).toBe(false);
    expect(vale({ erp: "simplesvet" })).toContain("erp.api");
    expect(vale({ crm: "nao" }).some((key) => key.startsWith("crm."))).toBe(false);
    expect(vale({ crm: "chat" })).toContain("crm.chatwoot");
    expect(vale({ crm: "outro" })).not.toContain("crm.chatwoot");
  });

  it("o progresso conta só o que vale", () => {
    const base = progressOf(EMPTY_ONBOARDING);
    expect(base.done).toBe(0);
    const semErp = progressOf({ checks: {}, fields: { erp: "nao" } });
    expect(semErp.total).toBeLessThan(base.total);
    const marcado = progressOf({ checks: { "meta.pagina": "2026-11-12", "site.oferecer": "2026-11-12" }, fields: {} });
    // "site.oferecer" não vale para quem tem site: não pode inflar o progresso.
    expect(marcado.done).toBe(1);
    expect(marcado.perSection.meta.done).toBe(1);
  });
});

describe("o pedido que a tela manda", () => {
  it("aceita marcação, ficha e observação válidas", () => {
    expect(parsePatch({ checks: { "meta.pagina": true }, fields: { erp: "onepet", erpOutro: "  x " }, notes: "ok" })).toEqual({ checks: { "meta.pagina": true }, fields: { erp: "onepet", erpOutro: "x" }, notes: "ok" });
  });

  it("recusa chave, valor ou formato que a tela não conhece", () => {
    expect(() => parsePatch({ checks: { "nao.existe": true } })).toThrow();
    expect(() => parsePatch({ checks: { "meta.pagina": "sim" } })).toThrow();
    expect(() => parsePatch({ fields: { erp: "sap" } })).toThrow();
    expect(() => parsePatch({ fields: { qualquer: "x" } })).toThrow();
    expect(() => parsePatch({ notes: 5 })).toThrow();
    expect(() => parsePatch(null)).toThrow();
    expect(() => parsePatch([])).toThrow();
  });

  it("limita o tamanho dos textos", () => {
    expect(parsePatch({ notes: "a".repeat(5000) }).notes).toHaveLength(4000);
    expect(parsePatch({ fields: { erpOutro: "b".repeat(200) } }).fields?.erpOutro).toHaveLength(80);
  });
});

describe("aplicar o pedido sobre o que já estava guardado", () => {
  const antes = { checks: { "meta.pagina": "2026-11-10" }, fields: { site: "nao" }, notes: "velha", updatedAt: null };

  it("item já marcado mantém a data original; item novo recebe a de hoje", () => {
    const depois = applyPatch(antes, { checks: { "meta.pagina": true, "meta.perfil": true } }, "2026-11-12");
    expect(depois.checks).toEqual({ "meta.pagina": "2026-11-10", "meta.perfil": "2026-11-12" });
  });

  it("desmarcar tira só aquele item e não mexe no resto", () => {
    const depois = applyPatch(antes, { checks: { "meta.pagina": false } }, "2026-11-12");
    expect(depois.checks).toEqual({});
    expect(depois.fields).toEqual({ site: "nao" });
    expect(depois.notes).toBe("velha");
  });

  it("mudar uma resposta da ficha preserva as outras", () => {
    const depois = applyPatch(antes, { fields: { erp: "onepet" } }, "2026-11-12");
    expect(depois.fields).toEqual({ site: "nao", erp: "onepet" });
  });
});
