import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildResultsPdf } from "../src/lib/results/report-pdf";
import type { ResultsReport } from "../src/lib/results/types";

const asset = (path: string) => readFileSync(fileURLToPath(new URL(`../public/${path}`, import.meta.url))).toString("base64");
const assets = { logo: asset("brand/vizantu-pdf.png"), regular: asset("fonts/vizantu-pdf-regular.ttf"), semibold: asset("fonts/vizantu-pdf-semibold.ttf") };

const report: ResultsReport = {
  period: "Setembro de 2026",
  intro: "O mês fechou com crescimento de alcance e de contatos. O carrossel de bastidores foi o conteúdo com mais salvamentos.",
  kpis: [
    { label: "Alcance", value: "128.400", delta: "+22% vs. agosto", trend: "up" },
    { label: "Novos seguidores", value: "1.312", delta: "+9%", trend: "up" },
    { label: "Contatos", value: "86", delta: "-4%", trend: "down" },
    { label: "Investimento", value: "R$ 2.400,00" },
  ],
  sections: [
    {
      title: "Instagram", eyebrow: "Orgânico", summary: "Reels puxaram o alcance; carrosséis puxaram os salvamentos.",
      metrics: [{ label: "Alcance", value: "96.200", delta: "+18%", trend: "up" }, { label: "Engajamento", value: "5,4%", delta: "+0,6 p.p.", trend: "up" }, { label: "Salvamentos", value: "1.840" }, { label: "Visitas ao perfil", value: "7.310", delta: "-2%", trend: "down" }],
      bars: { title: "ALCANCE POR CONTEÚDO", items: [{ label: "Reels: bastidores do show", value: 31200, display: "31.200" }, { label: "Carrossel: agenda", value: 18400, display: "18.400" }, { label: "Stories", value: 9100, display: "9.100" }] },
      highlights: ["Reels com gancho nos três primeiros segundos seguraram mais a audiência.", "Publicações às terças e quintas tiveram o melhor desempenho."],
    },
    {
      title: "Meta Ads", eyebrow: "Mídia paga",
      table: { columns: ["Campanha", "Investimento", "Resultados", "Custo por resultado"], rows: [["Captação de contatos", "R$ 1.500,00", "62", "R$ 24,19"], ["Reconhecimento", "R$ 900,00", "74.000", "R$ 12,16 / mil"]] },
    },
  ],
  nextSteps: ["Dobrar a frequência de Reels de bastidores.", "Testar um novo criativo na campanha de captação."],
  notes: ["Fonte: Meta Business Suite e Gerenciador de Anúncios, de 01/09 a 30/09/2026."],
};

describe("PDF do relatório de resultados", () => {
  it("gera o documento com o cliente, o período e o nome de arquivo certos", () => {
    const { pdf, filename } = buildResultsPdf({ clientName: "Sanfér Produções", title: "Relatório de resultados", report, assets });
    expect(filename).toBe("vizantu-resultados-sanfer-producoes-setembro-de-2026.pdf");
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(pdf.output().length).toBeGreaterThan(20_000);
  });

  // Um relatório simples, só com uma seção de texto, também precisa sair.
  it("aceita o relatório mínimo", () => {
    const { pdf } = buildResultsPdf({ clientName: "Cliente", title: "Relatório de resultados", report: { period: "Outubro de 2026", sections: [{ title: "Instagram", summary: "Mês de estreia." }] }, assets });
    expect(pdf.getNumberOfPages()).toBe(1);
  });

  it("pagina um relatório longo sem cortar conteúdo", () => {
    const many: ResultsReport = { ...report, sections: Array.from({ length: 8 }, (_, index) => ({ ...report.sections[0], title: `Canal ${index + 1}` })) };
    expect(buildResultsPdf({ clientName: "Cliente", title: "Relatório de resultados", report: many, assets }).pdf.getNumberOfPages()).toBeGreaterThan(2);
  });

  it("ignora a imagem que não foi carregada em vez de quebrar", () => {
    const withImage: ResultsReport = { period: "Outubro de 2026", sections: [{ title: "Instagram", images: [{ url: "https://exemplo.com/print.png", caption: "Melhor post" }] }] };
    expect(() => buildResultsPdf({ clientName: "Cliente", title: "Relatório de resultados", report: withImage, assets })).not.toThrow();
  });
});
