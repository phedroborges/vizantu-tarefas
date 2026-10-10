"use client";

// Avisos da equipe: o que o grupo do TIME recebe no WhatsApp. É a mesma fila
// dos avisos de cliente, com o próprio interruptor e o próprio grupo.

import { Eye, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import { Button, Card, Field, Select } from "@/components/vz";
import { networkError, responseError } from "@/lib/request-error";
import type { TeamNoticeSettings } from "@/lib/whatsapp/messages";

type Group = { id: string; name: string };
type Preview = { type: string; title: string; body: string };

const KINDS: { key: "overdue" | "missingInfo" | "fastest"; label: string; help: string }[] = [
  { key: "overdue", label: "Demandas atrasadas", help: "Uma vez por dia: as cinco mais atrasadas, com o cliente, há quantos dias e o responsável embaixo de cada uma. Sem atraso, não sai nada." },
  { key: "missingInfo", label: "Demandas sem informação", help: "Uma vez por dia, por pessoa: o que está sem legenda, sem responsável, sem prazo, sem formato, sem canal ou parado em “Aguardando informação”. Quem é cobrado é quem planeja o cliente." },
  { key: "fastest", label: "O mais rápido da equipe", help: "Quando a liderança muda: quem passou a ter o menor tempo médio de criação por entrega nos últimos 30 dias, e quem foi ultrapassado. Só entra quem fechou pelo menos 3 entregas." },
];

export function TeamNoticesPanel({ initialTeam, configured, paused, sendHour, sendUntilHour }: { initialTeam: TeamNoticeSettings; configured: boolean; paused: boolean; sendHour: number; sendUntilHour: number }) {
  const [team, setTeam] = useState(initialTeam);
  const [saved, setSaved] = useState(initialTeam);
  const [groups, setGroups] = useState<Group[]>([]);
  const [preview, setPreview] = useState<Preview[] | null>(null);
  const [busy, setBusy] = useState<"" | "save" | "preview" | "send">("");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();
  const dirty = JSON.stringify(team) !== JSON.stringify(saved);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    fetch("/api/whatsapp/groups", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { groups: [] }))
      .then((result: { groups?: Group[] }) => { if (active) setGroups(result.groups ?? []); })
      .catch(() => {});
    return () => { active = false; };
  }, [configured]);

  // O grupo salvo aparece na lista mesmo se a busca de grupos falhar.
  const options = team.groupId && !groups.some((group) => group.id === team.groupId) ? [{ id: team.groupId, name: team.groupName || team.groupId }, ...groups] : groups;

  async function request(action: "save" | "preview" | "send", init: RequestInit, failure: string): Promise<Record<string, unknown> | undefined> {
    setBusy(action);
    setMessage(null);
    try {
      const response = await fetch("/api/whatsapp/team", init);
      if (!response.ok) { setMessage({ text: await responseError(response, failure), error: true }); return undefined; }
      return await response.json();
    } catch {
      setMessage({ text: networkError(failure), error: true });
      return undefined;
    } finally {
      setBusy("");
    }
  }

  async function save() {
    const result = await request("save", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(team) }, "salvar os avisos da equipe");
    if (!result) return;
    const next = result.team as TeamNoticeSettings;
    setTeam(next);
    setSaved(next);
    setMessage({ text: next.enabled ? "Avisos da equipe ligados." : "Configuração salva. Os avisos da equipe estão desligados." });
  }

  async function loadPreview() {
    const result = await request("preview", { cache: "no-store" }, "montar a prévia");
    if (result) setPreview(result.notices as Preview[]);
  }

  async function sendNow() {
    if (!(await confirm({ title: "Enviar os avisos agora?", message: `Os avisos de hoje entram na fila e saem no grupo “${saved.groupName || "da equipe"}”, um por vez, dentro da janela de envio (${sendHour}h às ${sendUntilHour}h, em dia útil).`, confirmLabel: "Enviar agora" }))) return;
    const result = await request("send", { method: "POST" }, "enviar os avisos da equipe");
    if (result) setMessage({ text: result.queued ? `${result.queued} ${result.queued === 1 ? "aviso entrou" : "avisos entraram"} na fila.` : "Não há nada para avisar agora." });
  }

  return <>
    <div className="team-notices">
      {!configured ? <p className="form-message">O WhatsApp ainda não está conectado no servidor. Assim que as credenciais forem configuradas, os avisos da equipe passam a sair por aqui.</p> : null}
      {paused ? <p className="form-message">Os envios estão pausados pela parada de emergência: os avisos da equipe também não saem.</p> : null}

      <Card className="team-notices__card">
        <h2>Avisos para o grupo da equipe</h2>
        <p className="broadcasts__hint">Saem uma vez por dia útil, a partir das {sendHour}h, pela mesma fila dos avisos de cliente: uma mensagem por vez, com o intervalo mínimo e a janela de envio da aba “Mensagens automáticas”.</p>

        <label className="team-notices__switch">
          <input type="checkbox" checked={team.enabled} onChange={(event) => setTeam({ ...team, enabled: event.target.checked })} />
          <span><strong>Ligar os avisos da equipe</strong><small>Desligado, nada é enviado ao grupo do time. Os avisos de cliente não mudam.</small></span>
        </label>

        <Field label="Grupo da equipe" hint="O grupo de WhatsApp em que o time conversa. O número da Vizantu precisa estar nele.">
          <Select value={team.groupId ?? ""} onChange={(event) => { const group = options.find((item) => item.id === event.target.value); setTeam({ ...team, groupId: group?.id, groupName: group?.name }); }}>
            <option value="">Escolha o grupo…</option>
            {options.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </Select>
        </Field>

        <div className="team-notices__kinds">
          {KINDS.map((kind) => (
            <label className="team-notices__switch" key={kind.key}>
              <input type="checkbox" checked={team[kind.key]} onChange={(event) => setTeam({ ...team, [kind.key]: event.target.checked })} />
              <span><strong>{kind.label}</strong><small>{kind.help}</small></span>
            </label>
          ))}
        </div>

        {message ? <p className={message.error ? "form-message" : "project-communication__ok"} role="status">{message.text}</p> : null}
        <div className="team-notices__actions">
          <Button type="button" variant="primary" onClick={save} disabled={!dirty || busy !== ""}>{busy === "save" ? "Salvando…" : "Salvar"}</Button>
          <Button type="button" onClick={loadPreview} disabled={busy !== ""}><Eye size={14} /> {busy === "preview" ? "Montando…" : "Ver o que sairia agora"}</Button>
          <Button type="button" onClick={sendNow} disabled={busy !== "" || dirty || !saved.groupId || !configured || paused}><Send size={14} /> {busy === "send" ? "Enviando…" : "Enviar agora"}</Button>
        </div>
        {dirty ? <p className="broadcasts__hint">Há mudanças não salvas. “Enviar agora” usa o que está salvo.</p> : null}
      </Card>

      {preview ? (
        <Card className="team-notices__card team-notices__preview">
          <h2>Prévia com os dados de hoje</h2>
          {preview.length ? preview.map((notice) => <article key={notice.type}><h3>{notice.title}</h3><pre>{notice.body}</pre></article>) : <p className="broadcasts__hint">Nada para avisar agora: sem atraso, sem demanda travada por informação e sem ranking com base suficiente.</p>}
          <p className="broadcasts__hint">O aviso do mais rápido aparece aqui sempre; no envio automático ele só sai quando a liderança muda.</p>
        </Card>
      ) : null}
    </div>
    {ConfirmDialog}
  </>;
}
