"use client";

import { BarChart3, CheckCircle2, Clock3, FileQuestion } from "lucide-react";
import { useState } from "react";
import { Card, EmptyState, Tag } from "@/components/vz";
import type { Survey } from "@/lib/types";

export function ProjectSurveyResults({ surveys }: { surveys: Survey[] }) {
  const [selectedId, setSelectedId] = useState(surveys[0]?.id || "");
  const selected = surveys.find((survey) => survey.id === selectedId);
  return <div className="project-results-layout">
    <Card className="project-results-list"><div className="survey-section-head"><div><span className="vz-eyebrow">Pesquisas do cliente</span><h2 className="vz-h2">Respostas</h2><p className="vz-caption">Consulta somente leitura</p></div><FileQuestion size={20} /></div>
      {surveys.map((survey) => <button className={survey.id === selectedId ? "active" : ""} onClick={() => setSelectedId(survey.id)} key={survey.id}><strong>{survey.title}</strong><span>{survey.responses.length} resposta{survey.responses.length === 1 ? "" : "s"}</span><Tag tone={survey.status === "published" ? "green" : "slate"}>{survey.status === "published" ? "Aberta" : survey.status === "closed" ? "Encerrada" : "Rascunho"}</Tag></button>)}
      {!surveys.length ? <EmptyState icon={<FileQuestion size={24} />} title="Nenhuma pesquisa vinculada" description="Crie e publique formulários pelo módulo Pesquisas no menu lateral." /> : null}
    </Card>
    {selected ? <Card className="project-results-detail"><div className="survey-section-head"><div><span className="vz-eyebrow">Resultados consolidados</span><h2 className="vz-h2">{selected.title}</h2><p className="vz-caption">{selected.description}</p></div><BarChart3 size={20} /></div>
      <div className="project-results-summary"><span><FileQuestion size={15} /><b>{selected.questions.length}</b> perguntas</span><span><CheckCircle2 size={15} /><b>{selected.responses.length}</b> respostas</span><span><Clock3 size={15} />Atualizada em {new Date(selected.updatedAt).toLocaleDateString("pt-BR")}</span></div>
      {selected.responses.length ? <div className="survey-responses">{selected.responses.toReversed().map((response) => <details key={response.id}><summary><strong>{response.respondentName || "Resposta anônima"}</strong><span>{new Date(response.createdAt).toLocaleString("pt-BR")}</span></summary>{response.answers.map((answer) => <p key={answer.questionId}><b>{selected.questions.find((question) => question.id === answer.questionId)?.title || "Pergunta"}</b><span>{Array.isArray(answer.value) ? answer.value.join(", ") : answer.value}</span></p>)}</details>)}</div> : <EmptyState icon={<BarChart3 size={24} />} title="Ainda sem respostas" description="As respostas aparecerão aqui assim que o cliente enviar o formulário." />}
    </Card> : null}
  </div>;
}
