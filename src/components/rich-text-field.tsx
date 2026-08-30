"use client";

import { useEffect, useRef, useState } from "react";
import { AutoTextarea } from "@/components/auto-textarea";
import { renderMarkdownLite } from "@/components/markdown-lite";
import { imageMarkdown, imagesFromTransfer, uploadImageFile } from "@/lib/upload-image";

// Campo de texto das seções da descrição. Um <textarea> não consegue mostrar
// **negrito** formatado, então o campo tem dois estados: parado ele renderiza o
// markdown-lite; ao clicar (ou dar Tab até ele) vira o mesmo AutoTextarea de
// antes, com o texto cru, e sai da edição no blur.
//
// Só o modo de exibição é novo — a edição continua sendo textarea puro, então
// autosave, altura automática e o valor salvo no banco não mudam em nada.
//
// Imagem entra por Ctrl+V ou arrastando, direto no ponto do cursor: sobe pro
// storage e vira um ![](url) no texto. É por isso que a imagem fica ONDE foi
// colada, em vez de ir pra faixa de anexos no topo da tarefa.
export function RichTextField({
  value,
  onChange,
  onError,
  placeholder,
  disabled,
  className,
  maxLength,
}: {
  value: string;
  onChange: (value: string) => void;
  onError?: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxLength?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
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

  // Insere as imagens na posição pedida, mantendo cada uma em linha própria.
  // O texto ao redor é preservado: o que estava selecionado é substituído,
  // igual a colar qualquer outra coisa.
  async function insertImages(files: File[], start: number, end: number) {
    setIsUploading(true);
    try {
      const urls: string[] = [];
      for (const file of files) urls.push(await uploadImageFile(file));

      const before = value.slice(0, start);
      const after = value.slice(end);
      const prefix = !before || before.endsWith("\n") ? "" : "\n";
      const suffix = !after || after.startsWith("\n") ? "" : "\n";
      const snippet = `${prefix}${urls.map(imageMarkdown).join("\n")}${suffix}`;
      onChange(before + snippet + after);

      // Cursor logo depois da imagem — dá pra continuar escrevendo sem
      // precisar clicar de novo no lugar certo.
      const caret = before.length + snippet.length;
      window.requestAnimationFrame(() => ref.current?.setSelectionRange(caret, caret));
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Não foi possível enviar a imagem.");
    } finally {
      setIsUploading(false);
    }
  }

  function onPaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = imagesFromTransfer(event.clipboardData);
    if (!files.length) return; // Colar texto segue sendo colar texto.
    event.preventDefault();
    const el = event.currentTarget;
    insertImages(files, el.selectionStart, el.selectionEnd);
  }

  function onDrop(event: React.DragEvent) {
    const files = imagesFromTransfer(event.dataTransfer);
    setIsDragging(false);
    if (!files.length) return;
    event.preventDefault();
    // Soltar no textarea usa o ponto onde o cursor parou durante o arrasto;
    // soltar na prévia (fora de edição) anexa no fim do que já está escrito.
    const el = ref.current;
    const at = editing && el ? el.selectionStart : value.length;
    const to = editing && el ? el.selectionEnd : value.length;
    insertImages(files, at, to);
  }

  function onDragOver(event: React.DragEvent) {
    if (!event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault();
    setIsDragging(true);
  }

  const dropProps = disabled
    ? {}
    : { onDrop, onDragOver, onDragLeave: () => setIsDragging(false) };
  const stateClass = `${isDragging ? " is-drop-target" : ""}${isUploading ? " is-uploading" : ""}`;

  if (editing && !disabled) {
    return (
      <AutoTextarea
        ref={ref}
        className={`${className || ""}${stateClass}`}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        onPaste={onPaste}
        // Sair do campo enquanto a imagem sobe desmontaria o textarea no meio
        // do caminho e o cursor se perderia — o blur espera o upload acabar.
        onBlur={() => { if (!isUploading) setEditing(false); }}
        {...dropProps}
      />
    );
  }

  const empty = !value.trim();
  return (
    <div
      className={`${className || ""} rich-text-view${empty ? " is-empty" : ""}${disabled ? " is-disabled" : ""}${stateClass}`}
      // Sem o disabled o campo continua alcançável por teclado, igual ao
      // textarea que ele substitui.
      tabIndex={disabled ? undefined : 0}
      role={disabled ? undefined : "textbox"}
      onClick={disabled ? undefined : () => setEditing(true)}
      onFocus={disabled ? undefined : () => setEditing(true)}
      {...dropProps}
    >
      {empty ? placeholder : renderMarkdownLite(value)}
    </div>
  );
}
