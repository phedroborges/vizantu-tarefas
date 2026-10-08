// O PDF do relatório de resultados.
//
// Mesma linguagem visual do extrato de produção (finance/statement-pdf.ts):
// faixa roxa no topo, logo, bloco de abertura lilás, números em caixas, cartões
// brancos com contorno fino e rodapé com paginação. A diferença é o conteúdo:
// aqui o documento é para o cliente, então o texto é o do relatório e nada
// aponta para dentro do sistema.

import { jsPDF } from "jspdf";
import type { StatementAssets } from "../finance/statement-assets";
import type { ResultsMetric, ResultsReport, ResultsSection } from "./types";

// A paleta de impressão espelha src/styles/vizantu.css (tema claro).
const C = { brand: "#9147ff", strong: "#6435e7", deep: "#4b23b8", soft: "#f2ecff", bg: "#f6f6fa", line: "#ebecf2", text: "#14151c", muted: "#6d7183", white: "#ffffff", green: "#1c7a3f", red: "#b3322b", redBg: "#fdeeee", redLine: "#f3c9c6", gray: "#b9bcc9" };

/** Imagem já carregada: os bytes em data URL e o tamanho original, para manter
 * a proporção. */
export type ResultsImage = { data: string; width: number; height: number };

const LEFT = 16;
const RIGHT = 194;
const WIDTH = RIGHT - LEFT;
const BOTTOM = 273;

