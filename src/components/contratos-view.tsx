"use client";

import { FileText, Plus, Printer, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ContractDocument } from "@/components/contract-document";
import { useConfirm } from "@/components/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CONTRACT_FIELDS, CONTRACT_TEMPLATES, type ContractTemplateId, type PaymentMode } from "@/lib/contract-templates";
import { renderContract } from "@/lib/contract-render";
import { networkError, responseError } from "@/lib/request-error";
import { CONTRACT_STATUSES, type Contract, type Project } from "@/lib/types";

const AUTOSAVE_MS = 700;

// Só os campos que ESTE contrato realmente usa. O de criação de marca não
// pergunta quantos vídeos por mês, e o modelo em branco não pergunta quase
// nada — perguntar o que o texto não usa é fazer alguém preencher à toa.
function usedFieldKeys(body: string): Set<string> {
  const keys = new Set<string>();
  for (const match of body.matchAll(/\{\{(\w+)\}\}/g)) keys.add(match[1]);
  return keys;
}

function valoresIniciais(): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const field of CONTRACT_FIELDS) if (field.padrao) fields[field.key] = field.padrao;
  return fields;
}

const GRUPOS: { key: "cliente" | "contrato" | "escopo"; label: string; hint: string }[] = [
  { key: "cliente", label: "Dados do cliente", hint: "O que muda em todo contrato novo" },
  { key: "contrato", label: "Condições", hint: "Vigência, valor e datas" },
  { key: "escopo", label: "Escopo", hint: "Já vem preenchido com o padrão da casa" },
];

