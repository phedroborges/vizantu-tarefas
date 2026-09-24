"use client";

// A aba Contexto do projeto. Antes eram treze caixas de texto empilhadas e o
// resultado foi treze clientes de catorze com a ficha vazia. Três coisas
// mudaram aqui:
//
// 1. A tela abre em modo leitura. É um documento que a equipe lê antes de
//    produzir, não um formulário que alguém precisa preencher. Clicar numa
//    resposta abre ela pra edição, e sai salvando.
// 2. Todo campo é pergunta. "No que ele é enjoado?" é respondível; "Pontos de
//    precisão" não é.
// 3. O vazio é visível. Barra de progresso por bloco e no topo, porque ficha
//    vazia que não aparece continua vazia.

import { BookOpen, Check, ChevronDown, FileText, Loader2, Mic, Plus, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import { CLIENT_GUIDE_BLOCKS, guideCompletion, type GuideField } from "@/lib/client-guide";
import { networkError, responseError } from "@/lib/request-error";
import { PROJECT_SOURCE_KINDS, type ProjectProfile, type ProjectSource, type ProjectSourceKind } from "@/lib/types";
import { Button, Callout, Card, EmptyState, Field, Input, Progress, Select, Tag, Textarea } from "@/components/vz";

const AUTOSAVE_MS = 700;

// Mesmo teto da rota de transcrição (src/app/api/assistant/transcribe/route.ts),
// que por sua vez existe por causa do limite de 25MB do whisper.
const MAX_AUDIO_BYTES = 24 * 1024 * 1024;

export function ClientGuideView({
  projectId,
  initialProfile,
  initialSources,
  canEdit,
  aiEnabled,
  cadastro,
}: {
  projectId: string;
  initialProfile: Partial<ProjectProfile>;
  initialSources: ProjectSource[];
  canEdit: boolean;
  aiEnabled: boolean;
  // O cadastro (CNPJ, endereço, quem decide) continua existindo, mas recolhido:
  // é consulta esporádica e estava competindo com o que a equipe lê todo dia.
  cadastro: React.ReactNode;
}) {
  const [profile, setProfile] = useState<Partial<ProjectProfile>>(initialProfile);
  const [sources, setSources] = useState<ProjectSource[]>(initialSources);
  const [editando, setEditando] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [gerando, setGerando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [abrindoFonte, setAbrindoFonte] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const progresso = guideCompletion(profile);
  const manuais = new Set(profile.guideManualFields ?? []);

  // Só o campo alterado vai no PATCH. Mandar o objeto inteiro marcaria os
  // dezoito campos como corrigidos à mão e a IA nunca mais encostaria neles.
  async function persistir(key: string, value: string) {
    try {
      const response = await fetch(`/api/projects/${projectId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!response.ok) return setErro(await responseError(response, "salvar o guia"));
      setErro("");
      setProfile((atual) => ({
        ...atual,
        guideManualFields: Array.from(new Set([...(atual.guideManualFields ?? []), key])),
      }));
    } catch {
      setErro(networkError("salvar o guia"));
    }
  }

  function setCampo(key: string, value: string) {
    setProfile((atual) => ({ ...atual, [key]: value }));
    if (!canEdit) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persistir(key, value), AUTOSAVE_MS);
  }

  async function montarGuia() {
    setGerando(true);
    setErro("");
    setAviso("");
    try {
      const response = await fetch(`/api/projects/${projectId}/guide`, { method: "POST" });
      if (!response.ok) {
        setErro(await responseError(response, "montar o guia"));
        return;
      }
      const data = await response.json();
      setProfile(data.profile);
      const n = data.camposPreenchidos?.length ?? 0;
      setAviso(`A IA leu ${data.fontesLidas} fonte${data.fontesLidas === 1 ? "" : "s"} e preencheu ${n} campo${n === 1 ? "" : "s"}. Revise antes de tratar como verdade.`);
    } catch {
      setErro(networkError("montar o guia"));
    } finally {
      setGerando(false);
    }
  }

  async function removerFonte(source: ProjectSource) {
    const ok = await confirm({
      title: "Remover fonte",
      message: `Remover "${source.title}"? O guia já escrito continua, mas essa reunião não será mais considerada quando você montar de novo.`,
      confirmLabel: "Remover",
      danger: true,
    });
    if (!ok) return;
    try {
      const response = await fetch(`/api/projects/${projectId}/sources?sourceId=${source.id}`, { method: "DELETE" });
      if (!response.ok) return setErro(await responseError(response, "remover a fonte"));
      setSources((atual) => atual.filter((item) => item.id !== source.id));
    } catch {
      setErro(networkError("remover a fonte"));
    }
  }

  return (
    <div className="guia">
      {ConfirmDialog}

      <Card className="guia-topo">
        <div className="guia-topo__texto">
          <span className="vz-eyebrow">Conhecimento compartilhado</span>
          <h2 className="vz-h2">Guia do cliente</h2>
          <p className="vz-caption">
            O que a equipe precisa saber antes de produzir qualquer coisa para esse cliente.
          </p>
        </div>
        <div className="guia-topo__progresso">
          <strong>{progresso.preenchidos} de {progresso.total}</strong>
          <Progress value={progresso.percentual} thin tone={progresso.percentual >= 70 ? "green" : progresso.percentual >= 30 ? "amber" : "red"} />
          <span className="vz-caption">
            {progresso.percentual === 0
              ? "Ninguém respondeu nada ainda"
              : `${progresso.percentual}% do guia respondido`}
          </span>
        </div>
      </Card>

      {erro ? <Callout tone="danger" icon={<TriangleAlert size={16} />}>{erro}</Callout> : null}
      {aviso ? <Callout tone="brand" icon={<Sparkles size={16} />}>{aviso}</Callout> : null}

      <FontesDoGuia
        projectId={projectId}
        sources={sources}
        setSources={setSources}
        canEdit={canEdit}
        aiEnabled={aiEnabled}
        gerando={gerando}
        onMontar={montarGuia}
        onRemover={removerFonte}
        aberto={abrindoFonte}
        setAberto={setAbrindoFonte}
        setErro={setErro}
      />

      {CLIENT_GUIDE_BLOCKS.map((bloco) => {
        const doBloco = progresso.porBloco.find((item) => item.key === bloco.key);
        return (
          <Card className="guia-bloco" key={bloco.key}>
            <header className="guia-bloco__head">
              <div>
                <h3>{bloco.titulo}</h3>
                <p className="vz-caption">{bloco.resumo}</p>
              </div>
              <Tag tone={doBloco && doBloco.preenchidos === doBloco.total ? "green" : doBloco?.preenchidos ? "amber" : "slate"}>
                {doBloco?.preenchidos ?? 0}/{doBloco?.total ?? 0}
              </Tag>
            </header>

            <div className="guia-campos">
              {bloco.campos.map((campo) => (
                <CampoDoGuia
                  key={campo.key}
                  campo={campo}
                  valor={(profile[campo.key] as string) || ""}
                  escritoPelaIa={Boolean(profile.guideGeneratedAt) && !manuais.has(campo.key) && Boolean(profile[campo.key])}
                  canEdit={canEdit}
                  editando={editando === campo.key}
                  onAbrir={() => setEditando(campo.key)}
                  onFechar={() => setEditando(null)}
                  onChange={(valor) => setCampo(campo.key, valor)}
                />
              ))}
            </div>
          </Card>
        );
      })}

      <details className="guia-cadastro">
        <summary>
          <ChevronDown size={16} />
          Dados cadastrais
          <span className="vz-caption">CNPJ, endereço, site e quem decide</span>
        </summary>
        <div className="guia-cadastro__corpo">{cadastro}</div>
      </details>
    </div>
  );
}

function CampoDoGuia({
  campo, valor, escritoPelaIa, canEdit, editando, onAbrir, onFechar, onChange,
}: {
  campo: GuideField;
  valor: string;
  escritoPelaIa: boolean;
  canEdit: boolean;
  editando: boolean;
  onAbrir: () => void;
  onFechar: () => void;
  onChange: (valor: string) => void;
}) {
  const vazio = !valor.trim();

  return (
    <div className={`guia-campo${vazio ? " guia-campo--vazio" : ""}`}>
      <div className="guia-campo__pergunta">
        <strong>{campo.pergunta}</strong>
        {escritoPelaIa ? <Tag tone="violet" icon={<Sparkles size={11} />}>IA</Tag> : null}
      </div>

      {editando && canEdit ? (
        campo.kind === "escolha" ? (
          <Select
            autoFocus
            value={valor}
            onChange={(e) => { onChange(e.target.value); onFechar(); }}
            onBlur={onFechar}
          >
            <option value="">Não informado</option>
            {campo.opcoes?.map((opcao) => <option key={opcao} value={opcao}>{opcao}</option>)}
          </Select>
        ) : campo.kind === "curto" ? (
          <Input autoFocus value={valor} onChange={(e) => onChange(e.target.value)} onBlur={onFechar} placeholder={campo.ajuda} />
        ) : (
          <Textarea autoFocus rows={5} value={valor} onChange={(e) => onChange(e.target.value)} onBlur={onFechar} placeholder={campo.ajuda} />
        )
      ) : (
        <button
          type="button"
          className="guia-campo__resposta"
          disabled={!canEdit}
          onClick={onAbrir}
          title={canEdit ? "Clique para editar" : undefined}
        >
          {vazio ? <span className="guia-campo__placeholder">{campo.ajuda}</span> : valor}
        </button>
      )}
    </div>
  );
}

function FontesDoGuia({
  projectId, sources, setSources, canEdit, aiEnabled, gerando, onMontar, onRemover, aberto, setAberto, setErro,
}: {
  projectId: string;
  sources: ProjectSource[];
  setSources: React.Dispatch<React.SetStateAction<ProjectSource[]>>;
  canEdit: boolean;
  aiEnabled: boolean;
  gerando: boolean;
  onMontar: () => void;
  onRemover: (source: ProjectSource) => void;
  aberto: boolean;
  setAberto: (aberto: boolean) => void;
  setErro: (erro: string) => void;
}) {
  const [form, setForm] = useState<{ title: string; kind: ProjectSourceKind; happenedOn: string; content: string }>({
    title: "", kind: "reuniao", happenedOn: "", content: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const audioRef = useRef<HTMLInputElement | null>(null);

  // Whisper recusa acima de 25MB e a rota corta em 24MB. Uma reunião de uma
  // hora em mp3 de 128kbps passa de 50MB, então a checagem é no navegador:
  // esperar o upload inteiro pra receber erro é o pior jeito de descobrir.
  async function transcrever(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_AUDIO_BYTES) {
      const mb = Math.round(file.size / 1024 / 1024);
      return setErro(
        `O áudio tem ${mb}MB e o limite é 24MB. Comprima o arquivo ou corte em partes, salvando uma fonte por parte. A IA junta tudo depois.`,
      );
    }

    setTranscrevendo(true);
    setErro("");
    try {
      const formData = new FormData();
      formData.append("audio", file, file.name);
      const response = await fetch("/api/assistant/transcribe", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha ao transcrever o áudio.");
      setForm((atual) => ({
        ...atual,
        title: atual.title || file.name.replace(/\.[^.]+$/, ""),
        kind: "transcricao",
        content: atual.content.trim() ? `${atual.content.trim()}\n\n${result.text}` : result.text,
      }));
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao transcrever o áudio.");
    } finally {
      setTranscrevendo(false);
    }
  }

  async function salvar() {
    if (!form.title.trim() || !form.content.trim()) {
      return setErro("Dê um nome à fonte e cole o conteúdo antes de salvar.");
    }
    setSalvando(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) return setErro(await responseError(response, "salvar a fonte"));
      const data = await response.json();
      setSources((atual) => [...atual, data.source]);
      setForm({ title: "", kind: "reuniao", happenedOn: "", content: "" });
      setAberto(false);
      setErro("");
    } catch {
      setErro(networkError("salvar a fonte"));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card className="guia-fontes">
      <header className="guia-bloco__head">
        <div>
          <h3><BookOpen size={15} /> De onde o guia sai</h3>
          <p className="vz-caption">
            As reuniões e anotações desse cliente. A IA lê todas de uma vez e remonta o guia inteiro, então
            pode ir somando reunião por reunião.
          </p>
        </div>
        {canEdit ? (
          <div className="guia-fontes__acoes">
            <Button variant="ghost" onClick={() => setAberto(!aberto)}><Plus size={14} /> Adicionar</Button>
            <Button
              variant="primary"
              onClick={onMontar}
              disabled={gerando || !sources.length || !aiEnabled}
              title={!aiEnabled ? "IA não habilitada para o seu usuário" : !sources.length ? "Adicione uma reunião primeiro" : undefined}
            >
              {gerando ? <Loader2 size={14} className="vz-spin" /> : <Sparkles size={14} />}
              {gerando ? "Montando..." : "Montar guia com a IA"}
            </Button>
          </div>
        ) : null}
      </header>

      {aberto && canEdit ? (
        <div className="guia-fonte-form">
          <Field label="Nome"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="1ª reunião de alinhamento" /></Field>
          <Field label="Tipo">
            <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ProjectSourceKind })}>
              {PROJECT_SOURCE_KINDS.filter((kind) => kind.value !== "migrado").map((kind) => (
                <option key={kind.value} value={kind.value}>{kind.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Quando aconteceu"><Input type="date" value={form.happenedOn} onChange={(e) => setForm({ ...form, happenedOn: e.target.value })} /></Field>
          <Field label="Conteúdo" hint="Cole a transcrição ou a sua anotação. Pode ser bagunçado, a IA organiza.">
            <Textarea rows={8} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            <div className="guia-fonte-form__audio">
              <input ref={audioRef} type="file" accept="audio/*" hidden onChange={transcrever} />
              <Button variant="soft" size="sm" onClick={() => audioRef.current?.click()} disabled={transcrevendo}>
                {transcrevendo ? <Loader2 size={13} className="vz-spin" /> : <Mic size={13} />}
                {transcrevendo ? "Transcrevendo..." : "Enviar o áudio da reunião"}
              </Button>
              <span className="vz-caption">Até 24MB. A transcrição entra no campo acima e você pode editar antes de salvar.</span>
            </div>
          </Field>
          <div className="guia-fonte-form__acoes">
            <Button variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button variant="primary" onClick={salvar} disabled={salvando}>
              {salvando ? <Loader2 size={14} className="vz-spin" /> : <Check size={14} />} Salvar fonte
            </Button>
          </div>
        </div>
      ) : null}

      {sources.length ? (
        <ul className="guia-fonte-lista">
          {sources.map((source) => (
            <li key={source.id}>
              <FileText size={14} />
              <div>
                <strong>{source.title}</strong>
                <span className="vz-caption">
                  {PROJECT_SOURCE_KINDS.find((kind) => kind.value === source.kind)?.label}
                  {source.happenedOn ? ` · ${source.happenedOn.split("-").reverse().join("/")}` : ""}
                  {` · ${source.content.length.toLocaleString("pt-BR")} caracteres`}
                </span>
              </div>
              {canEdit ? (
                <button type="button" onClick={() => onRemover(source)} aria-label={`Remover ${source.title}`}>
                  <Trash2 size={14} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<BookOpen size={22} />}
          title="Nenhuma reunião registrada"
          description="Cole aqui a anotação ou a transcrição das reuniões com esse cliente. Depois é só pedir para a IA montar o guia."
        />
      )}
    </Card>
  );
}
