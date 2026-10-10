import { Trophy } from "lucide-react";
import { Avatar } from "@/components/avatar";
import type { DashboardRanking, DashboardRankingEntry, DashboardTeamRanking } from "@/lib/dashboard-metrics";
import { formatDuration } from "@/lib/dates";

const PLACES = ["ouro", "prata", "bronze"] as const;
const PLACE_LABELS = ["1º lugar", "2º lugar", "3º lugar"];

function summary(entry: DashboardRankingEntry) {
  return `${entry.deliveries} entregas · ${formatDuration(entry.averageMs)} por entrega · ${entry.qualityScore}% sem refação`;
}

function Board({ title, hint, ranking, minDeliveries }: { title: string; hint: string; ranking: DashboardRanking; minDeliveries: number }) {
  const podium = ranking.entries.slice(0, 3);
  // No pódio o primeiro fica no meio, com o segundo à esquerda e o terceiro à direita.
  const steps = [podium[1], podium[0], podium[2]].filter((entry): entry is DashboardRankingEntry => Boolean(entry));
  return <article className="rank-board">
    <header className="rank-board__head"><h3>{title}</h3><p>{hint}</p></header>
    {podium.length ? <>
      <ol className="rank-podium" aria-label={`Pódio: ${title}`}>
        {steps.map((entry) => {
          const place = PLACES[entry.position - 1];
          return <li className={`rank-step rank-step--${place}`} key={entry.memberId} title={summary(entry)}>
            <span className="rank-step__trophy"><Trophy size={entry.position === 1 ? 26 : 20} aria-hidden="true" /></span>
            <Avatar name={entry.name} imageUrl={entry.avatarUrl} size={entry.position === 1 ? 56 : 44} />
            <strong>{entry.name}</strong>
            <span className="rank-step__score">{entry.score} pts</span>
            <span className="rank-step__base"><b>{entry.position}º</b><span className="sr-only">{PLACE_LABELS[entry.position - 1]}</span></span>
          </li>;
        })}
      </ol>
      <ol className="rank-list">
        {ranking.entries.map((entry) => <li key={entry.memberId} className={entry.position <= 3 ? `is-${PLACES[entry.position - 1]}` : ""}>
          <b>{entry.position}º</b>
          <div><strong>{entry.name}</strong><small>{summary(entry)}{entry.reworkRounds ? ` (${entry.reworkRounds} ${entry.reworkRounds === 1 ? "volta" : "voltas"})` : ""}</small></div>
          <span>{entry.score} pts</span>
        </li>)}
      </ol>
    </> : <p className="rank-board__empty">Ninguém chegou a {minDeliveries} entregas neste período ainda.</p>}
    {ranking.warmingUp.length ? <p className="rank-board__warming">Na disputa a partir de {minDeliveries} entregas: {ranking.warmingUp.map((member) => `${member.name} (${member.deliveries})`).join(", ")}.</p> : null}
  </article>;
}

/** Pódio da criação e da estratégia. Só recebe o resultado pronto: nome, foto
 * e os números de cada pessoa, nada de cliente ou de tarefa. */
export function TeamRanking({ ranking, periodLabel }: { ranking: DashboardTeamRanking; periodLabel?: string }) {
  return <section className="team-ranking" aria-label="Ranking do time">
    <header className="team-ranking__head">
      <span className="eyebrow">Ranking do time</span>
      <h2>Quem está na frente{periodLabel ? <small> · {periodLabel}</small> : null}</h2>
      <p>Ganha quem entrega mais rápido e com menos refação.</p>
    </header>
    <div className="team-ranking__boards">
      <Board title="Melhor criativo" hint="Peças aprovadas no período." ranking={ranking.criacao} minDeliveries={ranking.minDeliveries} />
      <Board title="Melhor estratégico" hint="Planejamentos que chegaram na criação no período." ranking={ranking.estrategia} minDeliveries={ranking.minDeliveries} />
    </div>
    <details className="team-ranking__rules">
      <summary>Como a pontuação é calculada</summary>
      <p><strong>Pontuação de 0 a 100.</strong> Metade é rapidez: até 30 pontos pelo tempo médio por entrega e até 20 pelo número de entregas, sempre comparando com quem foi melhor no período. A outra metade é qualidade: a parte das entregas que não voltou para Ajuste nem virou Problema. Disputa quem fez pelo menos {ranking.minDeliveries} entregas no período.</p>
      <p><strong>Criação.</strong> A entrega é a peça aprovada. O tempo corre de “Pronto para criação” até o envio para aprovação, sem contar a espera pelo cliente. Refação é a peça voltar da revisão ou do cliente.</p>
      <p><strong>Estratégia.</strong> A entrega é o planejamento chegar na criação. O tempo corre enquanto o texto está em Rascunho, Aguardando informação ou Ajuste; a aprovação do cliente e a espera pela gravação não contam. Refação é o cliente pedir ajuste ou reprovar o texto, ou a criação devolver o briefing.</p>
    </details>
  </section>;
}
