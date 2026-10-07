// O que o grupo do cliente recebe e quando.
//
// Só texto e regra, sem banco nem rede: é o que dá para testar de ponta a
// ponta. Toda mensagem leva o link do portal do cliente, porque o objetivo de
// cada uma é a pessoa clicar e responder ali.

export type PendingApprovals = {
  /** Textos aguardando aprovação. */
  text: number;
  /** Criativos aguardando aprovação. */
  creative: number;
  /** Nome do conteúdo, quando é um só. */
  singleName?: string;
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function pendingLines({ text, creative }: PendingApprovals): string {
  return [
    text ? `• *${plural(text, "texto", "textos")}* para revisar` : "",
    creative ? `• *${plural(creative, "criativo", "criativos")}* para revisar` : "",
  ].filter(Boolean).join("\n");
}

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

/** Material novo no portal: um conteúdo que acabou de entrar ou o plano todo. */
export function approvalMessage(input: { pending: PendingApprovals; link: string; deadlineIso?: string }): string {
  const { pending } = input;
  const total = pending.text + pending.creative;
  const head = total === 1 && pending.singleName
    ? `O ${pending.creative ? "criativo" : "texto"} de *${pending.singleName}* está pronto para a sua aprovação.`
    : `Tem material novo para você revisar:\n\n${pendingLines(pending)}`;
  const deadline = input.deadlineIso ? `\n\nPrazo para responder: *${dateLabel(input.deadlineIso)}*.` : "";
  return `${head}\n\nAcesse o link e aprove ou peça ajuste:\n${input.link}${deadline}`;
}

export function reminderMessage(input: { pending: PendingApprovals; link: string; daysLeft: number }): string {
  const left = input.daysLeft <= 0 ? "O prazo termina hoje." : `Faltam *${plural(input.daysLeft, "dia", "dias")}* para o prazo.`;
  return `Lembrete: ainda há material esperando a sua aprovação.\n\n${pendingLines(input.pending)}\n\n${left}\n\nAcesse o link e responda:\n${input.link}`;
}

export function lastDayMessage(input: { pending: PendingApprovals; link: string; deadlineDays: number }): string {
  return `*Hoje é o último dia* para revisar o material enviado há ${plural(input.deadlineDays, "dia", "dias")}.\n\n${pendingLines(input.pending)}\n\nSem resposta até o fim do dia, o material será considerado *aprovado* e seguirá para a produção e publicação.\n\nAcesse o link e responda:\n${input.link}`;
}

export function autoApprovedMessage(input: { count: number; link: string }): string {
  return `O prazo de aprovação terminou sem resposta, então *${plural(input.count, "conteúdo foi dado", "conteúdos foram dados")} como aprovado*. Seguimos com a produção.\n\nVocê pode acompanhar tudo pelo link:\n${input.link}`;
}

export type ReminderStep = "reminder" | "last_day" | null;

/** Qual aviso sai hoje, dado há quantos dias inteiros o material mais antigo
 * espera. Lembrete a cada dois dias; no dia do prazo, o aviso de último dia. */
export function reminderStep(daysWaiting: number, deadlineDays: number): ReminderStep {
  if (daysWaiting >= deadlineDays) return "last_day";
  return daysWaiting >= 2 && daysWaiting % 2 === 0 ? "reminder" : null;
}

/** Sábado e domingo ninguém recebe cobrança; o que cairia no fim de semana
 * sai na segunda. */
export function isBusinessDay(date: Date): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Sao_Paulo" }).format(date);
  return weekday !== "Sat" && weekday !== "Sun";
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
