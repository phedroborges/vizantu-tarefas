// A inteligência de calendário do plano.
//
// O problema real: o cliente aprova devagar e fora de ordem. O calendário foi
// montado numa sequência que fazia sentido quando ninguém tinha aprovado nada,
// e agora o item do dia 4 continua parado em aprovação de texto enquanto o do
// dia 15 já está liberado pra produção. A equipe fica sem o que fazer hoje e
// com tudo represado depois.
//
// A ideia central é separar duas coisas que estavam grudadas: as DATAS do
// plano e os CONTEÚDOS que ocupam essas datas. As datas são vagas, e a
// quantidade de vagas por semana já foi combinada com o cliente. O que muda é
// quem senta em cada vaga: quem já foi aprovado senta antes.
//
// Nada é criado, nada é apagado e nenhuma data nova é inventada. As mesmas
// vagas, com outra ordem de ocupantes. É por isso que o algoritmo é seguro de
// rodar: o volume combinado com o cliente não muda.

import { DONE_STATUSES, type TaskStatus } from "./types";

// ---------- Formato ----------

export type FormatFamily = "video" | "carrossel" | "estatico" | "outro";

// O nome da tag é escrito por gente e varia ("Reels", "Reel", "Vídeo",
// "Video"). A normalização tira acento e caixa antes de comparar.
export function formatFamily(labels: string[]): FormatFamily {
  const normalized = labels.map((label) =>
    label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim(),
  );
  if (normalized.some((label) => /(^|\s)(video|reels?|tiktok|shorts?)(\s|$)/.test(label))) return "video";
  if (normalized.some((label) => label.includes("carrossel"))) return "carrossel";
  if (normalized.some((label) => label.includes("estatico") || label.includes("feed") || label.includes("post"))) return "estatico";
  return "outro";
}

// O mínimo por semana que a casa se comprometeu a entregar. Não é teto nem
// regra absoluta: é o piso que o algoritmo tenta manter quando escolhe qual
// conteúdo ocupa qual vaga, e é o que o diagnóstico cobra.
// Teto de conteúdos no mesmo dia numa recuperação de atraso. Dois é normal,
// três é o limite antes de o dia virar despejo.
export const MAX_POR_DIA = 3;

export const WEEKLY_MINIMUM: Record<Exclude<FormatFamily, "outro">, number> = {
  video: 2,
  estatico: 1,
  carrossel: 1,
};

// ---------- Aprovação ----------

// Status que já passaram pela aprovação de texto do cliente. Sai direto do
// fluxo: taskStatusAfterClientDecision manda o item aprovado pra
// "aguardando captação" ou "pronto para criação", e daí ele só avança.
const COPY_APPROVED = new Set<TaskStatus>([
  "aguardando_captacao", "pronto_para_criacao", "em_criacao", "revisao",
  "para_aprovacao", ...DONE_STATUSES,
]);

export function copyApproved(status: TaskStatus): boolean {
  return COPY_APPROVED.has(status);
}

// ---------- Semana ----------

const MS_DIA = 86_400_000;

function toUtc(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return fromUtc(toUtc(iso) + days * MS_DIA);
}

// A segunda-feira da semana da data. É a chave que agrupa o diagnóstico
// semanal, e semana no Brasil começa na segunda.
export function weekStart(iso: string): string {
  const ms = toUtc(iso);
  const weekday = (new Date(ms).getUTCDay() + 6) % 7;
  return fromUtc(ms - weekday * MS_DIA);
}

// ---------- Reordenação ----------

export type ScheduleItem = {
  id: string;
  name: string;
  dueDate?: string;
  status: TaskStatus;
  seasonal: boolean;
  formats: string[];
};

export type ScheduleMove = { id: string; name: string; from?: string; to: string };

export type ScheduleResult = {
  moves: ScheduleMove[];
  /** Item que precisaria de vaga e não tem data nenhuma pra receber. */
  unscheduled: ScheduleItem[];
};

