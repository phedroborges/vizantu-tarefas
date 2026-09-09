"use client";

import { Send } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { IconButton } from "@/components/vz";
import type { Member } from "@/lib/types";

export function MentionCommentForm({ value, onChange, members, disabled, onSubmit }: {
  value: string; onChange: (value: string) => void; members: Member[]; disabled?: boolean;
  onSubmit: (mentionedMemberIds: string[]) => void;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [mentioned, setMentioned] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const match = /(?:^|\s)@([^@\s]*)$/.exec(value);
  const options = useMemo(() => {
    if (!match) return [];
    const query = match[1].toLocaleLowerCase("pt-BR");
    return members.filter((member) => member.active && member.name.toLocaleLowerCase("pt-BR").includes(query)).slice(0, 6);
  }, [match, members]);

  function choose(member: Member) {
    if (!match) return;
    const at = match.index + match[0].lastIndexOf("@");
    const next = `${value.slice(0, at)}@${member.name} `;
    onChange(next);
    setMentioned((current) => current.includes(member.id) ? current : [...current, member.id]);
    setActiveIndex(0);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(next.length, next.length);
    });
  }
  function submit(event: React.SyntheticEvent) {
    event.preventDefault();
    const valid = mentioned.filter((id) => { const member = members.find((item) => item.id === id); return member && value.includes(`@${member.name}`); });
    onSubmit(valid); setMentioned([]);
  }

  return <form className="comment-form mention-composer" onSubmit={submit}>
    <textarea
      ref={inputRef}
      value={value}
      onChange={(event) => { onChange(event.target.value); setActiveIndex(0); }}
      onKeyDown={(event) => {
        if (options.length && event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => (index + 1) % options.length); }
        else if (options.length && event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => (index - 1 + options.length) % options.length); }
        else if (options.length && (event.key === "Enter" || event.key === "Tab")) { event.preventDefault(); choose(options[activeIndex] || options[0]); }
        else if (event.key === "Escape") { event.preventDefault(); onChange(value.replace(/(?:^|\s)@[^@\s]*$/, "")); }
        else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit(event);
      }}
      placeholder="Escreva um comentário ou use @ para mencionar"
      aria-label="Adicionar comentário"
      rows={3}
      maxLength={600}
    />
    <IconButton bare type="submit" disabled={disabled || !value.trim()} aria-label="Enviar comentário"><Send size={15} /></IconButton>
    <small className="mention-composer__hint">⌘ + Enter para enviar</small>
    {options.length ? <div className="mention-menu" role="listbox" aria-label="Mencionar usuário">{options.map((member, index) => <button type="button" role="option" aria-selected={index === activeIndex} key={member.id} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(member)}><Avatar name={member.name} imageUrl={member.avatarUrl} size={25} /><span><strong>{member.name}</strong><small>{member.email}</small></span></button>)}</div> : null}
  </form>;
}
