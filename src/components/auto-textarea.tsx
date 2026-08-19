"use client";

import { useEffect, useRef } from "react";

// Textarea que cresce junto com o texto — roteiro longo não fica preso numa
// caixinha com barra de rolagem própria. A altura acompanha o conteúdo e
// quem rola é o corpo do modal, uma barra só.
export function AutoTextarea({
  value,
  minRows = 2,
  ref: forwardedRef,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  value: string;
  minRows?: number;
  ref?: React.Ref<HTMLTextAreaElement>;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  // O ref interno controla a altura; quem usa o componente ainda pode pedir o
  // seu próprio ref (o RichTextField precisa dele pra focar ao entrar em edição).
  return (
    <textarea
      ref={(node) => {
        ref.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      value={value}
      rows={minRows}
      {...props}
    />
  );
}