// O plano tem uma lista de datas já combinadas. Esta função devolve QUEM fica
// em cada uma delas.
//
// Regras, em ordem de força:
// 1. Sazonal não se move. Um post de 7 de setembro no dia 8 não é conteúdo,
//    é erro. Ele sai do baralho antes de qualquer coisa, com a vaga dele.
// 2. Vaga no passado não recebe ninguém. Toda vaga anterior a `minDate` é
//    puxada pra frente, pra dias livres depois da última vaga existente.
// 3. Quem já teve o texto aprovado ocupa as vagas mais cedo.
// 4. Empate se resolve pelo mínimo semanal: entre dois itens aprovados, entra
//    o formato que ainda falta naquela semana.
// 5. Empate persistente mantém a ordem atual, pra reorganização não embaralhar
//    o que já estava bom.
export function reschedulePlan(
  items: ScheduleItem[],
  options: { minDate: string },
): ScheduleResult {
  const { minDate } = options;
  const comData = items.filter((item) => item.dueDate);

  // 1. Sazonal fica onde está, e a vaga dele sai do jogo.
  const travados = comData.filter((item) => item.seasonal);
  const travadasPorData = new Set(travados.map((item) => item.dueDate!));

  const moveis = comData.filter((item) => !item.seasonal);

  // 2. As vagas disponíveis são as datas dos itens móveis. As que caíram no
  //    passado não servem mais e precisam ser recolocadas.
  //
  //    Elas voltam pra DENTRO do plano, dobrando com dias que já têm conteúdo,
  //    e não pra depois do fim dele. Empurrar pra frente parece mais limpo,
  //    mas joga o que atrasou pro mês seguinte e o pacote combinado com o
  //    cliente deixa de fechar no mês. Dobrar recupera o atraso onde ele
  //    aconteceu. Dois conteúdos no mesmo dia é normal numa recuperação; três
  //    é o teto, e só quando não sobrou dia com menos.
  const vagasValidas: string[] = [];
  let atrasadas = 0;
  for (const item of moveis) {
    if (item.dueDate! < minDate) atrasadas += 1;
    else vagasValidas.push(item.dueDate!);
  }
  vagasValidas.sort();

  const ocupacao = new Map<string, number>();
  for (const data of vagasValidas) ocupacao.set(data, (ocupacao.get(data) ?? 0) + 1);
  for (const item of travados) ocupacao.set(item.dueDate!, (ocupacao.get(item.dueDate!) ?? 0) + 1);

  const conhecidas = [...ocupacao.keys()].sort();
  const ultima = conhecidas.length ? conhecidas[conhecidas.length - 1] : minDate;

  // O primeiro dia, a partir de amanhã, que ainda cabe mais um conteúdo sem
  // passar do teto. Dia de sazonal não conta como livre: a data dele é dele.
  function primeiroDiaComVaga(teto: number): string | null {
    for (let dia = minDate; dia <= ultima; dia = addDays(dia, 1)) {
      if (travadasPorData.has(dia)) continue;
      if ((ocupacao.get(dia) ?? 0) < teto) return dia;
    }
    return null;
  }

  let depoisDoFim = addDays(ultima, 1);
  for (let i = 0; i < atrasadas; i++) {
    // Espalha antes de dobrar: dia vazio primeiro, depois dia com um só, e
    // três só quando o plano inteiro já está cheio. Dobrar é permitido, mas
    // não é o primeiro recurso.
    let destino = primeiroDiaComVaga(1) ?? primeiroDiaComVaga(2) ?? primeiroDiaComVaga(MAX_POR_DIA);
    if (!destino) {
      // O plano inteiro já está no teto. Aí não tem jeito: vai pra depois.
      while (travadasPorData.has(depoisDoFim)) depoisDoFim = addDays(depoisDoFim, 1);
      destino = depoisDoFim;
      depoisDoFim = addDays(depoisDoFim, 1);
    }
    ocupacao.set(destino, (ocupacao.get(destino) ?? 0) + 1);
    vagasValidas.push(destino);
  }
  vagasValidas.sort();

  // 3 a 5. Preenche vaga por vaga, da mais cedo pra mais tarde.
  const fila = [...moveis].sort((a, b) => {
    const aprovacao = Number(copyApproved(b.status)) - Number(copyApproved(a.status));
    if (aprovacao) return aprovacao;
    return (a.dueDate || "").localeCompare(b.dueDate || "");
  });

  // Quanto de cada formato já foi colocado em cada semana, pra o desempate
  // saber o que ainda falta.
  const porSemana = new Map<string, Map<FormatFamily, number>>();
  for (const item of travados) {
    const semana = weekStart(item.dueDate!);
    const contagem = porSemana.get(semana) ?? new Map();
    const familia = formatFamily(item.formats);
    contagem.set(familia, (contagem.get(familia) ?? 0) + 1);
    porSemana.set(semana, contagem);
  }

  const moves: ScheduleMove[] = [];
  const restantes = [...fila];

  for (const vaga of vagasValidas) {
    if (!restantes.length) break;
    const semana = weekStart(vaga);
    const contagem = porSemana.get(semana) ?? new Map<FormatFamily, number>();

    // O primeiro da fila manda, MENOS quando um item do mesmo nível de
    // aprovação fecha um buraco do mínimo semanal que o primeiro não fecha.
    const primeiro = restantes[0];
    const mesmoNivel = restantes.filter((item) => copyApproved(item.status) === copyApproved(primeiro.status));
    const escolhido =
      mesmoNivel.find((item) => {
        const familia = formatFamily(item.formats);
        if (familia === "outro") return false;
        return (contagem.get(familia) ?? 0) < WEEKLY_MINIMUM[familia];
      }) ?? primeiro;

    const familia = formatFamily(escolhido.formats);
    contagem.set(familia, (contagem.get(familia) ?? 0) + 1);
    porSemana.set(semana, contagem);

    restantes.splice(restantes.indexOf(escolhido), 1);
    if (escolhido.dueDate !== vaga) moves.push({ id: escolhido.id, name: escolhido.name, from: escolhido.dueDate, to: vaga });
  }

  return { moves, unscheduled: restantes };
}

// ---------- Diagnóstico semanal ----------

export type WeekDiagnosis = {
  weekStart: string;
  counts: Record<FormatFamily, number>;
  missing: { family: Exclude<FormatFamily, "outro">; quantidade: number }[];
};

// O que cada semana do plano tem, e o que falta pro mínimo combinado. Não
// muda nada: é a leitura que diz se o plano cumpre o que foi vendido.
export function weeklyDiagnosis(items: ScheduleItem[]): WeekDiagnosis[] {
  const semanas = new Map<string, Record<FormatFamily, number>>();
  for (const item of items) {
    if (!item.dueDate) continue;
    const chave = weekStart(item.dueDate);
    const atual = semanas.get(chave) ?? { video: 0, carrossel: 0, estatico: 0, outro: 0 };
    atual[formatFamily(item.formats)] += 1;
    semanas.set(chave, atual);
  }

  return [...semanas.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([inicio, counts]) => ({
      weekStart: inicio,
      counts,
      missing: (Object.keys(WEEKLY_MINIMUM) as (keyof typeof WEEKLY_MINIMUM)[])
        .map((family) => ({ family, quantidade: WEEKLY_MINIMUM[family] - counts[family] }))
        .filter((falta) => falta.quantidade > 0),
    }));
}
