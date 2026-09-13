import { describe, expect, it } from "vitest";
import { organizeClientPackages, type ClientPackage, type PackageContent } from "../src/lib/client-packages";

const packages: ClientPackage[] = [1, 2].map((n) => ({ id: `c${n}`, planId: "plan", label: `${n}ª Captação`, packageKind: "capture", sequenceOrder: n }));
const videos = (count: number): PackageContent[] => Array.from({ length: count }, (_, index) => ({ id: `v${index}`, planId: "plan", planKind: "content", captacaoLabel: null, formatLabel: "Reels", status: "aprovacao_copy", dueDate: `2026-10-${String(index + 5).padStart(2, "0")}`, sequenceOrder: index }));
const counts = (items: ReturnType<typeof organizeClientPackages>) => packages.map((pkg) => items.filter((item) => item.clientPackageId === pkg.id).length);

describe("pacotes de conteúdo do cliente", () => {
  it.each([[10, [5, 5]], [12, [6, 6]], [11, [6, 5]], [3, [2, 1]]])("distribui %i vídeos em duas captações", (total, expected) => {
    const items = videos(total as number).reverse();
    const result = organizeClientPackages(items, packages);
    expect(counts(result)).toEqual(expected);
    expect(result.find((item) => item.id === "v0")?.clientPackageId).toBe("c1");
    expect(items[0].captacaoLabel).toBeNull();
  });
  it("antecipa vídeos que precisam ser publicados antes da segunda captação mais edição", () => {
    const result = organizeClientPackages(videos(10), [{ ...packages[0], date: "2026-10-01" }, { ...packages[1], date: "2026-10-09" }]);
    expect(counts(result)).toEqual([7, 3]);
    expect(result.find((item) => item.id === "v6")?.clientPackageId).toBe("c1");
    expect(result.find((item) => item.id === "v7")?.clientPackageId).toBe("c2");
  });
  it("sinaliza publicação sem tempo para produção", () => {
    const result = organizeClientPackages(videos(1), packages.map((pkg) => ({ ...pkg, date: "2026-10-10" })));
    expect(result[0].clientPackageWarning).toContain("Rever datas");
  });
  it("usa duas captações quando o plano ainda não tem pacotes", () => {
    const result = organizeClientPackages(videos(10), []);
    expect(result.filter((item) => item.clientPackageLabel === "1ª Captação")).toHaveLength(5);
    expect(result.filter((item) => item.clientPackageLabel === "2ª Captação")).toHaveLength(5);
    expect(result.every((item) => item.clientPackageWarning?.includes("a definir"))).toBe(true);
  });
  it("não mistura planos nem perde carrosséis, estáticos ou itens sem data", () => {
    const items = [...videos(2), { ...videos(1)[0], id: "other", planId: "other" }, { ...videos(1)[0], id: "carousel", formatLabel: "Carrossel" }, { ...videos(1)[0], id: "static", formatLabel: "Estático" }, { ...videos(1)[0], id: "undated", dueDate: null }];
    const result = organizeClientPackages(items, []);
    expect(new Set(result.map((item) => item.id)).size).toBe(items.length);
    expect(result.find((item) => item.id === "other")?.clientPackageId).not.toBe(result[0].clientPackageId);
    expect(result.find((item) => item.id === "carousel")?.clientPackageLabel).toBe("Carrosséis");
    expect(result.find((item) => item.id === "static")?.clientPackageLabel).toBe("Estáticos");
    expect(result.find((item) => item.id === "undated")?.clientPackageWarning).toContain("provisória");
  });
  it("preserva produção iniciada e pacotes explícitos de criação", () => {
    const creation: ClientPackage = { ...packages[0], id: "creation", label: "Vídeos de acervo", packageKind: "creation" };
    const result = organizeClientPackages([{ ...videos(1)[0], status: "em_criacao", captacaoId: "c2" }, { ...videos(1)[0], id: "archive", captacaoId: "creation" }], [...packages, creation]);
    expect(result[0].clientPackageId).toBe("c2");
    expect(result[1].clientPackageLabel).toBe("Vídeos de acervo");
  });
  it("não trata passos de processo como gravações", () => {
    const result = organizeClientPackages([{ ...videos(1)[0], planKind: "process" }], []);
    expect(result[0].clientPackageLabel).toBe("Etapas do processo");
  });
});
