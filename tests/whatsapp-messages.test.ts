import { describe, expect, it } from "vitest";
import { DEFAULT_AUTOMATION, DEFAULT_TEMPLATES, MESSAGE_KINDS, MESSAGE_VARIABLES, composeMessage, insideSendWindow, isBusinessDay, messageVariables, nextGapMs, normalizeAutomation, noticeFromKey, planBroadcast, reminderStep, renderTemplate, shuffled, startDeadlineClock, startDeadlineClockByStage, type WaitingItem } from "../src/lib/whatsapp/messages";
import { parseWhatsappGroups } from "../src/lib/whatsapp/provider";

const link = "https://tarefas.metricz.com.br/c/abc";
const texto = (name: string, format = "Carrossel"): WaitingItem => ({ name, stage: "text", format });
const criativo = (name: string, format = "Reels"): WaitingItem => ({ name, stage: "creative", format });
const first = () => 0;

describe("mensagens de aprovação no grupo do cliente", () => {
  // O pedido que originou isto: com poucos conteúdos, dizer quais são.
  it("lista os conteúdos um por um quando são menos de cinco", () => {
    const text = composeMessage("reminder", DEFAULT_AUTOMATION, { items: [texto("Como começar na viola"), texto("Porque meu carro é branco", "Reels")], link, deadlineDays: 7, daysLeft: 3 }, first);
    expect(text).toContain("👁️ Tô passando aqui pra lembrar que vocês têm 2 conteúdos para aprovar o texto:");
    expect(text).toContain("• Carrossel - Como começar na viola\n• Reels - Porque meu carro é branco");
    expect(text).toContain("resolva isso em menos de 5 minutos:\n" + link);
    expect(text).toContain("Faltam *3 dias* para o prazo.");
  });

  it("a partir de cinco mostra só as quantidades", () => {
    const items = [...Array.from({ length: 10 }, (_, index) => texto(`Conteúdo ${index}`)), ...Array.from({ length: 3 }, (_, index) => criativo(`Criativo ${index}`))];
    const text = composeMessage("approval", DEFAULT_AUTOMATION, { items, link, deadlineDays: 7, deadlineIso: "2026-10-14T15:00:00.000Z" }, first);
    expect(text).toContain("10 textos e 3 criativos para aprovar");
    expect(text).toContain("• *10 textos* para revisar\n• *3 criativos* para revisar");
    expect(text).not.toContain("Conteúdo 0");
    expect(text).toContain("Prazo para responder: *14/10*");
  });

  // A mensagem de um conteúdo só: tudo que o cliente precisa para decidir,
  // sem abrir nada antes.
  it("um conteúdo só vai com título, formato, datas, legenda e referência", () => {
    const item: WaitingItem = { name: "Como começar na viola", stage: "text", format: "Carrossel", dueDate: "2026-10-16", caption: "Salva esse post.", reference: "https://exemplo.com/ref" };
    const text = composeMessage("content", DEFAULT_AUTOMATION, { items: [item], link, deadlineDays: 7, deadlineIso: "2026-10-14T15:00:00.000Z", daysLeft: 7 }, first);
    expect(text).toContain("👁️ *Conteúdo novo para aprovar!*");
    expect(text).toContain("*Como começar na viola*");
    expect(text).toContain("🎬 Formato: Carrossel");
    expect(text).toContain("📅 Publicação: 16/10");
    expect(text).toContain("⏳ Prazo para aprovar o texto: *14/10*");
    expect(text).toContain("📝 Legenda: Salva esse post.");
    expect(text).toContain("🔗 Referência: https://exemplo.com/ref");
    expect(text).toContain(link);
  });

  // Tarefa fora de plano não aparece no portal: o link é o do material e a
  // resposta vem pelo grupo.
  it("tarefa avulsa leva o link do material e pede a resposta no grupo", () => {
    const material = "https://drive.google.com/drive/folders/abc";
    const text = composeMessage("standalone", DEFAULT_AUTOMATION, { items: [{ name: "Lembrete Hoje Repescagem", stage: "creative", format: "Story", dueDate: "2026-10-08" }], link: material, deadlineDays: 0 }, first);
    expect(text).toContain("👁️ *Material novo para aprovar!*");
    expect(text).toContain("*Lembrete Hoje Repescagem*");
    expect(text).toContain("🎬 Formato: Story");
    expect(text).toContain("📅 Publicação: 08/10");
    expect(text).toContain("responda aqui no grupo");
    expect(text).toContain(material);
    expect(text).not.toContain("Legenda");
  });

  it("no criativo, a mensagem também leva o link do material", () => {
    const item: WaitingItem = { name: "Horário no feriado", stage: "creative", format: "Stories", materialLink: "https://drive.google.com/drive/folders/abc" };
    const text = composeMessage("content", DEFAULT_AUTOMATION, { items: [item], link: `${link}?item=t1`, deadlineDays: 7 }, first);
    expect(text).toContain("📂 Material: https://drive.google.com/drive/folders/abc");
    expect(text).toContain(`${link}?item=t1`);
    // No texto ainda não existe material: a linha não aparece.
    expect(composeMessage("content", DEFAULT_AUTOMATION, { items: [{ name: "Só texto", stage: "text" }], link, deadlineDays: 7 }, first)).not.toContain("Material");
  });

  it("some com a linha do que o conteúdo não tem", () => {
    const text = composeMessage("content", DEFAULT_AUTOMATION, { items: [{ name: "Sem extras", stage: "creative" }], link, deadlineDays: 7, deadlineIso: "2026-10-14T15:00:00.000Z" }, first);
    expect(text).toContain("*Sem extras*");
    expect(text).toContain("Prazo para aprovar o criativo: *14/10*");
    for (const ausente of ["Formato", "Publicação", "Legenda", "Referência", "Material"]) expect(text, ausente).not.toContain(ausente);
    expect(text).not.toMatch(/\n{3,}/);
  });

  it("corta a legenda muito longa", () => {
    const { legenda } = messageVariables({ items: [{ name: "X", stage: "text", caption: "a".repeat(900) }], link, deadlineDays: 7 });
    expect(legenda).toHaveLength(601);
    expect(legenda.endsWith("…")).toBe(true);
  });

  it("diz qual é texto e qual é criativo quando a lista mistura os dois", () => {
    const variables = messageVariables({ items: [texto("A"), criativo("B")], link, deadlineDays: 7 });
    expect(variables.lista).toBe("• Carrossel - A (texto)\n• Reels - B (criativo)");
    expect(variables.resumo).toBe("1 texto e 1 criativo para aprovar");
  });

  it("concorda o singular e funciona sem formato", () => {
    const variables = messageVariables({ items: [{ name: "Sem formato", stage: "text" }], link, deadlineDays: 1, daysLeft: 1 });
    expect(variables).toMatchObject({ resumo: "1 conteúdo para aprovar o texto", lista: "• Sem formato", dias_restantes: "1 dia", dias_prazo: "1 dia" });
    expect(messageVariables({ items: [criativo("X")], link, deadlineDays: 7 }).resumo).toBe("1 criativo para aprovar");
  });

  it("o último dia vem com o emoji de aviso e diz a consequência", () => {
    const text = composeMessage("last_day", DEFAULT_AUTOMATION, { items: [texto("A")], link, deadlineDays: 7, daysLeft: 0 }, first);
    expect(text.startsWith("⚠️ *Hoje é o último dia para aprovar!*")).toBe(true);
    expect(text).toContain("será considerado *aprovado*");
    expect(text).toContain(link);
  });

  it("avisa o que foi aprovado por prazo", () => {
    expect(composeMessage("auto_approved", DEFAULT_AUTOMATION, { items: [], link, deadlineDays: 7, approvedCount: 3 }, first)).toContain("O prazo de 7 dias terminou sem resposta, então *3 conteúdos foram dados como aprovados*");
    expect(messageVariables({ items: [], link, deadlineDays: 7, approvedCount: 1 }).aprovados).toBe("1 conteúdo foi dado como aprovado");
  });

  it("toda mensagem padrão abre com a marca ou com o aviso e leva o link", () => {
    for (const { kind } of MESSAGE_KINDS) {
      for (const template of DEFAULT_TEMPLATES[kind]) {
        expect(/^(👁️|⚠️)/.test(template), `${kind}: ${template.slice(0, 20)}`).toBe(true);
        expect(template, kind).toContain("{{link}}");
      }
    }
  });
});

