import { createDailyOverdueNotifications } from "./storage";

// ---------- Varredura diária de tarefas atrasadas ----------
//
// O aviso de atraso é a única notificação que ninguém dispara ao usar o app:
// menção nasce de um comentário, atribuição nasce de uma edição, aviso nasce de
// uma publicação. Atraso nasce da passagem do tempo, então precisa de alguém
// batendo na porta todo dia.
//
// Esse alguém era o cron da Vercel, declarado em vercel.json. Só que o app não
// roda na Vercel — roda em container, e vercel.json ali é papel de parede: o
// endpoint existia, estava correto, e nunca foi chamado uma vez sequer. Por isso
// a varredura passou a morar dentro do próprio processo que serve o app. É o
// único lugar que existe em toda instalação, sem depender de painel configurado
// à mão nem de segredo que alguém precisa lembrar de criar.
//
// Rodar mais de uma vez no mesmo dia é inofensivo por construção: cada aviso
// carrega a chave `overdue:<data>:<tarefa>:<pessoa>`, e o índice único de
// dedupe_key recusa a segunda tentativa. É isso que torna seguro varrer de meia
// em meia hora, reiniciar o container à vontade e até subir mais de uma réplica
// um dia — o banco decide quem foi o primeiro, e os outros não fazem nada.
const INTERVALO = 30 * 60 * 1000;

// Ninguém quer descobrir à meia-noite e dez que uma tarefa venceu. O cron
// antigo rodava 11h UTC, que é 8h em São Paulo; o horário se manteve.
const HORA_DE_AVISAR = 8;

const EM_SAO_PAULO = { timeZone: "America/Sao_Paulo" } as const;

export function hojeEmSaoPaulo(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { ...EM_SAO_PAULO, year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

export function horaEmSaoPaulo(agora = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { ...EM_SAO_PAULO, hour: "2-digit", hour12: false }).format(agora));
}

export function estaNaHoraDeAvisar(agora = new Date()): boolean {
  return horaEmSaoPaulo(agora) >= HORA_DE_AVISAR;
}

export async function varrerAtrasos(agora = new Date()): Promise<number> {
  if (!estaNaHoraDeAvisar(agora)) return 0;
  try {
    return await createDailyOverdueNotifications(hojeEmSaoPaulo(agora));
  } catch (error) {
    // Varredura que quebra não pode derrubar o servidor inteiro junto: o app
    // serve tarefas, plano e formulário, e nada disso depende deste aviso.
    console.error("[atrasos] varredura falhou:", error);
    return 0;
  }
}

let agendado = false;

export function agendarVarreduraDeAtrasos(): void {
  if (agendado) return;
  agendado = true;
  void varrerAtrasos();
  // unref para o temporizador não ser motivo de o processo ficar de pé sozinho
  // — quem manda no ciclo de vida é o servidor, não a varredura.
  setInterval(() => void varrerAtrasos(), INTERVALO).unref?.();
}
