"use client";

// Comunicados: uma mensagem escrita uma vez e enviada ao grupo de vários
// clientes.
//
// O envio é espaçado e o texto pode ter variações em rodízio. Não é enfeite:
// a mesma mensagem, idêntica, disparada em sequência para vários grupos é o
// comportamento que faz o WhatsApp bloquear um número.

import { Megaphone, OctagonX, Play, Plus, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/vz";
import { useConfirm } from "@/components/confirm-dialog";
import { formatDateTime } from "@/lib/dates";
import { responseError } from "@/lib/request-error";
import { CommunicationOverviewPanel } from "@/components/communication-overview";
import { WhatsappAutomationPanel } from "@/components/whatsapp-automation-panel";
import type { AutomationSettings } from "@/lib/whatsapp/messages";
import type { CommunicationOverview } from "@/lib/whatsapp/overview";
import type { Broadcast } from "@/lib/whatsapp/service";

export type BroadcastClient = { id: string; name: string; groupName?: string };

const STATUS: Record<Broadcast["status"], string> = { sending: "Enviando", done: "Concluído", cancelled: "Cancelado" };
const MAX_VARIATIONS = 5;

function duration(seconds: number): string {
  if (seconds < 90) return `${Math.round(seconds)} segundos`;
  const minutes = Math.round(seconds / 60);
  return minutes < 90 ? `${minutes} minutos` : `${(minutes / 60).toFixed(1).replace(".", ",")} horas`;
}

export function BroadcastsView({ clients, configured, initialBroadcasts, initialAutomation, initialPending, overview }: { clients: BroadcastClient[]; configured: boolean; initialBroadcasts: Broadcast[]; initialAutomation: AutomationSettings; initialPending: number; overview: CommunicationOverview }) {
  const [paused, setPaused] = useState(initialAutomation.paused);
  const [pending, setPending] = useState(initialPending);
  const [stopping, setStopping] = useState(false);
  const [tab, setTab] = useState<"geral" | "automaticas" | "comunicados">("geral");
  const reachable = useMemo(() => clients.filter((client) => client.groupName), [clients]);
  const [broadcasts, setBroadcasts] = useState(initialBroadcasts);
  const [title, setTitle] = useState("");
  const [variations, setVariations] = useState([""]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [selected, setSelected] = useState<string[]>([]);
  const [interval, setIntervalSeconds] = useState(90);
  const [busy, setBusy] = useState<"" | "send" | "upload">("");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { confirm, ConfirmDialog } = useConfirm();
  const nameById = useMemo(() => new Map(clients.map((client) => [client.id, client.name])), [clients]);

  const texts = variations.map((text) => text.trim()).filter(Boolean);
  const canSend = configured && !paused && selected.length > 0 && (texts.length > 0 || mediaUrl.trim()) && busy === "";

  // Parada de emergência: vale na hora, sem depender de salvar mais nada.
  async function togglePause() {
    if (paused) {
      const ok = await confirm({ title: "Retomar os envios?", message: pending ? `Há ${pending} ${pending === 1 ? "mensagem" : "mensagens"} na fila. Elas voltam a sair uma por vez, respeitando o intervalo e a janela de envio.` : "Os avisos automáticos e os comunicados voltam a funcionar.", confirmLabel: "Retomar envios" });
      if (!ok) return;
    }
    setStopping(true);
    const response = await fetch("/api/whatsapp/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paused: !paused }) });
    setStopping(false);
    if (!response.ok) return setMessage({ text: await responseError(response, "alterar a parada de emergência"), error: true });
    const result = await response.json();
    setPaused(result.settings.paused);
    setPending(result.pending);
  }

  async function reload() {
    const response = await fetch("/api/whatsapp/broadcasts");
    if (response.ok) setBroadcasts((await response.json()).broadcasts);
  }

  async function upload(file: File) {
    setBusy("upload");
    setMessage(null);
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/uploads", { method: "POST", body: form });
    setBusy("");
    if (!response.ok) return setMessage({ text: await responseError(response, "enviar a imagem"), error: true });
    setMediaUrl((await response.json()).url);
    setMediaType("image");
  }

  async function send() {
    const ok = await confirm({
      title: `Enviar para ${selected.length} ${selected.length === 1 ? "grupo" : "grupos"}?`,
      message: `A mensagem sai no grupo de cada cliente, com cerca de ${duration(interval)} entre um envio e outro. O que já foi enviado não pode ser desfeito.`,
      confirmLabel: "Enviar comunicado",
    });
    if (!ok) return;
    setBusy("send");
    setMessage(null);
    const response = await fetch("/api/whatsapp/broadcasts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, variations: texts, mediaUrl: mediaUrl.trim(), mediaType, projectIds: selected, intervalSeconds: interval }),
    });
    setBusy("");
    if (!response.ok) return setMessage({ text: await responseError(response, "enviar o comunicado"), error: true });
    const result = await response.json();
    setMessage({ text: `Comunicado na fila para ${result.queued} ${result.queued === 1 ? "grupo" : "grupos"}.` });
    setTitle(""); setVariations([""]); setMediaUrl(""); setSelected([]);
    await reload();
  }

  async function cancel(broadcast: Broadcast) {
    const response = await fetch(`/api/whatsapp/broadcasts/${broadcast.id}`, { method: "DELETE" });
    if (!response.ok) return setMessage({ text: await responseError(response, "cancelar o comunicado"), error: true });
    await reload();
  }

  return <>
    <main className="admin-page dashboard broadcasts">
      <div className="dashboard-head"><div><span className="eyebrow">Clientes</span><h1>Comunicação</h1><p>O que os clientes recebem no grupo de WhatsApp: os avisos automáticos de aprovação e os comunicados enviados por vocês.</p></div></div>

      <div className={`broadcasts__stop${paused ? " is-paused" : ""}`} role="status">
        <div>
          <strong>{paused ? "Envios pausados" : "Envios ativos"}</strong>
          <span>{paused ? `Nada sai pelo WhatsApp: nem aviso automático, nem comunicado, nem mensagem de teste.${pending ? ` ${pending} ${pending === 1 ? "mensagem espera" : "mensagens esperam"} na fila.` : ""}` : `Em caso de urgência, pause todos os envios do WhatsApp de uma vez.${pending ? ` ${pending} ${pending === 1 ? "mensagem" : "mensagens"} na fila agora.` : ""}`}</span>
        </div>
        <Button type="button" variant={paused ? "primary" : "danger"} onClick={togglePause} disabled={stopping}>{paused ? <><Play size={14} /> Retomar envios</> : <><OctagonX size={14} /> Pausar tudo agora</>}</Button>
      </div>

      <div className="broadcasts__tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "geral"} className={tab === "geral" ? "active" : ""} onClick={() => setTab("geral")}>Visão geral</button>
        <button type="button" role="tab" aria-selected={tab === "automaticas"} className={tab === "automaticas" ? "active" : ""} onClick={() => setTab("automaticas")}>Mensagens automáticas</button>
        <button type="button" role="tab" aria-selected={tab === "comunicados"} className={tab === "comunicados" ? "active" : ""} onClick={() => setTab("comunicados")}>Comunicados</button>
      </div>

      {tab === "geral" ? <CommunicationOverviewPanel overview={overview} automationEnabled={initialAutomation.enabled} paused={paused} /> : null}
      {tab === "automaticas" ? <WhatsappAutomationPanel initialSettings={initialAutomation} configured={configured} /> : null}
      {tab === "comunicados" ? <>

      {!configured ? <p className="form-message">O WhatsApp ainda não está conectado no servidor. Assim que as credenciais forem configuradas, os comunicados passam a ser enviados por aqui.</p> : null}

      <div className="broadcasts__layout">
        <Card className="broadcasts__form">
          <h2><Megaphone size={15} /> Novo comunicado</h2>
          <Field label="Título (só para vocês)"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Recesso de fim de ano" /></Field>

          {variations.map((text, index) => (
            <Field key={index} label={variations.length > 1 ? `Mensagem · variação ${index + 1}` : "Mensagem"}>
              <span className="broadcasts__variation">
                <Textarea value={text} rows={4} onChange={(event) => setVariations(variations.map((item, position) => position === index ? event.target.value : item))} placeholder="O que os clientes vão ler no grupo." />
                {variations.length > 1 ? <button type="button" aria-label={`Remover variação ${index + 1}`} onClick={() => setVariations(variations.filter((_, position) => position !== index))}><Trash2 size={14} /></button> : null}
              </span>
            </Field>
          ))}
          {variations.length < MAX_VARIATIONS ? <Button type="button" size="sm" onClick={() => setVariations([...variations, ""])}><Plus size={13} /> Adicionar variação do texto</Button> : null}
          <p className="broadcasts__hint">Com mais de uma variação, cada grupo recebe uma delas em rodízio. Dizer a mesma coisa com palavras diferentes reduz o risco de o número ser bloqueado.</p>

          <Field label="Imagem ou vídeo (opcional)" hint="Envie uma imagem ou cole o link direto de um arquivo público. Link de pasta do Drive não funciona como mídia.">
            <span className="broadcasts__media">
              <Input value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder="https://…" />
              <Select value={mediaType} onChange={(event) => setMediaType(event.target.value === "video" ? "video" : "image")} aria-label="Tipo de mídia"><option value="image">Imagem</option><option value="video">Vídeo</option></Select>
              <Button type="button" onClick={() => fileRef.current?.click()} disabled={busy !== ""}><Upload size={13} /> {busy === "upload" ? "Enviando…" : "Enviar imagem"}</Button>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} />
            </span>
          </Field>

          <Field label="Intervalo entre os envios (segundos)" hint={selected.length > 1 ? `Com ${selected.length} grupos, o último recebe em cerca de ${duration(Math.max(interval * 1.15, initialAutomation.minGapMinutes * 60 * 1.3) * (selected.length - 1))}. Vale o maior entre este intervalo e o mínimo geral (${initialAutomation.minGapMinutes} min).` : `O tempo entre um grupo e o próximo, com uma folga aleatória. Nunca menor que o intervalo mínimo geral (${initialAutomation.minGapMinutes} min).`}>
            <Input type="number" min={20} max={3600} value={interval} onChange={(event) => setIntervalSeconds(Math.min(3600, Math.max(20, Number(event.target.value) || 20)))} />
          </Field>

          {message ? <p className={message.error ? "form-message" : "project-communication__ok"} role="status">{message.text}</p> : null}
          <Button variant="primary" type="button" onClick={send} disabled={!canSend}>{busy === "send" ? "Colocando na fila…" : `Enviar para ${selected.length} ${selected.length === 1 ? "grupo" : "grupos"}`}</Button>
        </Card>

        <Card className="broadcasts__clients">
          <div className="broadcasts__clients-head">
            <h2>Clientes</h2>
            <button type="button" onClick={() => setSelected(selected.length === reachable.length ? [] : reachable.map((client) => client.id))} disabled={!reachable.length}>{selected.length === reachable.length && reachable.length ? "Desmarcar todos" : "Marcar todos"}</button>
          </div>
          <ul>
            {clients.map((client) => (
              <li key={client.id} className={client.groupName ? "" : "is-off"}>
                <label>
                  <input type="checkbox" disabled={!client.groupName} checked={selected.includes(client.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, client.id] : selected.filter((id) => id !== client.id))} />
                  <span><strong>{client.name}</strong><small>{client.groupName || "Sem grupo configurado"}</small></span>
                </label>
              </li>
            ))}
          </ul>
          {clients.length > reachable.length ? <p className="broadcasts__hint">O grupo de cada cliente é escolhido na aba Comunicação, dentro do cliente.</p> : null}
        </Card>
      </div>

      <Card className="broadcasts__history">
        <h2>Enviados</h2>
        {broadcasts.length ? <ul>{broadcasts.map((broadcast) => {
          const sent = broadcast.deliveries.filter((delivery) => delivery.status === "sent").length;
          const failed = broadcast.deliveries.filter((delivery) => delivery.status === "failed");
          return <li key={broadcast.id}>
            <div><strong>{broadcast.title}</strong><small>{formatDateTime(broadcast.createdAt)} · {sent} de {broadcast.deliveries.length} enviados{failed.length ? ` · ${failed.length} com falha (${failed.map((delivery) => nameById.get(delivery.projectId) || "cliente removido").join(", ")})` : ""}</small></div>
            <span className={`broadcasts__status is-${broadcast.status}`}>{STATUS[broadcast.status]}</span>
            {broadcast.status === "sending" ? <Button type="button" size="sm" onClick={() => cancel(broadcast)}>Cancelar o restante</Button> : null}
          </li>;
        })}</ul> : <p className="broadcasts__hint">Nenhum comunicado enviado ainda.</p>}
      </Card>
      </> : null}
    </main>
    {ConfirmDialog}
  </>;
}
