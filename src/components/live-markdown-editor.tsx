"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

function inlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*\n]+\*\*)/g);
  return parts.map((part, index) => part.startsWith("**") && part.endsWith("**")
    ? <strong key={index}>{part.slice(2, -2)}</strong>
    : part);
}

function editorBlocks(markdown: string, placeholder?: string) {
  if (!markdown) return <div data-placeholder={placeholder || ""}><br /></div>;
  return markdown.split("\n").map((line, index) => {
    const heading = line.match(/^###\s*(.*)$/);
    return heading
      ? <div className="live-markdown-heading" data-md-heading="3" key={index}>{inlineMarkdown(heading[1])}<br /></div>
      : <div key={index}>{inlineMarkdown(line)}<br /></div>;
  });
}

function serializeInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
  if (!(node instanceof HTMLElement) || node.tagName === "BR") return "";
  const content = [...node.childNodes].map(serializeInline).join("");
  return node.tagName === "STRONG" || node.tagName === "B" ? `**${content}**` : content;
}

export function markdownFromEditor(root: HTMLElement) {
  return [...root.childNodes].map((block) => {
    if (block.nodeType === Node.TEXT_NODE) return block.textContent || "";
    const text = [...block.childNodes].map(serializeInline).join("");
    return block instanceof HTMLElement && block.dataset.mdHeading ? `### ${text}` : text;
  }).join("\n").replace(/\n+$/, "");
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
}

function formattingCharactersBefore(text: string, caret: number) {
  const before = text.slice(0, caret);
  const headings = before.match(/(^|\n)###\s/g)?.length || 0;
  const boldPairs = before.match(/\*\*[^*\n]+\*\*/g)?.length || 0;
  return headings * 4 + boldPairs * 4;
}

export function LiveMarkdownEditor({ value, onChange, onFiles, placeholder, className }: {
  value: string;
  onChange: (value: string) => void;
  onFiles?: (files: File[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [source, setSource] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value === lastEmitted.current) return;
    setSource(value);
  }, [value]);

  useLayoutEffect(() => {
    if (pendingCaret.current === null || !ref.current) return;
    restoreSelection(ref.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [source]);

  return (
    <div
      key={source}
      ref={ref}
      className={`${className || ""} live-markdown-editor${source ? "" : " is-empty"}`}
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
      onInput={(event) => {
        const root = event.currentTarget;
        const caret = selectionOffset(root);
        const visible = root.innerText;
        const next = markdownFromEditor(root);
        pendingCaret.current = caret === null ? null : Math.max(0, caret - formattingCharactersBefore(visible, caret));
        lastEmitted.current = next;
        setSource(next);
        onChange(next);
      }}
    >
      {editorBlocks(source, placeholder)}
    </div>
  );
}
