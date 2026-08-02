import { AlertTriangle, CheckCircle2, Clock3, ListTodo } from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { formatDueDate, isOverdue } from "@/lib/dates";
import { listProjects, listTasks } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [tasks, projects] = await Promise.all([listTasks(), listProjects()]);

  const total = tasks.length;
  const done = tasks.filter((task) => task.status === "concluida").length;
  const inProgress = tasks.filter((task) => task.status === "em_andamento").length;
  const overdue = tasks.filter((task) => isOverdue(task.dueDate, task.status)).length;

  const upcoming = tasks
    .filter((task) => task.status !== "concluida" && task.dueDate)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
    .slice(0, 8);

  const assigneeCounts = new Map<string, number>();
  tasks.forEach((task) => {
    if (!task.assignee) return;
    assigneeCounts.set(task.assignee, (assigneeCounts.get(task.assignee) || 0) + 1);
  });
  const ranking = Array.from(assigneeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maxCount = ranking[0]?.[1] || 1;

  const projectById = new Map(projects.map((project) => [project.id, project]));
  const projectOverview = projects.map((project) => {
    const projectTasks = tasks.filter((task) => task.projectId === project.id);
    const projectDone = projectTasks.filter((task) => task.status === "concluida").length;
    const rate = projectTasks.length ? Math.round((projectDone / projectTasks.length) * 100) : 0;
    return { project, total: projectTasks.length, done: projectDone, rate };
  });

  return (
    <AdminShell active="dashboard">
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
            <span>Concluídas</span>
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
                      <td><strong>{projectDone}/{projectTotal}</strong><span>concluídas</span></td>
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
            {upcoming.length ? (
              <ul className="upcoming-list">
                {upcoming.map((task) => {
                  const overdueTask = isOverdue(task.dueDate, task.status);
                  return (
                    <li className="upcoming-item" key={task.id}>
                      <div><strong>{task.name}</strong><span>{projectById.get(task.projectId)?.name || "Sem projeto"} · {task.assignee || "Sem responsável"}</span></div>
                      <span className={`upcoming-due ${overdueTask ? "overdue" : ""}`}>{formatDueDate(task.dueDate)}{overdueTask ? " · atrasada" : ""}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="empty-state"><h3>Nenhuma entrega pendente</h3><p>Todas as tarefas com prazo estão concluídas.</p></div>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <div><span className="eyebrow">Time</span><h2>Tarefas por responsável</h2></div>
            </div>
            {ranking.length ? (
              <ul className="ranking-list">
                {ranking.map(([assignee, count], index) => (
                  <li key={assignee}>
                    <span className="ranking-number">{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{assignee}</strong>
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
    </AdminShell>
  );
}
