"use client";

// Resultados do cliente: os relatórios publicados e o PDF de cada um.
//
// Não há criação nem edição aqui, de propósito. O relatório é montado fora do
// app, a partir dos dados de cada canal, e chega pronto. Esta tela mostra o que
// existe e gera o PDF na hora, com o mesmo código que define o seu desenho.

import { Download, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, EmptyState } from "@/components/vz";
import { VzLoading } from "@/components/vz/loading";
import { formatDateTime } from "@/lib/dates";
import { responseError } from "@/lib/request-error";
import type { ProjectResult } from "@/lib/results/types";

export function ProjectResultsPanel({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [results, setResults] = useState<ProjectResult[] | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const response = await fetch(`/api/projects/${projectId}/results`);
      if (!alive) return;
      if (!response.ok) { setMessage(await responseError(response, "carregar os resultados")); setResults([]); return; }
      setResults((await response.json()).results);
    })();
    return () => { alive = false; };
  }, [projectId]);

  async function download(result: ProjectResult) {
    setBusy(result.id);
    setMessage("");
    try {
      const [{ buildResultsPdf }, { loadStatementAssets }, { loadReportImages }] = await Promise.all([
        import("@/lib/results/report-pdf"), import("@/lib/finance/statement-assets"), import("@/lib/results/report-assets"),
      ]);
      const [assets, { images, failed }] = await Promise.all([loadStatementAssets(), loadReportImages(result.report)]);
      const { pdf, filename } = buildResultsPdf({ clientName: projectName, title: result.title, report: result.report, assets, images });
      await pdf.save(filename, { returnPromise: true });
      if (failed.length) setMessage(`O PDF foi gerado sem ${failed.length === 1 ? "1 imagem que não carregou" : `${failed.length} imagens que não carregaram`}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setBusy("");
    }
  }

  if (!results) return <Card><VzLoading label="Carregando os resultados…" /></Card>;

  return (
    <Card className="project-results">
      <div className="project-section-head">
        <div>
          <h2><TrendingUp size={14} /> Resultados</h2>
          <p>{results.length ? `${results.length} ${results.length === 1 ? "relatório publicado" : "relatórios publicados"} para ${projectName}.` : `Relatórios de resultados de ${projectName}.`}</p>
        </div>
      </div>

      {message ? <p className="form-message" role="status">{message}</p> : null}

      {results.length ? <ul className="project-results__list">{results.map((result) => (
        <li key={result.id}>
          <div className="project-results__head">
            <div>
              <strong>{result.title}</strong>
              <span>{result.report.period} · publicado em {formatDateTime(result.createdAt)}</span>
            </div>
            <Button variant="primary" type="button" onClick={() => download(result)} disabled={busy !== ""}><Download size={14} /> {busy === result.id ? "Gerando…" : "Baixar PDF"}</Button>
          </div>
          {result.report.kpis?.length ? <div className="project-results__kpis">{result.report.kpis.slice(0, 4).map((kpi) => (
            <div key={kpi.label}><span>{kpi.label}</span><strong>{kpi.value}</strong>{kpi.delta ? <em className={kpi.trend === "up" ? "is-up" : kpi.trend === "down" ? "is-down" : undefined}>{kpi.delta}</em> : null}</div>
          ))}</div> : null}
          {result.report.intro ? <p className="project-results__intro">{result.report.intro}</p> : null}
        </li>
      ))}</ul> : !message ? <EmptyState icon={<TrendingUp size={28} />} title="Nenhum resultado publicado ainda" description="Os relatórios deste cliente aparecem aqui assim que forem publicados." /> : null}
    </Card>
  );
}
