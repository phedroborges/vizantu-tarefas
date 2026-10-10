"use client";

// O resumo que abre o perfil do cliente. O que explica o projeto já existia,
// mas espalhado: o que ele faz e o que ele quer no guia, o escopo em
// Documentos, o plano em Planos, o time em Equipe. Quem ia estudar o cliente
// abria quatro abas. Aqui fica o suficiente para entender em uma tela, e cada
// quadro leva para a aba onde está o detalhe.

import Link from "next/link";
import { CalendarClock, FileSignature, ListChecks, Sparkles, Target, Users } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Card } from "@/components/vz";
import { formatDueDate, isOverdue } from "@/lib/dates";
import type { ProjectTab } from "@/lib/permissions";
import { CLOSED_TASK_STATUSES, CONTRACT_STATUSES, PLAN_KINDS, type Contract, type Member, type Plan, type ProjectProfile, type Task } from "@/lib/types";

// Assinado vale mais que enviado, que vale mais que rascunho; encerrado só
// aparece quando não há outro.
const PESO_DO_CONTRATO: Record<Contract["status"], number> = { assinado: 0, enviado: 1, rascunho: 2, encerrado: 3 };

function escopoDoContrato(contract: Contract): string {
  const { fields } = contract;
  const itens = [
    [fields.qtd_videos, "vídeos"], [fields.qtd_carrosseis, "carrosséis"], [fields.qtd_estaticos, "estáticos"],
  ].filter(([quantidade]) => Number(quantidade) > 0).map(([quantidade, nome]) => `${quantidade} ${nome}`);
  return itens.length ? `${itens.join(", ")} por mês` : "";
}

export function ProjectSummary({
  guia, tasks, plans, contracts, team, abas, onAbrirAba, onCompletar,
}: {
  guia: Partial<ProjectProfile>;
  tasks: Task[];
  plans: Plan[];
  contracts: Contract[];
  team: Member[];
  // Contrato e equipe só aparecem para quem tem a aba correspondente.
  abas: ProjectTab[];
  onAbrirAba: (aba: ProjectTab) => void;
  onCompletar?: () => void;
}) {
  const contrato = contracts.toSorted((a, b) => PESO_DO_CONTRATO[a.status] - PESO_DO_CONTRATO[b.status])[0];
  const plano = plans.find((plan) => plan.status !== "archived");
  const proximas = tasks
    .filter((task) => task.dueDate && !CLOSED_TASK_STATUSES.includes(task.status))
    .toSorted((a, b) => (a.dueDate as string).localeCompare(b.dueDate as string))
    .slice(0, 3);
  const vazio = (texto: string) => <p className="project-summary__vazio">{texto}{onCompletar ? <> <button type="button" onClick={onCompletar}>Responder</button></> : null}</p>;

  return (
    <Card className="project-summary">
      <div className="project-summary__linha project-summary__linha--textos">
      <div className="project-summary__item">
        <span className="vz-eyebrow"><Sparkles size={12} /> O que é</span>
        {guia.oQueFaz?.trim() || guia.segmento?.trim() ? <p className="project-summary__texto">{guia.oQueFaz?.trim() || guia.segmento}</p> : vazio("Ainda não está escrito o que esse cliente faz.")}
      </div>
      <div className="project-summary__item">
        <span className="vz-eyebrow"><Target size={12} /> O que ele quer</span>
        {guia.desejo?.trim() ? <p className="project-summary__texto">{guia.desejo}</p> : vazio("Ainda não está escrito o que ele espera do trabalho.")}
      </div>
      </div>

      <div className="project-summary__linha">
      {abas.includes("documentos") ? <div className="project-summary__item">
        <span className="vz-eyebrow"><FileSignature size={12} /> Contrato</span>
        {contrato ? <button type="button" className="project-summary__link" onClick={() => onAbrirAba("documentos")}>
          <strong>{contrato.title}</strong>
          <span>{[
            CONTRACT_STATUSES.find((item) => item.value === contrato.status)?.label,
            contrato.fields.vigencia_inicio ? `desde ${formatDueDate(contrato.fields.vigencia_inicio)}` : "",
            Number(contrato.fields.vigencia_meses) > 0 ? `${contrato.fields.vigencia_meses} meses` : "",
          ].filter(Boolean).join(" · ")}</span>
          {escopoDoContrato(contrato) ? <span>{escopoDoContrato(contrato)}</span> : null}
        </button> : <p className="project-summary__vazio">Nenhum contrato vinculado.</p>}
      </div> : null}

      <div className="project-summary__item">
        <span className="vz-eyebrow"><ListChecks size={12} /> Plano mais recente</span>
        {plano ? <Link className="project-summary__link" href={`/planos/${plano.id}`}>
          <strong>{plano.title}</strong>
          <span>{PLAN_KINDS.find((item) => item.value === plano.kind)?.label.split(" (")[0]}{plans.length > 1 ? ` · ${plans.length} planos no total` : ""}</span>
        </Link> : <p className="project-summary__vazio">Nenhum plano criado.</p>}
      </div>

      {abas.includes("equipe") ? <div className="project-summary__item">
        <span className="vz-eyebrow"><Users size={12} /> Quem atende</span>
        {team.length ? <button type="button" className="project-summary__link" onClick={() => onAbrirAba("equipe")}>
          <span className="project-summary__time">{team.map((member) => <Avatar key={member.id} name={member.name} imageUrl={member.avatarUrl} size={26} />)}</span>
          <span>{team.map((member) => member.name.split(" ")[0]).join(", ")}</span>
        </button> : <p className="project-summary__vazio">Sem equipe marcada: aberto para o time inteiro.</p>}
      </div> : null}

      <div className="project-summary__item">
        <span className="vz-eyebrow"><CalendarClock size={12} /> Próximas entregas</span>
        {proximas.length ? <ul className="project-summary__entregas">{proximas.map((task) => <li key={task.id}>
          <Link href={`/tarefas/${task.id}`}><span className={isOverdue(task.dueDate, task.status) ? "is-danger" : ""}>{formatDueDate(task.dueDate)}</span>{task.name}</Link>
        </li>)}</ul> : <p className="project-summary__vazio">Nenhuma entrega aberta com prazo.</p>}
      </div>
      </div>
    </Card>
  );
}
