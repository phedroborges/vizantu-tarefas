"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Button, Field, Input, Textarea } from "@/components/vz";
import { Logo } from "@/components/vz/logo";
import type { Survey, SurveyAnswer } from "@/lib/types";

export function PublicSurvey({ survey, projectName }: { survey: Survey; projectName: string }) {
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<string, string | string[] | number>>({});
  const [error, setError] = useState(""); const [sending, setSending] = useState(false); const [done, setDone] = useState(false);
  function setValue(id: string, value: string | string[] | number) { setValues((current) => ({ ...current, [id]: value })); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSending(true); setError("");
    const answers: SurveyAnswer[] = survey.questions.filter((question) => values[question.id] !== undefined).map((question) => ({ questionId: question.id, value: values[question.id] }));
    const response = await fetch(`/api/p/${survey.token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ respondentName: name, answers }) });
    const result = await response.json(); setSending(false); if (!response.ok) return setError(result.error || "Não foi possível enviar."); setDone(true);
  }
  if (done) return <main className="public-survey"><section className="public-survey__done"><CheckCircle2 size={42} /><h1>Resposta enviada</h1><p>Obrigado. Suas respostas já estão com a equipe.</p></section></main>;
  return <main className="public-survey"><form onSubmit={submit} className="public-survey__card"><header><Logo height={26} /><span className="vz-eyebrow">{projectName}</span><h1>{survey.title}</h1><p>{survey.description || "Responda às perguntas abaixo. Leva só alguns minutos."}</p></header>
    <Field label="Seu nome" hint="Opcional"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
    {survey.questions.map((question, index) => <fieldset key={question.id} className="public-survey__question"><legend><b>{index + 1}. {question.title}</b>{question.required ? <span>Obrigatória</span> : null}</legend>{question.description ? <p>{question.description}</p> : null}
      {question.type === "short_text" ? <Input required={question.required} value={String(values[question.id] || "")} onChange={(event) => setValue(question.id, event.target.value)} /> : null}
      {question.type === "long_text" ? <Textarea required={question.required} rows={5} value={String(values[question.id] || "")} onChange={(event) => setValue(question.id, event.target.value)} /> : null}
      {question.type === "single_choice" ? <div className="public-survey__choices">{question.options?.map((option) => <label key={option}><input required={question.required} type="radio" name={question.id} checked={values[question.id] === option} onChange={() => setValue(question.id, option)} />{option}</label>)}</div> : null}
      {question.type === "multiple_choice" ? <div className="public-survey__choices">{question.options?.map((option) => { const current = Array.isArray(values[question.id]) ? values[question.id] as string[] : []; return <label key={option}><input type="checkbox" checked={current.includes(option)} onChange={(event) => setValue(question.id, event.target.checked ? [...current, option] : current.filter((item) => item !== option))} />{option}</label>; })}</div> : null}
      {question.type === "scale" || question.type === "nps" ? <div className="public-survey__scale">{Array.from({ length: question.type === "nps" ? 11 : 5 }, (_, i) => i + (question.type === "nps" ? 0 : 1)).map((number) => <button className={values[question.id] === number ? "active" : ""} type="button" key={number} onClick={() => setValue(question.id, number)}>{number}</button>)}</div> : null}
    </fieldset>)}
    {error ? <p className="form-message">{error}</p> : null}<Button type="submit" disabled={sending}>{sending ? "Enviando..." : "Enviar respostas"}</Button>
  </form></main>;
}
