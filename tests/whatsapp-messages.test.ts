import { describe, expect, it } from "vitest";
import { approvalMessage, autoApprovedMessage, isBusinessDay, lastDayMessage, planBroadcast, reminderMessage, reminderStep } from "../src/lib/whatsapp/messages";
import { parseWhatsappGroups } from "../src/lib/whatsapp/provider";

const link = "https://tarefas.vizantu.com.br/c/abc";

describe("mensagens de aprovação no grupo do cliente", () => {
  it("resume o que há para revisar e sempre leva o link do portal", () => {
    const text = approvalMessage({ pending: { text: 10, creative: 3 }, link, deadlineIso: "2026-10-14T15:00:00.000Z" });
    expect(text).toContain("*10 textos* para revisar");
    expect(text).toContain("*3 criativos* para revisar");
    expect(text).toContain(link);
    expect(text).toContain("Prazo para responder: *14/10*.");
  });

  it("fala do conteúdo pelo nome quando é um só", () => {
    expect(approvalMessage({ pending: { text: 1, creative: 0, singleName: "Convite para o Buteco" }, link })).toContain("O texto de *Convite para o Buteco* está pronto para a sua aprovação.");
    expect(approvalMessage({ pending: { text: 0, creative: 1, singleName: "Convite para o Buteco" }, link })).toContain("O criativo de *Convite para o Buteco*");
  });

  it("não lista etapa que não tem nada pendente", () => {
    expect(approvalMessage({ pending: { text: 2, creative: 0 }, link })).not.toContain("criativo");
  });

  it("o lembrete diz quanto falta e o último dia avisa a consequência", () => {
    expect(reminderMessage({ pending: { text: 15, creative: 0 }, link, daysLeft: 3 })).toContain("Faltam *3 dias* para o prazo.");
    const last = lastDayMessage({ pending: { text: 15, creative: 0 }, link, deadlineDays: 7 });
    expect(last).toContain("*Hoje é o último dia*");
    expect(last).toContain("será considerado *aprovado*");
    expect(last).toContain(link);
    expect(autoApprovedMessage({ count: 1, link })).toContain("*1 conteúdo foi dado como aprovado*");
  });
});

describe("quando cada aviso sai", () => {
  it("lembra a cada dois dias e avisa o último dia no prazo", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 9].map((day) => reminderStep(day, 7))).toEqual([null, null, "reminder", null, "reminder", null, "reminder", "last_day", "last_day"]);
  });

  it("respeita um prazo diferente do padrão", () => {
    expect(reminderStep(3, 3)).toBe("last_day");
    expect(reminderStep(2, 3)).toBe("reminder");
  });

  it("não cobra em fim de semana", () => {
    expect(isBusinessDay(new Date("2026-10-09T15:00:00.000Z"))).toBe(true); // sexta
    expect(isBusinessDay(new Date("2026-10-10T15:00:00.000Z"))).toBe(false); // sábado
    expect(isBusinessDay(new Date("2026-10-11T15:00:00.000Z"))).toBe(false); // domingo
    // Segunda de madrugada em UTC ainda é domingo em São Paulo.
    expect(isBusinessDay(new Date("2026-10-12T01:00:00.000Z"))).toBe(false);
  });
});

describe("comunicado para vários grupos", () => {
  it("espaça os envios e reveza as variações", () => {
    const start = Date.parse("2026-10-07T12:00:00.000Z");
    const plan = planBroadcast(["a", "b", "c"], ["Olá!", "Oi, tudo bem?"], 60, start, () => 0);
    expect(plan.map((entry) => entry.body)).toEqual(["Olá!", "Oi, tudo bem?", "Olá!"]);
    expect(plan.map((entry) => entry.scheduledAt)).toEqual(["2026-10-07T12:00:00.000Z", "2026-10-07T12:01:00.000Z", "2026-10-07T12:02:00.000Z"]);
  });

  it("nunca manda dois grupos no mesmo instante, e a folga é aleatória", () => {
    const plan = planBroadcast(["a", "b"], ["Olá!"], 100, 0, () => 1);
    expect(new Date(plan[1].scheduledAt).getTime()).toBe(130_000);
  });
});

describe("leitura dos grupos do serviço", () => {
  it("aceita a lista direta ou embrulhada, com nomes de campo diferentes", () => {
    const expected = [{ id: "1@g.us", name: "Cliente A" }, { id: "2@g.us", name: "Cliente B" }];
    expect(parseWhatsappGroups([{ JID: "2@g.us", Name: "Cliente B" }, { JID: "1@g.us", Name: "Cliente A" }])).toEqual(expected);
    expect(parseWhatsappGroups({ data: [{ jid: "1@g.us", subject: "Cliente A" }, { id: "2@g.us", name: "Cliente B" }] })).toEqual(expected);
    expect(parseWhatsappGroups({ data: { groups: [{ JID: "1@g.us", Name: "Cliente A" }, { JID: "2@g.us", Name: "Cliente B" }] } })).toEqual(expected);
  });

  it("usa o identificador quando o grupo vem sem nome e ignora o que não é grupo", () => {
    expect(parseWhatsappGroups([{ JID: "9@g.us" }, null, "x", {}])).toEqual([{ id: "9@g.us", name: "9@g.us" }]);
    expect(parseWhatsappGroups(null)).toEqual([]);
  });
});
