"use client";

// Os dados que aparecem no topo do cliente, editáveis na própria página dele.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AvatarPicker } from "@/components/avatar-picker";
import { Button, Card, Field, Input, Select } from "@/components/vz";
import { networkError, responseError } from "@/lib/request-error";
import { PROJECT_STATUSES, type Project, type ProjectStatus } from "@/lib/types";

export function ProjectIdentityForm({ project }: { project: Project }) {
  const router = useRouter();
  const [draft, setDraft] = useState({
    name: project.name, client: project.client || "", clientRole: project.clientRole || "", clientCity: project.clientCity || "",
    clientInstagram: project.clientInstagram || "", avatarUrl: project.avatarUrl ?? null, avatarColor: project.avatarColor ?? null, status: project.status,
  });
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; erro?: boolean } | null>(null);

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) return setMensagem({ texto: "Informe o nome do projeto.", erro: true });
    setSalvando(true);
    setMensagem(null);
    try {
      const response = await fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      if (!response.ok) return setMensagem({ texto: await responseError(response, "salvar os dados do projeto"), erro: true });
      setMensagem({ texto: "Dados salvos." });
      router.refresh();
    } catch {
      setMensagem({ texto: networkError("salvar os dados do projeto"), erro: true });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card className="guia-bloco">
      <header className="guia-bloco__head">
        <div>
          <h3>Dados do projeto</h3>
          <p className="vz-caption">O que aparece no topo da página do cliente.</p>
        </div>
      </header>
      <form className="project-form" onSubmit={salvar}>
        <Field label="Logo ou cor do projeto"><AvatarPicker name={draft.name || "Projeto"} imageUrl={draft.avatarUrl} color={draft.avatarColor} withColor onChange={(next) => setDraft((atual) => ({ ...atual, ...next }))} /></Field>
        <div className="project-form__grid">
          <Field label="Nome do projeto"><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required /></Field>
          <Field label="Cliente"><Input value={draft.client} onChange={(e) => setDraft({ ...draft, client: e.target.value })} /></Field>
          <Field label="Cargo / área"><Input value={draft.clientRole} onChange={(e) => setDraft({ ...draft, clientRole: e.target.value })} /></Field>
          <Field label="Cidade"><Input value={draft.clientCity} onChange={(e) => setDraft({ ...draft, clientCity: e.target.value })} /></Field>
          <Field label="Instagram"><Input value={draft.clientInstagram} onChange={(e) => setDraft({ ...draft, clientInstagram: e.target.value })} placeholder="@perfil" /></Field>
          <Field label="Status"><Select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as ProjectStatus })}>{PROJECT_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></Field>
        </div>
        {mensagem ? <p className={mensagem.erro ? "form-message" : "project-communication__ok"} role="status">{mensagem.texto}</p> : null}
        <div><Button type="submit" variant="primary" disabled={salvando}>{salvando ? "Salvando…" : "Salvar dados do projeto"}</Button></div>
      </form>
    </Card>
  );
}
