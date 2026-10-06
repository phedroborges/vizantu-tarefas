import { jsPDF } from "jspdf";
import { brl, type ProducerClosing } from "./calculations";
import { RATE_LABELS, type FinanceData } from "./types";
import { TASK_STATUSES, type Task } from "../types";
import type { StatementAssets } from "./statement-assets";

const date = (value?: string | null) => value ? new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", ...(value.length === 10 ? { year: "numeric", month: "2-digit", day: "2-digit" } : {}) }) : "Não registrado";

/** Only closed creation intervals: elapsed status time is not a work timer. */
export function creationTime(task: Task): string {
  const intervals = task.statusHistory.filter((entry) => entry.status === "em_criacao" && entry.exitedAt);
  if (!intervals.length) return "Não registrado";
  let milliseconds = 0;
  for (const entry of intervals) {
    const duration = Date.parse(entry.exitedAt!) - Date.parse(entry.enteredAt);
    if (!Number.isFinite(duration) || duration < 0) return "Histórico incompleto";
    milliseconds += duration;
  }
  const minutes = Math.round(milliseconds / 60000);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}

// Print palette mirrors src/styles/vizantu.css (the light theme).
const C = { brand: "#9147ff", strong: "#6435e7", deep: "#4b23b8", soft: "#f2ecff", bg: "#f6f6fa", line: "#ebecf2", text: "#14151c", muted: "#6d7183", white: "#ffffff", green: "#1c7a3f", amber: "#92561a" };

