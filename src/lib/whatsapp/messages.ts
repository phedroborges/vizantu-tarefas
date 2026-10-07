// O que o grupo do cliente recebe e quando.
//
// Só texto e regra, sem banco nem rede: é o que dá para testar de ponta a
// ponta, e o que a tela de Comunicados usa para mostrar a prévia.
//
// Cada tipo de mensagem é um modelo editável, com variações, e o sistema
// preenche as variáveis (entre chaves duplas) na hora de enviar. Toda mensagem
// leva o link do portal, porque o objetivo de cada uma é a pessoa clicar e
// responder ali.

export type WaitingItem = { name: string; stage: "text" | "creative"; format?: string };

export type MessageKind = "approval" | "reminder" | "last_day" | "auto_approved";

export const MESSAGE_KINDS: { kind: MessageKind; label: string; when: string }[] = [
  { kind: "approval", label: "Material novo", when: "Quando um ou mais conteúdos entram em aprovação. Vários de uma vez viram uma mensagem só." },
  { kind: "reminder", label: "Lembrete", when: "Enquanto houver material sem resposta, no intervalo de dias configurado." },
  { kind: "last_day", label: "Último dia", when: "No dia em que o prazo de aprovação do cliente termina." },
  { kind: "auto_approved", label: "Aprovado por prazo", when: "No dia seguinte ao aviso de último dia, se ninguém respondeu." },
];

export const MESSAGE_VARIABLES: { name: string; meaning: string }[] = [
  { name: "resumo", meaning: "Quanto há para aprovar. Ex.: 4 conteúdos para aprovar o texto" },
  { name: "lista", meaning: "Os conteúdos, um por linha, quando são menos de 5; acima disso, só as quantidades" },
  { name: "link", meaning: "O endereço do portal do cliente" },
  { name: "prazo", meaning: "A data limite. Ex.: 14/10" },
  { name: "dias_restantes", meaning: "Quanto falta para o prazo. Ex.: 3 dias" },
  { name: "dias_prazo", meaning: "O prazo combinado. Ex.: 7 dias" },
  { name: "cliente", meaning: "O nome do cliente" },
  { name: "aprovados", meaning: "Só em “Aprovado por prazo”. Ex.: 3 conteúdos foram dados como aprovados" },
];

export const DEFAULT_TEMPLATES: Record<MessageKind, string[]> = {
  approval: [
    "👁️ *Vizantu por aqui!*\n\nTem material novo esperando vocês: {{resumo}}.\n\n{{lista}}\n\nAcesse abaixo e resolva isso em menos de 5 minutos:\n{{link}}\n\n📅 Prazo para responder: *{{prazo}}*",
    "👁️ Chegou conteúdo novo para vocês revisarem!\n\n{{lista}}\n\nÉ rapidinho: entra no link, lê e aprova ou pede ajuste.\n{{link}}\n\n📅 Vocês têm até *{{prazo}}* para responder.",
  ],
  reminder: [
    "👁️ Tô passando aqui pra lembrar que vocês têm {{resumo}}:\n\n{{lista}}\n\nAcesse abaixo e resolva isso em menos de 5 minutos:\n{{link}}\n\n⏳ Faltam *{{dias_restantes}}* para o prazo.",
    "👁️ Lembrete da Vizantu: ainda tem material aguardando vocês.\n\n{{lista}}\n\n{{link}}\n\n⏳ O prazo é *{{prazo}}* (faltam {{dias_restantes}}).",
  ],
  last_day: [
    "⚠️ *Hoje é o último dia para aprovar!*\n\nVocês ainda têm {{resumo}}:\n\n{{lista}}\n\nSem resposta até o fim do dia, o material será considerado *aprovado* e segue para produção e publicação.\n\n{{link}}",
  ],
  auto_approved: [
    "👁️ O prazo de {{dias_prazo}} terminou sem resposta, então *{{aprovados}}* e seguimos com a produção.\n\nDá para acompanhar tudo por aqui:\n{{link}}",
  ],
};

export type AutomationSettings = {
  /** Parada de emergência: enquanto estiver ligada, NADA sai pelo WhatsApp —
   * nem aviso automático, nem comunicado, nem mensagem de teste. */
  paused: boolean;
  /** Interruptor dos avisos de aprovação. Desligado, nenhum aviso automático sai e nenhum prazo corre. */
  enabled: boolean;
  /** A partir de que hora (São Paulo) os avisos automáticos podem sair. */
  sendHour: number;
  /** Até que hora eles saem. Depois disso, esperam o dia seguinte. */
  sendUntilHour: number;
  /** Tempo mínimo, em minutos, entre duas mensagens quaisquer. */
  minGapMinutes: number;
  /** De quantos em quantos dias o lembrete se repete. */
  reminderEveryDays: number;
  /** Lembrete e último dia só de segunda a sexta. */
  weekdaysOnly: boolean;
  templates: Record<MessageKind, string[]>;
};

