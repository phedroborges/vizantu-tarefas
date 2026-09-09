"use client";

import { ArrowDown, ArrowUp, BarChart3, Check, ClipboardCopy, ExternalLink, FileQuestion, GripVertical, Plus, Send, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Card, EmptyState, Field, Input, Tag, Textarea } from "@/components/vz";
import { SURVEY_TEMPLATES, type SurveyTemplate } from "@/lib/survey-templates";
import type { Project, Survey, SurveyQuestion, SurveyQuestionType } from "@/lib/types";

const TYPES: { value: SurveyQuestionType; label: string }[] = [
  { value: "short_text", label: "Texto curto" }, { value: "long_text", label: "Texto longo" },
  { value: "single_choice", label: "Escolha única" }, { value: "multiple_choice", label: "Múltipla escolha" },
  { value: "scale", label: "Escala de 1 a 5" }, { value: "nps", label: "NPS de 0 a 10" },
];
const needsOptions = (type: SurveyQuestionType) => type === "single_choice" || type === "multiple_choice";

export function SurveyManager({ initialSurveys, projects, lockedProjectId }: { initialSurveys: Survey[]; projects: Project[]; lockedProjectId?: string }) {
  const visibleProjects = lockedProjectId ? projects.filter((project) => project.id === lockedProjectId) : projects;
  const [surveys, setSurveys] = useState(initialSurveys);
  const [selectedId, setSelectedId] = useState(initialSurveys[0]?.id || "");
  const selected = surveys.find((survey) => survey.id === selectedId);
  const [creating, setCreating] = useState(false);
  const [projectId, setProjectId] = useState(lockedProjectId || visibleProjects[0]?.id || "");
  const [newTitle, setNewTitle] = useState("");
  const [template, setTemplate] = useState<SurveyTemplate>("business_extraction");
  const [draft, setDraft] = useState<Survey | null>(selected || null);
  const [message, setMessage] = useState("");
  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);

  function select(survey: Survey) { setSelectedId(survey.id); setDraft(survey); setCreating(false); setMessage(""); }
  function notify(text: string) { setMessage(text); window.setTimeout(() => setMessage(""), 2600); }

  async function create() {
    if (!projectId || !newTitle.trim()) return notify("Informe o cliente e o nome da pesquisa.");
    const response = await fetch("/api/surveys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, title: newTitle, template }) });
    const result = await response.json();
    if (!response.ok) return notify(result.error || "Não foi possível criar.");
    setSurveys((current) => [result.survey, ...current]); select(result.survey); setNewTitle("");
  }

  async function save(next = draft) {
    if (!next) return;
    const response = await fetch(`/api/surveys/${next.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: next.title, description: next.description, status: next.status, questions: next.questions }) });
    const result = await response.json();
    if (!response.ok) return notify(result.error || "Não foi possível salvar.");
    setSurveys((current) => current.map((item) => item.id === result.survey.id ? result.survey : item)); setDraft(result.survey); notify("Pesquisa salva.");
  }

  async function remove() {
    if (!draft || !confirm(`Excluir “${draft.title}”? As respostas também serão apagadas.`)) return;
    const response = await fetch(`/api/surveys/${draft.id}`, { method: "DELETE" });
    if (!response.ok) return notify("Não foi possível excluir.");
    const remaining = surveys.filter((item) => item.id !== draft.id); setSurveys(remaining); setSelectedId(remaining[0]?.id || ""); setDraft(remaining[0] || null);
  }

  function updateQuestion(id: string, patch: Partial<SurveyQuestion>) {
    if (!draft) return;
    setDraft({ ...draft, questions: draft.questions.map((question) => question.id === id ? { ...question, ...patch } : question) });
  }
  function addQuestion() {
    if (!draft) return;
    setDraft({ ...draft, questions: [...draft.questions, { id: crypto.randomUUID(), title: "Nova pergunta", type: "short_text", required: true }] });
  }
  function moveQuestion(index: number, direction: -1 | 1) {
    if (!draft) return; const target = index + direction; if (target < 0 || target >= draft.questions.length) return;
    const questions = [...draft.questions]; [questions[index], questions[target]] = [questions[target], questions[index]]; setDraft({ ...draft, questions });
  }
  async function copyLink() {
    if (!draft) return; await navigator.clipboard.writeText(`${window.location.origin}/p/${draft.token}`); notify("Link copiado.");
  }

  return <div className="survey-layout">
    <Card className="survey-list">
      <div className="survey-section-head"><div><span className="vz-eyebrow">Formulários</span><h2 className="vz-h2">Pesquisas</h2><p className="vz-caption">{surveys.length} formulário{surveys.length === 1 ? "" : "s"}</p></div><Button variant="secondary" onClick={() => { setCreating(true); setTemplate("business_extraction"); setNewTitle("Extrator de negócio"); }}><Plus size={14} /> Nova</Button></div>
      {creating ? <div className="survey-create">
        {!lockedProjectId ? <Field label="Projeto"><select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{visibleProjects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></Field> : null}
        <Field label="Modelo" hint={SURVEY_TEMPLATES.find((item) => item.value === template)?.hint}>
          <select value={template} onChange={(event) => { const value = event.target.value as SurveyTemplate; setTemplate(value); const modelo = SURVEY_TEMPLATES.find((item) => item.value === value); if (modelo && (!newTitle || SURVEY_TEMPLATES.some((item) => item.defaultTitle === newTitle))) setNewTitle(modelo.defaultTitle); }}>
            {SURVEY_TEMPLATES.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
          </select>
        </Field>
        <Field label="Nome"><Input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Ex.: Diagnóstico de marca" /></Field>
        <div><Button onClick={create}>Criar pesquisa</Button><Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button></div>
      </div> : null}
      <div className="survey-list__items">{surveys.map((survey) => <button className={survey.id === selectedId ? "active" : ""} key={survey.id} onClick={() => select(survey)}>
        <span><FileQuestion size={16} /><strong>{survey.title}</strong></span><small>{projectById.get(survey.projectId)} · {survey.questions.length} perguntas · {survey.responses.length} respostas</small>
        <Tag tone={survey.status === "published" ? "green" : survey.status === "closed" ? "slate" : "amber"}>{survey.status === "published" ? "Publicada" : survey.status === "closed" ? "Encerrada" : "Rascunho"}</Tag>
      </button>)}</div>
      {!surveys.length && !creating ? <EmptyState icon={<FileQuestion size={24} />} title="Nenhuma pesquisa" description="Crie o primeiro formulário deste cliente." /> : null}
    </Card>

    {draft ? <div className="survey-workspace">
      <Card className="survey-builder">
        <div className="survey-builder__head"><div><span className="vz-eyebrow">{projectById.get(draft.projectId)}</span><Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></div><div>
          {draft.status === "published" ? <><Button variant="secondary" onClick={copyLink}><ClipboardCopy size={14} /> Copiar link</Button><a className="vz-button vz-button--secondary" href={`/p/${draft.token}`} target="_blank"><ExternalLink size={14} /> Abrir</a></> : null}
          <Button onClick={() => save({ ...draft, status: draft.status === "published" ? "closed" : "published" })}><Send size={14} />{draft.status === "published" ? "Encerrar" : "Publicar"}</Button>
        </div></div>
        <Textarea rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Explique ao cliente o objetivo deste formulário." />
        <div className="survey-builder__toolbar"><div><strong>Perguntas</strong><span>O bloco agrupa a pergunta numa etapa do formulário. Perguntas do mesmo bloco aparecem juntas.</span></div><Button variant="secondary" onClick={addQuestion}><Plus size={14} /> Adicionar pergunta</Button></div>
        <datalist id="survey-secoes">{[...new Set(draft.questions.map((item) => item.section).filter(Boolean))].map((nome) => <option value={nome} key={nome} />)}</datalist>
        <div className="survey-questions">{draft.questions.map((question, index) => <div className="survey-question" key={question.id}>
          <div className="survey-question__order"><GripVertical size={16} /><b>{String(index + 1).padStart(2, "0")}</b><button onClick={() => moveQuestion(index, -1)} aria-label="Mover para cima"><ArrowUp size={13} /></button><button onClick={() => moveQuestion(index, 1)} aria-label="Mover para baixo"><ArrowDown size={13} /></button></div>
          <div className="survey-question__body"><Input value={question.title} onChange={(event) => updateQuestion(question.id, { title: event.target.value })} />
            <div className="survey-question__settings"><select value={question.type} onChange={(event) => updateQuestion(question.id, { type: event.target.value as SurveyQuestionType, options: needsOptions(event.target.value as SurveyQuestionType) ? question.options || ["Opção 1", "Opção 2"] : undefined })}>{TYPES.map((type) => <option value={type.value} key={type.value}>{type.label}</option>)}</select><Input value={question.section || ""} onChange={(event) => updateQuestion(question.id, { section: event.target.value })} placeholder="Bloco (ex.: Quem compra)" list="survey-secoes" /><label><input type="checkbox" checked={question.required} onChange={(event) => updateQuestion(question.id, { required: event.target.checked })} /> Obrigatória</label></div>
            {needsOptions(question.type) ? <Textarea rows={3} value={(question.options || []).join("\n")} onChange={(event) => updateQuestion(question.id, { options: event.target.value.split("\n").filter(Boolean) })} placeholder="Uma opção por linha" /> : null}
          </div><button className="survey-question__delete" onClick={() => setDraft({ ...draft, questions: draft.questions.filter((item) => item.id !== question.id) })} aria-label="Excluir pergunta"><Trash2 size={15} /></button>
        </div>)}</div>
        {!draft.questions.length ? <EmptyState icon={<FileQuestion size={24} />} title="Comece pelas perguntas" description="Adicione textos, escolhas, escalas ou uma pergunta NPS." /> : null}
        <div className="survey-builder__actions"><Button variant="danger" onClick={remove}><Trash2 size={14} /> Excluir</Button><Button onClick={() => save()}><Check size={14} /> Salvar alterações</Button></div>
      </Card>
      <Card className="survey-results"><div className="survey-section-head"><div><span className="vz-eyebrow">Resultados</span><h2 className="vz-h2">{draft.responses.length} resposta{draft.responses.length === 1 ? "" : "s"}</h2></div><BarChart3 size={20} /></div>
        {draft.responses.length ? <div className="survey-responses">{draft.responses.toReversed().map((response) => <details key={response.id}><summary><strong>{response.respondentName || "Resposta anônima"}</strong><span>{new Date(response.createdAt).toLocaleString("pt-BR")}</span></summary>{response.answers.map((answer) => <p key={answer.questionId}><b>{draft.questions.find((q) => q.id === answer.questionId)?.title}</b><span>{Array.isArray(answer.value) ? answer.value.join(", ") : answer.value}</span></p>)}</details>)}</div> : <EmptyState icon={<BarChart3 size={24} />} title="Ainda sem respostas" description="Publique e compartilhe o link para começar a receber dados." />}
      </Card>
    </div> : null}
    {message ? <div className="survey-toast">{message}</div> : null}
  </div>;
}
