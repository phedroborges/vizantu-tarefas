"use client";

import { ArrowLeft, AtSign, BarChart3, CheckCircle2, Clock3, Eye, EyeOff, KeyRound, Loader2, MapPin, Plus, ShieldAlert, Target, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import { networkError, responseError } from "@/lib/request-error";
import { CREDENTIAL_KINDS, type Project, type ProjectCredential, type ProjectProfile } from "@/lib/types";
import type { ClientSatisfactionScore, Task } from "@/lib/types";
import { Avatar } from "@/components/avatar";
import { ProjectTaskHub } from "@/components/project-task-hub";
import { Button, Card, EmptyState, Field, Input, Progress, Tag, Textarea } from "@/components/vz";

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
  initialTasks,
  satisfactionScores,
  canEditProfile,
}: {
  project: Project;
  initialProfile: ProjectProfile | null;
  initialCredentials: ProjectCredential[];
  canManageCredentials: boolean;
  secretsConfigured: boolean;
  initialTasks: Task[];
  satisfactionScores: ClientSatisfactionScore[];
  canEditProfile: boolean;
}) {
  const [profile, setProfile] = useState<Partial<ProjectProfile>>(initialProfile ?? {});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [credentials, setCredentials] = useState(initialCredentials);
  const [error, setError] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();
  const done = initialTasks.filter((task) => task.status === "finalizado").length;
  const overdue = initialTasks.filter((task) => task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10) && task.status !== "finalizado").length;
  const completion = initialTasks.length ? Math.round(done / initialTasks.length * 100) : 0;
  const nps = satisfactionScores.length ? Math.round(((satisfactionScores.filter((item) => item.score >= 9).length - satisfactionScores.filter((item) => item.score <= 6).length) / satisfactionScores.length) * 100) : null;

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
    if (!canEditProfile) return;
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
        <section className="project-profile-hero" style={{ "--project-accent": project.avatarColor || "var(--vz-brand)" } as React.CSSProperties}>
          <div className="project-profile-hero__cover"><Link href="/projetos" className="project-profile-back"><ArrowLeft size={14} /> Todos os projetos</Link></div>
          <div className="project-profile-hero__main">
            <Avatar name={project.name} imageUrl={project.avatarUrl} color={project.avatarColor} size={92} className="project-profile-hero__avatar" />
            <div className="project-profile-hero__copy"><div><Tag tone={project.status === "ativo" ? "green" : project.status === "pausado" ? "amber" : "slate"}>{project.status === "concluido" ? "Concluído" : project.status === "pausado" ? "Pausado" : "Ativo"}</Tag></div><h1>{project.name}</h1><p>{project.client || "Projeto interno"}</p><div className="project-profile-facts">{project.clientRole ? <span><UserRound size={14} />{project.clientRole}</span> : null}{project.clientCity ? <span><MapPin size={14} />{project.clientCity}</span> : null}{project.clientInstagram ? <span><AtSign size={14} />{project.clientInstagram}</span> : null}</div></div>
          <span className="task-save-status" aria-live="polite">
            {saveState === "saving" ? "Salvando..." : saveState === "saved" ? "Salvo" : saveState === "error" ? "Erro ao salvar" : ""}
          </span>
          </div>
        </section>

        {error ? <div className="form-message">{error}</div> : null}

        <div className="project-metrics">
          <Card><div className="vz-metric"><div className="vz-metric__top"><span className="vz-metric__icon"><BarChart3 size={18} /></span><div><strong className="vz-metric__value">{initialTasks.length}</strong><span className="vz-metric__label">Tarefas totais</span></div></div></div></Card>
          <Card><div className="vz-metric"><div className="vz-metric__top"><span className="vz-metric__icon vz-metric__icon--green"><CheckCircle2 size={18} /></span><div><strong className="vz-metric__value">{completion}%</strong><span className="vz-metric__label">Conclusão</span></div></div><Progress value={completion} thin tone="green" /></div></Card>
          <Card><div className="vz-metric"><div className="vz-metric__top"><span className="vz-metric__icon vz-metric__icon--red"><Clock3 size={18} /></span><div><strong className="vz-metric__value">{overdue}</strong><span className="vz-metric__label">Tarefas atrasadas</span></div></div></div></Card>
          <Card><div className="vz-metric"><div className="vz-metric__top"><span className="vz-metric__icon vz-metric__icon--blue"><Target size={18} /></span><div><strong className="vz-metric__value">{nps === null ? "—" : nps > 0 ? `+${nps}` : nps}</strong><span className="vz-metric__label">NPS · {satisfactionScores.length} resposta{satisfactionScores.length === 1 ? "" : "s"}</span></div></div></div></Card>
        </div>

        <ProjectTaskHub tasks={initialTasks} />

        <div className="project-profile-grid">
          <Card className="project-context-card">
            <div className="project-section-head"><div><span className="vz-eyebrow">Conhecimento compartilhado</span><h2 className="vz-h2">Contexto do cliente</h2><p className="vz-caption">Salvo automaticamente enquanto você escreve.</p></div></div>
            <div className="project-context-body">
              <div className="project-fields-grid">
                {CAMPOS.map((campo) => (
                  <Field label={campo.label} hint={campo.hint} key={campo.key}>
                    <Input
                      disabled={!canEditProfile}
                      value={(profile[campo.key] as string) || ""}
                      onChange={(e) => setCampo(campo.key, e.target.value)}
                      placeholder={campo.hint}
                    />
                  </Field>
                ))}
              </div>

              {TEXTOS.map((campo) => (
                <Field label={campo.label} hint={campo.hint} key={campo.key}>
                  <Textarea rows={5}
                    disabled={!canEditProfile}
                    value={(profile[campo.key] as string) || ""}
                    onChange={(e) => setCampo(campo.key, e.target.value)}
                  />
                </Field>
              ))}
            </div>
          </Card>

          <Card className="project-credentials-card">
            <div className="project-section-head">
              <div>
                <h2><KeyRound size={14} /> Acessos</h2>
                <p>{credentials.length} {credentials.length === 1 ? "acesso guardado" : "acessos guardados"}</p>
              </div>
              {canManageCredentials ? (
                <Button type="button" variant="secondary" onClick={() => setIsAdding(true)}><Plus size={13} /> Novo acesso</Button>
              ) : null}
            </div>

            {!canManageCredentials ? (
              <EmptyState icon={<ShieldAlert size={24} />} title="Acessos são do dono" description="Senha de cliente é acesso à casa dele. Só o dono da conta vê e edita." />
            ) : (
              <div className="project-credentials-body">
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
                  <EmptyState icon={<KeyRound size={24} />} title="Nenhum acesso ainda" description="Instagram, Meta, Google, hospedagem ou chave de API — seguros e disponíveis para o time autorizado." />
                ) : null}
              </div>
            )}
          </Card>
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
