import { describe, expect, it } from "vitest";
import { DEFAULT_AUTOMATION, normalizeAutomation, normalizeTeamNotices } from "../src/lib/whatsapp/messages";
import { composeFastestNotice, composeMissingInfoDigest, composeOverdueDigest, missingInfo, speedRanking, type InfoTask } from "../src/lib/whatsapp/team-notices";

const HOUR = 3_600_000;

describe("avisos da equipe", () => {
  it("lista as cinco mais atrasadas com o responsável embaixo de cada uma", () => {
    const items = [1, 2, 3, 4, 5, 6, 7].map((days) => ({ name: `Demanda ${days}`, projectName: "Cliente", lateDays: days, statusLabel: "Em criação", assigneeName: days === 7 ? undefined : "Josiano Silva" }));
    const body = composeOverdueDigest(items, "https://app.test/tarefas")!;
    expect(body).toContain("⏰ *7 demandas atrasadas hoje*");
    // A mais atrasada vem primeiro, e quem não tem dono aparece assim.
    expect(body).toContain("1. *Demanda 7*\n   Cliente · há 7 dias · Em criação\n   👤 Sem responsável");
    expect(body).toContain("2. *Demanda 6*\n   Cliente · há 6 dias · Em criação\n   👤 Josiano");
    expect(body).not.toContain("Demanda 2*");
    expect(body).toContain("E mais 2 atrasadas. Ver todas: https://app.test/tarefas");
    expect(composeOverdueDigest([])).toBeUndefined();
    expect(composeOverdueDigest([{ name: "Única", projectName: "Cliente", lateDays: 1, statusLabel: "Ajuste" }])).toContain("*1 demanda atrasada hoje*");
  });

  it("aponta o que falta em cada demanda, sem cobrar rascunho", () => {
    const base: InfoTask = { status: "em_criacao", kind: "conteudo", description: "**Legenda**\nTexto pronto", driveLink: "https://drive.test/x", assigneeId: "m1", dueDate: "2026-10-12", formatTagIds: ["f"], channelTagIds: ["c"] };
    expect(missingInfo(base)).toEqual([]);
    expect(missingInfo({ ...base, description: "**Roteiro**\nSó o roteiro" })).toEqual(["sem legenda"]);
    expect(missingInfo({ ...base, description: "", channelTagIds: [], dueDate: null })).toEqual(["sem legenda", "sem data de entrega", "sem canal"]);
    expect(missingInfo({ ...base, status: "aguardando_informacao" })).toEqual(["parada em Aguardando informação"]);
    // Item de plano de conteúdo tem legenda mesmo com o tipo "tarefa".
    expect(missingInfo({ ...base, kind: "tarefa", planContent: true, description: "" })).toContain("sem legenda");
    // Tarefa comum não tem legenda, formato nem canal para cobrar.
    expect(missingInfo({ ...base, kind: "tarefa", description: "", formatTagIds: [], channelTagIds: [] })).toEqual([]);
    expect(missingInfo({ ...base, status: "rascunho", description: "", assigneeId: null, dueDate: null })).toEqual([]);
    expect(missingInfo({ ...base, status: "finalizado", description: "" })).toEqual([]);
  });

  it("cobra a informação de quem é dono dela, pelo primeiro nome", () => {
    const body = composeMissingInfoDigest([
      { items: [{ name: "Sem dono", projectName: "Cliente B", missing: ["sem responsável"] }] },
      { person: "Cyntthia Almeida", items: [{ name: "Carrossel de dicas", projectName: "Cliente A", missing: ["sem legenda", "sem canal"] }] },
    ])!;
    expect(body.indexOf("*Cyntthia*, esta demanda precisa de você:")).toBeGreaterThan(0);
    expect(body).toContain("• Carrossel de dicas (Cliente A): sem legenda, sem canal");
    expect(body.indexOf("*Sem dono definido*")).toBeGreaterThan(body.indexOf("*Cyntthia*"));
    expect(composeMissingInfoDigest([{ person: "Ana", items: [] }])).toBeUndefined();
  });

  it("anuncia o mais rápido só quando a liderança muda", () => {
    const ranking = speedRanking([
      { memberId: "erika", name: "Erika Iorrana", averageMs: 30 * HOUR, deliveries: 8 },
      { memberId: "josiano", name: "Josiano", averageMs: 26 * HOUR, deliveries: 5 },
      { memberId: "luis", name: "Luís", averageMs: 2 * HOUR, deliveries: 2 },
      { memberId: "camila", name: "Camila Rocha", averageMs: undefined, deliveries: 0 },
    ]);
    // Duas entregas não bastam para entrar na disputa.
    expect(ranking.map((entry) => entry.memberId)).toEqual(["josiano", "erika"]);
    expect(composeFastestNotice(ranking, "erika")).toContain("🏆 *Josiano*, você acaba de se tornar o designer mais rápido da equipe! Passou Erika.");
    expect(composeFastestNotice(ranking, "erika")).toContain("Média de *1d 2h* por entrega nos últimos 30 dias (5 entregas).");
    expect(composeFastestNotice(ranking, "josiano")).toBeUndefined();
    expect(composeFastestNotice(ranking)).toContain("🏆 *Josiano* é o designer mais rápido da equipe, à frente de Erika.");
    expect(composeFastestNotice([], "erika")).toBeUndefined();
  });

  it("nasce desligado e não liga sem querer", () => {
    expect(DEFAULT_AUTOMATION.team).toEqual({ enabled: false, overdue: true, missingInfo: true, fastest: true });
    expect(normalizeAutomation({}).team.enabled).toBe(false);
    expect(normalizeAutomation({ enabled: true }).team.enabled).toBe(false);
    expect(normalizeTeamNotices({ enabled: true, groupId: " 123@g.us ", groupName: "Vizantu", fastest: false })).toEqual({ enabled: true, groupId: "123@g.us", groupName: "Vizantu", overdue: true, missingInfo: true, fastest: false });
    // Nome de grupo sem grupo não fica guardado.
    expect(normalizeTeamNotices({ groupName: "Solto" })).toMatchObject({ groupId: undefined, groupName: undefined });
  });
});
