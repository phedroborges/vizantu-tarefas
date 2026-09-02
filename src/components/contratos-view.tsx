"use client";

import { FileText, Plus, Printer, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ContractAssistant } from "@/components/contract-assistant";
import { ContractDocument } from "@/components/contract-document";
import { useConfirm } from "@/components/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CONTRACT_FIELDS, CONTRACT_TEMPLATES, PAYMENT_STRUCTURES, defaultStructure, type ContractTemplateId, type PaymentMode, type PaymentStructure } from "@/lib/contract-templates";
import { contractTotal, parseFaixas, renderContract } from "@/lib/contract-render";
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
    const escalonado = selected.paymentStructure === "escalonado";
    // Num contrato escalonado a vigência sai da soma das faixas, então o campo
    // de meses deixa de existir: mostrá-lo seria oferecer um número que o
    // documento ignora.
    if (escalonado) { usadas.add("escalonamento"); usadas.delete("vigencia_meses"); usadas.delete("valor_mensal"); }
    else usadas.delete("escalonamento");
    return {
      missing: renderContract(selected.body, selected.fields, selected.paymentMode, selected.paymentStructure).missing,
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

  async function criar(input: { title: string; templateId: ContractTemplateId; paymentMode: PaymentMode; paymentStructure: PaymentStructure; projectId: string }) {
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
                        {/* O valor primeiro: é o que se procura numa lista de
                            contratos. Sem valor calculável, diz que falta em
                            vez de mostrar R$ 0,00. */}
                        <strong className="contrato-valor">
                          {contractTotal(contract.fields, contract.paymentMode, contract.paymentStructure) || "sem valor"}
                        </strong>
                        {" · "}
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

                    <section className="contrato-grupo">
                      <h4>Estrutura de pagamento <small>Trocar aqui reescreve só a cláusula 3</small></h4>
                      <div className="contrato-modelos contrato-modelos-linha">
                        {PAYMENT_STRUCTURES.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className={selected.paymentStructure === option.id ? "contrato-modelo is-on" : "contrato-modelo"}
                            onClick={() => patchSelected({ paymentStructure: option.id }, { immediate: true })}
                          >
                            <strong>{option.label}</strong>
                            <small>{option.descricao}</small>
                          </button>
                        ))}
                      </div>
                      <div className="kind-toggle" role="group" aria-label="Quando paga" style={{ marginTop: 8 }}>
                        <button type="button" className={selected.paymentMode === "pre" ? "is-on" : ""} onClick={() => patchSelected({ paymentMode: "pre" }, { immediate: true })}>Pré-pago</button>
                        <button type="button" className={selected.paymentMode === "pos" ? "is-on" : ""} onClick={() => patchSelected({ paymentMode: "pos" }, { immediate: true })}>Pós-pago</button>
                      </div>
                    </section>

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
                                {field.type === "faixas" ? (
                                  <FaixasEditor
                                    value={selected.fields[field.key] || ""}
                                    onChange={(value) => setField(field.key, value)}
                                  />
                                ) : field.type === "linhas" ? (
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

                  <ContractAssistant
                    key={selected.id}
                    contract={selected}
                    onContractUpdated={(atualizado) =>
                      setContracts((current) => current.map((item) => (item.id === atualizado.id ? atualizado : item)))
                    }
                  />

                  <ContractDocument
                    body={selected.body}
                    fields={selected.fields}
                    paymentMode={selected.paymentMode}
                    paymentStructure={selected.paymentStructure}
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
  onCreate: (input: { title: string; templateId: ContractTemplateId; paymentMode: PaymentMode; paymentStructure: PaymentStructure; projectId: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState<ContractTemplateId>("gestao_marca");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("pre");
  const [paymentStructure, setPaymentStructure] = useState<PaymentStructure>("mensal");
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
            onCreate({ title, templateId, paymentMode, paymentStructure, projectId });
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
                  onClick={() => { setTemplateId(option.id); setPaymentStructure(defaultStructure(option.id)); }}
                >
                  <strong>{option.label}</strong>
                  <small>{option.descricao}</small>
                </button>
              ))}
            </div>
          </div>

          {template?.id !== "branco" ? (
            <div className="field">
              <label>Estrutura de pagamento</label>
              <div className="contrato-modelos contrato-modelos-linha">
                {PAYMENT_STRUCTURES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={paymentStructure === option.id ? "contrato-modelo is-on" : "contrato-modelo"}
                    onClick={() => setPaymentStructure(option.id)}
                  >
                    <strong>{option.label}</strong>
                    <small>{option.descricao}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {template?.id !== "branco" ? (
            <div className="field">
              <label>Quando paga</label>
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


// As faixas de um contrato escalonado. Uma linha por degrau, com os meses
// acumulando na etiqueta ("do 4º ao 6º mês") pra ficar óbvio onde cada valor
// começa a valer sem ninguém precisar somar de cabeça.
function FaixasEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const faixas = parseFaixas(value);
  const linhas = faixas.length ? faixas : [{ meses: 0, valor: 0 }];

  function grava(proximas: { meses: number; valor: number }[]) {
    onChange(proximas.filter((f) => f.meses > 0 || f.valor > 0).map((f) => `${f.meses} x ${f.valor}`).join("\n"));
  }

  // Onde cada degrau começa e termina, calculado ANTES de renderizar: somar
  // dentro do map obrigaria a mutar uma variável durante a renderização.
  const intervalos: { inicio: number; fim: number }[] = [];
  linhas.reduce((mes, faixa) => {
    const fim = mes + Math.max(faixa.meses, 1) - 1;
    intervalos.push({ inicio: mes, fim });
    return fim + 1;
  }, 1);

  return (
    <div className="contrato-faixas">
      {linhas.map((faixa, index) => {
        const { inicio, fim } = intervalos[index];
        return (
          <div className="contrato-faixa" key={index}>
            <input
              type="text"
              inputMode="numeric"
              aria-label="Meses"
              value={faixa.meses || ""}
              placeholder="meses"
              onChange={(e) => grava(linhas.map((f, i) => (i === index ? { ...f, meses: Number(e.target.value.replace(/\D/g, "")) || 0 } : f)))}
            />
            <span>meses x R$</span>
            <input
              type="text"
              inputMode="decimal"
              aria-label="Valor por mês"
              value={faixa.valor || ""}
              placeholder="valor"
              onChange={(e) => grava(linhas.map((f, i) => (i === index ? { ...f, valor: Number(e.target.value.replace(/[^\d]/g, "")) || 0 } : f)))}
            />
            <small>{faixa.meses ? (inicio === fim ? `${inicio}º mês` : `${inicio}º ao ${fim}º`) : ""}</small>
            {linhas.length > 1 ? (
              <button type="button" onClick={() => grava(linhas.filter((_, i) => i !== index))} aria-label="Remover faixa">×</button>
            ) : null}
          </div>
        );
      })}
      <button type="button" className="desc-add-button" onClick={() => grava([...linhas, { meses: 0, valor: 0 }])}>
        + Faixa
      </button>
    </div>
  );
}