export function buildStatementPdf(data: FinanceData, closing: ProducerClosing, tasks: Task[], month: string, origin: string, assets: StatementAssets) {
  const name = data.members.find((member) => member.id === closing.producerId)?.name || "Diretor criativo";
  const pdf = new jsPDF({ putOnlyUsedFonts: true, compress: true });
  // Static instances of the system's Mona Sans; renamed per its font license.
  pdf.addFileToVFS("VizantuPDF-Regular.ttf", assets.regular);
  pdf.addFont("VizantuPDF-Regular.ttf", "VizantuPDF", "normal");
  pdf.addFileToVFS("VizantuPDF-Semibold.ttf", assets.semibold);
  pdf.addFont("VizantuPDF-Semibold.ttf", "VizantuPDF", "bold");
  pdf.setProperties({ title: `Extrato de produção - ${name} - ${month}`, author: "Vizantu" });
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
  const period = month.split("-").reverse().join("/");
  const header = (continuation = false) => {
    pdf.setFillColor(C.brand); pdf.rect(0, 0, 210, 2, "F");
    pdf.addImage(assets.logo, "PNG", 16, 13, 40, 40 * 295.55 / 1518.08, "vizantu-logo");
    text("FINANCEIRO / PRODUÇÃO", 194, 18.5, 8, true, C.muted, "right");
    if (continuation) {
      pdf.setDrawColor(C.line); pdf.line(16, 27, 194, 27);
      text("Extrato de produção", 16, 35, 11, true);
      text(period, 194, 35, 9, true, C.strong, "right");
    }
  };
  header();
  box(16, 31, 178, 48, C.soft);
  text("EQUIPE CRIATIVA", 23, 41, 8, true, C.strong);
  text("Extrato de produção", 23, 53, 23, true);
  const nameLines = wrap(name, 116, 12, true);
  // Long names are shown in full in the metadata below the hero.
  text(nameLines[0], 23, 65, 12, true);
  text("Diretor criativo", 23, 72, 8.5, false, C.muted);
  box(156, 40, 31, 30, C.white);
  text("COMPETÊNCIA", 159, 49, 6.8, true, C.muted);
  text(period, 159, 61, 13, true, C.deep);
  let y = 86;
  if (nameLines.length > 1) { for (const line of nameLines) { text(line, 16, y, 9, true); y += 4.5; } y += 2; }
  const metrics: [string, string][] = [["VALOR COMPUTADO", brl(closing.total)], ["JÁ LANÇADO", brl(closing.launched)], ["A LANÇAR", brl(closing.pending)], ["TRABALHOS", String(closing.pieces)]];
  metrics.forEach(([label, value], index) => {
    const x = 16 + index * 45.5;
    box(x, y, 41.5, 24, index === 0 ? C.strong : C.bg);
    text(label, x + 4, y + 7, 6.8, true, index === 0 ? C.white : C.muted);
    const size = value.length > 14 ? 10 : 14;
    text(value, x + 4, y + 17, size, true, index === 0 ? C.white : C.text);
  });
  y += 33;
  text("Trabalhos entregues", 16, y, 13, true);
  text(`${closing.pieces} item(s) · ${closing.unpriced} sem valor calculado`, 194, y, 8, false, C.muted, "right");
  y += 8;
  const page = () => { pdf.addPage(); header(true); y = 43; };

  closing.lines.forEach((line, index) => {
    const task = tasks.find((task) => task.id === line.taskId);
    if (!task) throw new Error(`Detalhes ausentes para ${line.name}`);
    const entry = data.entries.find((entry) => entry.sourceKey === `production:${line.taskId}` && !entry.cancelled);
    const project = data.projects.find((project) => project.id === line.projectId)?.name || "Não informado";
    const status = TASK_STATUSES.find((status) => status.value === line.taskStatus)?.label || line.taskStatus || "Não informado";
    const titleLines = wrap(line.name, 112, 10.5, true);
    const metadata = wrap(`${project}  ·  ${line.rateKey ? RATE_LABELS[line.rateKey] : "Formato não reconhecido"}  ·  ${status}`, 163, 8);
    const notes: string[] = [];
    if (entry) {
      notes.push(`Registro: ${entry.id} · Competência: ${entry.competence} · Lançado em ${date(entry.createdAt)}`);
      if (entry.notes) notes.push(`Regra registrada: ${entry.notes}`);
    } else if (line.rule) {
      notes.push(`Preço ${line.rule.pack ? `de pacote: ${brl(line.rule.unit)} / ${line.rule.packSize} peças` : `unitário: ${brl(line.rule.unit)}`} · Base: ${brl(line.base)} · Cards adicionais: ${line.rule.extraCards} x ${brl(line.rule.extraCardValue)}`);
      notes.push(`Desconto: ${line.penalty ? "50%" : "Sem desconto"} · Fora do prazo: ${line.deliveredLate ? "Sim" : "Não"} · Problema de qualidade: ${line.qualityProblem ? "Sim" : "Não"}`);
    } else if (line.pendencia) notes.push(line.pendencia);
    const noteLines = notes.flatMap((note) => wrap(note, 164, 7.5));
    const facts = [["CADASTRO", date(task.createdAt)], ["PRAZO", date(line.dueDate)], ["ENTREGA COMPUTADA", date(line.deliveredDate)], ["TEMPO EM CRIAÇÃO", creationTime(task)]];
    const factLines = facts.map(([, value]) => wrap(value, 37, 8.5));
    const titleHeight = Math.max(12, titleLines.length * 4.8);
    const metaHeight = metadata.length * 4;
    const factsHeight = Math.max(...factLines.map((lines) => lines.length)) * 4;
    const baseHeight = 33 + titleHeight + metaHeight + factsHeight;
    // Keep ordinary items together; paginate unusually long notes without clipping.
    let offset = 0;
    do {
      const remaining = noteLines.length - offset;
      const desiredHeight = baseHeight + remaining * 3.7;
      if (y + Math.min(desiredHeight, 230) > 273) page();
      const capacity = Math.max(1, Math.floor((273 - y - baseHeight) / 3.7));
      const shownNotes = noteLines.slice(offset, offset + capacity);
      const height = baseHeight + shownNotes.length * 3.7;
      box(16, y, 178, height, C.white, C.line);
      box(21, y + 5, 7, 7, C.soft);
      text(String(index + 1).padStart(2, "0"), 22.2, y + 9.7, 7, true, C.strong);
      titleLines.forEach((title, row) => text(title, 32, y + 9.5 + row * 4.8, 10.5, true));
      const taskUrl = `${origin}/tarefas/${encodeURIComponent(line.taskId)}`;
      pdf.link(32, y + 5, 112, titleHeight, { url: taskUrl });
      const value = entry ? brl(entry.amount) : line.ready ? brl(line.total) : "Sem valor";
      text(value, 188, y + 10, value.length > 14 ? 9 : 12, true, entry ? C.text : C.strong, "right");
      text(entry ? "Lançado" : line.ready ? "Estimativa" : "Pendente", 188, y + 15.5, 7.5, false, entry ? C.green : C.amber, "right");
      let rowY = y + 8 + titleHeight;
      metadata.forEach((part) => { text(part, 22, rowY, 8, false, C.muted); rowY += 4; });
      rowY += 5;
      facts.forEach(([label], column) => {
        const x = 22 + column * 42;
        text(label, x, rowY, 6.8, true, C.muted);
        factLines[column].forEach((part, row) => text(part, x, rowY + 5 + row * 4, 8.5));
      });
      rowY += factsHeight + 10;
      if (shownNotes.length) {
        box(21, rowY - 3, 168, shownNotes.length * 3.7 + 5, C.bg);
        shownNotes.forEach((part, row) => text(part, 24, rowY + 1 + row * 3.7, 7.5, false, C.muted));
        rowY += shownNotes.length * 3.7 + 7;
      }
      font(8, true, C.strong); pdf.textWithLink(offset ? "Abrir tarefa (continuação)" : "Abrir tarefa", 22, rowY - 1, { url: taskUrl });
      if (task.driveLink && /^https?:\/\//i.test(task.driveLink)) {
        pdf.textWithLink("Abrir material entregue", 55, rowY - 1, { url: task.driveLink });
      } else text("Material sem link cadastrado", 55, rowY - 1, 8, false, C.muted);
      y += height + 5;
      offset += shownNotes.length;
      if (offset < noteLines.length) page();
    } while (offset < noteLines.length);
  });

  const explanations = [
    "Sobre este extrato",
    "Valores a lançar são estimativas. Lançamentos registram despesas e não comprovam pagamento.",
    "Tempo em criação soma os períodos encerrados em Em criação, incluindo esperas; não mede horas efetivamente trabalhadas. Histórico ausente aparece como não registrado.",
    "Links da tarefa exigem acesso ao sistema. O material segue as permissões do Drive.",
    `Emitido em ${date(new Date().toISOString())} · Responsável: ${name}`,
  ];
  const explanationLines = explanations.slice(1).flatMap((value) => wrap(value, 164, 7.5));
  const explanationHeight = 14 + explanationLines.length * 3.7;
  if (y + explanationHeight > 273) page();
  box(16, y, 178, explanationHeight, C.soft);
  text(explanations[0], 23, y + 8, 9, true, C.deep);
  explanationLines.forEach((part, row) => text(part, 23, y + 14 + row * 3.7, 7.5, false, C.muted));

  const count = pdf.getNumberOfPages();
  for (let i = 1; i <= count; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(C.line); pdf.line(16, 282, 194, 282);
    text("VIZANTU", 16, 289, 7, true, C.strong);
    text(`Extrato de produção · ${period}`, 39, 289, 7, false, C.muted);
    text(`${i} / ${count}`, 194, 289, 7, false, C.muted, "right");
  }
  const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  return { pdf, filename: `vizantu-extrato-${slug}-${month}.pdf` };
}
