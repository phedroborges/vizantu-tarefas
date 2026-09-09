"use client";

import { BarChart3, CheckCircle2, Clock3, FileQuestion, MessageSquareQuote } from "lucide-react";
import { useState } from "react";
import { Card, EmptyState, Tag } from "@/components/vz";
import type { Survey, SurveyAnswer, SurveyQuestion } from "@/lib/types";

// Uma resposta de diagnóstico tem quarenta perguntas. Lida como lista crua de
// pergunta/resposta, ela não ensina nada sobre a empresa: vira transcrição de
// interrogatório. Agrupada nos mesmos blocos em que foi perguntada, vira um
// documento que dá para ler de cabo a rabo antes de uma reunião — que é o
// ponto de coletar tudo isso.
function blocosDaResposta(questions: SurveyQuestion[], answers: SurveyAnswer[]) {
  const porPergunta = new Map(answers.map((answer) => [answer.questionId, answer.value]));
  const blocos: { nome: string; itens: { question: SurveyQuestion; valor: string }[] }[] = [];
  for (const question of questions) {
    const bruto = porPergunta.get(question.id);
    // Pergunta não respondida também informa — some do dossiê, mas o contador
    // de respondidas mostra o buraco.
    if (bruto === undefined || bruto === null || bruto === "") continue;
    const valor = Array.isArray(bruto) ? bruto.join(" · ") : String(bruto);
    if (!valor.trim()) continue;
    const nome = question.section?.trim() || "Respostas";
    const atual = blocos.find((bloco) => bloco.nome === nome);
    if (atual) atual.itens.push({ question, valor });
    else blocos.push({ nome, itens: [{ question, valor }] });
  }
  return blocos;
}

export function ProjectSurveyResults({ surveys }: { surveys: Survey[] }) {
  const [selectedId, setSelectedId] = useState(surveys[0]?.id || "");
  const selected = surveys.find((survey) => survey.id === selectedId);
  const [respostaId, setRespostaId] = useState("");
  const respostas = selected ? selected.responses.toReversed() : [];
  const resposta = respostas.find((item) => item.id === respostaId) || respostas[0];
  const blocos = selected && resposta ? blocosDaResposta(selected.questions, resposta.answers) : [];
  const respondidas = resposta ? blocos.reduce((soma, bloco) => soma + bloco.itens.length, 0) : 0;

  return <div className="project-results-layout">
    <Card className="project-results-list"><div className="survey-section-head"><div><span className="vz-eyebrow">Pesquisas do cliente</span><h2 className="vz-h2">Respostas</h2><p className="vz-caption">Consulta somente leitura</p></div><FileQuestion size={20} /></div>
      {surveys.map((survey) => <button className={survey.id === selectedId ? "active" : ""} onClick={() => { setSelectedId(survey.id); setRespostaId(""); }} key={survey.id}><strong>{survey.title}</strong><span>{survey.responses.length} resposta{survey.responses.length === 1 ? "" : "s"}</span><Tag tone={survey.status === "published" ? "green" : "slate"}>{survey.status === "published" ? "Aberta" : survey.status === "closed" ? "Encerrada" : "Rascunho"}</Tag></button>)}
      {!surveys.length ? <EmptyState icon={<FileQuestion size={24} />} title="Nenhuma pesquisa vinculada" description="Crie e publique formulários pelo módulo Pesquisas no menu lateral." /> : null}
    </Card>

    {selected ? <Card className="project-results-detail">
      <div className="survey-section-head"><div><span className="vz-eyebrow">Dossiê</span><h2 className="vz-h2">{selected.title}</h2><p className="vz-caption">{selected.description}</p></div><BarChart3 size={20} /></div>
      <div className="project-results-summary">
        <span><FileQuestion size={15} /><b>{selected.questions.length}</b> perguntas</span>
        <span><CheckCircle2 size={15} /><b>{selected.responses.length}</b> respostas</span>
        <span><Clock3 size={15} />Atualizada em {new Date(selected.updatedAt).toLocaleDateString("pt-BR")}</span>
      </div>

      {resposta ? <>
        {respostas.length > 1 ? (
          <div className="dossie-seletor">{respostas.map((item) => <button className={item.id === resposta.id ? "active" : ""} type="button" key={item.id} onClick={() => setRespostaId(item.id)}>
            <strong>{item.respondentName || "Anônimo"}</strong><span>{new Date(item.createdAt).toLocaleDateString("pt-BR")}</span>
          </button>)}</div>
        ) : null}

        <div className="dossie">
          <div className="dossie__head">
            <div><strong>{resposta.respondentName || "Resposta anônima"}</strong><span>Enviado em {new Date(resposta.createdAt).toLocaleString("pt-BR")}</span></div>
            <span className="dossie__contagem">{respondidas} de {selected.questions.length} respondidas</span>
          </div>
          {blocos.map((bloco) => <section className="dossie__bloco" key={bloco.nome}>
            <h3>{bloco.nome}</h3>
            {bloco.itens.map(({ question, valor }) => <div className="dossie__item" key={question.id}>
              <h4>{question.title}</h4>
              <p>{valor}</p>
            </div>)}
          </section>)}
        </div>
      </> : <EmptyState icon={<MessageSquareQuote size={24} />} title="Ainda sem respostas" description="O dossiê aparece aqui assim que o cliente enviar o formulário." />}
    </Card> : null}
  </div>;
}
