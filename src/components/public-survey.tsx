"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, Field, Input, Textarea } from "@/components/vz";
import { Logo } from "@/components/vz/logo";
import type { Survey, SurveyAnswer, SurveyQuestion } from "@/lib/types";

type Valor = string | string[] | number;

// Um formulário longo numa página só não é respondido — é abandonado, ou pior,
// respondido com uma linha por pergunta só para acabar logo. Como o objetivo
// aqui é conhecer a empresa SEM reunião, a qualidade da resposta é o produto:
// se ela vier rasa, a reunião volta. Daí as três coisas abaixo, que são o que
// separa um questionário de um formulário que alguém termina.
//
// 1. Uma seção por vez, para a pessoa ver um bloco com começo e fim em vez de
//    uma parede de campos.
// 2. Progresso visível, porque ninguém investe meia hora sem saber quanto falta.
// 3. O que foi digitado fica guardado NESTE navegador. Um diagnóstico de marca
//    se responde em duas ou três sentadas, consultando outras pessoas da
//    empresa — sem isso, fechar a aba apaga tudo e a pessoa não recomeça.
const chaveDoRascunho = (token: string) => `vz-survey-rascunho:${token}`;

type Rascunho = { nome: string; valores: Record<string, Valor>; secao: number };

function agruparEmSecoes(questions: SurveyQuestion[]): { nome: string; questions: SurveyQuestion[] }[] {
  const secoes: { nome: string; questions: SurveyQuestion[] }[] = [];
  for (const question of questions) {
    // Pesquisas antigas foram gravadas sem seção. Elas caem num bloco único e
    // o formulário se comporta como antes.
    const nome = question.section?.trim() || "";
    const atual = secoes.find((secao) => secao.nome === nome);
    if (atual) atual.questions.push(question);
    else secoes.push({ nome, questions: [question] });
  }
  return secoes;
}

function respondida(question: SurveyQuestion, valor: Valor | undefined): boolean {
  if (valor === undefined || valor === null) return false;
  if (Array.isArray(valor)) return valor.length > 0;
  if (typeof valor === "number") return true;
  return valor.trim().length > 0;
}

