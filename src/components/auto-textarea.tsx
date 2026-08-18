"use client";

import { useEffect, useRef } from "react";

// Textarea que cresce junto com o texto — roteiro longo não fica preso numa
// caixinha com barra de rolagem própria. A altura acompanha o conteúdo e
// quem rola é o corpo do modal, uma barra só.
export function AutoTextarea({
  value,
  minRows = 2,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string; minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return <textarea ref={ref} value={value} rows={minRows} {...props} />;
}
