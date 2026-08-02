"use client";

import { Pencil, Power, Search, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Member } from "@/lib/types";

export function MembrosView({ initialMembers }: { initialMembers: Member[] }) {
  const [members, setMembers] = useState(initialMembers);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState("");

  const visibleMembers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return members;
    return members.filter((member) => member.name.toLowerCase().includes(normalized));
  }, [members, query]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setError("");
  }

  function startEdit(member: Member) {
    setEditingId(member.id);
    setName(member.name);
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return setError("Informe o nome do membro.");
    setError("");
    setIsSaving(true);
    const response = await fetch(editingId ? `/api/members/${editingId}` : "/api/members", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const result = await response.json();
    setIsSaving(false);
    if (!response.ok) return setError(result.error || "Não foi possível salvar o membro.");
    setMembers((current) => {
      const exists = current.some((item) => item.id === result.member.id);
      const next = exists
        ? current.map((item) => (item.id === result.member.id ? result.member : item))
        : [result.member, ...current];
      return next.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    });
    showToast(editingId ? "Membro atualizado." : "Membro cadastrado.");
    resetForm();
  }

  async function toggleActive(member: Member) {
    const response = await fetch(`/api/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !member.active }),
    });
    if (!response.ok) return showToast("Não foi possível atualizar o membro.");
    const result = await response.json();
    setMembers((current) => current.map((item) => (item.id === member.id ? result.member : item)));
    showToast(result.member.active ? "Membro reativado." : "Membro desativado.");
  }

  return (
    <>
      <main className="admin-page dashboard">
        <div className="dashboard-head">
          <div>
            <span className="eyebrow">Operação</span>
            <h1>Membros</h1>
            <p>Cadastre os nomes do time para atribuir responsáveis nas tarefas, sem precisar digitar toda vez.</p>
          </div>
          <div className="stats" style={{ display: "flex", gap: 1, background: "var(--line)", border: "1px solid var(--line)" }}>
            <div className="stat" style={{ background: "white", minWidth: 132, padding: "15px 18px" }}><strong>{members.length}</strong><span>membros</span></div>
          </div>
        </div>
        <div className="split-layout">
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>{editingId ? "Editar membro" : "Novo membro"}</h2>
                <p>{editingId ? "Atualize o nome do membro." : "Cadastre um novo integrante do time."}</p>
              </div>
            </div>
            <form className="modal-body" onSubmit={submit} style={{ padding: "24px 25px 27px" }}>
              {error ? <div className="form-message">{error}</div> : null}
              <div className="field">
                <label htmlFor="member-name">Nome</label>
                <input id="member-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Phedro" required maxLength={80} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="primary-button" type="submit" disabled={isSaving} style={{ flex: 1 }}>{isSaving ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar membro"}</button>
                {editingId ? <button className="secondary-button" type="button" onClick={resetForm}><X size={15} /></button> : null}
              </div>
            </form>
          </section>

          <section className="panel list-panel">
            <div className="toolbar">
              <div className="search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome" aria-label="Buscar membros" /></div>
              <span style={{ color: "var(--muted-text)", fontSize: 12 }}>{visibleMembers.length} {visibleMembers.length === 1 ? "resultado" : "resultados"}</span>
            </div>
            {visibleMembers.length ? (
              <ul className="project-list">
                {visibleMembers.map((member) => (
                  <li className="project-row" key={member.id} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                    <div className="project-row-title">
                      <strong>{member.name}</strong>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                      <span className={`status ${member.active ? "feita" : "atrasada"}`}>{member.active ? "Ativo" : "Inativo"}</span>
                      <button className="icon-button" type="button" onClick={() => startEdit(member)} title="Editar" aria-label={`Editar ${member.name}`}><Pencil size={14} /></button>
                      <button className="icon-button" type="button" onClick={() => toggleActive(member)} title={member.active ? "Desativar" : "Reativar"} aria-label={`${member.active ? "Desativar" : "Reativar"} ${member.name}`}><Power size={14} /></button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                <Users size={35} />
                <h3>{query ? "Nenhum membro encontrado" : "Cadastre o primeiro membro"}</h3>
                <p>{query ? "Tente buscar por outro nome." : "Use o formulário ao lado para cadastrar o time."}</p>
              </div>
            )}
          </section>
        </div>
      </main>
      {toast ? <div className="toast">{toast}</div> : null}
    </>
  );
}