export function ContratosView({ initialContracts, projects }: { initialContracts: Contract[]; projects: Project[] }) {
  const [contracts, setContracts] = useState(initialContracts);
  const [selectedId, setSelectedId] = useState<string | null>(initialContracts[0]?.id ?? null);
  const [isCreating, setIsCreating] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const [editingBody, setEditingBody] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const selected = contracts.find((contract) => contract.id === selectedId) || null;

  const { missing, campos } = useMemo(() => {
    if (!selected) return { missing: [] as string[], campos: [] as typeof CONTRACT_FIELDS };
    const usadas = usedFieldKeys(selected.body);
    return {
      missing: renderContract(selected.body, selected.fields, selected.paymentMode).missing,
      campos: CONTRACT_FIELDS.filter((field) => usadas.has(field.key)),
    };
  }, [selected]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  async function persist(id: string, patch: Partial<Contract>) {
    setSaveState("saving");
    try {
      const response = await fetch(`/api/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        setSaveState("error");
        setError(await responseError(response, "salvar o contrato"));
        return;
      }
      const { contract } = await response.json();
      setContracts((current) => current.map((item) => (item.id === contract.id ? contract : item)));
      setError("");
      setSaveState("saved");
    } catch {
      setSaveState("error");
      setError(networkError("salvar o contrato"));
    }
  }

  // Edição local imediata, gravação com folga — o mesmo comportamento do modal
  // de tarefa, pra ninguém ter que aprender uma segunda regra de salvamento.
  function patchSelected(patch: Partial<Contract>, options?: { immediate?: boolean }) {
    if (!selected) return;
    const atualizado = { ...selected, ...patch };
    setContracts((current) => current.map((item) => (item.id === selected.id ? atualizado : item)));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (options?.immediate) persist(selected.id, patch);
    else debounceRef.current = setTimeout(() => persist(selected.id, patch), AUTOSAVE_MS);
  }

  function setField(key: string, value: string) {
    if (!selected) return;
    patchSelected({ fields: { ...selected.fields, [key]: value } });
  }

  async function criar(input: { title: string; templateId: ContractTemplateId; paymentMode: PaymentMode; projectId: string }) {
    setIsCreating(false);
    try {
      const response = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, projectId: input.projectId || null, fields: valoresIniciais() }),
      });
      if (!response.ok) return setError(await responseError(response, "criar o contrato"));
      const { contract } = await response.json();
      setContracts((current) => [contract, ...current]);
      setSelectedId(contract.id);
      setError("");
    } catch {
      setError(networkError("criar o contrato"));
    }
  }

  async function excluir() {
    if (!selected) return;
    if (!(await confirm({ title: "Excluir contrato", message: `Excluir o contrato "${selected.title}"? Essa ação não pode ser desfeita.`, confirmLabel: "Excluir", danger: true }))) return;
    const response = await fetch(`/api/contracts/${selected.id}`, { method: "DELETE" });
    if (!response.ok) return setError(await responseError(response, "excluir o contrato"));
    const restantes = contracts.filter((item) => item.id !== selected.id);
    setContracts(restantes);
    setSelectedId(restantes[0]?.id ?? null);
  }

  // Exportar em PDF é imprimir: o navegador já sabe gerar PDF, e o CSS de
  // impressão manda só o documento pra folha. Sem biblioteca, sem servidor
  // gerando arquivo, e o resultado é o mesmo texto que está na tela.
  function exportarPdf() {
    window.print();
  }

  const projetoLabel = (id?: string) => projects.find((project) => project.id === id)?.name || "";

  return (
    <>
      <main className="admin-page dashboard contratos-page">
        <div className="dashboard-head no-print">
          <div>
            <span className="eyebrow">Comercial</span>
            <h1>Contratos</h1>
            <p>Os modelos da casa prontos para receber os dados do cliente novo. O texto de cada contrato é uma cópia do modelo feita na criação, então melhorar um modelo depois nunca mexe em contrato já assinado.</p>
          </div>
          <button className="primary-button" type="button" onClick={() => setIsCreating(true)}>
            <Plus size={14} /> Novo contrato
          </button>
        </div>

        {error ? <div className="form-message no-print">{error}</div> : null}

        <div className="split-layout contratos-split">
          <section className="panel no-print">
            <div className="panel-head">
              <div>
                <h2>Contratos</h2>
                <p>{contracts.length} {contracts.length === 1 ? "contrato" : "contratos"}</p>
              </div>
            </div>
            {contracts.length ? (
              <ul className="project-list">
                {contracts.map((contract) => (
                  <li
                    key={contract.id}
                    className="project-row knowledge-row"
                    style={{ gridTemplateColumns: "1fr", cursor: "pointer", background: contract.id === selectedId ? "#f6f1ff" : undefined }}
                    onClick={() => setSelectedId(contract.id)}
                  >
                    <div className="project-row-title">
                      <strong>{contract.title || "Sem título"}</strong>
                      <span>
                        {CONTRACT_TEMPLATES.find((t) => t.id === contract.templateId)?.label || contract.templateId}
                        {" · "}
                        {CONTRACT_STATUSES.find((s) => s.value === contract.status)?.label}
                        {projetoLabel(contract.projectId) ? ` · ${projetoLabel(contract.projectId)}` : ""}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                <FileText size={35} />
                <h3>Nenhum contrato ainda</h3>
                <p>Crie o primeiro a partir de um modelo e preencha só os dados do cliente.</p>
              </div>
            )}
          </section>

          <section className="panel contrato-painel">
            {selected ? (
              <>
                <div className="panel-head contrato-toolbar no-print">
                  <input
                    className="meta-title-input"
                    style={{ fontSize: 17 }}
                    value={selected.title}
                    onChange={(e) => patchSelected({ title: e.target.value })}
                    placeholder="Nome do contrato"
                    maxLength={140}
                  />
                  <span className="task-save-status" aria-live="polite">
                    {saveState === "saving" ? "Salvando..." : saveState === "saved" ? "Salvo" : saveState === "error" ? "Erro ao salvar" : ""}
                  </span>
                  <select
                    className="meta-date"
                    value={selected.status}
                    onChange={(e) => patchSelected({ status: e.target.value as Contract["status"] }, { immediate: true })}
                  >
                    {CONTRACT_STATUSES.map((status) => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                  <button type="button" className="secondary-button" onClick={exportarPdf}>
                    <Printer size={13} /> Exportar PDF
                  </button>
                  <button type="button" className="icon-button" onClick={excluir} title="Excluir contrato" aria-label="Excluir contrato">
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="modal-body contrato-corpo">
                  <div className="no-print">
                    {missing.length ? (
                      <p className="contrato-pendencias">
                        Faltam {missing.length} {missing.length === 1 ? "campo" : "campos"}. Eles aparecem marcados no documento.
                      </p>
                    ) : (
                      <p className="contrato-pronto">Contrato completo, pronto para exportar.</p>
                    )}

                    {GRUPOS.map((grupo) => {
                      const doGrupo = campos.filter((field) => field.group === grupo.key);
                      if (!doGrupo.length) return null;
                      return (
                        <section className="contrato-grupo" key={grupo.key}>
                          <h4>{grupo.label} <small>{grupo.hint}</small></h4>
                          <div className="contrato-campos">
                            {doGrupo.map((field) => (
                              <label className="contrato-campo" key={field.key}>
                                <span>{field.label}</span>
                                {field.type === "linhas" ? (
                                  <textarea
                                    rows={2}
                                    value={selected.fields[field.key] || ""}
                                    onChange={(e) => setField(field.key, e.target.value)}
                                    placeholder={field.hint}
                                  />
                                ) : (
                                  <input
                                    type={field.type === "data" ? "date" : "text"}
                                    inputMode={field.type === "numero" ? "decimal" : undefined}
                                    value={selected.fields[field.key] || ""}
                                    onChange={(e) => setField(field.key, e.target.value)}
                                    placeholder={field.hint}
                                  />
                                )}
                                {field.hint && field.type !== "linhas" ? <small>{field.hint}</small> : null}
                              </label>
                            ))}
                          </div>
                        </section>
                      );
                    })}

                    <div className="contrato-grupo">
                      <h4>Projeto <small>Opcional, só para achar o contrato depois</small></h4>
                      <select
                        className="meta-date"
                        value={selected.projectId || ""}
                        onChange={(e) => patchSelected({ projectId: e.target.value || undefined }, { immediate: true })}
                      >
                        <option value="">Sem projeto</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>{project.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="contrato-grupo">
                      <h4>
                        Texto das cláusulas
                        <button type="button" className="desc-add-button" onClick={() => setEditingBody((v) => !v)}>
                          {editingBody ? "Fechar" : "Editar"}
                        </button>
                      </h4>
                      {editingBody ? (
                        <>
                          <p className="contrato-dica">
                            Este texto é só deste contrato. As marcações são: # título, ## cláusula, - item de lista, **negrito** e {"{{campo}}"} para o que vem dos dados acima.
                          </p>
                          <textarea
                            className="knowledge-editor"
                            value={selected.body}
                            onChange={(e) => patchSelected({ body: e.target.value })}
                          />
                        </>
                      ) : null}
                    </div>
                  </div>

                  <ContractDocument
                    body={selected.body}
                    fields={selected.fields}
                    paymentMode={selected.paymentMode}
                    clientName={selected.fields.contratante_nome || selected.title}
                    kindLabel={CONTRACT_TEMPLATES.find((t) => t.id === selected.templateId)?.label.toUpperCase() || ""}
                  />
                </div>
              </>
            ) : (
              <div className="empty-state">
                <FileText size={35} />
                <h3>Selecione um contrato</h3>
                <p>Ou crie um novo a partir de um modelo.</p>
              </div>
            )}
          </section>
        </div>
      </main>
      {isCreating ? <NovoContratoModal projects={projects} onClose={() => setIsCreating(false)} onCreate={criar} /> : null}
      {ConfirmDialog}
    </>
  );
}

function NovoContratoModal({
  projects,
  onClose,
  onCreate,
}: {
  projects: Project[];
  onClose: () => void;
  onCreate: (input: { title: string; templateId: ContractTemplateId; paymentMode: PaymentMode; projectId: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState<ContractTemplateId>("gestao_marca");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("pre");
  const [projectId, setProjectId] = useState("");
  const template = CONTRACT_TEMPLATES.find((t) => t.id === templateId);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="!max-w-[560px] w-[calc(100%-2rem)]">
        <DialogHeader className="modal-head">
          <DialogTitle>Novo contrato</DialogTitle>
        </DialogHeader>
        <form
          className="modal-body"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            onCreate({ title, templateId, paymentMode, projectId });
          }}
        >
          <div className="field">
            <label htmlFor="contrato-nome">Nome do contrato</label>
            <input id="contrato-nome" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contrato · Gestão de marca · Target" maxLength={140} required />
          </div>

          <div className="field">
            <label>Modelo</label>
            <div className="contrato-modelos">
              {CONTRACT_TEMPLATES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={templateId === option.id ? "contrato-modelo is-on" : "contrato-modelo"}
                  onClick={() => setTemplateId(option.id)}
                >
                  <strong>{option.label}</strong>
                  <small>{option.descricao}</small>
                </button>
              ))}
            </div>
          </div>

          {template?.id !== "branco" ? (
            <div className="field">
              <label>Pagamento</label>
              <div className="kind-toggle" role="group" aria-label="Forma de pagamento">
                <button type="button" className={paymentMode === "pre" ? "is-on" : ""} onClick={() => setPaymentMode("pre")}>Pré-pago</button>
                <button type="button" className={paymentMode === "pos" ? "is-on" : ""} onClick={() => setPaymentMode("pos")}>Pós-pago</button>
              </div>
              <small className="qt-hint">
                {paymentMode === "pre"
                  ? "Paga antes do mês de execução, e a produção começa depois da confirmação."
                  : "Paga dentro do mês de execução, no dia combinado."}
              </small>
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="contrato-projeto">Projeto</label>
            <select id="contrato-projeto" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Sem projeto</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>

          <footer className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
            <button type="submit" className="primary-button" disabled={!title.trim()}>Criar contrato</button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