describe("modelos editáveis", () => {
  const variables = { resumo: "2 conteúdos para aprovar o texto", link, prazo: "" };

  it("preenche as variáveis, aceitando espaços e maiúsculas", () => {
    expect(renderTemplate("Oi! {{ resumo }}.\n{{LINK}}", variables)).toBe(`Oi! 2 conteúdos para aprovar o texto.\n${link}`);
  });

  // Erro de digitação tem que aparecer na prévia, não sumir em silêncio.
  it("deixa à mostra a variável que não existe", () => {
    expect(renderTemplate("Oi {{clinte}}", variables)).toBe("Oi {{clinte}}");
  });

  it("não deixa buraco quando a variável vem vazia", () => {
    expect(renderTemplate("Linha 1\n\n{{prazo}}\n\nLinha 2", variables)).toBe("Linha 1\n\nLinha 2");
  });

  it("todas as variáveis documentadas existem", () => {
    const available = messageVariables({ items: [texto("A")], link, deadlineDays: 7 });
    for (const { name } of MESSAGE_VARIABLES) expect(available, name).toHaveProperty(name);
  });

  it("sorteia entre as variações do texto", () => {
    const settings = { templates: { ...DEFAULT_TEMPLATES, reminder: ["Primeira {{link}}", "Segunda {{link}}"] } };
    const context = { items: [texto("A")], link, deadlineDays: 7 };
    expect(composeMessage("reminder", settings, context, () => 0)).toBe(`Primeira ${link}`);
    expect(composeMessage("reminder", settings, context, () => 0.99)).toBe(`Segunda ${link}`);
  });
});

