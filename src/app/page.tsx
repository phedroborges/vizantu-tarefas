import { AlertTriangle, CheckCircle2, Clock3, ListTodo } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { formatDueDate, isOverdue } from "@/lib/dates";
import { getCurrentUser } from "@/lib/current-user";
import { listMembers, listProjects, listTasks } from "@/lib/storage";
import { TASK_STATUSES } from "@/lib/types";

export const dynamic = "force-dynamic";

function groupOf(status: string) {
  return TASK_STATUSES.find((item) => item.value === status)?.group;
}

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [allTasks, allProjects, members] = await Promise.all([listTasks(), listProjects(), listMembers()]);
  const tasks = user.accessibleProjectIds === "all" ? allTasks : allTasks.filter((t) => user.accessibleProjectIds.includes(t.projectId));
  const projects = user.accessibleProjectIds === "all" ? allProjects : allProjects.filter((p) => user.accessibleProjectIds.includes(p.id));
  const memberById = new Map(members.map((member) => [member.id, member]));

  const total = tasks.length;
  // "Finalizado" é o verdadeiro estado de conclusão (quando a peça foi publicada).
  const done = tasks.filter((task) => task.status === "finalizado").length;
  const inProgress = tasks.filter((task) => groupOf(task.status) === "em_andamento").length;
  const overdue = tasks.filter((task) => isOverdue(task.dueDate, task.status)).length;

  const upcoming = tasks
    .filter((task) => task.status !== "finalizado" && task.dueDate)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
    .slice(0, 8);

  const assigneeCounts = new Map<string, number>();
  tasks.forEach((task) => {
    if (!task.assigneeId) return;
    assigneeCounts.set(task.assigneeId, (assigneeCounts.get(task.assigneeId) || 0) + 1);
  });
  const ranking = Array.from(assigneeCounts.entries())
    .map(([assigneeId, count]) => ({ name: memberById.get(assigneeId)?.name || "Ex-membro", count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const maxCount = ranking[0]?.count || 1;

  const projectById = new Map(projects.map((project) => [project.id, project]));
  const projectOverview = projects.map((project) => {
    const projectTasks = tasks.filter((task) => task.projectId === project.id);
    const projectDone = projectTasks.filter((task) => task.status === "finalizado").length;
    const rate = projectTasks.length ? Math.round((projectDone / projectTasks.length) * 100) : 0;
    return { project, total: projectTasks.length, done: projectDone, rate };
  });

  return (
    <AdminShell active="dashboard" user={user}>
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
            {upcoming.length ? (
              <ul className="upcoming-list">
                {upcoming.map((task) => {
                  const overdueTask = isOverdue(task.dueDate, task.status);
                  return (
                    <Link className="upcoming-item" key={task.id} href={`/tarefas/${task.id}`}>
                      <div><strong>{task.name}</strong><span>{projectById.get(task.projectId)?.name || "Sem projeto"} · {task.assigneeId ? memberById.get(task.assigneeId)?.name || "Ex-membro" : "Sem responsável"}</span></div>
                      <span className={`upcoming-due ${overdueTask ? "overdue" : ""}`}>{formatDueDate(task.dueDate)}{overdueTask ? " · atrasada" : ""}</span>
                    </Link>
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
    </AdminShell>
  );
}
