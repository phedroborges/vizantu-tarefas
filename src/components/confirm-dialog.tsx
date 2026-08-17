"use client";

import { useCallback, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ConfirmOptions = { title?: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type PendingConfirm = ConfirmOptions & { resolve: (value: boolean) => void };

// Substitui window.confirm() por um modal do próprio app — mesma ergonomia
// (await confirm("mensagem") devolve true/false), só que sem o balão feio do
// Chrome. Um componente por tela: const { confirm, ConfirmDialog } =
// useConfirm(); depois {ConfirmDialog} em algum lugar do JSX.
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions | string) => {
    const opts = typeof options === "string" ? { message: options } : options;
    return new Promise<boolean>((resolve) => setPending({ ...opts, resolve }));
  }, []);

  function close(result: boolean) {
    pending?.resolve(result);
    setPending(null);
  }

  const ConfirmDialog = pending ? (
    <Dialog open onOpenChange={(open) => !open && close(false)}>
      <DialogContent showCloseButton={false} className="!max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{pending.title || "Confirmar"}</DialogTitle>
        </DialogHeader>
        <p style={{ fontSize: 13, lineHeight: 1.5, margin: "6px 0 18px", color: "var(--muted-text)" }}>{pending.message}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="secondary-button" onClick={() => close(false)}>{pending.cancelLabel || "Cancelar"}</button>
          <button type="button" className={pending.danger ? "danger-button" : "primary-button"} onClick={() => close(true)}>
            {pending.confirmLabel || "Confirmar"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  ) : null;

  return { confirm, ConfirmDialog };
}
