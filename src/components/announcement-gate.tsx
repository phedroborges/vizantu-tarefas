"use client";

import { Megaphone } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Announcement } from "@/lib/types";

// Renderizado uma vez em AdminShell (presente em toda página autenticada) —
// busca os avisos ainda não confirmados PARA este usuário e mostra um modal
// bloqueante: sem botão de fechar, sem fechar no ESC, sem fechar clicando
// fora (Dialog fica sempre "open" enquanto houver pendência, e não recebe
// onOpenChange — nada faz ele fechar sozinho). Só o botão "Ok, entendi"
// grava o ack; aí passa pro próximo pendente, se houver, ou desmonta.
export function AnnouncementGate() {
  const [queue, setQueue] = useState<Announcement[]>([]);
  const [acking, setAcking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/announcements?pending=1")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.announcements)) setQueue(data.announcements);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const current = queue[0];
  if (!current) return null;

  async function ack() {
    if (acking) return;
    setAcking(true);
    await fetch(`/api/announcements/${current.id}/ack`, { method: "POST" });
    setAcking(false);
    setQueue((q) => q.slice(1));
  }

  return (
    // Controlado sempre aberto, cancelando qualquer tentativa de fechar (ESC,
    // clique fora) — só o botão "Ok, entendi" avança a fila via ack().
    <Dialog open onOpenChange={(_open, eventDetails) => eventDetails.cancel()} disablePointerDismissal>
      <DialogContent showCloseButton={false} className="!max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Megaphone size={17} /> {current.title || "Aviso"}</DialogTitle>
        </DialogHeader>
        <p style={{ whiteSpace: "pre-wrap", margin: "4px 0 16px", fontSize: 13, lineHeight: 1.5 }}>{current.body}</p>
        <button type="button" className="primary-button" style={{ width: "100%" }} onClick={ack} disabled={acking}>
          {acking ? "Confirmando..." : "Ok, entendi"}
        </button>
        {queue.length > 1 ? (
          <p style={{ textAlign: "center", fontSize: 11, color: "var(--muted-text)", marginTop: 8 }}>
            +{queue.length - 1} aviso{queue.length - 1 > 1 ? "s" : ""} depois deste
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
