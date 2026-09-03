"use client";

import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, Plus, ShieldAlert, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import { networkError, responseError } from "@/lib/request-error";
import { CREDENTIAL_KINDS, type Project, type ProjectCredential, type ProjectProfile } from "@/lib/types";

const AUTOSAVE_MS = 700;

const CAMPOS: { key: keyof ProjectProfile; label: string; hint?: string; longo?: boolean }[] = [
  { key: "razaoSocial", label: "Razão social" },
  { key: "documento", label: "CNPJ / CPF" },
  { key: "endereco", label: "Endereço completo", longo: true },
  { key: "cidade", label: "Cidade" },
  { key: "segmento", label: "Segmento" },
  { key: "site", label: "Site" },
  { key: "responsavelNome", label: "Quem decide" , hint: "A pessoa que aprova de verdade" },
  { key: "responsavelTelefone", label: "Telefone" },
  { key: "responsavelEmail", label: "E-mail" },
];

const TEXTOS: { key: keyof ProjectProfile; label: string; hint: string }[] = [
  { key: "objetivos", label: "Objetivos", hint: "O que esse cliente quer que aconteça" },
  { key: "publico", label: "Público", hint: "Quem ele precisa alcançar" },
  { key: "historico", label: "Histórico", hint: "O que já foi feito, o que funcionou e o que não funcionou" },
  { key: "observacoes", label: "Observações", hint: "O que a equipe precisa saber antes de falar com ele" },
];