export function buildResultsPdf(input: { clientName: string; title: string; report: ResultsReport; assets: StatementAssets; images?: Record<string, ResultsImage> }) {
  const { clientName, title, report, assets, images = {} } = input;
  const pdf = new jsPDF({ putOnlyUsedFonts: true, compress: true });
  pdf.addFileToVFS("VizantuPDF-Regular.ttf", assets.regular);
  pdf.addFont("VizantuPDF-Regular.ttf", "VizantuPDF", "normal");
  pdf.addFileToVFS("VizantuPDF-Semibold.ttf", assets.semibold);
  pdf.addFont("VizantuPDF-Semibold.ttf", "VizantuPDF", "bold");
  pdf.setProperties({ title: `${title} - ${clientName} - ${report.period}`, author: "Vizantu" });

  const font = (size: number, bold = false, color = C.text) => {
    pdf.setFont("VizantuPDF", bold ? "bold" : "normal"); pdf.setFontSize(size); pdf.setTextColor(color);
  };
  const text = (value: string, x: number, y: number, size = 9, bold = false, color = C.text, align: "left" | "right" = "left") => {
    font(size, bold, color); pdf.text(value, x, y, { align });
  };
  const wrap = (value: string, width: number, size = 9, bold = false): string[] => {
    font(size, bold); return pdf.splitTextToSize(value, width) as string[];
  };
  const box = (x: number, y: number, width: number, height: number, fill: string, stroke = fill) => {
    pdf.setFillColor(fill); pdf.setDrawColor(stroke); pdf.setLineWidth(0.25); pdf.roundedRect(x, y, width, height, 2.5, 2.5, "FD");
  };
  const trendColor = (metric: ResultsMetric, onDark = false) => onDark ? C.white : metric.trend === "up" ? C.green : metric.trend === "down" ? C.red : C.muted;

  const header = (continuation = false) => {
    pdf.setFillColor(C.brand); pdf.rect(0, 0, 210, 2, "F");
    pdf.addImage(assets.logo, "PNG", LEFT, 13, 40, 40 * 295.55 / 1518.08, "vizantu-logo");
    text("RESULTADOS", RIGHT, 18.5, 8, true, C.muted, "right");
    if (continuation) {
      pdf.setDrawColor(C.line); pdf.line(LEFT, 27, RIGHT, 27);
      text(clientName, LEFT, 35, 11, true);
      text(report.period, RIGHT, 35, 9, true, C.strong, "right");
    }
  };

  let y = 0;
  const page = () => { pdf.addPage(); header(true); y = 43; };
  /** Garante espaço para um bloco inteiro; se não couber, começa outra página. */
  const ensure = (height: number) => { if (y + height > BOTTOM) page(); };

  // ---------- Abertura ----------
  header();
  box(LEFT, 31, WIDTH, 48, C.soft);
  text(title.toUpperCase(), 23, 41, 8, true, C.strong);
  const nameLines = wrap(clientName, 122, 23, true).slice(0, 2);
  nameLines.forEach((line, index) => text(line, 23, 53 + index * 10, nameLines.length > 1 ? 19 : 23, true));
  text("Preparado pela Vizantu", 23, 72, 8.5, false, C.muted);
  box(150, 40, 37, 30, C.white);
  text("PERÍODO", 153, 49, 6.8, true, C.muted);
  const periodLines = wrap(report.period, 31, 11, true).slice(0, 2);
  periodLines.forEach((line, index) => text(line, 153, 59 + index * 5, periodLines.length > 1 ? 9.5 : 11, true, C.deep));
  y = 86;

  // ---------- Números do topo ----------
  const kpis = (report.kpis ?? []).slice(0, 4);
  if (kpis.length) {
    const gap = 4;
    const width = (WIDTH - gap * (kpis.length - 1)) / kpis.length;
    kpis.forEach((kpi, index) => {
      const x = LEFT + index * (width + gap);
      const featured = index === 0;
      box(x, y, width, 28, featured ? C.strong : C.bg);
      text(wrap(kpi.label.toUpperCase(), width - 8, 6.8, true)[0], x + 4, y + 7, 6.8, true, featured ? C.white : C.muted);
      text(kpi.value, x + 4, y + 17, kpi.value.length > 12 ? 10.5 : 14, true, featured ? C.white : C.text);
      if (kpi.delta) text(kpi.delta, x + 4, y + 23.5, 7.5, true, trendColor(kpi, featured));
    });
    y += 36;
  }

  // ---------- Resumo ----------
  if (report.intro?.trim()) {
    const lines = wrap(report.intro.trim(), WIDTH - 14, 9.5);
    const height = 15 + lines.length * 4.6;
    ensure(height);
    box(LEFT, y, WIDTH, height, C.white, C.line);
    text("RESUMO", 23, y + 8, 6.8, true, C.strong);
    lines.forEach((line, row) => text(line, 23, y + 14.5 + row * 4.6, 9.5));
    y += height + 8;
  }

  // ---------- Seções ----------
  const paragraph = (value: string, size = 9, color = C.text) => {
    for (const line of wrap(value, WIDTH, size)) { ensure(5); text(line, LEFT, y + 3, size, false, color); y += size * 0.5; }
    y += 3;
  };

  const metricGrid = (metrics: ResultsMetric[]) => {
    const columns = Math.min(3, metrics.length);
    const gap = 4;
    const width = (WIDTH - gap * (columns - 1)) / columns;
    for (let start = 0; start < metrics.length; start += columns) {
      ensure(24);
      metrics.slice(start, start + columns).forEach((metric, index) => {
        const x = LEFT + index * (width + gap);
        box(x, y, width, 21, C.bg);
        text(wrap(metric.label.toUpperCase(), width - 8, 6.5, true)[0], x + 4, y + 6.5, 6.5, true, C.muted);
        text(metric.value, x + 4, y + 14.5, metric.value.length > 16 ? 9.5 : 12, true);
        if (metric.delta) text(metric.delta, x + width - 4, y + 14.5, 7.5, true, trendColor(metric), "right");
      });
      y += 24;
    }
    y += 2;
  };

  const barChart = (chart: NonNullable<ResultsSection["bars"]>) => {
    const items = chart.items.filter((item) => Number.isFinite(item.value));
    if (!items.length) return;
    const maximum = Math.max(...items.map((item) => item.value), 1);
    // O gráfico fica inteiro numa página sempre que couber em uma.
    const total = (chart.title ? 7 : 0) + items.length * 7.5;
    ensure(total < 200 ? total : 14);
    if (chart.title) { text(chart.title, LEFT, y + 3, 8, true, C.muted); y += 7; }
    for (const item of items) {
      ensure(8);
      text(wrap(item.label, 62, 8.5, Boolean(item.highlight))[0], LEFT, y + 4, 8.5, Boolean(item.highlight), item.highlight ? C.strong : C.text);
      pdf.setFillColor(C.bg); pdf.roundedRect(82, y + 0.5, 84, 4.5, 2, 2, "F");
      // Numa comparação, só a barra do cliente fica na cor da marca.
      const compared = items.some((entry) => entry.highlight);
      pdf.setFillColor(compared && !item.highlight ? C.gray : C.brand); pdf.roundedRect(82, y + 0.5, Math.max(2.5, (item.value / maximum) * 84), 4.5, 2, 2, "F");
      text(item.display ?? String(item.value), RIGHT, y + 4, 8.5, true, item.highlight ? C.strong : C.text, "right");
      y += 7.5;
    }
    y += 3;
  };

  const table = (data: NonNullable<ResultsSection["table"]>) => {
    const columns = data.columns.length;
    if (!columns) return;
    // A primeira coluna costuma ser o nome (campanha, post): fica mais larga.
    const first = columns > 1 ? WIDTH * 0.4 : WIDTH;
    const rest = columns > 1 ? (WIDTH - first) / (columns - 1) : 0;
    // Coluna de número alinha à direita; coluna de texto, à esquerda.
    const numeric = data.columns.map((_, index) => index > 0 && data.rows.filter((cells) => /\d/.test(String(cells[index] ?? ""))).length * 2 > data.rows.length);
    const x = (index: number) => index === 0 ? LEFT + 3 : numeric[index] ? LEFT + first + rest * index - 3 : LEFT + first + rest * (index - 1) + 3;
    const row = (cells: string[], headerRow: boolean) => {
      const size = headerRow ? 6.8 : 8.5;
      // Texto comprido quebra em linhas em vez de ser cortado.
      const lines = cells.slice(0, columns).map((cell, index) => wrap(String(cell), (index === 0 ? first : rest) - 6, size, headerRow || index === 0).slice(0, headerRow ? 2 : 4));
      const step = headerRow ? 3.4 : 4.2;
      const height = 7 + (Math.max(...lines.map((cell) => cell.length), 1) - 1) * step;
      ensure(height + 1);
      if (headerRow) { pdf.setFillColor(C.bg); pdf.rect(LEFT, y, WIDTH, height, "F"); }
      lines.forEach((cell, index) => cell.forEach((line, rowIndex) => text(line, x(index), y + 4.8 + rowIndex * step, size, headerRow || index === 0, headerRow ? C.muted : C.text, numeric[index] ? "right" : "left")));
      y += height;
      if (!headerRow) { pdf.setDrawColor(C.line); pdf.setLineWidth(0.2); pdf.line(LEFT, y, RIGHT, y); }
    };
    row(data.columns.map((column) => column.toUpperCase()), true);
    data.rows.forEach((cells) => row(cells, false));
    y += 5;
  };

  const bullets = (items: string[], heading: string) => {
    ensure(16);
    text(heading, LEFT, y + 3, 8, true, C.muted);
    y += 7;
    for (const item of items) {
      const lines = wrap(item, WIDTH - 7, 9);
      ensure(lines.length * 4.6 + 2);
      pdf.setFillColor(C.brand); pdf.circle(LEFT + 1.5, y + 2, 0.9, "F");
      lines.forEach((line, rowIndex) => text(line, LEFT + 6, y + 3 + rowIndex * 4.6, 9));
      y += lines.length * 4.6 + 2;
    }
    y += 3;
  };

  const alertCards = (items: NonNullable<ResultsSection["alerts"]>) => {
    for (const item of items) {
      const titleLines = wrap(item.title, WIDTH - 16, 10, true);
      const detailLines = item.detail ? wrap(item.detail, WIDTH - 16, 8.5) : [];
      const height = 15 + titleLines.length * 4.8 + (detailLines.length ? detailLines.length * 4.2 + 2 : 0);
      ensure(height + 4);
      box(LEFT, y, WIDTH, height, C.redBg, C.redLine);
      pdf.setFillColor(C.red); pdf.rect(LEFT, y + 2.5, 1.4, height - 5, "F");
      const tag = item.tag.toUpperCase();
      font(6.5, true);
      const tagWidth = pdf.getTextWidth(tag) + 5;
      pdf.setFillColor(C.red); pdf.roundedRect(LEFT + 7, y + 4.5, tagWidth, 5, 1.5, 1.5, "F");
      text(tag, LEFT + 9.5, y + 8, 6.5, true, C.white);
      titleLines.forEach((line, row) => text(line, LEFT + 7, y + 15.5 + row * 4.8, 10, true));
      detailLines.forEach((line, row) => text(line, LEFT + 7, y + 16.5 + titleLines.length * 4.8 + row * 4.2, 8.5, false, C.muted));
      y += height + 4;
    }
    y += 2;
  };

  const gallery = (items: NonNullable<ResultsSection["images"]>, columns = 2) => {
    const loaded = items.flatMap((item) => images[item.url] ? [{ ...item, image: images[item.url] }] : []);
    const gap = columns > 2 ? 4 : 6;
    const width = (WIDTH - gap * (columns - 1)) / columns;
    for (let start = 0; start < loaded.length; start += columns) {
      const pair = loaded.slice(start, start + columns).map((item) => {
        // Cabe na coluna e não passa de 95 mm de altura, mantendo a proporção.
        const scale = Math.min(width / item.image.width, 95 / item.image.height);
        return { ...item, w: item.image.width * scale, h: item.image.height * scale, caption: item.caption ? wrap(item.caption, width, 7.5) : [] };
      });
      const height = Math.max(...pair.map((item) => item.h + (item.caption.length ? item.caption.length * 3.8 + 3 : 0)));
      ensure(height + 4);
      pair.forEach((item, index) => {
        const x = LEFT + index * (width + gap);
        pdf.addImage(item.image.data, item.image.data.startsWith("data:image/png") ? "PNG" : "JPEG", x, y, item.w, item.h, undefined, "FAST");
        pdf.setDrawColor(C.line); pdf.setLineWidth(0.25); pdf.rect(x, y, item.w, item.h);
        item.caption.forEach((line, rowIndex) => text(line, x, y + item.h + 4.5 + rowIndex * 3.8, 7.5, false, C.muted));
      });
      y += height + 6;
    }
  };

  for (const section of report.sections) {
    // O título nunca fica sozinho no fim da página: precisa caber junto com o
    // começo do conteúdo da seção.
    ensure(34 + (section.summary ? 8 : 0) + (section.metrics?.length ? 26 : section.alerts?.length ? 30 : 14));
    pdf.setDrawColor(C.line); pdf.setLineWidth(0.25); pdf.line(LEFT, y, RIGHT, y);
    y += 8;
    if (section.eyebrow) { text(section.eyebrow.toUpperCase(), LEFT, y, 6.8, true, C.strong); y += 6; }
    text(section.title, LEFT, y + 1, 14, true);
    y += 8;
    if (section.summary?.trim()) paragraph(section.summary.trim(), 9, C.muted);
    if (section.metrics?.length) metricGrid(section.metrics);
    if (section.bars) barChart(section.bars);
    if (section.table) table(section.table);
    if (section.highlights?.length) bullets(section.highlights, (section.highlightsTitle || "O que funcionou").toUpperCase());
    if (section.alerts?.length) alertCards(section.alerts);
    if (section.images?.length) gallery(section.images, section.imageColumns ?? 2);
    y += 4;
  }

  // ---------- Próximos passos ----------
  if (report.nextSteps?.length) {
    const lines = report.nextSteps.map((step) => wrap(step, WIDTH - 22, 9));
    const height = 16 + lines.reduce((sum, item) => sum + item.length * 4.6 + 2.5, 0);
    ensure(Math.min(height, 120));
    box(LEFT, y, WIDTH, height, C.soft);
    text("Próximos passos", 23, y + 9, 11, true, C.deep);
    let rowY = y + 17;
    lines.forEach((item, index) => {
      text(String(index + 1).padStart(2, "0"), 23, rowY, 8, true, C.strong);
      item.forEach((line, rowIndex) => text(line, 31, rowY + rowIndex * 4.6, 9));
      rowY += item.length * 4.6 + 2.5;
    });
    y += height + 8;
  }

  // ---------- Observações ----------
  const notes = [...(report.notes ?? []), `Emitido em ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} pela Vizantu.`];
  const noteLines = notes.flatMap((note) => wrap(note, WIDTH - 14, 7.5));
  const notesHeight = 14 + noteLines.length * 3.7;
  ensure(notesHeight);
  box(LEFT, y, WIDTH, notesHeight, C.bg);
  text("Sobre este relatório", 23, y + 8, 9, true, C.deep);
  noteLines.forEach((line, row) => text(line, 23, y + 14 + row * 3.7, 7.5, false, C.muted));

  const count = pdf.getNumberOfPages();
  for (let index = 1; index <= count; index += 1) {
    pdf.setPage(index);
    pdf.setDrawColor(C.line); pdf.setLineWidth(0.25); pdf.line(LEFT, 282, RIGHT, 282);
    text("VIZANTU", LEFT, 289, 7, true, C.strong);
    text(`${title} · ${clientName} · ${report.period}`, 39, 289, 7, false, C.muted);
    text(`${index} / ${count}`, RIGHT, 289, 7, false, C.muted, "right");
  }

  const slug = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return { pdf, filename: `vizantu-resultados-${slug(clientName)}-${slug(report.period)}.pdf` };
}
