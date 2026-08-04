"use client";

import { Check, FolderLock, Sparkles, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { USER_ROLES } from "@/lib/types";
import type { Member, Project, UserRole } from "@/lib/types";

export function MembrosView({
  initialMembers,
  projects,
  initialProjectAccess,
}: {
  initialMembers: Member[];
  projects: Project[];
  initialProjectAccess: Record<string, string[]>;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [projectAccess, setProjectAccess] = useState(initialProjectAccess);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("editor");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [managingAccessFor, setManagingAccessFor] = useState<string | null>(null);

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function resetForm() {
    setName("");
    setEmail("");
    setPassword("");
    setRole("editor");
    setAiEnabled(false);
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return setError("Preencha nome, e-mail e senha.");
    setError("");
    setIsSaving(true);
    const response = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role, aiEnabled }),
    });
    const result = await response.json();
    setIsSaving(false);
    if (!response.ok) return setError(result.error || "Não foi possível criar o usuário.");
    setMembers((current) => [...current, result.member].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
    showToast("Usuário criado.");
    resetForm();
  }

  async function patchMember(id: string, patch: Partial<Pick<Member, "role" | "aiEnabled" | "active">>) {
    const response = await fetch(`/api/members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!response.ok) return showToast("Não foi possível atualizar o usuário.");
    const result = await response.json();
    setMembers((current) => current.map((m) => (m.id === id ? result.member : m)));
  }

  async function toggleProjectAccess(memberId: string, projectId: string) {
    const current = projectAccess[memberId] || [];
    const next = current.includes(projectId) ? current.filter((id) => id !== projectId) : [...current, projectId];
    setProjectAccess((state) => ({ ...state, [memberId]: next }));
    await fetch(`/api/members/${memberId}/projects`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectIds: next }),
    });
  }

  const managingMember = members.find((m) => m.id === managingAccessFor);

  return (
    <>
      <main className="admin-page dashboard">
        <div className="dashboard-head">
          <div>
            <span className="eyebrow">Operação</span>
            <h1>Membros</h1>
            <p>Gerencie quem tem acesso ao app, o papel de cada um, se pode usar a IA, e quais projetos consegue ver.</p>
          </div>
          <div className="stats" style={{ display: "flex", gap: 1, background: "var(--line)", border: "1px solid var(--line)" }}>
            <div className="stat" style={{ background: "white", minWidth: 132, padding: "15px 18px" }}><strong>{members.length}</strong><span>usuários</span></div>
          </div>
        </div>
        <div className="split-layout">
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Novo usuário</h2>
                <p>Defina o e-mail e uma senha temporária — a pessoa pode trocá-la depois pelo &quot;esqueci minha senha&quot;.</p>
              </div>
            </div>
            <form className="modal-body" onSubmit={submit} style={{ padding: "24px 25px 27px" }}>
              {error ? <div className="form-message">{error}</div> : null}
              <div className="field">
                <label htmlFor="member-name">Nome</label>
                <input id="member-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Phedro" required maxLength={80} />
              </div>
              <div className="field">
                <label htmlFor="member-email">E-mail</label>
                <input id="member-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={160} />
              </div>
              <div className="field">
                <label htmlFor="member-password">Senha temporária</label>
                <input id="member-password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
              </div>
              <div className="field">
                <label htmlFor="member-role">Papel</label>
                <select id="member-role" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                  {USER_ROLES.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                </select>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--dark)" }}>
                <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} />
                Liberar assistente de IA para esse usuário
              </label>
              <button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? "Criando..." : "Criar usuário"}</button>
            </form>
          </section>

          <section className="panel list-panel">
            <div className="toolbar">
              <span style={{ color: "var(--muted-text)", fontSize: 12 }}>{members.length} {members.length === 1 ? "usuário" : "usuários"}</span>
            </div>
            {members.length ? (
              <ul className="project-list">
                {members.map((member) => (
                  <li className="project-row" key={member.id} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                    <div className="project-row-title">
                      <strong>{member.name}</strong>
                      <span>{member.email}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <select
                        className="meta-select"
                        style={{ border: "1px solid var(--line)", height: 32, padding: "0 8px" }}
                        value={member.role}
                        onChange={(e) => patchMember(member.id, { role: e.target.value as UserRole })}
                      >
                        {USER_ROLES.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                      </select>
                      {member.role === "visualizador" ? (
                        <button className="icon-button" type="button" onClick={() => setManagingAccessFor(member.id)} title="Projetos liberados" aria-label={`Projetos liberados para ${member.name}`}>
                          <FolderLock size={14} />
                        </button>
                      ) : null}
                      <button
                        className={`icon-button ${member.aiEnabled ? "" : ""}`}
                        type="button"
                        onClick={() => patchMember(member.id, { aiEnabled: !member.aiEnabled })}
                        title={member.aiEnabled ? "IA liberada — clique pra desligar" : "IA desligada — clique pra liberar"}
                        aria-label={`${member.aiEnabled ? "Desligar" : "Liberar"} IA para ${member.name}`}
                        style={member.aiEnabled ? { borderColor: "#d9caf7", background: "#f2ecfe", color: "var(--brand-strong)" } : undefined}
                      >
                        <Sparkles size={14} />
                      </button>
                      <span className={`status ${member.active ? "feita" : "atrasada"}`}>{member.active ? "Ativo" : "Inativo"}</span>
                      <button
                        className="icon-button"
                        type="button"
                        onClick={() => patchMember(member.id, { active: !member.active })}
                        title={member.active ? "Desativar" : "Reativar"}
                        aria-label={`${member.active ? "Desativar" : "Reativar"} ${member.name}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                <Users size={35} />
                <h3>Nenhum usuário ainda</h3>
                <p>Use o formulário ao lado para criar o primeiro acesso.</p>
              </div>
            )}
          </section>
        </div>
      </main>

      {managingMember ? (
        <div className="modal-layer">
          <button className="modal-backdrop" type="button" aria-label="Fechar" onClick={() => setManagingAccessFor(null)} />
          <div className="modal" style={{ maxHeight: 460 }}>
            <header className="modal-head">
              <h2 className="modal-title">Projetos de {managingMember.name}</h2>
              <button type="button" onClick={() => setManagingAccessFor(null)} aria-label="Fechar"><X size={16} /></button>
            </header>
            <div className="modal-body">
              <p style={{ margin: 0, color: "var(--muted-text)", fontSize: 12 }}>Marque os projetos que essa pessoa pode ver. Sem nenhum marcado, ela não vê tarefa nenhuma.</p>
              <ul className="project-list">
                {projects.map((project) => {
                  const checked = (projectAccess[managingMember.id] || []).includes(project.id);
                  return (
                    <li className="project-row" key={project.id} style={{ gridTemplateColumns: "1fr auto", padding: "12px 4px" }}>
                      <span>{projectById.get(project.id)?.name}</span>
                      <button type="button" className={`tag-pill ${checked ? "selected" : ""}`} onClick={() => toggleProjectAccess(managingMember.id, project.id)}>
                        {checked ? <Check size={11} /> : null} {checked ? "Liberado" : "Bloqueado"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            <footer className="modal-actions">
              <span />
              <button className="primary-button" type="button" onClick={() => setManagingAccessFor(null)}>Concluído</button>
            </footer>
          </div>
        </div>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </>
  );
}