export function ProjectProfileView({
  project,
  initialProfile,
  initialCredentials,
  canManageCredentials,
  secretsConfigured,
}: {
  project: Project;
  initialProfile: ProjectProfile | null;
  initialCredentials: ProjectCredential[];
  canManageCredentials: boolean;
  secretsConfigured: boolean;
}) {
  const [profile, setProfile] = useState<Partial<ProjectProfile>>(initialProfile ?? {});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [credentials, setCredentials] = useState(initialCredentials);
  const [error, setError] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  async function persist(next: Partial<ProjectProfile>) {
    setSaveState("saving");
    try {
      const response = await fetch(`/api/projects/${project.id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!response.ok) {
        setSaveState("error");
        return setError(await responseError(response, "salvar o perfil"));
      }
      setError("");
      setSaveState("saved");
    } catch {
      setSaveState("error");
      setError(networkError("salvar o perfil"));
    }
  }

  function setCampo(key: keyof ProjectProfile, value: string) {
    const next = { ...profile, [key]: value };
    setProfile(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persist(next), AUTOSAVE_MS);
  }

  async function removerCredencial(credential: ProjectCredential) {
    if (!(await confirm({ title: "Excluir acesso", message: `Excluir "${credential.label}"? A senha guardada some junto.`, confirmLabel: "Excluir", danger: true }))) return;
    const response = await fetch(`/api/credentials/${credential.id}`, { method: "DELETE" });
    if (!response.ok) return setError(await responseError(response, "excluir a credencial"));
    setCredentials((atual) => atual.filter((item) => item.id !== credential.id));
  }

  return (
    <>
      <main className="admin-page dashboard">
        <div className="dashboard-head">
          <div>
            <Link href="/projetos" className="voltar-link"><ArrowLeft size={13} /> Projetos</Link>
            <h1>{project.name}</h1>
            <p>A ficha do cliente. O que a equipe precisa saber antes de escrever, gravar ou falar com ele.</p>
          </div>
          <span className="task-save-status" aria-live="polite">
            {saveState === "saving" ? "Salvando..." : saveState === "saved" ? "Salvo" : saveState === "error" ? "Erro ao salvar" : ""}
          </span>
        </div>

        {error ? <div className="form-message">{error}</div> : null}

        <div className="split-layout" style={{ gridTemplateColumns: "minmax(320px, 1.2fr) minmax(320px, 1fr)" }}>
          <section className="panel">
            <div className="panel-head"><h2>Dados</h2></div>
            <div className="modal-body" style={{ padding: "18px 22px" }}>
              <div className="contrato-campos">
                {CAMPOS.map((campo) => (
                  <label className="contrato-campo" key={campo.key} style={campo.longo ? { gridColumn: "1 / -1" } : undefined}>
                    <span>{campo.label}</span>
                    <input
                      value={(profile[campo.key] as string) || ""}
                      onChange={(e) => setCampo(campo.key, e.target.value)}
                      placeholder={campo.hint}
                    />
                    {campo.hint ? <small>{campo.hint}</small> : null}
                  </label>
                ))}
              </div>

              {TEXTOS.map((campo) => (
                <section className="contrato-grupo" key={campo.key} style={{ marginTop: 16 }}>
                  <h4>{campo.label} <small>{campo.hint}</small></h4>
                  <textarea
                    className="knowledge-editor"
                    style={{ minHeight: 110 }}
                    value={(profile[campo.key] as string) || ""}
                    onChange={(e) => setCampo(campo.key, e.target.value)}
                  />
                </section>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2><KeyRound size={14} /> Acessos</h2>
                <p>{credentials.length} {credentials.length === 1 ? "acesso guardado" : "acessos guardados"}</p>
              </div>
              {canManageCredentials ? (
                <button type="button" className="secondary-button" onClick={() => setIsAdding(true)}><Plus size={13} /> Novo acesso</button>
              ) : null}
            </div>

            {!canManageCredentials ? (
              <div className="empty-state">
                <ShieldAlert size={32} />
                <h3>Acessos são do dono</h3>
                <p>Senha de cliente é acesso à casa dele. Só o dono da conta vê e edita.</p>
              </div>
            ) : (
              <div className="modal-body" style={{ padding: "14px 18px" }}>
                {!secretsConfigured ? (
                  <p className="contrato-pendencias">
                    Este servidor está sem a chave de criptografia (CREDENTIALS_KEY). Dá para guardar usuário, link e
                    observação, mas senha não: gravar aberta seria pior que não guardar.
                  </p>
                ) : null}

                {isAdding ? (
                  <CredentialForm
                    projectId={project.id}
                    secretsConfigured={secretsConfigured}
                    onCancel={() => setIsAdding(false)}
                    onSaved={(credential) => {
                      setCredentials((atual) => [...atual, credential]);
                      setIsAdding(false);
                    }}
                    onError={setError}
                  />
                ) : null}

                {credentials.length ? (
                  <ul className="credencial-list">
                    {credentials.map((credential) => (
                      <CredentialRow
                        key={credential.id}
                        credential={credential}
                        onRemove={() => removerCredencial(credential)}
                        onError={setError}
                      />
                    ))}
                  </ul>
                ) : !isAdding ? (
                  <div className="empty-state">
                    <KeyRound size={32} />
                    <h3>Nenhum acesso ainda</h3>
                    <p>Instagram, Meta, Google, hospedagem, chave de API. Tudo que a equipe precisa e hoje vive num print no WhatsApp.</p>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </main>
      {ConfirmDialog}
    </>
  );
}

// A senha nunca vem junto com a lista. Ela é buscada no momento em que alguém
// pede, e some da tela quando a linha é fechada.
function CredentialRow({
  credential,
  onRemove,
  onError,
}: {
  credential: ProjectCredential;
  onRemove: () => void;
  onError: (message: string) => void;
}) {
  const [secret, setSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function revelar() {
    if (secret !== null) return setSecret(null);
    setIsLoading(true);
    try {
      const response = await fetch(`/api/credentials/${credential.id}/reveal`, { method: "POST" });
      if (!response.ok) return onError(await responseError(response, "revelar a senha"));
      setSecret((await response.json()).secret ?? "");
    } catch {
      onError(networkError("revelar a senha"));
    } finally {
      setIsLoading(false);
    }
  }

  const kindLabel = CREDENTIAL_KINDS.find((item) => item.value === credential.kind)?.label || credential.kind;

  return (
    <li className="credencial-item">
      <div className="credencial-topo">
        <div>
          <strong>{credential.label}</strong>
          <small>{kindLabel}{credential.username ? ` · ${credential.username}` : ""}</small>
        </div>
        <div className="credencial-acoes">
          {credential.hasSecret ? (
            <button type="button" className="icon-button" onClick={revelar} disabled={isLoading} title={secret === null ? "Mostrar senha" : "Esconder senha"}>
              {isLoading ? <Loader2 size={13} className="ai-spin" /> : secret === null ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
          ) : null}
          <button type="button" className="icon-button" onClick={onRemove} title="Excluir acesso"><Trash2 size={13} /></button>
        </div>
      </div>
      {secret !== null ? <code className="credencial-secret">{secret || "sem senha guardada"}</code> : null}
      {credential.url ? <a className="credencial-url" href={credential.url} target="_blank" rel="noreferrer">{credential.url}</a> : null}
      {credential.notes ? <p className="credencial-notes">{credential.notes}</p> : null}
    </li>
  );
}

function CredentialForm({
  projectId,
  secretsConfigured,
  onCancel,
  onSaved,
  onError,
}: {
  projectId: string;
  secretsConfigured: boolean;
  onCancel: () => void;
  onSaved: (credential: ProjectCredential) => void;
  onError: (message: string) => void;
}) {
  const [form, setForm] = useState({ label: "", kind: "instagram", username: "", secret: "", url: "", notes: "" });
  const [isSaving, setIsSaving] = useState(false);

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (!form.label.trim()) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) return onError(await responseError(response, "salvar a credencial"));
      onSaved((await response.json()).credential);
    } catch {
      onError(networkError("salvar a credencial"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="credencial-form" onSubmit={salvar}>
      <div className="contrato-campos">
        <label className="contrato-campo">
          <span>Nome do acesso</span>
          <input autoFocus value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Instagram @casacaramelo" required />
        </label>
        <label className="contrato-campo">
          <span>Tipo</span>
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            {CREDENTIAL_KINDS.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
          </select>
        </label>
        <label className="contrato-campo">
          <span>Usuário</span>
          <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </label>
        <label className="contrato-campo">
          <span>Senha</span>
          <input
            type="password"
            autoComplete="new-password"
            value={form.secret}
            disabled={!secretsConfigured}
            onChange={(e) => setForm({ ...form, secret: e.target.value })}
            placeholder={secretsConfigured ? "" : "Chave de criptografia não configurada"}
          />
        </label>
        <label className="contrato-campo" style={{ gridColumn: "1 / -1" }}>
          <span>Link</span>
          <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://" />
        </label>
        <label className="contrato-campo" style={{ gridColumn: "1 / -1" }}>
          <span>Observação</span>
          <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Autenticação em dois fatores, quem é o titular, onde chega o código" />
        </label>
      </div>
      <div className="credencial-form-acoes">
        <button type="button" className="secondary-button" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="primary-button" disabled={isSaving || !form.label.trim()}>{isSaving ? "Salvando..." : "Guardar acesso"}</button>
      </div>
    </form>
  );
}
