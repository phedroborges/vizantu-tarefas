// O relatório de resultados de um cliente.
//
// É um documento de dados, não de layout: quem monta descreve o que aconteceu
// (números, comparações, destaques, imagens) e o gerador de PDF cuida da forma.
// Não existe tela de criação — o relatório é escrito fora do app e gravado
// pronto em project_results. Por isso tudo aqui é opcional o bastante para um
// relatório simples caber, e livre o bastante para um canal novo não exigir
// mudança de código.

export type ResultsTrend = "up" | "down" | "flat";

export type ResultsMetric = {
  label: string;
  /** Já formatado para leitura: "12.480", "R$ 3.210,00", "4,8%". */
  value: string;
  /** Comparação com o período anterior: "+18%", "-3 p.p.". */
  delta?: string;
  /** Se a variação é boa (up), ruim (down) ou neutra. Não é o sinal do número:
   * custo por resultado caindo é "up". */
  trend?: ResultsTrend;
};

export type ResultsSection = {
  /** Canal ou assunto: "Instagram", "Meta Ads", "Site". */
  title: string;
  /** Linha pequena acima do título: "ORGÂNICO", "MÍDIA PAGA". */
  eyebrow?: string;
  /** Leitura dos números, em texto corrido. */
  summary?: string;
  metrics?: ResultsMetric[];
  /** Comparação em barras horizontais: melhores posts, campanhas, públicos. */
  bars?: { title?: string; items: { label: string; value: number; display?: string }[] };
  table?: { columns: string[]; rows: string[][] };
  /** O que funcionou, em tópicos. */
  highlights?: string[];
  /** Prints e criativos. `url` é um endereço público (https). */
  images?: { url: string; caption?: string }[];
};

export type ResultsReport = {
  /** Mês ou intervalo, como deve aparecer: "Setembro de 2026". */
  period: string;
  /** Resumo executivo: o que o cliente precisa saber se ler só isto. */
  intro?: string;
  /** Os números do topo. O primeiro ganha destaque. */
  kpis?: ResultsMetric[];
  sections: ResultsSection[];
  nextSteps?: string[];
  /** Fonte dos dados e observações de método. */
  notes?: string[];
};

export type ProjectResult = {
  id: string;
  projectId: string;
  title: string;
  report: ResultsReport;
  createdAt: string;
};
