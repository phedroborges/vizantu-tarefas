"use client";

import Link from "next/link";
import { Copy, Folders, Link2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";
import { AvatarPicker } from "@/components/avatar-picker";
import { useConfirm } from "@/components/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button, Card, EmptyState, Field, IconButton, Input, PageHeader, Progress, SearchInput, Select, Tag, Toolbar } from "@/components/vz";
import { PROJECT_STATUSES, type Project, type ProjectStatus, type Task } from "@/lib/types";

type ProjectDraft = { name: string; client: string; clientRole: string; clientCity: string; clientInstagram: string; avatarUrl: string | null; avatarColor: string | null; status: ProjectStatus };
const EMPTY_DRAFT: ProjectDraft = { name: "", client: "", clientRole: "", clientCity: "", clientInstagram: "", avatarUrl: null, avatarColor: null, status: "ativo" };
const toneByStatus = { ativo: "green", pausado: "amber", concluido: "slate" } as const;

export function ProjetosView({ initialProjects, initialTasks, canEdit = true }: { initialProjects: Project[]; initialTasks: Task[]; canEdit?: boolean }) {
  const [projects, setProjects] = useState(initialProjects);
  const [draft, setDraft] = useState<ProjectDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [linksByProject, setLinksByProject] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");
  const { confirm, ConfirmDialog } = useConfirm();

  const taskStats = useMemo(() => {
    const result = new Map<string, { total: number; done: number; overdue: number }>();
    const today = new Date().toISOString().slice(0, 10);
    for (const task of initialTasks) {
      const current = result.get(task.projectId) || { total: 0, done: 0, overdue: 0 };
      current.total++;
      if (task.status === "finalizado") current.done++;
      if (task.dueDate && task.dueDate < today && task.status !== "finalizado") current.overdue++;
      result.set(task.projectId, current);
    }
    return result;
  }, [initialTasks]);
  const visibleProjects = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return term ? projects.filter((project) => `${project.name} ${project.client || ""}`.toLocaleLowerCase("pt-BR").includes(term)) : projects;
  }, [projects, query]);

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2400); }
  function openCreate() { setEditingId(null); setDraft(EMPTY_DRAFT); setError(""); setDialogOpen(true); }
  function openEdit(project: Project) {
    setEditingId(project.id);
    setDraft({ name: project.name, client: project.client || "", clientRole: project.clientRole || "", clientCity: project.clientCity || "", clientInstagram: project.clientInstagram || "", avatarUrl: project.avatarUrl ?? null, avatarColor: project.avatarColor ?? null, status: project.status });
    setError(""); setDialogOpen(true);
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim()) return setError("Informe o nome do projeto.");
    setIsSaving(true); setError("");
    const response = await fetch(editingId ? `/api/projects/${editingId}` : "/api/projects", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    const result = await response.json(); setIsSaving(false);
    if (!response.ok) return setError(result.error || "Não foi possível salvar o projeto.");
    setProjects((current) => (current.some((item) => item.id === result.project.id) ? current.map((item) => item.id === result.project.id ? result.project : item) : [result.project, ...current]).toSorted((a, b) => a.name.localeCompare(b.name, "pt-BR")));
    setDialogOpen(false); notify(editingId ? "Projeto atualizado." : "Projeto criado.");
  }
  async function clientLink(project: Project) {
    const known = linksByProject[project.id];
    if (known) { await navigator.clipboard.writeText(known); return notify("Link copiado."); }
    const response = await fetch(`/api/projects/${project.id}/link`, { method: "POST" }); const result = await response.json();
    if (!response.ok) return notify("Não foi possível gerar o link.");
    const url = `${window.location.origin}/c/${result.link.token}`; setLinksByProject((current) => ({ ...current, [project.id]: url }));
    await navigator.clipboard.writeText(url).catch(() => {}); notify("Link do cliente gerado e copiado.");
  }
  async function remove(project: Project) {
    if (!(await confirm({ title: "Excluir projeto", message: `Excluir “${project.name}”? As tarefas desse projeto também serão excluídas.`, confirmLabel: "Excluir", danger: true }))) return;
    if (!(await fetch(`/api/projects/${project.id}`, { method: "DELETE" })).ok) return notify("Não foi possível excluir o projeto.");
    setProjects((current) => current.filter((item) => item.id !== project.id)); notify("Projeto excluído.");
  }

  return <>
    <main className="admin-page dashboard projects-page">
      <PageHeader eyebrow="Operação" title="Projetos" description="Uma visão clara de cada cliente, suas entregas e a saúde da operação." actions={canEdit ? <Button variant="primary" onClick={openCreate}><Plus size={16} /> Novo projeto</Button> : null} />
      <Toolbar className="projects-toolbar"><div className="vz-toolbar__search"><SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar projeto ou cliente…" shortcut={null} /></div><span className="vz-caption">{visibleProjects.length} {visibleProjects.length === 1 ? "projeto" : "projetos"}</span></Toolbar>
      {visibleProjects.length ? <div className="project-gallery">{visibleProjects.map((project) => {
        const stats = taskStats.get(project.id) || { total: 0, done: 0, overdue: 0 }; const rate = stats.total ? Math.round(stats.done / stats.total * 100) : 0;
        return <Card key={project.id} className="project-tile" interactive>
          <Link href={`/projetos/${project.id}`} className="project-tile__link" aria-label={`Abrir ${project.name}`}>
            <div className="project-tile__cover" style={{ "--project-accent": project.avatarColor || "var(--vz-brand)" } as React.CSSProperties} />
            <div className="project-tile__body"><Avatar name={project.name} imageUrl={project.avatarUrl} color={project.avatarColor} size={58} className="project-tile__avatar" /><Tag tone={toneByStatus[project.status]}>{PROJECT_STATUSES.find((item) => item.value === project.status)?.label}</Tag><h2>{project.name}</h2><p>{project.client || "Projeto interno"}{project.clientCity ? ` · ${project.clientCity}` : ""}</p><Progress value={stats.done} total={stats.total || 1} label={`${stats.done} de ${stats.total} tarefas concluídas`} tone={stats.overdue ? "red" : "green"} thin /><div className="project-tile__meta"><span>{rate}% concluído</span><span className={stats.overdue ? "is-danger" : ""}>{stats.overdue ? `${stats.overdue} atrasada${stats.overdue > 1 ? "s" : ""}` : "No prazo"}</span></div></div>
          </Link>
          {canEdit ? <div className="project-tile__actions"><IconButton bare title="Editar" aria-label={`Editar ${project.name}`} onClick={() => openEdit(project)}><Pencil size={15} /></IconButton><IconButton bare title="Link do cliente" aria-label={`Link de ${project.name}`} onClick={() => clientLink(project)}>{linksByProject[project.id] ? <Copy size={15} /> : <Link2 size={15} />}</IconButton><IconButton bare title="Excluir" aria-label={`Excluir ${project.name}`} onClick={() => remove(project)}><Trash2 size={15} /></IconButton></div> : null}
        </Card>;
      })}</div> : <EmptyState icon={<Folders size={24} />} title={query ? "Nenhum projeto encontrado" : "Seu primeiro projeto começa aqui"} description={query ? "Tente buscar por outro nome." : "Crie um projeto para reunir contexto, acessos e todas as entregas de um cliente."} actions={!query && canEdit ? <Button variant="soft" onClick={openCreate}><Plus size={15} /> Criar projeto</Button> : undefined} />}
    </main>
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="project-dialog sm:max-w-2xl !p-0 !gap-0" showCloseButton={false}><DialogHeader className="vz-modal__head"><div><DialogTitle>{editingId ? "Editar projeto" : "Novo projeto"}</DialogTitle><DialogDescription>{editingId ? "Atualize a identidade e os dados principais." : "Crie a área de um novo cliente ou projeto interno."}</DialogDescription></div><IconButton bare aria-label="Fechar" onClick={() => setDialogOpen(false)}><X size={17} /></IconButton></DialogHeader><form onSubmit={submit}><div className="vz-modal__body project-form">{error ? <div className="form-message">{error}</div> : null}<Field label="Logo ou cor do projeto"><AvatarPicker name={draft.name || "Novo projeto"} imageUrl={draft.avatarUrl} color={draft.avatarColor} withColor onChange={(next) => setDraft((current) => ({ ...current, ...next }))} /></Field><div className="project-form__grid"><Field label="Nome do projeto"><Input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex.: Casa Caramelo" required /></Field><Field label="Cliente"><Input value={draft.client} onChange={(e) => setDraft({ ...draft, client: e.target.value })} placeholder="Nome do contato ou empresa" /></Field><Field label="Cargo / área"><Input value={draft.clientRole} onChange={(e) => setDraft({ ...draft, clientRole: e.target.value })} placeholder="Ex.: Diretora de marketing" /></Field><Field label="Cidade"><Input value={draft.clientCity} onChange={(e) => setDraft({ ...draft, clientCity: e.target.value })} placeholder="Ex.: Mineiros — GO" /></Field><Field label="Instagram"><Input value={draft.clientInstagram} onChange={(e) => setDraft({ ...draft, clientInstagram: e.target.value })} placeholder="@perfil" /></Field><Field label="Status"><Select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as ProjectStatus })}>{PROJECT_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></Field></div></div><div className="vz-modal__foot"><Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button type="submit" variant="primary" disabled={isSaving}>{isSaving ? "Salvando…" : editingId ? "Salvar alterações" : "Criar projeto"}</Button></div></form></DialogContent></Dialog>
    {ConfirmDialog}{toast ? <div className="toast">{toast}</div> : null}
  </>;
}
