"use client";

// O corpo do dashboard. Ele vivia inline dentro de app/page.tsx, que é um
// Server Component — e por isso era a única tela do produto que não dava pra
// montar na prévia com dados de mentira. Extraído, ele passa a seguir o mesmo
// padrão de todas as outras: a página busca e calcula, a view só desenha.

import { AlertTriangle, CheckCircle2, Clock3, ListTodo } from "lucide-react";
import Link from "next/link";
import { DueCountdown } from "@/components/due-countdown";
import type { Project, Task } from "@/lib/types";

export type ProjectOverviewRow = { project: Project; total: number; done: number; rate: number };
export type RankingRow = { name: string; count: number };

export function DashboardView({
  tasks,
  projectById,
  projectsCount,
  total,
  done,
  inProgress,
  overdue,
  projectOverview,
  ranking,
  maxCount,
}: {
  tasks: Task[];
  projectById: Map<string, Project>;
  projectsCount: number;
  total: number;
  done: number;
  inProgress: number;
  overdue: number;
  projectOverview: ProjectOverviewRow[];
  ranking: RankingRow[];
  maxCount: number;
}) {
  const projects = { length: projectsCount };
  return (
      <main className="admin-page dashboard">
        <div className="dashboard-head">
          <div>
            <span className="eyebrow">Operação</span>
            <h1>Visão geral</h1>
            <p>Acompanhe o andamento de todas as tarefas do time, prazos e responsáveis em um só painel.</p>
          </div>
        </div>

        <div className="metric-grid">
          <div className="metric-card">
            <div className="metric-icon violet"><ListTodo size={18} /></div>
            <span>Total de tarefas</span>
            <strong>{total}</strong>
            <small>Em {projects.length} {projects.length === 1 ? "projeto" : "projetos"}</small>
          </div>
          <div className="metric-card">
            <div className="metric-icon green"><CheckCircle2 size={18} /></div>
            <span>Finalizadas</span>
            <strong>{done}</strong>
            <small>{total ? Math.round((done / total) * 100) : 0}% do total</small>
          </div>
          <div className="metric-card">
            <div className="metric-icon blue"><Clock3 size={18} /></div>
            <span>Em andamento</span>
            <strong>{inProgress}</strong>
            <small>Precisam de acompanhamento</small>
          </div>
          <div className="metric-card">
            <div className="metric-icon red"><AlertTriangle size={18} /></div>
            <span>Atrasadas</span>
            <strong>{overdue}</strong>
            <small>Passaram da data de entrega</small>
          </div>
        </div>

        <section className="panel project-overview">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Projetos</span>
              <h2>Andamento por projeto</h2>
            </div>
            <Link className="secondary-button" href="/projetos">Ver projetos</Link>
          </div>
          {projectOverview.length ? (
            <div className="project-table-wrap">
              <table className="project-table">
                <thead>
                  <tr><th>Projeto</th><th>Tarefas</th><th>Progresso</th></tr>
                </thead>
                <tbody>
                  {projectOverview.map(({ project, total: projectTotal, done: projectDone, rate }) => (
                    <tr key={project.id}>
                      <td><strong>{project.name}</strong><span>{project.client || "Sem cliente definido"}</span></td>
                      <td><strong>{projectDone}/{projectTotal}</strong><span>finalizadas</span></td>
                      <td>
                        <div className="project-progress-label"><strong>{rate}%</strong></div>
                        <div className="project-progress"><span style={{ width: `${rate}%` }} /></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state"><h3>Nenhum projeto cadastrado</h3><p>Crie o primeiro projeto para começar a organizar as tarefas.</p></div>
          )}
        </section>

        <div className="split-layout">
          <section className="panel">
            <div className="panel-head">
              <div><span className="eyebrow">Prazos</span><h2>Próximas entregas</h2></div>
              <Link className="secondary-button" href="/tarefas">Ver tarefas</Link>
            </div>
            {/* O contador substitui a lista simples que existia aqui: era a
                mesma informação sem dizer quanto tempo falta, que é justamente
                o que se quer saber num painel de prazos. */}
            <DueCountdown tasks={tasks} projectById={projectById} />
          </section>

          <section className="panel">
            <div className="panel-head">
              <div><span className="eyebrow">Time</span><h2>Tarefas por responsável</h2></div>
            </div>
            {ranking.length ? (
              <ul className="ranking-list">
                {ranking.map(({ name, count }, index) => (
                  <li key={name}>
                    <span className="ranking-number">{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{name}</strong>
                      <div className="project-progress" style={{ marginTop: 6 }}><span style={{ width: `${(count / maxCount) * 100}%` }} /></div>
                    </div>
                    <span>{count} {count === 1 ? "tarefa" : "tarefas"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state"><h3>Sem responsáveis definidos</h3><p>Atribua responsáveis às tarefas para ver o ranking aqui.</p></div>
            )}
          </section>
        </div>
      </main>
  );
}
