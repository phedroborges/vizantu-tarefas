"use client";

import { ClipboardList, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import { planStageLabel, planStageTone } from "@/lib/approval-workflow";
import { PLAN_KINDS } from "@/lib/types";
import type { Plan, PlanKind, PlanStage, Project } from "@/lib/types";

function kindLabel(kind: PlanKind) {
  return PLAN_KINDS.find((k) => k.value === kind)?.label || kind;
}

export function PlanosView({
  initialPlans,
  initialProjects,
  planStages,
  canEdit = true,
}: {
  initialPlans: Plan[];
  initialProjects: Project[];
  planStages: Record<string, PlanStage>;
  canEdit?: boolean;
}) {
  const [plans, setPlans] = useState(initialPlans);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(initialProjects[0]?.id || "");
  const [kind, setKind] = useState<PlanKind>("content");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState("");
  const { confirm, ConfirmDialog } = useConfirm();

  const projectById = useMemo(() => new Map(initialProjects.map((p) => [p.id, p])), [initialProjects]);

  const visiblePlans = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return plans;
    return plans.filter((plan) => `${plan.title} ${projectById.get(plan.projectId)?.name || ""}`.toLowerCase().includes(normalized));
  }, [plans, query, projectById]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return setError("Informe o título do plano.");
    if (!projectId) return setError("Selecione um projeto.");
    setError("");
    setIsSaving(true);
    const response = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, projectId, kind }),
    });
    const result = await response.json();
    setIsSaving(false);
    if (!response.ok) return setError(result.error || "Não foi possível criar o plano.");
    setPlans((current) => [result.plan, ...current]);
    setTitle("");
    showToast("Plano criado.");
  }

  async function remove(plan: Plan) {
    if (!(await confirm({ title: "Excluir plano", message: `Excluir o plano "${plan.title}"? Os itens (tarefas) dele também serão excluídos.`, confirmLabel: "Excluir", danger: true }))) return;
    const response = await fetch(`/api/plans/${plan.id}`, { method: "DELETE" });
    if (!response.ok) return showToast("Não foi possível excluir o plano.");
    setPlans((current) => current.filter((item) => item.id !== plan.id));
    showToast("Plano excluído.");
  }

  return (
    <>
      <main className="admin-page dashboard">
        <div className="dashboard-head">
          <div>
            <span className="eyebrow">Operação</span>
            <h1>Planos</h1>
            <p>Conjuntos de conteúdos ou passos de processo por projeto — roteiro, direcionamento, referência e legenda de cada item ficam aqui, prontos pro dashboard do cliente.</p>
          </div>
          <div className="stats" style={{ display: "flex", gap: 1, background: "var(--line)", border: "1px solid var(--line)" }}>
            <div className="stat"><strong>{plans.length}</strong><span>planos</span></div>
          </div>
        </div>
        <div className="split-layout" style={!canEdit ? { gridTemplateColumns: "1fr" } : undefined}>
          {canEdit ? (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Novo plano</h2>
                  <p>Crie o container — os itens (vídeos, posts, carrosséis ou passos) você adiciona na página do plano.</p>
                </div>
              </div>
              <form className="modal-body" onSubmit={submit} style={{ padding: "24px 25px 27px" }}>
                {error ? <div className="form-message">{error}</div> : null}
                <div className="field">
                  <label htmlFor="plan-title">Título do plano</label>
                  <input id="plan-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Setembro/2026 — Conteúdo orgânico" required maxLength={140} />
                </div>
                <div className="field">
                  <label htmlFor="plan-project">Projeto</label>
                  <select id="plan-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                    {initialProjects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="plan-kind">Tipo</label>
                  <select id="plan-kind" value={kind} onChange={(e) => setKind(e.target.value as PlanKind)}>
                    {PLAN_KINDS.filter((item) => item.value !== "brand").map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                  </select>
                </div>
                <button className="primary-button" type="submit" disabled={isSaving} style={{ width: "100%" }}>{isSaving ? "Criando..." : "Criar plano"}</button>
              </form>
            </section>
          ) : null}

          <section className="panel list-panel">
            <div className="toolbar">
              <div className="search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por plano ou projeto" aria-label="Buscar planos" /></div>
              <span style={{ color: "var(--muted-text)", fontSize: 12 }}>{visiblePlans.length} {visiblePlans.length === 1 ? "resultado" : "resultados"}</span>
            </div>
            {visiblePlans.length ? (
              <ul className="project-list">
                {visiblePlans.map((plan) => (
                  <li className="project-row" key={plan.id}>
                    <Link href={`/planos/${plan.id}`} className="project-row-title" style={{ textDecoration: "none", color: "inherit" }}>
                      <strong>{plan.title}</strong>
                      <span>{projectById.get(plan.projectId)?.name || "—"} · {kindLabel(plan.kind)}</span>
                    </Link>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                      <span className={`status ${planStageTone(planStages[plan.id] || "rascunho")}`} title="Etapa calculada a partir das rodadas de aprovação do cliente">{planStageLabel(planStages[plan.id] || "rascunho")}</span>
                      {canEdit ? (
                        <button className="icon-button" type="button" onClick={() => remove(plan)} title="Excluir" aria-label={`Excluir ${plan.title}`}><Trash2 size={14} /></button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                <ClipboardList size={35} />
                <h3>{query ? "Nenhum plano encontrado" : "Crie o primeiro plano"}</h3>
                <p>{query ? "Tente buscar por outro nome." : "Use o formulário ao lado para criar o primeiro plano de conteúdo ou processo."}</p>
              </div>
            )}
          </section>
        </div>
      </main>
      {ConfirmDialog}
      {toast ? <div className="toast">{toast}</div> : null}
    </>
  );
}
