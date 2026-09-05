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
  const inputRef = useRef<HTMLInputElement>(null);
  const [mentioned, setMentioned] = useState<string[]>([]);
  const match = /(?:^|\s)@([^@\s]*)$/.exec(value);
  const options = useMemo(() => {
    if (!match) return [];
    const query = match[1].toLocaleLowerCase("pt-BR");
    return members.filter((member) => member.active && member.name.toLocaleLowerCase("pt-BR").includes(query)).slice(0, 6);
  }, [match, members]);

  function choose(member: Member) {
    if (!match) return;
    const at = match.index + match[0].lastIndexOf("@");
    onChange(`${value.slice(0, at)}@${member.name} `);
    setMentioned((current) => current.includes(member.id) ? current : [...current, member.id]);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const valid = mentioned.filter((id) => { const member = members.find((item) => item.id === id); return member && value.includes(`@${member.name}`); });
    onSubmit(valid); setMentioned([]);
  }

  return <form className="comment-form mention-composer" onSubmit={submit}>
    <input ref={inputRef} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Comente ou use @ para mencionar alguém" maxLength={600} />
    <IconButton bare type="submit" disabled={disabled || !value.trim()} aria-label="Enviar comentário"><Send size={15} /></IconButton>
    {options.length ? <div className="mention-menu" role="listbox" aria-label="Mencionar usuário">{options.map((member) => <button type="button" role="option" aria-selected={mentioned.includes(member.id)} key={member.id} onClick={() => choose(member)}><Avatar name={member.name} imageUrl={member.avatarUrl} size={25} /><span><strong>{member.name}</strong><small>{member.email}</small></span></button>)}</div> : null}
  </form>;
}
