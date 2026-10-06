import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildStatementPdf, creationTime } from "../src/lib/finance/statement-pdf";
import { producerClosing, productionLines, teamClosingsFromLines } from "../src/lib/finance/calculations";
import { financeFixture } from "../src/app/design-system/financeiro-check/mock";
const asset = (path: string) => readFileSync(fileURLToPath(new URL(`../public/${path}`, import.meta.url))).toString("base64");
const assets = { logo: asset("brand/vizantu-pdf.png"), regular: asset("fonts/vizantu-pdf-regular.ttf"), semibold: asset("fonts/vizantu-pdf-semibold.ttf") };

describe("extrato PDF de produção", () => {
  it("soma apenas períodos encerrados de criação e distingue histórico ausente", () => {
    const task = financeFixture.tasks[0];
    expect(creationTime({ ...task, statusHistory: [] })).toBe("Não registrado");
    expect(creationTime({ ...task, statusHistory: [
      { status: "em_criacao", enteredAt: "2026-09-01T10:00:00Z", exitedAt: "2026-09-01T11:30:00Z" },
      { status: "revisao", enteredAt: "2026-09-01T11:30:00Z", exitedAt: "2026-09-01T12:00:00Z" },
      { status: "em_criacao", enteredAt: "2026-09-01T12:00:00Z", exitedAt: "2026-09-01T13:00:00Z" },
    ] })).toBe("2h 30min");
  });

  it("exporta salário fixo com links das tarefas e permite um mês sem entregas", () => {
    const data = structuredClone(financeFixture);
    data.settings.compensationRules = [{ memberId: data.members[0].id, fromMonth: "2026-09", mode: "salary", salary: 180000 }];
    const lines = productionLines(data.tasks, data.tags, data.settings, data.members);
    const closing = teamClosingsFromLines(lines, data.entries, data.members, data.settings, "2026-09")[0];
    expect(closing).toMatchObject({ total: 180000, pending: 180000, pieces: 5, paymentMode: "salary" });
    const pdf = buildStatementPdf(data, closing, data.tasks, "2026-09", "https://tarefas.vizantu.com", assets).pdf;
    for (const task of data.tasks) expect(pdf.output()).toContain(`https://tarefas.vizantu.com/tarefas/${task.id}`);
    const empty = teamClosingsFromLines([], data.entries, data.members, data.settings, "2026-09")[0];
    expect(buildStatementPdf(data, empty, [], "2026-09", "https://tarefas.vizantu.com", assets).pdf.getNumberOfPages()).toBe(1);
  });
  it("gera um PDF paginado com todas as demandas, links ativos e valores registrados", () => {
    const data = structuredClone(financeFixture);
    const lines = productionLines(data.tasks, data.tags, data.settings, data.members).filter((line) => line.counted && line.deliveredDate?.startsWith("2026-09"));
    const closing = producerClosing(lines, data.entries)[0];
    expect(closing).toBeDefined();
    const taskId = closing.lines[0].taskId;
    data.entries.push({ ...data.entries[0], id: "registered-production", direction: "expense", category: "producao", sourceKey: `production:${taskId}`, amount: 12345, notes: "Preço negociado e registrado", cancelled: false });
    data.tasks.find((task) => task.id === taskId)!.driveLink = "https://drive.google.com/file/d/test/view";
    const { pdf, filename } = buildStatementPdf(data, closing, data.tasks, "2026-09", "https://tarefas.vizantu.com", assets);
    const output = pdf.output();
    expect(output).toMatch(/^%PDF/);
    expect(filename).toMatch(/vizantu-extrato-.*-2026-09\.pdf$/);
    for (const line of closing.lines) expect(output).toContain(`https://tarefas.vizantu.com/tarefas/${line.taskId}`);
    expect(output).toContain("https://drive.google.com/file/d/test/view");
    expect(pdf.getFontList().VizantuPDF).toEqual(["normal", "bold"]);
    expect(output).toContain("/Subtype /Image");
    const many = { ...closing, lines: Array.from({ length: 35 }, () => closing.lines[0]) };
    expect(buildStatementPdf(data, many, data.tasks, "2026-09", "https://tarefas.vizantu.com", assets).pdf.getNumberOfPages()).toBeGreaterThan(1);
  });
});
