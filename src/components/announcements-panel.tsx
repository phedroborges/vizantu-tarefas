"use client";

import { Megaphone } from "lucide-react";
import { useState } from "react";
import { ANNOUNCEMENT_SCOPES, USER_ROLES } from "@/lib/types";
import type { Announcement, AnnouncementScope, Member, UserRole } from "@/lib/types";

// Criação de Aviso — some da tela do destinatário só quando ele confirma
// explicitamente (ver AnnouncementGate, renderizado em todo AdminShell).
export function AnnouncementsPanel({ members, currentUserRole }: { members: Member[]; currentUserRole: UserRole }) {
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState<AnnouncementScope>("all");
  const [scopeRole, setScopeRole] = useState<UserRole>("editor");
  const [scopeMemberId, setScopeMemberId] = useState(members[0]?.id || "");
  const [sent, setSent] = useState<Announcement[]>([]);
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);

  const scopeOptions = ANNOUNCEMENT_SCOPES.filter((s) => s.value !== "all" || currentUserRole === "dono");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) return setError("Escreva o texto do aviso.");
    setError("");
    setIsSending(true);
    const response = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, scope, scopeRole: scope === "role" ? scopeRole : undefined, scopeMemberId: scope === "member" ? scopeMemberId : undefined }),
    });
    const result = await response.json();
    setIsSending(false);
    if (!response.ok) return setError(result.error || "Não foi possível enviar o aviso.");
    setSent((current) => [result.announcement, ...current]);
    setBody("");
    setTitle("");
  }

  return (
    <section className="panel" style={{ marginTop: 18 }}>
      <div className="panel-head"><h2><Megaphone size={15} style={{ verticalAlign: -2 }} /> Avisos</h2><p>Aparece bloqueando a tela de quem você escolher, até a pessoa clicar em &quot;Ok, entendi&quot;.</p></div>
      <form className="modal-body" onSubmit={submit} style={{ padding: "20px 25px 24px", display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr", alignItems: "end" }}>
        {error ? <div className="form-message" style={{ gridColumn: "1 / -1" }}>{error}</div> : null}
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="ann-title">Título (opcional)</label>
          <input id="ann-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="ann-body">Mensagem</label>
          <textarea id="ann-body" className="task-desc-textarea" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} required />
        </div>
        <div className="field">
          <label htmlFor="ann-scope">Para quem</label>
          <select id="ann-scope" value={scope} onChange={(e) => setScope(e.target.value as AnnouncementScope)}>
            {scopeOptions.map((s) => <option value={s.value} key={s.value}>{s.label}</option>)}
          </select>
        </div>
        {scope === "role" ? (
          <div className="field">
            <label htmlFor="ann-role">Categoria</label>
            <select id="ann-role" value={scopeRole} onChange={(e) => setScopeRole(e.target.value as UserRole)}>
              {USER_ROLES.map((r) => <option value={r.value} key={r.value}>{r.label}</option>)}
            </select>
          </div>
        ) : null}
        {scope === "member" ? (
          <div className="field">
            <label htmlFor="ann-member">Usuário</label>
            <select id="ann-member" value={scopeMemberId} onChange={(e) => setScopeMemberId(e.target.value)}>
              {members.map((m) => <option value={m.id} key={m.id}>{m.name}</option>)}
            </select>
          </div>
        ) : null}
        <button className="primary-button" type="submit" disabled={isSending} style={{ gridColumn: "1 / -1" }}>{isSending ? "Enviando..." : "Enviar aviso"}</button>
      </form>
      {sent.length ? (
        <ul className="project-list" style={{ padding: "0 25px 20px" }}>
          {sent.map((a) => (
            <li key={a.id} className="project-row">
              <div className="project-row-title"><strong>{a.title || "Aviso"}</strong><span>{a.body}</span></div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
