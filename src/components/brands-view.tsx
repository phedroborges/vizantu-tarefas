"use client";

import { CheckCircle2, Palette, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import type { Plan, Project } from "@/lib/types";

export function BrandsView({ initialBrands, initialProjects, taskCounts, canEdit = true }: { initialBrands: Plan[]; initialProjects: Project[]; taskCounts: Record<string, { completed: number; total: number }>; canEdit?: boolean }) {
  const [brands, setBrands] = useState(initialBrands);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(initialProjects[0]?.id || "");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const { confirm, ConfirmDialog } = useConfirm();
  const projectById = useMemo(() => new Map(initialProjects.map((project) => [project.id, project])), [initialProjects]);
  const visible = brands.filter((brand) => `${brand.title} ${projectById.get(brand.projectId)?.name || ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !projectId) return setError("Informe a marca e o projeto.");
    setSaving(true); setError("");
    const response = await fetch("/api/brands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, projectId }) });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) return setError(result.error || "Não foi possível criar a marca.");
    setBrands((current) => [result.plan, ...current]); setTitle(""); setToast("Marca criada com as 7 etapas padrão.");
    window.setTimeout(() => setToast(""), 2500);
  }

  async function remove(brand: Plan) {
    if (!(await confirm({ title: "Excluir marca", message: `Excluir “${brand.title}” e suas etapas?`, confirmLabel: "Excluir", danger: true }))) return;
    const response = await fetch(`/api/plans/${brand.id}`, { method: "DELETE" });
    if (response.ok) setBrands((current) => current.filter((item) => item.id !== brand.id));
  }

  return <>
    <main className="admin-page dashboard">
      <div className="dashboard-head"><div><span className="eyebrow">Operação</span><h1>Marcas</h1><p>Fluxos de branding com etapas, responsáveis, prazos e entregáveis centralizados.</p></div><div className="stats"><div className="stat"><strong>{brands.length}</strong><span>marcas</span></div></div></div>
      <div className="split-layout" style={!canEdit ? { gridTemplateColumns: "1fr" } : undefined}>
        {canEdit ? <section className="panel"><div className="panel-head"><div><h2>Nova marca</h2><p>As sete etapas padrão serão criadas automaticamente como tarefas.</p></div></div><form className="modal-body" onSubmit={submit}>
          {error ? <div className="form-message">{error}</div> : null}
          <div className="field"><label htmlFor="brand-title">Nome da marca</label><input id="brand-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Identidade visual — Global Energia" /></div>
          <div className="field"><label htmlFor="brand-project">Projeto</label><select id="brand-project" value={projectId} onChange={(event) => setProjectId(event.target.value)}>{initialProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
          <button className="primary-button" disabled={saving} type="submit"><Plus size={15} /> {saving ? "Criando..." : "Criar fluxo de marca"}</button>
        </form></section> : null}
        <section className="panel list-panel"><div className="toolbar"><div className="search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar marca ou projeto" /></div></div>
          {visible.length ? <ul className="brand-list">{visible.map((brand) => { const count = taskCounts[brand.id] || { completed: 0, total: 7 }; const rate = count.total ? Math.round(count.completed / count.total * 100) : 0; return <li key={brand.id} className="brand-row"><Link href={`/marcas/${brand.id}`}><span className="brand-row-icon"><Palette size={18} /></span><span className="brand-row-copy"><strong>{brand.title}</strong><small>{projectById.get(brand.projectId)?.name} · {count.completed} de {count.total} etapas</small><span className="brand-mini-progress"><i style={{ width: `${rate}%` }} /></span></span><span className="brand-rate"><CheckCircle2 size={14} /> {rate}%</span></Link>{canEdit ? <button className="icon-button" onClick={() => remove(brand)}><Trash2 size={14} /></button> : null}</li>})}</ul> : <div className="empty-state"><Palette size={34} /><h3>Nenhuma marca encontrada</h3><p>Crie um fluxo para acompanhar todas as entregas de branding.</p></div>}
        </section>
      </div>
    </main>{ConfirmDialog}{toast ? <div className="toast">{toast}</div> : null}
  </>;
}
