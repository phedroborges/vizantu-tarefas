"use client";

// Linha do tempo do cliente, na vertical e em ordem: do ano em que ele entrou,
// passando pelo hoje, até o futuro, com o sonho no fim como destino. Cada ano
// aparece com animação conforme a pessoa rola. A regra de ordem mora em
// lib/timeline/model.ts (caminhoPorAno); aqui só desenha e edita.
//
// Mudança de rumo se registra com "Mudou", que cria o item novo e deixa o
// antigo como substituído — a tela mostra os dois, e a mudança fica visível.

import { Check, Flag, Milestone, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, EmptyState, Field, Input, Select, Tag, Textarea, type Tone } from "@/components/vz";
import { VzLoading } from "@/components/vz/loading";
import { responseError } from "@/lib/request-error";
import { caminhoPorAno, dataNoCaminho, periodoEmTexto, rotuloDaSituacao, rotuloDoTipo, TIMELINE_KINDS, type TimelineItem, type TimelineKind } from "@/lib/timeline/model";

type Dados = { hoje: string; itens: TimelineItem[] };

const TOM_DO_TIPO: Record<TimelineKind, Tone> = { sonho: "violet", objetivo: "blue", meta: "green", marco: "amber" };

type Formulario = { kind: TimelineKind; title: string; detail: string; inicio: string; fim: string; saidOn: string; sourceLabel: string };
type Edicao = { modo: "novo" } | { modo: "editar"; item: TimelineItem } | { modo: "mudou"; item: TimelineItem };

const mes = (data?: string) => (data ? data.slice(0, 7) : "");
const ultimoDia = (anoMes: string) => `${anoMes}-${String(new Date(Number(anoMes.slice(0, 4)), Number(anoMes.slice(5, 7)), 0).getDate()).padStart(2, "0")}`;
const NOMES_DOS_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Une no mesmo card tudo o que começa no mesmo mês. Só a tela agrupa: cada item continua separado no banco. */
function porMes(itens: TimelineItem[]): { chave: string; itens: TimelineItem[] }[] {
  const meses: { chave: string; itens: TimelineItem[] }[] = [];
  for (const item of itens) {
    const chave = dataNoCaminho(item).slice(0, 7);
    const ultimo = meses[meses.length - 1];
    if (ultimo?.chave === chave) ultimo.itens.push(item); else meses.push({ chave, itens: [item] });
  }
  return meses;
}

const dataBr = (data?: string) => (data ? `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}` : "");

function formularioDe(edicao: Edicao, hoje: string): Formulario {
  if (edicao.modo === "novo") return { kind: "objetivo", title: "", detail: "", inicio: "", fim: "", saidOn: hoje, sourceLabel: "" };
  const { item } = edicao;
  if (edicao.modo === "mudou") return { kind: item.kind, title: "", detail: "", inicio: mes(item.startsOn), fim: mes(item.endsOn), saidOn: hoje, sourceLabel: "" };
  return { kind: item.kind, title: item.title, detail: item.detail, inicio: mes(item.startsOn), fim: mes(item.endsOn), saidOn: item.saidOn ?? "", sourceLabel: item.sourceLabel ?? "" };
}

