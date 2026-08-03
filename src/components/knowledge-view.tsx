"use client";

import { BookOpen, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { KnowledgeDoc } from "@/lib/types";

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function KnowledgeView({ initialDocs }: { initialDocs: KnowledgeDoc[] }) {
  const [docs, setDocs] = useState(initialDocs);
  const [selectedId, setSelectedId] = useState<string | null>(initialDocs[0]?.id ?? null);
  const [title, setTitle] = useState(initialDocs[0]?.title ?? "");
  const [content, setContent] = useState(initialDocs[0]?.content ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [toast, setToast] = useState("");

  const selected = docs.find((doc) => doc.id === selectedId) || null;
  const dirty = selected ? title !== selected.title || content !== selected.content : Boolean(title || content);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function select(doc: KnowledgeDoc) {
    setSelectedId(doc.id);
    setTitle(doc.title);
    setContent(doc.content);
  }

  async function createDoc() {
    setIsCreating(true);
    const response = await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Novo documento", content: "" }),
    });
    const result = await response.json();
    setIsCreating(false);
    if (!response.ok) return showToast(result.error || "Não foi possível criar o documento.");
    setDocs((current) => [result.doc, ...current]);
    select(result.doc);
  }

  async function save() {
    if (!selected) return;
    if (!title.trim()) return showToast("Informe um título para o documento.");
    setIsSaving(true);
    const response = await fetch(`/api/knowledge/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    const result = await response.json();
    setIsSaving(false);
    if (!response.ok) return showToast(result.error || "Não foi possível salvar o documento.");
    setDocs((current) => current.map((doc) => (doc.id === result.doc.id ? result.doc : doc)));
    showToast("Documento salvo.");
  }

  async function remove() {
    if (!selected) return;
    if (!window.confirm(`Excluir o documento "${selected.title}"?`)) return;
    const response = await fetch(`/api/knowledge/${selected.id}`, { method: "DELETE" });
    if (!response.ok) return showToast("Não foi possível excluir o documento.");
    const remaining = docs.filter((doc) => doc.id !== selected.id);
    setDocs(remaining);
    if (remaining[0]) select(remaining[0]);
    else {
      setSelectedId(null);
      setTitle("");
      setContent("");
    }
    showToast("Documento excluído.");
  }

  return (
    <>
      <main className="admin-page dashboard">
        <div className="dashboard-head">
          <div>
            <span className="eyebrow">Operação</span>
            <h1>Base de conhecimento</h1>
            <p>Os processos e padrões da Vizantu que a IA usa como referência para te ajudar. Prefira vários documentos curtos e focados (um assunto por documento) a um só documento gigante — assim a IA acha e lê só o que precisa, sem gastar tokens abrindo tudo.</p>
          </div>
          <button className="primary-button" type="button" onClick={createDoc} disabled={isCreating}>
            <Plus size={14} /> Novo documento
          </button>
        </div>
        <div className="split-layout" style={{ gridTemplateColumns: "minmax(260px, .7fr) minmax(460px, 1.6fr)" }}>
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Documentos</h2>
                <p>{docs.length} {docs.length === 1 ? "documento" : "documentos"}</p>
              </div>
            </div>
            {docs.length ? (
              <ul className="project-list">
                {docs.map((doc) => (
                  <li
                    key={doc.id}
                    className="project-row knowledge-row"
                    style={{ gridTemplateColumns: "1fr", cursor: "pointer", background: doc.id === selectedId ? "#f6f1ff" : undefined }}
                    onClick={() => select(doc)}
                  >
                    <div className="project-row-title">
                      <strong>{doc.title || "Sem título"}</strong>
                      <span>{doc.content ? `Atualizado em ${formatUpdatedAt(doc.updatedAt)}` : "Ainda não documentado"}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                <BookOpen size={35} />
                <h3>Nenhum documento ainda</h3>
                <p>Crie o primeiro documento para começar a alinhar os processos com a IA.</p>
              </div>
            )}
          </section>

          <section className="panel">
            {selected ? (
              <>
                <div className="panel-head">
                  <input
                    className="meta-title-input"
                    style={{ fontSize: 18 }}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Título do documento"
                    maxLength={140}
                  />
                  <button className="icon-button" type="button" onClick={remove} title="Excluir documento" aria-label="Excluir documento">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="modal-body" style={{ padding: "20px 22px" }}>
                  <textarea
                    className="knowledge-editor"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Escreva aqui o passo a passo, os padrões ou o processo. Você também pode pedir para a IA escrever isso com você no chat."
                  />
                </div>
                <footer className="modal-actions">
                  <span style={{ color: "var(--muted-text)", fontSize: 11 }}>{dirty ? "Alterações não salvas" : "Tudo salvo"}</span>
                  <button className="primary-button" type="button" onClick={save} disabled={isSaving || !dirty}>
                    {isSaving ? "Salvando..." : "Salvar"}
                  </button>
                </footer>
              </>
            ) : (
              <div className="empty-state">
                <BookOpen size={35} />
                <h3>Selecione um documento</h3>
                <p>Ou crie um novo para começar a documentar.</p>
              </div>
            )}
          </section>
        </div>
      </main>
      {toast ? <div className="toast">{toast}</div> : null}
    </>
  );
}
