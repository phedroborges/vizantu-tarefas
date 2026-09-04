"use client";

// A tela de dentro de um pacote de produção.
//
// O pacote existe porque gravar cinco reels no mesmo dia é UMA tarefa, não
// cinco. Mas ele era um cartãozinho na tela do plano que não abria em lugar
// nenhum, e quem ia gravar não tinha onde responder a única pergunta que
// importa na véspera: "o que eu preciso ter na mão, e já está tudo pronto?".
//
// Nenhum componente novo foi inventado pra ela: é migalha + cabeçalho de tela
// + quatro fichas + cartão com barra de progresso + a mesma tabela das outras
// telas. É exatamente o que um design system tem que permitir — montar uma
// tela que não existia sem desenhar uma peça nova.

import Link from "next/link";
import { Camera, ChevronRight, CircleAlert, Check, Clapperboard, Paperclip, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";
import { StatusTag, statusColorMap } from "@/components/status-tag";
import { TaskModal } from "@/components/task-modal";
import { formatDueDate } from "@/lib/dates";
import { DONE_STATUSES } from "@/lib/types";
import type { Member, Plan, PlanCaptacao, Project, StatusColor, Tag, Task } from "@/lib/types";

export function PacoteDetailView({
  plan,
  project,
  captacao,
  captacoes,
  initialTasks,
  members,
  formatTags,
  channelTags,
  categoryTags,
  statusColors,
  currentUserId,
  canEdit = true,
}: {
  plan: Plan;
  project: Project;
  captacao: PlanCaptacao;
  captacoes: PlanCaptacao[];
  initialTasks: Task[];
  members: Member[];
  formatTags: Tag[];
  channelTags: Tag[];
  categoryTags: Tag[];
  statusColors: StatusColor[];
  currentUserId: string;
  canEdit?: boolean;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [editingTask, setEditingTask] = useState<Task | null | undefined>(undefined);
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const cores = useMemo(() => statusColorMap(statusColors), [statusColors]);
  const captura = captacao.packageKind === "capture";

  const prontos = tasks.filter((task) => DONE_STATUSES.includes(task.status)).length;
  const comRoteiro = tasks.filter((task) => (task.description || "").trim().length > 40).length;
  const comLink = tasks.filter((task) => Boolean(task.driveLink)).length;

  // A checklist não é uma lista digitada: cada linha é derivada do estado real
  // das tarefas do pacote. Uma checklist que alguém marca à mão vira decoração
  // no primeiro dia corrido.
  const checklist = [
    { texto: "Roteiros escritos", ok: comRoteiro === tasks.length && tasks.length > 0, detalhe: `${comRoteiro} de ${tasks.length}` },
    { texto: "Material anexado", ok: comLink === tasks.length && tasks.length > 0, detalhe: `${comLink} de ${tasks.length}` },
    ...(captura ? [{ texto: "Responsável pela gravação definido", ok: Boolean(captacao.recordingAssigneeId), detalhe: captacao.recordingAssigneeId ? memberById.get(captacao.recordingAssigneeId)?.name ?? "definido" : "ninguém" }] : []),
    { texto: captura ? "Responsável pela edição definido" : "Responsável pela criação definido", ok: Boolean(captacao.editingAssigneeId), detalhe: captacao.editingAssigneeId ? memberById.get(captacao.editingAssigneeId)?.name ?? "definido" : "ninguém" },
  ];
  const pendencias = checklist.filter((linha) => !linha.ok).length;

  function onTaskSaved(task: Task) {
    setTasks((current) => current.map((t) => (t.id === task.id ? task : t)).filter((t) => t.captacaoId === captacao.id));
  }

  return (
    <>
      <main className="admin-page dashboard plan-screen">
        <div className="vz-crumb" style={{ marginBottom: 10 }}>
          <Link href="/planos">Planos</Link>
          <ChevronRight size={13} />
          <Link href={`/planos/${plan.id}`}>{project.name}</Link>
          <ChevronRight size={13} />
          <Link href={`/planos/${plan.id}`}>{plan.title}</Link>
          <ChevronRight size={13} />
          <b>{captacao.label}</b>
        </div>

        <div className="plan-head">
          <div className="plan-head__text">
            <h1>{captacao.label}</h1>
            <div className="plan-head__tags">
              <span className={`badge ${captura ? "list" : "format"}`}>
                {captura ? <Camera size={11} /> : <Clapperboard size={11} />}
                {captura ? "Exige captação" : "Direto pra criação"}
              </span>
              <span className="badge">{tasks.length} {tasks.length === 1 ? "conteúdo" : "conteúdos"}</span>
              <span className="badge">{prontos} prontos</span>
              {pendencias ? <span className="badge is-danger">{pendencias} {pendencias === 1 ? "pendência" : "pendências"}</span> : null}
            </div>
          </div>
        </div>

        <div className="pacote-fichas">
          <Ficha icone={<Camera size={16} />} tom="violet" rotulo={captura ? "Quem grava" : "Quem cria"} membro={captura ? captacao.recordingAssigneeId : captacao.editingAssigneeId} memberById={memberById} />
          <Ficha icone={<Clapperboard size={16} />} tom="green" rotulo={captura ? "Quem edita" : "Revisão"} membro={captacao.editingAssigneeId} memberById={memberById} />
          <Ficha icone={<UserRound size={16} />} tom="blue" rotulo="Cliente" texto={project.client || project.name} apoio={project.clientCity} />
          <Ficha icone={<Paperclip size={16} />} tom="amber" rotulo="Material" texto={`${comLink} de ${tasks.length} com link`} apoio={comLink === tasks.length ? "tudo anexado" : "faltando"} />
        </div>

        <section className="panel" style={{ marginBottom: 18 }}>
          <div className="panel-head">
            <div>
              <h2>{captura ? "Pronto para gravar?" : "Pronto para criar?"}</h2>
              <p>Cada linha é lida do estado real dos conteúdos — nada aqui se marca à mão.</p>
            </div>
            <span className={`badge ${pendencias ? "is-danger" : "is-ok"}`}>
              {pendencias ? `${pendencias} ${pendencias === 1 ? "pendência" : "pendências"}` : "tudo pronto"}
            </span>
          </div>
          <div style={{ padding: "16px 20px 20px", display: "grid", gap: 12 }}>
            <div className="plan-progress-track plan-progress-track--thin">
              <div className="plan-progress-fill" style={{ width: `${Math.round(((checklist.length - pendencias) / checklist.length) * 100)}%` }} />
            </div>
            <ul className="pacote-checklist">
              {checklist.map((linha) => (
                <li key={linha.texto} className={linha.ok ? "is-ok" : "is-pendente"}>
                  <span className="pacote-checklist__marca">{linha.ok ? <Check size={13} strokeWidth={3} /> : <CircleAlert size={15} />}</span>
                  <span>{linha.texto}</span>
                  <small>{linha.detalhe}</small>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="panel list-panel">
          <div className="panel-head">
            <div>
              <h2>Conteúdos deste pacote</h2>
              <p>Na ordem de {captura ? "gravação" : "criação"}.</p>
            </div>
          </div>
          {tasks.length ? (
            <div className="project-table-wrap">
              <table className="task-table">
                <thead>
                  <tr>
                    <th style={{ width: 52 }}>#</th>
                    <th>Conteúdo</th>
                    <th style={{ width: 170 }}>Responsável</th>
                    <th style={{ width: 130 }}>Entrega</th>
                    <th style={{ width: 200 }}>Etapa</th>
                    <th style={{ width: 130 }}>Roteiro</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task, indice) => {
                    const dono = task.assigneeId ? memberById.get(task.assigneeId) : undefined;
                    const temRoteiro = (task.description || "").trim().length > 40;
                    return (
                      <tr key={task.id} onClick={() => setEditingTask(task)} style={{ cursor: "pointer" }}>
                        <td style={{ color: "var(--vz-text-faint)", fontFamily: "var(--vz-font-mono)", fontSize: 11 }}>{String(indice + 1).padStart(2, "0")}</td>
                        <td><span className="task-name">{task.name}</span></td>
                        <td>{dono ? <span className="avatar-name"><Avatar name={dono.name} imageUrl={dono.avatarUrl} size={20} /><span>{dono.name}</span></span> : <span className="meta-empty">—</span>}</td>
                        <td><span className="due-value">{task.dueDate ? formatDueDate(task.dueDate) : "—"}</span></td>
                        <td><StatusTag status={task.status} colorByStatus={cores} /></td>
                        <td><span className={`badge ${temRoteiro ? "is-ok" : "list"}`}>{temRoteiro ? "Pronto" : "Falta escrever"}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <Camera size={35} />
              <h3>Nenhum conteúdo neste pacote</h3>
              <p>Volte ao plano e mova um conteúdo para cá pelo modal da tarefa.</p>
            </div>
          )}
        </section>
      </main>

      {editingTask !== undefined ? (
        <TaskModal
          task={editingTask}
          projects={[project]}
          members={members}
          formatTags={formatTags}
          channelTags={channelTags}
          categoryTags={categoryTags}
          statusColors={statusColors}
          captacoes={captacoes}
          defaultProjectId={plan.projectId}
          canEdit={canEdit}
          currentUserId={currentUserId}
          onClose={() => setEditingTask(undefined)}
          onSaved={onTaskSaved}
          onDeleted={(id) => setTasks((current) => current.filter((t) => t.id !== id))}
          onDuplicated={onTaskSaved}
          onTagCreated={() => {}}
        />
      ) : null}
    </>
  );
}

function Ficha({
  icone, tom, rotulo, membro, memberById, texto, apoio,
}: {
  icone: React.ReactNode; tom: string; rotulo: string;
  membro?: string; memberById?: Map<string, Member>; texto?: string; apoio?: string;
}) {
  const pessoa = membro && memberById ? memberById.get(membro) : undefined;
  return (
    <div className="pacote-ficha">
      <span className="pacote-ficha__topo">
        <span className={`metric-icon ${tom === "violet" ? "violet" : tom}`}>{icone}</span>
        <span className="ds-label">{rotulo}</span>
      </span>
      <span className="pacote-ficha__valor">
        {pessoa ? <Avatar name={pessoa.name} imageUrl={pessoa.avatarUrl} size={22} /> : null}
        <strong>{pessoa?.name ?? texto ?? "definir"}</strong>
      </span>
      {apoio ? <small>{apoio}</small> : null}
    </div>
  );
}
