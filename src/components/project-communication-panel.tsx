"use client";

// Comunicação com o cliente: o grupo de WhatsApp dele e o prazo de aprovação.
//
// É daqui que saem os avisos automáticos — material novo para aprovar,
// lembretes e o aviso de último dia. Enquanto o serviço de WhatsApp não estiver
// conectado no servidor, a tela continua salvando a configuração: quando a
// conexão existir, os avisos passam a sair sem ninguém precisar voltar aqui.

import { MessageCircle, RefreshCw, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, Field, Input, Select } from "@/components/vz";
import { VzLoading } from "@/components/vz/loading";
import { responseError } from "@/lib/request-error";

type Communication = { whatsappGroupId?: string; whatsappGroupName?: string; notifyEnabled: boolean; approvalDeadlineDays: number };
type Group = { id: string; name: string };

export function ProjectCommunicationPanel({ projectId, projectName, canEdit }: { projectId: string; projectName: string; canEdit: boolean }) {
  const [settings, setSettings] = useState<Communication | null>(null);
  const [configured, setConfigured] = useState(false);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [busy, setBusy] = useState<"" | "groups" | "save" | "test">("");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const response = await fetch(`/api/projects/${projectId}/communication`);
      if (!alive) return;
      if (!response.ok) return setMessage({ text: await responseError(response, "carregar a comunicação do cliente"), error: true });
      const result = await response.json();
      setSettings(result.communication);
      setConfigured(Boolean(result.configured));
    })();
    return () => { alive = false; };
  }, [projectId]);

  async function loadGroups() {
    setBusy("groups");
    setMessage(null);
    const response = await fetch("/api/whatsapp/groups");
    setBusy("");
    if (!response.ok) return setMessage({ text: await responseError(response, "buscar os grupos do WhatsApp"), error: true });
    const result = await response.json();
    setGroups(result.groups);
    if (!result.groups.length) setMessage({ text: "O número conectado não participa de nenhum grupo. Adicione o número ao grupo do cliente e busque de novo.", error: true });
  }

  async function save() {
    if (!settings) return;
    setBusy("save");
    setMessage(null);
    const response = await fetch(`/api/projects/${projectId}/communication`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    setBusy("");
    if (!response.ok) return setMessage({ text: await responseError(response, "salvar a comunicação do cliente"), error: true });
    setSettings((await response.json()).communication);
    setMessage({ text: "Comunicação salva." });
  }

  async function sendTest() {
    setBusy("test");
    setMessage(null);
    const response = await fetch(`/api/projects/${projectId}/communication`, { method: "POST" });
    setBusy("");
    setMessage(response.ok ? { text: "Mensagem de teste enviada. Confira no grupo." } : { text: await responseError(response, "enviar a mensagem de teste"), error: true });
  }

  if (!settings) return <Card>{message ? <p className="form-message">{message.text}</p> : <VzLoading label="Carregando a comunicação…" />}</Card>;

  // O grupo salvo aparece na lista mesmo antes de buscar os grupos do número.
  const options = groups ?? (settings.whatsappGroupId ? [{ id: settings.whatsappGroupId, name: settings.whatsappGroupName || settings.whatsappGroupId }] : []);

  return (
    <Card className="project-communication">
      <div className="project-section-head">
        <div>
          <h2><MessageCircle size={14} /> Comunicação</h2>
          <p>O grupo de WhatsApp de {projectName} e o prazo que o cliente tem para aprovar.</p>
        </div>
      </div>

      {!configured ? <p className="form-message">O WhatsApp ainda não está conectado no servidor. Você já pode deixar o prazo configurado; a escolha do grupo e os avisos automáticos começam a funcionar quando a conexão existir.</p> : null}

      <div className="project-communication__grid">
        <Field label="Grupo do cliente no WhatsApp" hint={settings.whatsappGroupId ? undefined : "Sem grupo, nenhum aviso sai para este cliente."}>
          <span className="project-communication__group">
            <Select value={settings.whatsappGroupId || ""} disabled={!canEdit} onChange={(event) => { const group = options.find((item) => item.id === event.target.value); setSettings({ ...settings, whatsappGroupId: group?.id, whatsappGroupName: group?.name }); }}>
              <option value="">Nenhum grupo</option>
              {options.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </Select>
            <Button type="button" onClick={loadGroups} disabled={!canEdit || !configured || busy !== ""}><RefreshCw size={13} /> {busy === "groups" ? "Buscando…" : "Buscar grupos"}</Button>
          </span>
        </Field>

        <Field label="Prazo de aprovação (dias)" hint="No último dia o cliente é avisado; sem resposta, o material é dado como aprovado.">
          <Input type="number" min={1} max={60} value={settings.approvalDeadlineDays} disabled={!canEdit} onChange={(event) => setSettings({ ...settings, approvalDeadlineDays: Number(event.target.value) })} />
        </Field>
      </div>

      <label className="project-communication__toggle">
        <input type="checkbox" checked={settings.notifyEnabled} disabled={!canEdit} onChange={(event) => setSettings({ ...settings, notifyEnabled: event.target.checked })} />
        <span><strong>Avisar este cliente automaticamente</strong>Material novo para aprovar, lembrete a cada dois dias e aviso de último dia, sempre com o link do portal.</span>
      </label>

      {message ? <p className={message.error ? "form-message" : "project-communication__ok"} role="status">{message.text}</p> : null}

      {canEdit ? <div className="project-communication__actions">
        <Button variant="primary" type="button" onClick={save} disabled={busy !== ""}>{busy === "save" ? "Salvando…" : "Salvar"}</Button>
        <Button type="button" onClick={sendTest} disabled={!configured || !settings.whatsappGroupId || busy !== ""}><Send size={13} /> {busy === "test" ? "Enviando…" : "Enviar mensagem de teste"}</Button>
      </div> : null}
    </Card>
  );
}
