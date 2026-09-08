"use client";

import { FileCheck2, FileText } from "lucide-react";
import { useState } from "react";
import { ContractDocument } from "@/components/contract-document";
import { Card, EmptyState, Tag } from "@/components/vz";
import { CONTRACT_TEMPLATES } from "@/lib/contract-templates";
import { CONTRACT_STATUSES, type Contract } from "@/lib/types";

export function ProjectDocuments({ contracts }: { contracts: Contract[] }) {
  const [selectedId, setSelectedId] = useState(contracts[0]?.id || "");
  const selected = contracts.find((contract) => contract.id === selectedId);
  const status = (contract: Contract) => CONTRACT_STATUSES.find((item) => item.value === contract.status)?.label || contract.status;
  return <div className="project-documents-layout">
    <Card className="project-documents-list"><div className="survey-section-head"><div><span className="vz-eyebrow">Arquivos vinculados</span><h2 className="vz-h2">Documentos</h2><p className="vz-caption">Visualização somente leitura</p></div><FileText size={20} /></div>
      {contracts.map((contract) => <button className={contract.id === selectedId ? "active" : ""} onClick={() => setSelectedId(contract.id)} key={contract.id}><span><FileCheck2 size={16} /><strong>{contract.title}</strong></span><small>Atualizado em {new Date(contract.updatedAt).toLocaleDateString("pt-BR")}</small><Tag tone={contract.status === "assinado" ? "green" : contract.status === "enviado" ? "amber" : "slate"}>{status(contract)}</Tag></button>)}
      {!contracts.length ? <EmptyState icon={<FileText size={24} />} title="Nenhum documento vinculado" description="Quando um contrato for associado a este projeto, ele aparecerá aqui." /> : null}
    </Card>
    {selected ? <Card className="project-document-preview"><div className="survey-section-head"><div><span className="vz-eyebrow">Documento</span><h2 className="vz-h2">{selected.title}</h2><p className="vz-caption">{status(selected)} · somente leitura</p></div></div><div className="project-document-scroll"><ContractDocument body={selected.body} fields={selected.fields} paymentMode={selected.paymentMode} paymentStructure={selected.paymentStructure} clientName={selected.fields.contratante_nome || selected.title} kindLabel={CONTRACT_TEMPLATES.find((item) => item.id === selected.templateId)?.label.toUpperCase() || "CONTRATO"} /></div></Card> : null}
  </div>;
}
