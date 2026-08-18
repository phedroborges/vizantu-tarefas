"use client";

import { Megaphone } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ANNOUNCEMENT_SCOPES, USER_ROLES } from "@/lib/types";
import type { AnnouncementScope, Member, UserRole } from "@/lib/types";

// Enviar um aviso não pertence a nenhuma página — é uma ação do time, de
// qualquer lugar. Por isso vive como botão no canto superior direito do
// AdminShell, e não enfiado no fim de alguma tela.
export function AnnouncementComposer({ currentUserRole }: { currentUserRole: UserRole }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scope, setScope] = useState<AnnouncementScope>(currentUserRole === "dono" ? "all" : "role");
  const [scopeRole, setScopeRole] = useState<UserRole>("editor");
  const [scopeMemberId, setScopeMemberId] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  // Só busca a lista de gente quando o modal abre — a maioria das sessões
  // nunca envia aviso nenhum.
  useEffect(() => {
    if (!open || members.length) return;
    fetch("/api/members")
      .then((r) => r.json())
      .then((data) => {
        const active = (data.members || []).filter((m: Member) => m.active);
        setMembers(active);
        setScopeMemberId((current) => current || active[0]?.id || "");
      })
      .catch(() => {});
  }, [open, members.length]);

  const scopeOptions = ANNOUNCEMENT_SCOPES.filter((s) => s.value !== "all" || currentUserRole === "dono");

  function reset() {
    setTitle("");
    setBody("");
    setError("");
    setSent(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) return setError("Escreva o texto do aviso.");
    setError("");
    setIsSending(true);
    const response = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        body,
        scope,
        scopeRole: scope === "role" ? scopeRole : undefined,
        scopeMemberId: scope === "member" ? scopeMemberId : undefined,
      }),
    });
    const result = await response.json();
    setIsSending(false);
    if (!response.ok) return setError(result.error || "Não foi possível enviar o aviso.");
    setSent(true);
    window.setTimeout(() => {
      setOpen(false);
      reset();
    }, 1200);
  }

  return (
    <>
      <button
        type="button"
        className="announcement-trigger"
        onClick={() => setOpen(true)}
        title="Enviar um aviso pro time"
        aria-label="Enviar um aviso pro time"
      >
        <Megaphone size={16} />
      </button>

      {open ? (
        <Dialog open onOpenChange={(isOpen) => { if (!isOpen) { setOpen(false); reset(); } }}>
          <DialogContent className="!max-w-[460px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Megaphone size={16} /> Enviar aviso</DialogTitle>
            </DialogHeader>
            <p style={{ fontSize: 11.5, color: "var(--muted-text)", margin: "2px 0 14px", lineHeight: 1.5 }}>
              Aparece bloqueando a tela de quem você escolher, até a pessoa clicar em &quot;Ok, entendi&quot;.
            </p>

            {sent ? (
              <p style={{ color: "var(--approved)", fontWeight: 650, fontSize: 13, padding: "10px 0 4px" }}>Aviso enviado.</p>
            ) : (
              <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {error ? <div className="form-message">{error}</div> : null}
                <div className="field">
                  <label htmlFor="ann-title">Título (opcional)</label>
                  <input id="ann-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
                </div>
                <div className="field">
                  <label htmlFor="ann-body">Mensagem</label>
                  <textarea id="ann-body" className="task-desc-textarea" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} required autoFocus />
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
                <button className="primary-button" type="submit" disabled={isSending || !body.trim()}>
                  {isSending ? "Enviando..." : "Enviar aviso"}
                </button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