export function ProjectTimelinePanel({ projectId, projectName, canEdit, canDelete }: { projectId: string; projectName: string; canEdit: boolean; canDelete: boolean }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [form, setForm] = useState<Formulario | null>(null);
  const [salvando, setSalvando] = useState(false);
  const caminhoRef = useRef<HTMLDivElement>(null);

  const buscar = useCallback(async (): Promise<Dados | string> => {
    try {
      const response = await fetch(`/api/projects/${projectId}/timeline`);
      if (!response.ok) return await responseError(response, "carregar a linha do tempo");
      return await response.json();
    } catch {
      return "Não foi possível carregar a linha do tempo. Confira a conexão e recarregue.";
    }
  }, [projectId]);

  async function carregar() {
    const resultado = await buscar();
    if (typeof resultado === "string") setMensagem(resultado);
    else { setDados(resultado); setMensagem(""); }
  }

  useEffect(() => {
    let vivo = true;
    void buscar().then((resultado) => {
      if (!vivo) return;
      if (typeof resultado === "string") setMensagem(resultado);
      else setDados(resultado);
    });
    return () => { vivo = false; };
  }, [buscar]);

  // Cada ano entra na tela conforme a pessoa rola até ele.
  useEffect(() => {
    const raiz = caminhoRef.current;
    if (!raiz) return;
    const blocos = Array.from(raiz.querySelectorAll<HTMLElement>(".timeline-reveal"));
    if (!("IntersectionObserver" in window)) { blocos.forEach((b) => b.classList.add("is-visible")); return; }
    const observador = new IntersectionObserver((entradas) => {
      for (const entrada of entradas) if (entrada.isIntersecting) { entrada.target.classList.add("is-visible"); observador.unobserve(entrada.target); }
    }, { rootMargin: "0px 0px -10% 0px" });
    blocos.forEach((b) => observador.observe(b));
    return () => observador.disconnect();
  }, [dados]);

  function abrir(nova: Edicao) {
    if (!dados) return;
    setEdicao(nova);
    setForm(formularioDe(nova, dados.hoje));
  }

  function fechar() { setEdicao(null); setForm(null); }

  async function enviar(url: string, method: string, body?: unknown) {
    setSalvando(true);
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      if (!response.ok) throw new Error(await responseError(response, "salvar a linha do tempo"));
      await carregar();
      return true;
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Não foi possível salvar. Tente de novo.");
      return false;
    } finally {
      setSalvando(false);
    }
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (!form || !edicao) return;
    if (!form.title.trim()) { setMensagem("Escreva o que é."); return; }
    const corpo = {
      kind: form.kind, title: form.title, detail: form.detail,
      startsOn: form.inicio ? `${form.inicio}-01` : null,
      endsOn: form.fim ? ultimoDia(form.fim) : null,
      saidOn: form.saidOn || null, sourceLabel: form.sourceLabel || null,
    };
    const base = `/api/projects/${projectId}/timeline`;
    const ok = edicao.modo === "editar"
      ? await enviar(`${base}?itemId=${edicao.item.id}`, "PATCH", corpo)
      : await enviar(base, "POST", edicao.modo === "mudou" ? { ...corpo, substitui: edicao.item.id } : corpo);
    if (ok) fechar();
  }

  if (!dados) return <Card>{mensagem ? <p className="form-message" role="status">{mensagem}</p> : <VzLoading label="Carregando a linha do tempo…" />}</Card>;

  const porId = new Map(dados.itens.map((item) => [item.id, item]));
  const { anos, destino } = caminhoPorAno(dados.itens, dados.hoje);
  const vigentes = dados.itens.filter((item) => item.status === "vigente").length;

  const cartao = (item: TimelineItem) => {
    const substituto = item.replacedById ? porId.get(item.replacedById) : undefined;
    const origem = [item.saidOn ? `Dito em ${dataBr(item.saidOn)}` : "", item.sourceLabel, item.createdByName ? `por ${item.createdByName}` : ""].filter(Boolean).join(" · ");
    return (
      <article className={item.status === "vigente" ? "timeline-item" : "timeline-item is-past"} key={item.id}>
        <div className="timeline-item__top">
          <Tag tone={TOM_DO_TIPO[item.kind]}>{rotuloDoTipo(item.kind)}</Tag>
          <span className="timeline-item__period">{periodoEmTexto(item)}</span>
          {item.status !== "vigente" ? <Tag tone={item.status === "alcancado" ? "green" : "slate"} outline>{rotuloDaSituacao(item.status)}</Tag> : null}
        </div>
        <h4>{item.title}</h4>
        {item.detail ? <p>{item.detail}</p> : null}
        {substituto ? <p className="timeline-item__replaced"><RefreshCw size={12} aria-hidden /> Mudou para: {substituto.title}</p> : null}
        {origem ? <small className="timeline-item__origin">{origem}</small> : null}
        {canEdit ? (
          <div className="timeline-item__actions">
            <Button size="sm" variant="ghost" onClick={() => abrir({ modo: "editar", item })}><Pencil size={13} /> Editar</Button>
            {item.status === "vigente" ? <>
              <Button size="sm" variant="ghost" onClick={() => abrir({ modo: "mudou", item })}><RefreshCw size={13} /> Mudou</Button>
              {item.kind === "objetivo" || item.kind === "meta" ? <Button size="sm" variant="ghost" disabled={salvando} onClick={() => enviar(`/api/projects/${projectId}/timeline?itemId=${item.id}`, "PATCH", { status: "alcancado" })}><Check size={13} /> Alcançado</Button> : null}
            </> : <Button size="sm" variant="ghost" disabled={salvando} onClick={() => enviar(`/api/projects/${projectId}/timeline?itemId=${item.id}`, "PATCH", { status: "vigente" })}>Voltar a valer</Button>}
            {canDelete ? <Button size="sm" variant="ghost" disabled={salvando} onClick={() => { if (window.confirm("Apagar este item? Use só para corrigir erro. Se o cliente mudou de ideia, use \"Mudou\".")) void enviar(`/api/projects/${projectId}/timeline?itemId=${item.id}`, "DELETE"); }}><Trash2 size={13} /> Apagar</Button> : null}
          </div>
        ) : null}
      </article>
    );
  };

  const mesDoAno = (mes: { chave: string; itens: TimelineItem[] }) => (
    <div className="timeline-month" key={mes.chave}>
      <h4 className="timeline-month__label">{NOMES_DOS_MESES[Number(mes.chave.slice(5, 7)) - 1]}</h4>
      {mes.itens.map(cartao)}
    </div>
  );

  return (
    <div className="timeline">
      <Card className="timeline-head">
        <div className="project-section-head">
          <div>
            <h2><Milestone size={14} /> Linha do tempo</h2>
            <p>O caminho de {projectName} com a gente, do começo até onde quer chegar. Role para descer pelos anos.</p>
          </div>
          {canEdit ? <Button variant="primary" size="sm" onClick={() => abrir({ modo: "novo" })}><Plus size={14} /> Novo</Button> : null}
        </div>

        {mensagem ? <p className="form-message" role="status">{mensagem}</p> : null}
      </Card>

      {form && edicao ? (
        <Card className="timeline-form">
          <form onSubmit={salvar}>
            <h3>{edicao.modo === "novo" ? "Novo na linha do tempo" : edicao.modo === "editar" ? "Editar" : `Mudou: "${edicao.item.title}"`}</h3>
            {edicao.modo === "mudou" ? <p className="timeline-form__hint">O item atual fica como substituído e o novo passa a valer. Os dois continuam visíveis.</p> : null}
            <div className="timeline-form__grid">
              <Field label="Tipo" hint={TIMELINE_KINDS.find((tipo) => tipo.value === form.kind)?.hint}>
                <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as TimelineKind })}>
                  {TIMELINE_KINDS.map((tipo) => <option value={tipo.value} key={tipo.value}>{tipo.label}</option>)}
                </Select>
              </Field>
              <Field label="O que é">
                <Input autoFocus value={form.title} maxLength={300} placeholder="Ex.: 20 conversas por dia no WhatsApp" onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Field>
              <Field label="Vale a partir de" hint="Vazio = desde já.">
                <Input type="month" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} />
              </Field>
              <Field label="Até" hint="Vazio = sem fim definido.">
                <Input type="month" value={form.fim} onChange={(e) => setForm({ ...form, fim: e.target.value })} />
              </Field>
              <Field label="Dito em">
                <Input type="date" value={form.saidOn} onChange={(e) => setForm({ ...form, saidOn: e.target.value })} />
              </Field>
              <Field label="De onde veio" hint="Reunião, WhatsApp, anotação.">
                <Input value={form.sourceLabel} maxLength={200} placeholder="Ex.: Reunião de resultados" onChange={(e) => setForm({ ...form, sourceLabel: e.target.value })} />
              </Field>
            </div>
            <Field label="Detalhe" hint="Com as palavras do cliente, se der.">
              <Textarea rows={3} value={form.detail} maxLength={4000} onChange={(e) => setForm({ ...form, detail: e.target.value })} />
            </Field>
            <div className="timeline-form__actions">
              <Button type="button" variant="ghost" onClick={fechar}>Cancelar</Button>
              <Button type="submit" variant="primary" disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</Button>
            </div>
          </form>
        </Card>
      ) : null}

      {!dados.itens.length && !form ? (
        <Card><EmptyState icon={<Milestone size={24} />} title="A linha do tempo ainda está vazia" description="Registre o sonho do cliente, o objetivo de agora e o que ele quer para os próximos meses. O Totó também preenche a partir das reuniões." /></Card>
      ) : null}

      {anos.length || destino.length ? (
        <div className="timeline-road" ref={caminhoRef}>
          {anos.map((ano) => (
            <section className={ano.temHoje ? "timeline-year is-current timeline-reveal" : ano.ano > Number(dados.hoje.slice(0, 4)) ? "timeline-year is-future timeline-reveal" : "timeline-year timeline-reveal"} key={ano.ano} aria-label={String(ano.ano)}>
              <h3 className="timeline-year__label">{ano.ano}</h3>
              <div className="timeline-year__items">
                {porMes(ano.antesDeHoje).map(mesDoAno)}
                {ano.temHoje ? <div className="timeline-today" role="separator" aria-label="Hoje"><span>Hoje · {dataBr(dados.hoje)}</span></div> : null}
                {porMes(ano.depoisDeHoje).map(mesDoAno)}
                {!ano.antesDeHoje.length && !ano.depoisDeHoje.length && !ano.temHoje ? <p className="timeline-year__empty">Nada registrado neste ano.</p> : null}
              </div>
            </section>
          ))}
          {destino.length ? (
            <section className="timeline-year is-destiny timeline-reveal" aria-label="Aonde quer chegar">
              <h3 className="timeline-year__label"><Flag size={16} aria-hidden /> Aonde quer chegar</h3>
              <div className="timeline-year__items"><div className="timeline-month">{destino.map(cartao)}</div></div>
            </section>
          ) : null}
        </div>
      ) : null}

      {vigentes ? <p className="dash-footnote">{vigentes} {vigentes === 1 ? "item valendo" : "itens valendo"}. Os agentes leem esta mesma linha do tempo.</p> : null}
    </div>
  );
}
