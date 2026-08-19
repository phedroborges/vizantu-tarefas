"use client";

import { Check, Copy, ExternalLink, Link2, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import type { ClientLink } from "@/lib/types";

// Link do painel do cliente — o mesmo mecanismo que existia no vizantu-planos:
// um endereço sem senha que abre /c/[token], credencia um cookie de sessão e
// leva o cliente pro painel onde ele aprova, pede ajuste ou reprova cada
// conteúdo do plano.
//
// O link é por PROJETO (o projeto é a conta do cliente), então ele vale pra
// todos os planos daquele cliente — trocar de plano não troca o endereço.
function isActive(link: ClientLink): boolean {
  if (link.revokedAt) return false;
  return !link.expiresAt || new Date(link.expiresAt).getTime() > Date.now();
}

export function ClientLinkPanel({
  projectId,
  projectName,
  canEdit,
  onToast,
}: {
  projectId: string;
  projectName: string;
  canEdit: boolean;
  onToast: (message: string) => void;
}) {
  const [link, setLink] = useState<ClientLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  const url = link ? `${typeof window === "undefined" ? "" : window.location.origin}/c/${link.token}` : "";

  // Hidrata do servidor: sem isso o botão só conhecia links criados na sessão
  // atual e, a cada reload, oferecia "gerar" de novo pra um projeto que já
  // tinha link.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/link`);
        if (!response.ok) return;
        const result = await response.json();
        if (alive) setLink((result.links as ClientLink[]).find(isActive) ?? null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  const copy = useCallback(
    async (value: string) => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
        onToast("Link copiado.");
      } catch {
        onToast("Não foi possível copiar — selecione o link e copie manualmente.");
      }
    },
    [onToast],
  );

  async function generate() {
    setBusy(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/link`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) return onToast("Não foi possível gerar o link.");
      setLink(result.link);
      await copy(`${window.location.origin}/c/${result.link.token}`);
    } finally {
      setBusy(false);
    }
  }

  async function rotate() {
    const ok = await confirm({
      title: "Gerar um link novo",
      message: `O link atual de ${projectName} deixa de funcionar na hora. Quem já tiver o endereço antigo perde o acesso e você precisa enviar o novo.`,
      confirmLabel: "Gerar novo link",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/link?rotate=1`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) return onToast("Não foi possível gerar o link.");
      setLink(result.link);
      await copy(`${window.location.origin}/c/${result.link.token}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head">
          <div>
            <h2><Link2 size={15} style={{ verticalAlign: -2 }} /> Link do cliente</h2>
            <p>Endereço sem senha para {projectName} acompanhar o planejamento e aprovar, pedir ajuste ou reprovar cada conteúdo.</p>
          </div>
        </div>
        <div className="client-link-row">
          {loading ? (
            <span className="plan-item-empty"><Loader2 size={13} className="spin" /> Carregando…</span>
          ) : link ? (
            <>
              <code className="client-link-url" title={url}>{url}</code>
              <button type="button" className="secondary-button" onClick={() => copy(url)}>
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copiado" : "Copiar"}
              </button>
              <a className="secondary-button" href={url} target="_blank" rel="noreferrer">
                <ExternalLink size={13} /> Abrir
              </a>
              {canEdit ? (
                <button type="button" className="secondary-button" onClick={rotate} disabled={busy} title="Invalida o link atual e cria outro">
                  <RefreshCw size={13} /> Gerar novo
                </button>
              ) : null}
            </>
          ) : canEdit ? (
            <>
              <span className="plan-item-empty">Nenhum link gerado ainda.</span>
              <button type="button" className="secondary-button" onClick={generate} disabled={busy}>
                {busy ? <Loader2 size={13} className="spin" /> : <Link2 size={13} />} Gerar link do cliente
              </button>
            </>
          ) : (
            <span className="plan-item-empty">Nenhum link gerado ainda.</span>
          )}
        </div>
      </section>
      {ConfirmDialog}
    </>
  );
}
