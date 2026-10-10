"use client";

// Visão geral da comunicação: o que saiu, quem já foi avisado e quem falta.
//
// Recebe tudo pronto do servidor e não guarda cópia em estado, de propósito: a
// página se revalida sozinha a cada poucos segundos, e os números daqui
// acompanham sem ninguém apertar atualizar.

import { AlertTriangle, CheckCheck, Clock3, MessagesSquare, Send, Users } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/vz";
import { formatDateTime } from "@/lib/dates";
import type { ClientState, CommunicationOverview } from "@/lib/whatsapp/overview";

const STATE: Record<ClientState, { label: string; tone: string; help: string }> = {
  falta_avisar: { label: "Falta avisar", tone: "is-amber", help: "Tem conteúdo esperando que o grupo ainda não recebeu." },
  avisado: { label: "Avisado", tone: "is-green", help: "O grupo já recebeu o aviso de tudo que está pendente." },
  sem_link: { label: "Sem link do portal", tone: "is-red", help: "Tem conteúdo esperando, mas o cliente não tem link de aprovação ativo. Nada pode ser enviado." },
  avisos_desligados: { label: "Avisos desligados", tone: "", help: "Os avisos automáticos deste cliente estão desligados na aba Comunicação dele." },
  sem_grupo: { label: "Sem grupo", tone: "", help: "Nenhum grupo de WhatsApp escolhido para este cliente." },
  em_dia: { label: "Nada pendente", tone: "", help: "Não há conteúdo esperando resposta deste cliente." },
};