export const DEFAULT_AUTOMATION: AutomationSettings = { paused: false, enabled: false, sendHour: 9, sendUntilHour: 18, minGapMinutes: 4, reminderEveryDays: 2, weekdaysOnly: true, templates: DEFAULT_TEMPLATES };

/** Junta o que veio do banco com os padrões: tipo sem modelo válido volta ao
 * texto padrão, para nunca sair mensagem vazia. */
export function normalizeAutomation(stored: Partial<AutomationSettings> | null | undefined): AutomationSettings {
  const templates = { ...DEFAULT_TEMPLATES };
  for (const { kind } of MESSAGE_KINDS) {
    const custom = (stored?.templates?.[kind] ?? []).map((text) => String(text).trim()).filter(Boolean);
    if (custom.length) templates[kind] = custom.slice(0, 5);
  }
  const hour = Math.round(Number(stored?.sendHour));
  const until = Math.round(Number(stored?.sendUntilHour));
  const gap = Math.round(Number(stored?.minGapMinutes));
  const every = Math.round(Number(stored?.reminderEveryDays));
  const sendHour = Number.isFinite(hour) ? Math.min(20, Math.max(6, hour)) : DEFAULT_AUTOMATION.sendHour;
  return {
    paused: stored?.paused === true,
    enabled: stored?.enabled === true,
    sendHour,
    // A janela tem pelo menos uma hora, para a fila do dia conseguir sair.
    sendUntilHour: Math.min(22, Math.max(sendHour + 1, Number.isFinite(until) ? until : DEFAULT_AUTOMATION.sendUntilHour)),
    minGapMinutes: Number.isFinite(gap) ? Math.min(30, Math.max(1, gap)) : DEFAULT_AUTOMATION.minGapMinutes,
    reminderEveryDays: Number.isFinite(every) ? Math.min(7, Math.max(1, every)) : DEFAULT_AUTOMATION.reminderEveryDays,
    weekdaysOnly: stored?.weekdaysOnly !== false,
    templates,
  };
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function summary(items: WaitingItem[]): string {
  const text = items.filter((item) => item.stage === "text").length;
  const creative = items.length - text;
  if (text && creative) return `${plural(text, "texto", "textos")} e ${plural(creative, "criativo", "criativos")} para aprovar`;
  if (creative) return `${plural(creative, "criativo", "criativos")} para aprovar`;
  return `${plural(text, "conteúdo", "conteúdos")} para aprovar o texto`;
}

// Até quatro conteúdos cabem nomeados na mensagem; a partir de cinco a lista
// vira parede de texto no grupo, então ficam só as quantidades.
const LIST_LIMIT = 5;

function list(items: WaitingItem[]): string {
  if (items.length < LIST_LIMIT) {
    const mixed = new Set(items.map((item) => item.stage)).size > 1;
    return items.map((item) => `• ${item.format ? `${item.format} - ` : ""}${item.name}${mixed ? ` (${item.stage === "creative" ? "criativo" : "texto"})` : ""}`).join("\n");
  }
  const text = items.filter((item) => item.stage === "text").length;
  const creative = items.length - text;
  return [text ? `• *${plural(text, "texto", "textos")}* para revisar` : "", creative ? `• *${plural(creative, "criativo", "criativos")}* para revisar` : ""].filter(Boolean).join("\n");
}

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

export type MessageContext = {
  items: WaitingItem[];
  link: string;
  clientName?: string;
  /** Quando o prazo termina. */
  deadlineIso?: string;
  /** Dias inteiros que faltam para o prazo. */
  daysLeft?: number;
  deadlineDays: number;
  /** Quantos conteúdos foram aprovados por prazo (só em auto_approved). */
  approvedCount?: number;
};

export function messageVariables(context: MessageContext): Record<string, string> {
  const left = context.daysLeft;
  return {
    resumo: summary(context.items),
    lista: list(context.items),
    link: context.link,
    cliente: context.clientName || "",
    prazo: context.deadlineIso ? dateLabel(context.deadlineIso) : "",
    dias_restantes: left === undefined ? "" : left <= 0 ? "menos de 1 dia" : plural(left, "dia", "dias"),
    dias_prazo: plural(context.deadlineDays, "dia", "dias"),
    aprovados: context.approvedCount === undefined ? "" : context.approvedCount === 1 ? "1 conteúdo foi dado como aprovado" : `${context.approvedCount} conteúdos foram dados como aprovados`,
  };
}

/** Preenche as variáveis do modelo. Variável desconhecida fica como está, para
 * o erro de digitação aparecer na prévia em vez de sumir. Linha que ficou
 * vazia porque a variável não tinha valor é removida. */
export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template
    .replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, name: string) => name.toLowerCase() in variables ? variables[name.toLowerCase()] : match)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** A mensagem pronta. Com mais de uma variação do modelo, sorteia uma. */