export function PublicSurvey({ survey, projectName }: { survey: Survey; projectName: string }) {
  const secoes = useMemo(() => agruparEmSecoes(survey.questions), [survey.questions]);
  // Nome, respostas e seção são UM rascunho, não três estados soltos: é assim
  // que eles são gravados e restaurados, e assim a restauração é um setState só.
  const [rascunho, setRascunho] = useState<Rascunho>({ nome: "", valores: {}, secao: 0 });
  const [restaurado, setRestaurado] = useState(false);
  const [faltando, setFaltando] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const { nome, valores, secao: secaoAtual } = rascunho;

  // A leitura acontece depois de montar, e não num inicializador de useState,
  // porque o servidor não tem localStorage: preencher os campos já na primeira
  // renderização faria o HTML do cliente divergir do que veio pronto.
  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(chaveDoRascunho(survey.token));
      if (!guardado) return;
      const salvo = JSON.parse(guardado) as Rascunho;
      const valoresSalvos = salvo.valores || {};
      /* eslint-disable react-hooks/set-state-in-effect -- restaurar o rascunho só é possível depois de montar, porque localStorage não existe no servidor. Custa uma renderização extra na abertura da página; a alternativa seria ler no inicializador do useState e entregar um HTML diferente do que o servidor mandou. */
      setRascunho({ nome: salvo.nome || "", valores: valoresSalvos, secao: Math.min(salvo.secao || 0, Math.max(0, secoes.length - 1)) });
      setRestaurado(Object.keys(valoresSalvos).length > 0);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      // Janela anônima ou armazenamento bloqueado: o formulário continua
      // funcionando, só não lembra de nada.
    }
  }, [survey.token, secoes.length]);

  useEffect(() => {
    if (done) return;
    try { window.localStorage.setItem(chaveDoRascunho(survey.token), JSON.stringify(rascunho)); } catch { /* idem */ }
  }, [rascunho, survey.token, done]);

  const setNome = (valor: string) => setRascunho((atual) => ({ ...atual, nome: valor }));
  const irParaSecao = (indice: number) => setRascunho((atual) => ({ ...atual, secao: indice }));

  function setValor(id: string, valor: Valor) {
    setRascunho((atual) => ({ ...atual, valores: { ...atual.valores, [id]: valor } }));
    setFaltando((atual) => atual.filter((item) => item !== id));
  }

  const secao = secoes[secaoAtual];
  const ultima = secaoAtual >= secoes.length - 1;
  const totalObrigatorias = survey.questions.filter((question) => question.required).length;
  const respondidasObrigatorias = survey.questions.filter((question) => question.required && respondida(question, valores[question.id])).length;
  const progresso = totalObrigatorias ? Math.round((respondidasObrigatorias / totalObrigatorias) * 100) : 100;

  function pendentesDaSecao(): string[] {
    return (secao?.questions || [])
      .filter((question) => question.required && !respondida(question, valores[question.id]))
      .map((question) => question.id);
  }

  function avancar() {
    const pendentes = pendentesDaSecao();
    if (pendentes.length) {
      setFaltando(pendentes);
      document.getElementById(`pergunta-${pendentes[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setFaltando([]);
    irParaSecao(Math.min(secaoAtual + 1, secoes.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function voltar() {
    setFaltando([]);
    irParaSecao(Math.max(0, secaoAtual - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const pendentes = pendentesDaSecao();
    if (pendentes.length) {
      setFaltando(pendentes);
      document.getElementById(`pergunta-${pendentes[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSending(true);
    setError("");
    const answers: SurveyAnswer[] = survey.questions
      .filter((question) => valores[question.id] !== undefined)
      .map((question) => ({ questionId: question.id, value: valores[question.id] }));
    try {
      const response = await fetch(`/api/p/${survey.token}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respondentName: nome, answers }),
      });
      const result = await response.json();
      setSending(false);
      if (!response.ok) return setError(result.error || "Não foi possível enviar.");
      try { window.localStorage.removeItem(chaveDoRascunho(survey.token)); } catch { /* idem */ }
      setDone(true);
    } catch {
      setSending(false);
      setError("Não foi possível enviar. Confira sua conexão e tente de novo.");
    }
  }

  if (done) {
    return <main className="public-survey"><section className="public-survey__done">
      <CheckCircle2 size={42} /><h1>Resposta enviada</h1><p>Obrigado. Suas respostas já estão com a equipe.</p>
    </section></main>;
  }

  return <main className="public-survey">
    <form onSubmit={submit} className="public-survey__card">
      <header>
        <Logo height={26} />
        <span className="vz-eyebrow">{projectName}</span>
        <h1>{survey.title}</h1>
        <p>{survey.description || "Responda com calma. O que você escrever fica guardado neste navegador, então dá para parar e voltar depois."}</p>
      </header>

      {secoes.length > 1 ? (
        <div className="public-survey__progresso">
          <div className="public-survey__barra"><i style={{ width: `${progresso}%` }} /></div>
          <div className="public-survey__passo">
            <strong>{secao?.nome || `Bloco ${secaoAtual + 1}`}</strong>
            <span>Bloco {secaoAtual + 1} de {secoes.length} · {respondidasObrigatorias} de {totalObrigatorias} obrigatórias respondidas</span>
          </div>
        </div>
      ) : null}

      {restaurado ? (
        <p className="public-survey__retomada"><Save size={13} /> Retomamos de onde você parou. Nada foi enviado ainda.</p>
      ) : null}

      {secaoAtual === 0 ? (
        <Field label="Seu nome" hint="Para sabermos com quem falamos"><Input value={nome} onChange={(event) => setNome(event.target.value)} /></Field>
      ) : null}

      {(secao?.questions || []).map((question) => {
        const numero = survey.questions.indexOf(question) + 1;
        const pendente = faltando.includes(question.id);
        return <fieldset className={`public-survey__question${pendente ? " is-pendente" : ""}`} id={`pergunta-${question.id}`} key={question.id}>
          <legend><b>{numero}. {question.title}</b>{question.required ? <span>Obrigatória</span> : null}</legend>
          {question.description ? <p>{question.description}</p> : null}
          {question.type === "short_text" ? <Input value={String(valores[question.id] || "")} onChange={(event) => setValor(question.id, event.target.value)} /> : null}
          {question.type === "long_text" ? <Textarea rows={5} value={String(valores[question.id] || "")} onChange={(event) => setValor(question.id, event.target.value)} /> : null}
          {question.type === "single_choice" ? <div className="public-survey__choices">{question.options?.map((option) => <label key={option}><input type="radio" name={question.id} checked={valores[question.id] === option} onChange={() => setValor(question.id, option)} />{option}</label>)}</div> : null}
          {question.type === "multiple_choice" ? <div className="public-survey__choices">{question.options?.map((option) => { const atual = Array.isArray(valores[question.id]) ? valores[question.id] as string[] : []; return <label key={option}><input type="checkbox" checked={atual.includes(option)} onChange={(event) => setValor(question.id, event.target.checked ? [...atual, option] : atual.filter((item) => item !== option))} />{option}</label>; })}</div> : null}
          {question.type === "scale" || question.type === "nps" ? <div className="public-survey__scale">{Array.from({ length: question.type === "nps" ? 11 : 5 }, (_, i) => i + (question.type === "nps" ? 0 : 1)).map((numero) => <button className={valores[question.id] === numero ? "active" : ""} type="button" key={numero} onClick={() => setValor(question.id, numero)}>{numero}</button>)}</div> : null}
          {pendente ? <p className="public-survey__falta">Esta pergunta é obrigatória.</p> : null}
        </fieldset>;
      })}

      {error ? <p className="form-message">{error}</p> : null}

      <div className="public-survey__acoes">
        {secaoAtual > 0 ? <Button type="button" variant="secondary" onClick={voltar}><ArrowLeft size={15} /> Voltar</Button> : <span />}
        {ultima
          ? <Button type="submit" disabled={sending}>{sending ? "Enviando..." : "Enviar respostas"}</Button>
          : <Button type="button" onClick={avancar}>Continuar <ArrowRight size={15} /></Button>}
      </div>
    </form>
  </main>;
}