const KIND: Record<string, string> = { team: "Aviso da equipe", approval: "Conteúdo para aprovar", reminder: "Lembrete", last_day: "Último dia", auto_approved: "Aprovado por prazo", broadcast: "Comunicado" };
const STATUS: Record<string, { label: string; tone: string }> = {
  sent: { label: "Enviada", tone: "is-green" },
  pending: { label: "Na fila", tone: "is-blue" },
  failed: { label: "Falhou", tone: "is-red" },
  skipped: { label: "Descartada", tone: "" },
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", timeZone: "UTC" }).replace(".", "");
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

function Kpi({ icon, tone, label, value, detail }: { icon: React.ReactNode; tone: string; label: string; value: string | number; detail: string }) {
  return <article className={`dash-kpi dash-kpi--${tone}`}><span className="dash-kpi__icon">{icon}</span><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>;
}

export function CommunicationOverviewPanel({ overview, automationEnabled, paused }: { overview: CommunicationOverview; automationEnabled: boolean; paused: boolean }) {
  const { totals, daily, clients, recent } = overview;
  const peak = Math.max(1, ...daily.map((day) => day.sent + day.failed));
  const attention = clients.filter((client) => client.state === "falta_avisar" || client.state === "sem_link");

  return <div className="comm-overview">
    {!automationEnabled && !paused ? <p className="form-message">Os avisos automáticos de aprovação estão desligados. Quem aparece como “Falta avisar” só recebe quando você ligar na aba Mensagens automáticas.</p> : null}

    <section className="dash-kpi-grid" aria-label="Indicadores da comunicação">
      <Kpi icon={<Send size={19} />} tone="violet" label="Enviadas hoje" value={totals.sentToday} detail={`${totals.sent7d} nos últimos 7 dias`} />
      <Kpi icon={<Clock3 size={19} />} tone="blue" label="Na fila" value={totals.queued} detail={paused ? "Envios pausados" : totals.queued ? "Saem uma por vez, com intervalo" : "Nada esperando para sair"} />
      <Kpi icon={<AlertTriangle size={19} />} tone={totals.clientsNotNotified ? "amber" : "green"} label="Clientes sem aviso" value={totals.clientsNotNotified} detail={`de ${plural(totals.clientsWaiting, "cliente", "clientes")} com material esperando`} />
      <Kpi icon={<MessagesSquare size={19} />} tone="violet" label="Conteúdos esperando" value={totals.contentsWaiting} detail="textos e criativos com os clientes agora" />
      <Kpi icon={<Users size={19} />} tone="blue" label="Clientes com grupo" value={`${totals.clientsWithGroup}/${totals.clients}`} detail={totals.clients - totals.clientsWithGroup ? `${totals.clients - totals.clientsWithGroup} ainda sem grupo configurado` : "todos configurados"} />
      <Kpi icon={<CheckCheck size={19} />} tone={totals.failed7d ? "red" : "green"} label="Falhas em 7 dias" value={totals.failed7d} detail={totals.failed7d ? "veja o motivo no histórico abaixo" : "nenhum envio falhou"} />
    </section>

    <div className="comm-overview__grid">
      <Card className="comm-overview__clients">
        <header><h2>Situação por cliente</h2><p>{attention.length ? `${plural(attention.length, "cliente precisa", "clientes precisam")} de atenção.` : "Ninguém precisando de atenção agora."}</p></header>
        <div className="dash-table-wrap"><table className="dash-table">
          <thead><tr><th>Cliente</th><th>Situação</th><th>Esperando</th><th>Último aviso</th><th>Prazo</th></tr></thead>
          <tbody>{clients.map((client) => {
            const state = STATE[client.state];
            return <tr key={client.id}>
              <td><Link href={`/projetos/${client.id}`}><strong>{client.name}</strong><span>{client.groupName || "Sem grupo configurado"}</span></Link></td>
              <td><span className={`dash-pill ${state.tone}`} title={state.help}>{state.label}</span></td>
              <td>{client.text + client.creative ? <>{[client.text ? plural(client.text, "texto", "textos") : "", client.creative ? plural(client.creative, "criativo", "criativos") : ""].filter(Boolean).join(" · ")}{client.notNotified > 0 && client.notNotified < client.text + client.creative ? <span> {client.notNotified} sem aviso</span> : null}</> : "—"}</td>
              <td>{client.lastNotice ? <>{KIND[client.lastNotice.kind] || client.lastNotice.kind}<span> {formatDateTime(client.lastNotice.at)}</span></> : "Nunca"}</td>
              <td>{client.deadlineIso ? <strong className={client.daysLeft !== undefined && client.daysLeft <= 1 ? "is-negative" : undefined}>{shortDate(client.deadlineIso)}{client.daysLeft !== undefined ? <span> {client.daysLeft <= 0 ? "vence hoje" : `faltam ${plural(client.daysLeft, "dia", "dias")}`}</span> : null}</strong> : "—"}</td>
            </tr>;
          })}</tbody>
        </table></div>
      </Card>

      <Card className="comm-overview__daily">
        <header><h2>Envios por dia</h2><p>Últimos 7 dias.</p></header>
        <div className="comm-overview__bars" role="img" aria-label={`Mensagens enviadas por dia: ${daily.map((day) => `${weekday(day.date)} ${day.sent}`).join(", ")}`}>
          {daily.map((day) => <div key={day.date} title={`${weekday(day.date)}: ${plural(day.sent, "enviada", "enviadas")}${day.failed ? `, ${plural(day.failed, "falha", "falhas")}` : ""}`}>
            <b>{day.sent + day.failed || ""}</b>
            <i><em className="is-failed" style={{ height: `${(day.failed / peak) * 100}%` }} /><em style={{ height: `${(day.sent / peak) * 100}%` }} /></i>
            <span>{weekday(day.date)}</span>
          </div>)}
        </div>
      </Card>
    </div>

    <Card className="comm-overview__recent">
      <header><h2>Histórico de mensagens</h2><p>As 25 mais recentes, incluindo o que está na fila.</p></header>
      {recent.length ? <ul>{recent.map((message) => {
        const status = STATUS[message.status] || { label: message.status, tone: "" };
        return <li key={message.id}>
          <details>
            <summary>
              <span className={`dash-pill ${status.tone}`}>{status.label}</span>
              <strong>{message.projectName}</strong>
              <span>{KIND[message.kind] || message.kind}</span>
              <time dateTime={message.at}>{formatDateTime(message.at)}</time>
            </summary>
            {message.error ? <p className="comm-overview__error">{message.error}</p> : null}
            {message.body ? <p className="comm-overview__body">{message.body}</p> : !message.error ? <p className="comm-overview__error">O texto é montado na hora do envio.</p> : null}
          </details>
        </li>;
      })}</ul> : <p className="broadcasts__hint">Nenhuma mensagem enviada ainda.</p>}
    </Card>
  </div>;
}
