"use client";

// Mensagens automáticas do WhatsApp: se estão ligadas, a que horas saem e o
// que cada uma diz.
//
// O texto de cada tipo é um modelo com variáveis. A prévia ao lado usa o mesmo
// código que monta a mensagem de verdade, então o que aparece aqui é o que o
// cliente recebe.

import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Card, Field, Select, Textarea } from "@/components/vz";
import { useConfirm } from "@/components/confirm-dialog";
import { responseError } from "@/lib/request-error";
import { DEFAULT_TEMPLATES, MESSAGE_KINDS, MESSAGE_VARIABLES, messageVariables, renderTemplate, type AutomationSettings, type MessageKind, type WaitingItem } from "@/lib/whatsapp/messages";

const MAX_VARIATIONS = 5;
const HOURS = Array.from({ length: 15 }, (_, index) => index + 6);

const MONTH_PLAN = { planId: "mes", planName: "Plano de Outubro de 2026", planLink: "https://tarefas.metricz.com.br/c/…?plan=…" };
const CAMPAIGN_PLAN = { planId: "campanha", planName: "Black Friday", planLink: "https://tarefas.metricz.com.br/c/…?plan=…" };
const FEW: WaitingItem[] = [
  { name: "Como começar na viola", stage: "text", format: "Carrossel", dueDate: "2026-10-16", caption: "Quer aprender viola e não sabe por onde começar? Salva esse post e chama no direct.", reference: "https://instagram.com/p/exemplo", materialLink: "https://drive.google.com/drive/folders/exemplo", ...MONTH_PLAN },
  { name: "Porque meu carro é branco", stage: "text", format: "Reels", ...MONTH_PLAN },
  { name: "Esquenta da Black", stage: "text", format: "Carrossel", ...CAMPAIGN_PLAN },
];
const MANY: WaitingItem[] = [
  ...Array.from({ length: 10 }, (_, index): WaitingItem => ({ name: `Conteúdo ${index + 1}`, stage: "text", format: "Carrossel", ...MONTH_PLAN })),
  ...Array.from({ length: 3 }, (_, index): WaitingItem => ({ name: `Criativo ${index + 1}`, stage: "creative", format: "Reels", ...CAMPAIGN_PLAN })),
];