describe("configuração das mensagens automáticas", () => {
  // Nada sai para cliente antes de alguém revisar os textos e ligar.
  it("nasce desligada, com os padrões", () => {
    expect(normalizeAutomation(null)).toEqual({ paused: false, enabled: false, sendHour: 9, sendUntilHour: 18, minGapMinutes: 4, reminderEveryDays: 2, weekdaysOnly: true, templates: DEFAULT_TEMPLATES });
    expect(normalizeAutomation({}).enabled).toBe(false);
  });

  it("guarda os textos editados e volta ao padrão no tipo que ficou vazio", () => {
    const result = normalizeAutomation({ enabled: true, sendHour: 14, reminderEveryDays: 3, weekdaysOnly: false, templates: { ...DEFAULT_TEMPLATES, reminder: ["  Meu lembrete {{link}}  ", ""], last_day: ["", "  "] } });
    expect(result).toMatchObject({ enabled: true, sendHour: 14, reminderEveryDays: 3, weekdaysOnly: false });
    expect(result.templates.reminder).toEqual(["Meu lembrete {{link}}"]);
    expect(result.templates.last_day).toEqual(DEFAULT_TEMPLATES.last_day);
  });

  it("segura a hora e o intervalo dentro do que faz sentido", () => {
    expect(normalizeAutomation({ sendHour: 3, reminderEveryDays: 0 })).toMatchObject({ sendHour: 6, reminderEveryDays: 1 });
    expect(normalizeAutomation({ sendHour: 23, reminderEveryDays: 30 })).toMatchObject({ sendHour: 20, reminderEveryDays: 7 });
    expect(normalizeAutomation({ sendHour: Number.NaN })).toMatchObject({ sendHour: 9 });
  });
});

describe("ritmo dos envios", () => {
  const janela = { sendHour: 9, sendUntilHour: 18, weekdaysOnly: true };

  // 12h UTC = 9h em São Paulo.
  it("os avisos automáticos só saem dentro da janela do dia", () => {
    expect(insideSendWindow(new Date("2026-10-07T11:59:00.000Z"), janela)).toBe(false);
    expect(insideSendWindow(new Date("2026-10-07T12:00:00.000Z"), janela)).toBe(true);
    expect(insideSendWindow(new Date("2026-10-07T20:59:00.000Z"), janela)).toBe(true);
    expect(insideSendWindow(new Date("2026-10-07T21:00:00.000Z"), janela)).toBe(false);
  });

  it("no fim de semana a janela só abre se estiver liberado", () => {
    const sabado = new Date("2026-10-10T15:00:00.000Z");
    expect(insideSendWindow(sabado, janela)).toBe(false);
    expect(insideSendWindow(sabado, { ...janela, weekdaysOnly: false })).toBe(true);
  });

  // Vários grupos no mesmo minuto, ou em intervalos exatos, é padrão de
  // disparo em massa.
  it("espera pelo menos o intervalo mínimo, com folga aleatória de até 60%", () => {
    expect(nextGapMs(4, () => 0)).toBe(240_000);
    expect(nextGapMs(4, () => 0.5)).toBe(312_000);
    expect(nextGapMs(4, () => 1)).toBe(384_000);
  });

  it("embaralha a ordem sem perder nem repetir ninguém", () => {
    const clientes = ["a", "b", "c", "d", "e"];
    const ordem = shuffled(clientes, () => 0);
    expect(ordem).not.toEqual(clientes);
    expect([...ordem].sort()).toEqual(clientes);
    expect(clientes).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("a parada de emergência e o ritmo têm padrão seguro e limites", () => {
    expect(normalizeAutomation({ paused: true }).paused).toBe(true);
    expect(normalizeAutomation({ minGapMinutes: 0 }).minGapMinutes).toBe(1);
    expect(normalizeAutomation({ minGapMinutes: 500 }).minGapMinutes).toBe(30);
    // A janela nunca fecha antes de abrir.
    expect(normalizeAutomation({ sendHour: 14, sendUntilHour: 10 })).toMatchObject({ sendHour: 14, sendUntilHour: 15 });
  });
});

describe("quando cada aviso sai", () => {
  it("lembra a cada dois dias e avisa o último dia no prazo", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 9].map((day) => reminderStep(day, 7))).toEqual([null, null, "reminder", null, "reminder", null, "reminder", "last_day", "last_day"]);
  });

  it("respeita o intervalo e o prazo configurados", () => {
    expect([1, 2, 3, 4, 5, 6].map((day) => reminderStep(day, 10, 3))).toEqual([null, null, "reminder", null, null, "reminder"]);
    expect([1, 2].map((day) => reminderStep(day, 7, 1))).toEqual(["reminder", "reminder"]);
    expect(reminderStep(3, 3)).toBe("last_day");
  });

  it("não cobra em fim de semana", () => {
    expect(isBusinessDay(new Date("2026-10-09T15:00:00.000Z"))).toBe(true); // sexta
    expect(isBusinessDay(new Date("2026-10-10T15:00:00.000Z"))).toBe(false); // sábado
    expect(isBusinessDay(new Date("2026-10-11T15:00:00.000Z"))).toBe(false); // domingo
    // Segunda de madrugada em UTC ainda é domingo em São Paulo.
    expect(isBusinessDay(new Date("2026-10-12T01:00:00.000Z"))).toBe(false);
  });
});

