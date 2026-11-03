"use client";

// O que se faz com um mês fechado, nas duas pontas: o dono no Financeiro e a
// pessoa no Meu financeiro baixam o mesmo comprovante e veem a mesma nota.

import { Download, FileText, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/vz";
import { formatDateTime } from "@/lib/dates";
import { responseError } from "@/lib/request-error";
import type { Closing } from "@/lib/finance/types";

export function ReceiptButton({ closing, person }: { closing: Closing; person: { name: string; role?: string } }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    setBusy(true); setError("");
    try {
      const { buildReceiptPdf } = await import("@/lib/finance/statement-pdf");
      const { loadStatementAssets } = await import("@/lib/finance/statement-assets");
      const { pdf, filename } = buildReceiptPdf(closing, person, await loadStatementAssets());
      await pdf.save(filename, { returnPromise: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível gerar o comprovante.");
    } finally { setBusy(false); }
  }
  return <>
    <Button size="sm" variant="secondary" onClick={() => void download()} disabled={busy}><Download size={14} /> {busy ? "Gerando…" : "Comprovante"}</Button>
    {error ? <small className="fin-negative" role="alert">{error}</small> : null}
  </>;
}

export function InvoiceStatus({ closing }: { closing: Closing }) {
  if (!closing.invoiceUploadedAt) return <span className="fin-badge">Aguardando nota</span>;
  return <a className="fin-profile-link" href={`/api/financeiro/fechamentos/${closing.id}/nota`} target="_blank" rel="noreferrer" title={`Enviada em ${formatDateTime(closing.invoiceUploadedAt)}`}><FileText size={12} /> Ver nota</a>;
}

export function InvoiceUpload({ closing, onDone }: { closing: Closing; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send(file: File) {
    setBusy(true); setError("");
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(`/api/financeiro/fechamentos/${closing.id}/nota`, { method: "POST", body: form });
    setBusy(false);
    if (input.current) input.current.value = "";
    if (!response.ok) return setError(await responseError(response, "enviar a nota fiscal"));
    onDone();
  }
  return <>
    <input ref={input} type="file" hidden accept=".pdf,.xml,application/pdf,application/xml,text/xml,image/png,image/jpeg" onChange={(event) => { const file = event.target.files?.[0]; if (file) void send(file); }} />
    <Button size="sm" variant={closing.invoiceUploadedAt ? "secondary" : "primary"} onClick={() => input.current?.click()} disabled={busy}><Upload size={14} /> {busy ? "Enviando…" : closing.invoiceUploadedAt ? "Trocar nota" : "Enviar nota fiscal"}</Button>
    {error ? <small className="fin-negative" role="alert">{error}</small> : null}
  </>;
}