export function composeMessage(kind: MessageKind, settings: Pick<AutomationSettings, "templates">, context: MessageContext, random: () => number = Math.random): string {
  const options = settings.templates[kind]?.length ? settings.templates[kind] : DEFAULT_TEMPLATES[kind];
  const template = options[Math.min(options.length - 1, Math.floor(random() * options.length))];
  return renderTemplate(template, messageVariables(context));
}

export type ReminderStep = "reminder" | "last_day" | null;

/** Qual aviso sai hoje, dado há quantos dias inteiros o material mais antigo
 * espera desde o primeiro aviso. No dia do prazo, o de último dia. */
export function reminderStep(daysWaiting: number, deadlineDays: number, everyDays = 2): ReminderStep {
  if (daysWaiting >= deadlineDays) return "last_day";
  return daysWaiting >= everyDays && daysWaiting % everyDays === 0 ? "reminder" : null;
}

/** O prazo de cada conteúdo corre a partir do primeiro aviso que o cliente
 * recebeu depois de ele entrar em aprovação, e não de quando entrou. Sem isso,
 * ligar os avisos de um cliente com material parado há semanas cobraria "hoje
 * é o último dia" na primeira manhã, por um prazo de que ele nunca soube. */
export function startDeadlineClock<T extends { since: number }>(waiting: T[], noticesSentAt: number[]): { notified: T[]; unnotified: T[] } {
  const notices = [...noticesSentAt].sort((a, b) => a - b);
  const notified: T[] = [];
  const unnotified: T[] = [];
  for (const item of waiting) {
    const first = notices.find((sentAt) => sentAt >= item.since);
    if (first === undefined) unnotified.push(item);
    else notified.push({ ...item, since: first });
  }
  return { notified, unnotified };
}

/** Sábado e domingo ninguém recebe cobrança; o que cairia no fim de semana
 * sai na segunda. */
export function isBusinessDay(date: Date): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Sao_Paulo" }).format(date);
  return weekday !== "Sat" && weekday !== "Sun";
}

const hourInSaoPaulo = (date: Date) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(date));

/** Os avisos automáticos só saem dentro da janela do dia. Fora dela ficam na
 * fila: ninguém recebe cobrança às onze da noite porque o time subiu conteúdo
 * tarde. */
export function insideSendWindow(date: Date, settings: Pick<AutomationSettings, "sendHour" | "sendUntilHour" | "weekdaysOnly">): boolean {
  if (settings.weekdaysOnly && !isBusinessDay(date)) return false;
  const hour = hourInSaoPaulo(date);
  return hour >= settings.sendHour && hour < settings.sendUntilHour;
}

/** Quanto esperar até a próxima mensagem: o mínimo configurado mais uma folga
 * de até 60%. Vários grupos recebendo no mesmo minuto, ou em intervalos
 * exatos, é o padrão de disparo em massa que derruba um número. */
export function nextGapMs(minGapMinutes: number, random: () => number = Math.random): number {
  return Math.round(minGapMinutes * 60_000 * (1 + random() * 0.6));
}

/** Embaralha a ordem: o mesmo cliente não é sempre o primeiro a receber. */
export function shuffled<T>(items: T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

/** Espalha um comunicado pelos grupos: um intervalo entre cada envio, com uma
 * folga aleatória, e as variações do texto em rodízio. Mensagem idêntica em
 * rajada é o padrão que o WhatsApp bloqueia. */
export function planBroadcast<T>(targets: T[], variations: string[], intervalSeconds: number, startMs: number, random: () => number = Math.random): { target: T; body: string; scheduledAt: string }[] {
  const texts = variations.map((text) => text.trim()).filter(Boolean);
  let at = startMs;
  return targets.map((target, index) => {
    if (index > 0) at += Math.round(intervalSeconds * 1000 * (1 + random() * 0.3));
    return { target, body: texts[index % texts.length] ?? "", scheduledAt: new Date(at).toISOString() };
  });
}
