"use client";

// Onboard do cliente: o checklist padrão da Vizantu, igual para todo projeto.
//
// A lista mora em lib/onboarding/checklist.ts. Marcar salva na hora (uma
// marcação por pedido, em fila), como a equipe do projeto: um checklist com
// botão "salvar" no fim é daqueles em que se esquece de clicar.

import { ChevronRight, ClipboardCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Card, Field, Input, Progress, Select, Textarea } from "@/components/vz";
import { VzLoading } from "@/components/vz/loading";
import { responseError } from "@/lib/request-error";
import { applyPatch, FIELDS, itemApplies, noticeApplies, progressOf, SECTIONS, type OnboardingData, type OnboardingPatch } from "@/lib/onboarding/checklist";

const NOTES_MS = 700;
const shortDate = (iso: string) => (iso.length === 10 ? `${iso.slice(8)}/${iso.slice(5, 7)}` : "");

export function ProjectOnboardPanel({ projectId, projectName, canEdit }: { projectId: string; projectName: string; canEdit: boolean }) {
  const [data, setData] = useState<OnboardingData | null>(null);
  const [message, setMessage] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [onlyPending, setOnlyPending] = useState(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/onboarding`);
        if (!alive) return;
        if (!response.ok) { setMessage(await responseError(response, "carregar o onboard")); return; }
        setData((await response.json()).onboarding);
      } catch {
        if (alive) setMessage("Não foi possível carregar o onboard. Confira a conexão e recarregue.");
      }
    })();
    return () => { alive = false; };
  }, [projectId]);

  function send(patch: OnboardingPatch) {
    if (!canEdit) return;
    setData((current) => current && applyPatch(current, patch, new Date().toLocaleDateString("sv")));
    setSaveState("saving");
    queue.current = queue.current.then(async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/onboarding`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
        if (!response.ok) throw new Error(await responseError(response, "salvar o onboard"));
        setMessage("");
        setSaveState("saved");
      } catch (error) {
        setSaveState("error");
        setMessage(error instanceof Error ? error.message : "Não foi possível salvar. Tente de novo.");
      }
    });
  }

  function typeNotes(value: string) {
    setData((current) => current && { ...current, notes: value });
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => send({ notes: value }), NOTES_MS);
  }

  if (!data) return <Card>{message ? <p className="form-message" role="status">{message}</p> : <VzLoading label="Carregando o onboard…" />}</Card>;

  const progress = progressOf(data);
  const status = saveState === "saving" ? "Salvando..." : saveState === "saved" ? "Salvo" : saveState === "error" ? "Erro ao salvar" : "";

  return (
    <div className="onboard">
      <Card className="onboard-head">
        <div className="project-section-head">
          <div>
            <h2><ClipboardCheck size={14} /> Onboard</h2>
            <p>O processo padrão de {projectName}: o que precisa estar pronto para o cliente entrar no fluxo.</p>
          </div>
          <span className="task-save-status" aria-live="polite">{status}</span>
        </div>
        <div className="onboard-head__body">
          <div className="onboard-head__stats">
            <span><strong>{progress.percent}%</strong> concluído</span>
            <span><strong>{progress.done}</strong> de {progress.total} itens</span>
            <span><strong>{progress.total - progress.done}</strong> pendentes</span>
          </div>
          <Progress value={progress.percent} tone={progress.percent === 100 ? "green" : undefined} />
        </div>
        {message ? <p className="form-message" role="status">{message}</p> : null}
      </Card>

      <Card className="onboard-fields">
        {FIELDS.map((field) => {
          const value = data.fields[field.key] ?? (field.key === "site" ? "sim" : "");
          const otherKey = field.key === "erp" ? "erpOutro" : field.key === "crm" ? "crmOutro" : null;
          return (
            <Field label={field.label} hint={field.hint} key={field.key}>
              <Select disabled={!canEdit} value={value} onChange={(event) => send({ fields: { [field.key]: event.target.value } })}>
                {field.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
              </Select>
              {otherKey && value === "outro" ? (
                <Input
                  disabled={!canEdit}
                  value={data.fields[otherKey] ?? ""}
                  placeholder="Qual?"
                  maxLength={80}
                  onChange={(event) => setData((current) => current && { ...current, fields: { ...current.fields, [otherKey]: event.target.value } })}
                  onBlur={(event) => send({ fields: { [otherKey]: event.target.value } })}
                />
              ) : null}
            </Field>
          );
        })}
      </Card>

      <label className="onboard-only"><input type="checkbox" checked={onlyPending} onChange={(event) => setOnlyPending(event.target.checked)} /> Mostrar só o que falta</label>

      {SECTIONS.map((section) => {
        const { done, total } = progress.perSection[section.id];
        const isOpen = open[section.id] ?? done < total;
        const items = section.items.filter((item) => itemApplies(item, data.fields) && !(onlyPending && data.checks[item.key]));
        return (
          <Card className="onboard-section" key={section.id}>
            <button type="button" className="onboard-section__head" aria-expanded={isOpen} onClick={() => setOpen((current) => ({ ...current, [section.id]: !isOpen }))}>
              <ChevronRight size={15} className={isOpen ? "is-open" : undefined} aria-hidden />
              <h3>{section.title}</h3>
              <span className={total && done === total ? "onboard-count is-done" : "onboard-count"}>{total ? `${done}/${total}` : "—"}</span>
            </button>
            {isOpen ? (
              <div className="onboard-section__body">
                {noticeApplies(section, data.fields) && section.notice ? <p className="onboard-notice">{section.notice.text}</p> : null}
                {items.map((item) => (
                  <label className="onboard-item" key={item.key}>
                    <input type="checkbox" disabled={!canEdit} checked={Boolean(data.checks[item.key])} onChange={(event) => send({ checks: { [item.key]: event.target.checked } })} />
                    <span className="onboard-item__text"><strong>{item.title}</strong>{item.hint ? <small>{item.hint}</small> : null}</span>
                    <time className="onboard-item__date">{shortDate(data.checks[item.key] ?? "")}</time>
                  </label>
                ))}
                {!items.length && !noticeApplies(section, data.fields) ? <p className="onboard-empty">Nada pendente aqui.</p> : null}
              </div>
            ) : null}
          </Card>
        );
      })}

      <Card className="onboard-fields">
        <Field label="Observações do onboard" hint="Pendências, combinados, quem é o contato, datas de retorno.">
          <Textarea disabled={!canEdit} rows={4} value={data.notes} maxLength={4000} onChange={(event) => typeNotes(event.target.value)} />
        </Field>
      </Card>
    </div>
  );
}
