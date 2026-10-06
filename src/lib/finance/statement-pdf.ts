import { jsPDF } from "jspdf";
import { brl, type ProducerClosing } from "./calculations";
import { RATE_LABELS, type FinanceData } from "./types";
import { TASK_STATUSES, type Task } from "../types";

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

export function buildStatementPdf(data: FinanceData, closing: ProducerClosing, tasks: Task[], month: string, origin: string) {
  const name = data.members.find((member) => member.id === closing.producerId)?.name || "Diretor criativo";
  const pdf = new jsPDF();
  pdf.setProperties({ title: `Extrato de produção - ${name} - ${month}`, author: "Vizantu" });
  let y = 22;
  const page = () => { pdf.addPage(); y = 22; };
  const write = (text: string, size = 10, bold = false, url?: string) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(text, 174) as string[];
    for (const line of lines) {
      if (y > 274) page();
      pdf.setTextColor(url ? 45 : 35, url ? 75 : 35, url ? 160 : 35);
      if (url) pdf.textWithLink(line, 18, y, { url }); else pdf.text(line, 18, y);
      y += size * 0.45 + 1.5;
    }
  };
  write("VIZANTU | Extrato de produção", 18, true);
  write(name, 14, true);
  write(`Competência: ${month.split("-").reverse().join("/")} | Emitido em ${date(new Date().toISOString())}`);
  write(`${closing.pieces} trabalhos | Total: ${brl(closing.total)} | Já lançado: ${brl(closing.launched)} | A lançar: ${brl(closing.pending)}`, 11, true);
  write(`${closing.unpriced} trabalho(s) sem valor calculado. Valores a lançar são estimativas; lançamento não comprova pagamento.`);
  write("Tempo de criação = soma dos períodos encerrados em Em criação, incluindo esperas. Não mede horas efetivamente trabalhadas. Links da tarefa exigem acesso ao sistema; material segue as permissões do Drive.");
  y += 5;
  closing.lines.forEach((line, index) => {
    if (y > 205) page();
    const task = tasks.find((task) => task.id === line.taskId);
    if (!task) throw new Error(`Detalhes ausentes para ${line.name}`);
    const entry = data.entries.find((entry) => entry.sourceKey === `production:${line.taskId}` && !entry.cancelled);
    write(`${index + 1}. ${line.name}`, 12, true, `${origin}/tarefas/${encodeURIComponent(line.taskId)}`);
    write(`Cliente: ${data.projects.find((project) => project.id === line.projectId)?.name || "Não informado"}`);
    write(`Formato: ${line.rateKey ? RATE_LABELS[line.rateKey] : "Não reconhecido"} | Status: ${TASK_STATUSES.find((status) => status.value === line.taskStatus)?.label || line.taskStatus}`);
    write(`Cadastro: ${date(task.createdAt)} | Prazo: ${date(line.dueDate)} | Entrega computada: ${date(line.deliveredDate)}`);
    write(`Tempo em criação: ${creationTime(task)}`);
    write(`Valor: ${entry ? brl(entry.amount) : line.ready ? brl(line.total) : "Sem valor calculado"} | ${entry ? "Lançado como despesa" : line.ready ? "A lançar (estimativa)" : line.pendencia || "Pendente"}`, 11, true);
    if (entry) {
      write(`Registro: ${entry.id} | Competência: ${entry.competence} | Lançado em: ${date(entry.createdAt)}`);
      if (entry.notes) write(`Regra registrada: ${entry.notes}`);
    } else if (line.rule) {
      write(`Preço: ${line.rule.pack ? `pacote de ${line.rule.packSize}, ${brl(line.rule.unit)} dividido entre as peças` : `unitário ${brl(line.rule.unit)}`} | Base: ${brl(line.base)}`);
      write(`Cards adicionais: ${line.rule.extraCards} x ${brl(line.rule.extraCardValue)} | Desconto: ${line.penalty ? "50%" : "Sem desconto"} | Entrega fora do prazo: ${line.deliveredLate ? "Sim" : "Não"} | Problema de qualidade: ${line.qualityProblem ? "Sim" : "Não"}`);
    }
    if (task.driveLink && /^https?:\/\//i.test(task.driveLink)) write("Abrir material entregue", 10, false, task.driveLink);
    else write("Link do material: não cadastrado");
    y += 7;
  });
  const count = pdf.getNumberOfPages();
  for (let i = 1; i <= count; i++) {
    pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(110);
    pdf.text(`Vizantu | ${month} | Página ${i} de ${count}`, 18, 288);
  }
  const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  return { pdf, filename: `vizantu-extrato-${slug}-${month}.pdf` };
}