export function WhatsappAutomationPanel({ initialSettings, configured }: { initialSettings: AutomationSettings; configured: boolean }) {
  const [settings, setSettings] = useState(initialSettings);
  const [saved, setSaved] = useState(initialSettings);
  const [sample, setSample] = useState<"few" | "many">("few");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);

  // A prévia usa uma data fixa em relação a agora só para ter o que mostrar.
  const variables = useMemo(() => {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 3);
    return messageVariables({ items: sample === "few" ? FEW : MANY, link: "https://tarefas.metricz.com.br/c/…", clientName: "Cliente", deadlineIso: deadline.toISOString(), daysLeft: 3, deadlineDays: 7, approvedCount: 3 });
  }, [sample]);

  function setVariations(kind: MessageKind, variations: string[]) {
    setSettings({ ...settings, templates: { ...settings.templates, [kind]: variations } });
  }

  async function save() {
    if (settings.enabled && !saved.enabled) {
      const ok = await confirm({
        title: "Ligar o aviso de material para aprovar?",
        message: "Os clientes com grupo configurado e material esperando aprovação recebem o aviso dentro da janela de envio de hoje, um por cliente.",
        confirmLabel: "Ligar e salvar",
      });
      if (!ok) return;
    }
    if (settings.reminders && !saved.reminders) {
      const ok = await confirm({
        title: "Ligar as cobranças?",
        message: "A partir do primeiro aviso de cada conteúdo correm o lembrete e o prazo. Sem resposta, o cliente recebe o aviso de último dia e, no dia seguinte, o conteúdo é dado como aprovado.",
        confirmLabel: "Ligar e salvar",
      });
      if (!ok) return;
    }
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/whatsapp/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    setBusy(false);
    if (!response.ok) return setMessage({ text: await responseError(response, "salvar as mensagens automáticas"), error: true });
    const result = (await response.json()).settings as AutomationSettings;
    setSettings(result);
    setSaved(result);
    setMessage({ text: `Salvo. Aviso de material ${result.enabled ? "ligado" : "desligado"}; cobranças ${result.reminders ? "ligadas" : "desligadas"}.` });
  }

  return <>
    <div className="automation">
      {!configured ? <p className="form-message">O WhatsApp ainda não está conectado no servidor. Você pode deixar os textos prontos; nada é enviado até a conexão existir.</p> : null}

      <Card className="automation__rules">
        <label className="project-communication__toggle">
          <input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} />
          <span><strong>Aviso de material para aprovar {settings.enabled ? "ligado" : "desligado"}</strong>{settings.enabled ? "Quando a equipe coloca um conteúdo em aprovação, o grupo do cliente recebe o aviso. O que entra em sequência vira uma mensagem só, e cada cliente recebe no máximo um aviso por dia." : "A equipe avisa o cliente por conta própria. Os comunicados manuais continuam funcionando."}</span>
        </label>
        <label className="project-communication__toggle">
          <input type="checkbox" checked={settings.reminders} onChange={(event) => setSettings({ ...settings, reminders: event.target.checked })} />
          <span><strong>Cobranças {settings.reminders ? "ligadas" : "desligadas"}</strong>{settings.reminders ? "Lembrete, aviso de último dia e aprovação por prazo. Só é aprovado pelo prazo o que o cliente foi avisado e recebeu o aviso de último dia." : "Nenhum lembrete sai, nenhum prazo corre e nada é aprovado sozinho."}</span>
        </label>
        <div className="automation__grid">
          <Field label="Enviar a partir de" hint="Início da janela do dia. Não é um disparo: as mensagens saem uma por vez a partir desta hora.">
            <Select value={settings.sendHour} onChange={(event) => { const sendHour = Number(event.target.value); setSettings({ ...settings, sendHour, sendUntilHour: Math.max(settings.sendUntilHour, sendHour + 1) }); }}>{HOURS.map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}</Select>
          </Field>
          <Field label="Enviar até" hint="Depois desta hora os avisos automáticos esperam o dia seguinte.">
            <Select value={settings.sendUntilHour} onChange={(event) => setSettings({ ...settings, sendUntilHour: Number(event.target.value) })}>{Array.from({ length: 22 - settings.sendHour }, (_, index) => settings.sendHour + 1 + index).map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}</Select>
          </Field>
          <Field label="Intervalo mínimo entre mensagens" hint={`Vale para tudo que sai, com uma folga aleatória de até 60% em cima. Com 5 grupos, o último recebe cerca de ${Math.round(settings.minGapMinutes * 1.3 * 4)} minutos depois do primeiro.`}>
            <Select value={settings.minGapMinutes} onChange={(event) => setSettings({ ...settings, minGapMinutes: Number(event.target.value) })}>{[1, 2, 3, 4, 5, 8, 10, 15, 20, 30].map((minutes) => <option key={minutes} value={minutes}>{minutes} {minutes === 1 ? "minuto" : "minutos"}</option>)}</Select>
          </Field>
          <Field label="Repetir o lembrete" hint="Enquanto houver material sem resposta e o prazo não tiver chegado.">
            <Select value={settings.reminderEveryDays} onChange={(event) => setSettings({ ...settings, reminderEveryDays: Number(event.target.value) })}>{[1, 2, 3, 4, 5, 6, 7].map((days) => <option key={days} value={days}>{days === 1 ? "Todo dia" : `A cada ${days} dias`}</option>)}</Select>
          </Field>
        </div>
        <label className="project-communication__toggle">
          <input type="checkbox" checked={settings.weekdaysOnly} onChange={(event) => setSettings({ ...settings, weekdaysOnly: event.target.checked })} />
          <span><strong>Só de segunda a sexta</strong>O que cairia no fim de semana sai na segunda.</span>
        </label>
        <p className="broadcasts__hint">O prazo de aprovação é de cada cliente (aba Comunicação, dentro do cliente) e conta a partir do primeiro aviso que ele recebeu.</p>
      </Card>

      <Card className="automation__variables">
        <h2>Variáveis</h2>
        <p className="broadcasts__hint">Escreva entre chaves duplas e o sistema preenche na hora de enviar. No WhatsApp, texto entre asteriscos sai em *negrito*.</p>
        <ul>{MESSAGE_VARIABLES.map((variable) => <li key={variable.name}><code>{`{{${variable.name}}}`}</code><span>{variable.meaning}</span></li>)}</ul>
        <Field label="Prévia com">
          <Select value={sample} onChange={(event) => setSample(event.target.value === "many" ? "many" : "few")}><option value="few">2 conteúdos (lista um por um)</option><option value="many">13 conteúdos (só as quantidades)</option></Select>
        </Field>
      </Card>

      {MESSAGE_KINDS.map(({ kind, label, when }) => {
        const variations = settings.templates[kind];
        return <Card className="automation__kind" key={kind}>
          <div className="automation__kind-head">
            <div><h2>{label}</h2><p className="broadcasts__hint">{when}</p></div>
            <Button type="button" size="sm" onClick={() => setVariations(kind, DEFAULT_TEMPLATES[kind])}><RotateCcw size={13} /> Restaurar padrão</Button>
          </div>
          {variations.map((text, index) => <div className="automation__variation" key={index}>
            <Field label={variations.length > 1 ? `Variação ${index + 1}` : "Mensagem"}>
              <span className="broadcasts__variation">
                <Textarea value={text} rows={9} onChange={(event) => setVariations(kind, variations.map((item, position) => position === index ? event.target.value : item))} />
                {variations.length > 1 ? <button type="button" aria-label={`Remover variação ${index + 1} de ${label}`} onClick={() => setVariations(kind, variations.filter((_, position) => position !== index))}><Trash2 size={14} /></button> : null}
              </span>
            </Field>
            <div className="automation__preview"><span>Como chega no grupo</span><p>{renderTemplate(text, variables)}</p></div>
          </div>)}
          {variations.length < MAX_VARIATIONS ? <Button type="button" size="sm" onClick={() => setVariations(kind, [...variations, ""])}><Plus size={13} /> Adicionar variação</Button> : null}
          {variations.length > 1 ? <p className="broadcasts__hint">A cada envio o sistema sorteia uma das variações.</p> : null}
        </Card>;
      })}

      <div className="automation__save">
        {message ? <p className={message.error ? "form-message" : "project-communication__ok"} role="status">{message.text}</p> : dirty ? <p className="broadcasts__hint">Há alterações não salvas.</p> : null}
        <Button variant="primary" type="button" onClick={save} disabled={busy || !dirty}>{busy ? "Salvando…" : "Salvar mensagens automáticas"}</Button>
      </div>
    </div>
    {ConfirmDialog}
  </>;
}
