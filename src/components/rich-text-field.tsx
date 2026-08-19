"use client";

import { useEffect, useRef, useState } from "react";
import { AutoTextarea } from "@/components/auto-textarea";
import { renderMarkdownLite } from "@/components/markdown-lite";

// Campo de texto das seções da descrição. Um <textarea> não consegue mostrar
// **negrito** formatado, então o campo tem dois estados: parado ele renderiza o
// markdown-lite; ao clicar (ou dar Tab até ele) vira o mesmo AutoTextarea de
// antes, com o texto cru, e sai da edição no blur.
//
// Só o modo de exibição é novo — a edição continua sendo textarea puro, então
// autosave, altura automática e o valor salvo no banco não mudam em nada.
export function RichTextField({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Entrou em edição: foca e deixa o cursor no fim, em vez de selecionar tudo
  // (um Ctrl+A acidental não apaga um roteiro inteiro).
  useEffect(() => {
    if (!editing) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  if (editing && !disabled) {
    return (
      <AutoTextarea
        ref={ref}
        className={className}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
      />
    );
  }

  const empty = !value.trim();
  return (
    <div
      className={`${className || ""} rich-text-view${empty ? " is-empty" : ""}${disabled ? " is-disabled" : ""}`}
      // Sem o disabled o campo continua alcançável por teclado, igual ao
      // textarea que ele substitui.
      tabIndex={disabled ? undefined : 0}
      role={disabled ? undefined : "textbox"}
      onClick={disabled ? undefined : () => setEditing(true)}
      onFocus={disabled ? undefined : () => setEditing(true)}
    >
      {empty ? placeholder : renderMarkdownLite(value)}
    </div>
  );
}
