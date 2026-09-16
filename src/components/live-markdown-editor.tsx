"use client";

import { useLayoutEffect, useRef } from "react";

// O navegador é dono dos nós editáveis durante a digitação. Recriá-los a cada
// input (ou usar o texto como key) quebra seleção, desfazer e teclas de acento.
function renderEditor(root: HTMLElement, markdown: string) {
  const fragment = document.createDocumentFragment();
  for (const line of markdown.split("\n")) {
    const block = document.createElement("div");
    const heading = line.match(/^###\s*(.*)$/);
    if (heading) {
      block.className = "live-markdown-heading";
      block.dataset.mdHeading = "3";
    }
    const text = heading ? heading[1] : line;
    for (const part of text.split(/(\*\*[^*\n]+\*\*)/g)) {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        const strong = document.createElement("strong");
        strong.textContent = part.slice(2, -2);
        block.append(strong);
      } else {
        block.append(document.createTextNode(part));
      }
    }
    if (!text) block.append(document.createElement("br"));
    fragment.append(block);
  }
  root.replaceChildren(fragment);
}

function serializeChildren(parent: Node): string {
  let text = "";
  let previousWasBlock = false;
  [...parent.childNodes].forEach((node, index, nodes) => {
    const block = node instanceof HTMLElement && /^(DIV|P)$/.test(node.tagName);
    if (index > 0 && (previousWasBlock || (block && !text.endsWith("\n")))) text += "\n";
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent || "";
    else if (node instanceof HTMLElement) {
      if (node.tagName === "BR") {
        // O último BR só sustenta a linha do cursor em alguns navegadores.
        if (index < nodes.length - 1) text += "\n";
      } else {
        const content = serializeChildren(node);
        text += node.dataset.mdHeading ? `### ${content}`
          : /^(STRONG|B)$/.test(node.tagName) ? `**${content}**` : content;
      }
    }
    previousWasBlock = block;
  });
  return text;
}

export function markdownFromEditor(root: HTMLElement) {
  return serializeChildren(root).replace(/\n+$/, "");
}

function selectionOffset(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !root.contains(selection.anchorNode)) return null;
  const range = selection.getRangeAt(0).cloneRange();
  range.selectNodeContents(root);
  range.setEnd(selection.anchorNode!, selection.anchorOffset);
  return range.toString().length;
}

function restoreSelection(root: HTMLElement, requested: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = requested;
  let node = walker.nextNode();
  while (node) {
    const length = node.textContent?.length || 0;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    remaining -= length;
    node = walker.nextNode();
  }
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
}

function updatePlaceholder(root: HTMLElement) {
  root.classList.toggle("is-empty", !root.textContent && !markdownFromEditor(root));
}

export function LiveMarkdownEditor({ value, onChange, onFiles, placeholder, className }: {
  value: string;
  onChange: (value: string) => void;
  onFiles?: (files: File[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const composing = useRef(false);
  const lastEmitted = useRef<string | undefined>(undefined);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || composing.current) return;
    if (value !== lastEmitted.current) {
      const caret = document.activeElement === root ? selectionOffset(root) : null;
      renderEditor(root, value);
      lastEmitted.current = value;
      if (caret !== null) restoreSelection(root, caret);
    }
    updatePlaceholder(root);
  }, [value, className]);

  function emit(root: HTMLElement) {
    updatePlaceholder(root);
    const next = markdownFromEditor(root);
    if (next === lastEmitted.current) return;
    lastEmitted.current = next;
    onChange(next);
  }

  return (
    <div
      ref={ref}
      className={`${className || ""} live-markdown-editor`}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      data-placeholder={placeholder || ""}
      onPaste={(event) => {
        const files = [...event.clipboardData.files].filter((file) => file.type.startsWith("image/"));
        if (!files.length) return;
        event.preventDefault();
        onFiles?.(files);
      }}
      onDrop={(event) => {
        const files = [...event.dataTransfer.files].filter((file) => file.type.startsWith("image/"));
        if (!files.length) return;
        event.preventDefault();
        onFiles?.(files);
      }}
      onDragOver={(event) => { if ([...event.dataTransfer.types].includes("Files")) event.preventDefault(); }}
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={(event) => {
        composing.current = false;
        emit(event.currentTarget);
      }}
      onInput={(event) => {
        updatePlaceholder(event.currentTarget);
        // Acentos/IME só chegam ao autosave depois de a composição terminar.
        if (composing.current || (event.nativeEvent as InputEvent).isComposing) return;
        emit(event.currentTarget);
      }}
      onBlur={(event) => {
        if (composing.current) return;
        emit(event.currentTarget);
        // Formata marcações novas ao sair; nunca reconstrói o texto enquanto
        // a pessoa escreve, seleciona ou usa o histórico nativo de desfazer.
        renderEditor(event.currentTarget, markdownFromEditor(event.currentTarget));
        updatePlaceholder(event.currentTarget);
      }}
    />
  );
}