describe("quando o prazo começa a contar", () => {
  const D = 86_400_000;

  // Cliente com texto parado há semanas, que acabou de ter os avisos ligados:
  // sem aviso enviado, nada está correndo.
  it("não conta prazo do que o cliente nunca foi avisado", () => {
    const antigo = { id: "antigo", since: 0 };
    expect(startDeadlineClock([antigo], [])).toEqual({ notified: [], unnotified: [antigo] });
  });

  it("conta a partir do primeiro aviso depois de o conteúdo entrar em aprovação", () => {
    const { notified, unnotified } = startDeadlineClock([{ id: "antigo", since: 0 }], [30 * D, 32 * D]);
    expect(notified).toEqual([{ id: "antigo", since: 30 * D }]);
    expect(unnotified).toEqual([]);
  });

  // Para não desgastar o grupo: o que já foi avisado não é anunciado de novo
  // quando outro conteúdo entra; só volta se sair da aprovação e retornar.
  it("conteúdo já avisado não é novidade; o que voltou do ajuste é", () => {
    const jaAvisado = { id: "avisado", since: 10 * D };
    const voltouDoAjuste = { id: "voltou", since: 25 * D };
    const { notified, unnotified } = startDeadlineClock([jaAvisado, voltouDoAjuste], [12 * D]);
    expect(notified.map((item) => item.id)).toEqual(["avisado"]);
    expect(unnotified).toEqual([voltouDoAjuste]);
  });

  // A mensagem direta de um criativo não fala dos textos: eles continuam sem
  // aviso, e o prazo deles não começa a correr por causa dela.
  it("o aviso só de criativo não conta para os textos que estão esperando", () => {
    const texto = { id: "texto", since: 10 * D, stage: "text" as const };
    const criativo = { id: "criativo", since: 10 * D, stage: "creative" as const };
    const soCriativo = startDeadlineClockByStage([texto, criativo], [{ at: 12 * D, creativeOnly: true }]);
    expect(soCriativo.notified.map((item) => item.id)).toEqual(["criativo"]);
    expect(soCriativo.unnotified).toEqual([texto]);
    const geral = startDeadlineClockByStage([texto, criativo], [{ at: 12 * D, creativeOnly: false }]);
    expect(geral.unnotified).toEqual([]);
  });

  it("lê da chave da mensagem o que o aviso cobriu", () => {
    expect(noticeFromKey("approval:p1:m1:creative", 5)).toEqual({ at: 5, creativeOnly: true });
    expect(noticeFromKey("approval:p1:m1", 5)).toEqual({ at: 5, creativeOnly: false });
    expect(noticeFromKey("reminder:p1:2026-10-08", 5)).toEqual({ at: 5, creativeOnly: false });
    // Aviso de tarefa avulsa fala de outra tarefa: não conta para o plano.
    expect(noticeFromKey("standalone:t1:m1", 5)).toBeUndefined();
  });

  it("aviso anterior ao conteúdo não vale para ele", () => {
    const novo = { id: "novo", since: 40 * D };
    const { notified, unnotified } = startDeadlineClock([{ id: "antigo", since: 0 }, novo], [30 * D]);
    expect(notified.map((item) => item.id)).toEqual(["antigo"]);
    expect(unnotified).toEqual([novo]);
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
