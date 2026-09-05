"use client";

import { ChevronLeft, ChevronRight, Image as ImageIcon, Layers, Link2, Lock, Megaphone, MessageSquare, Paperclip, Settings2, Smartphone, Video } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";
import { Button, Check, Count, IconButton } from "@/components/vz";
import { currentMonthKey, monthKeyFromDate, monthLabel, moveMonth, todayIso } from "@/lib/dates";
import { TASK_STATUSES } from "@/lib/types";
import type { Member, Tag, Task } from "@/lib/types";

type CardField = "formato" | "etapa" | "responsavel" | "canal" | "link" | "comentarios";
const CARD_FIELDS: { key: CardField; label: string }[] = [
  { key: "formato", label: "Formato" }, { key: "etapa", label: "Etapa" }, { key: "responsavel", label: "Responsável" },
  { key: "canal", label: "Canal" }, { key: "link", label: "Link do material" }, { key: "comentarios", label: "Comentários e anexos" },
];

function calendarDates(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year, monthNumber - 1, 1, 12);
  const start = new Date(first); start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const last = new Date(year, monthNumber, 0, 12);
  const end = new Date(last); end.setDate(last.getDate() + ((7 - last.getDay()) % 7));
  const result: { iso: string; day: number; outside: boolean }[] = [];
  for (const date = new Date(start); date <= end || result.length < 35; date.setDate(date.getDate() + 1)) {
    result.push({ iso: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`, day: date.getDate(), outside: date.getMonth() !== monthNumber - 1 });
  }
  return result;
}

function formatMeta(label = "") {
  if (/carrossel/i.test(label)) return { label: "Carrossel", tone: "blue", Icon: Layers };
  if (/estát|estatic|imagem/i.test(label)) return { label: "Estático", tone: "green", Icon: ImageIcon };
  if (/stor/i.test(label)) return { label: "Stories", tone: "pink", Icon: Smartphone };
  if (/anún|anunc|ads?/i.test(label)) return { label: "Anúncio", tone: "amber", Icon: Megaphone };
  if (/reel|vídeo|video/i.test(label)) return { label: "Reels", tone: "violet", Icon: Video };
  return { label: label || "Conteúdo", tone: "slate", Icon: ImageIcon };
}

export function PlanCalendar({ tasks, formatTags, channelTags = [], members = [], canEdit, onMove, onOpen }: {
  tasks: Task[]; formatTags: Tag[]; channelTags?: Tag[]; members?: Member[]; canEdit: boolean;
  onMove: (taskId: string, dueDate: string) => void; onOpen: (task: Task) => void;
}) {
  const initialMonth = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of tasks) if (task.dueDate) { const key = monthKeyFromDate(task.dueDate); counts.set(key, (counts.get(key) || 0) + 1); }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || currentMonthKey();
  }, [tasks]);
  const [month, setMonth] = useState(initialMonth);
  const [fields, setFields] = useState<CardField[]>(["formato", "etapa", "responsavel", "link"]);
  const [dragId, setDragId] = useState<string | null>(null);
  const formatById = useMemo(() => new Map(formatTags.map((tag) => [tag.id, tag.label])), [formatTags]);
  const channelById = useMemo(() => new Map(channelTags.map((tag) => [tag.id, tag.label])), [channelTags]);
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const byDay = useMemo(() => { const map = new Map<string, Task[]>(); for (const task of tasks) if (task.dueDate) map.set(task.dueDate, [...(map.get(task.dueDate) || []), task]); return map; }, [tasks]);
  const monthTasks = tasks.filter((task) => task.dueDate?.startsWith(month));
  const show = (field: CardField) => fields.includes(field);
  const toggle = (field: CardField) => setFields((current) => current.includes(field) ? current.filter((item) => item !== field) : [...current, field]);

  return <section className="vz-cal task-calendar plan-calendar" aria-label={`Calendário de ${monthLabel(month)}`}>
    <div className="vz-cal__head">
      <div className="calendar-month-title"><strong className="vz-cal__month">{monthLabel(month)}</strong><Count>{monthTasks.length} conteúdos</Count></div>
      <div className="vz-cal__nav"><IconButton size="sm" aria-label="Mês anterior" onClick={() => setMonth((value) => moveMonth(value, -1))}><ChevronLeft size={14} /></IconButton><Button variant="ghost" size="sm" onClick={() => setMonth(currentMonthKey())}>Hoje</Button><IconButton size="sm" aria-label="Próximo mês" onClick={() => setMonth((value) => moveMonth(value, 1))}><ChevronRight size={14} /></IconButton></div>
    </div>
    <div className="vz-toolbar calendar-card-config"><span className="ds-label"><Settings2 size={13} /> Mostrar no cartão</span><div className="vz-cal__config">{CARD_FIELDS.map((field) => <Check key={field.key} label={field.label} checked={show(field.key)} onChange={() => toggle(field.key)} />)}</div></div>
    <div className="calendar-scroll"><div className="vz-cal__weekdays">{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => <span key={day}>{day}</span>)}</div><div className="vz-cal__grid">
      {calendarDates(month).map((cell) => { const dayTasks = cell.outside ? [] : byDay.get(cell.iso) || []; return <div className={`vz-cal__day${cell.outside ? " vz-cal__day--out" : ""}${cell.iso === todayIso() ? " vz-cal__day--today" : ""}`} key={cell.iso} onDragOver={(event) => { if (canEdit && dragId && !cell.outside) event.preventDefault(); }} onDrop={() => { if (dragId && !cell.outside) onMove(dragId, cell.iso); setDragId(null); }}><span className="vz-cal__daynum">{cell.day}</span>{dayTasks.map((task) => {
        const format = formatMeta(task.formatTagIds.map((id) => formatById.get(id)).find(Boolean)); const FormatIcon = format.Icon;
        const assignee = task.assigneeId ? memberById.get(task.assigneeId) : undefined; const status = TASK_STATUSES.find((item) => item.value === task.status);
        const statusTone = task.status === "problema" ? "red" : status?.group === "feita" ? "green" : status?.group === "em_andamento" ? "amber" : "blue";
        const channel = task.channelTagIds.map((id) => channelById.get(id)).find(Boolean);
        return <button className={`vz-cal-card vz-cal-card--${format.tone}`} type="button" title={task.name} draggable={canEdit && !task.seasonal} onDragStart={() => setDragId(task.id)} onDragEnd={() => setDragId(null)} onClick={() => onOpen(task)} key={task.id}>
          {show("formato") ? <div className="vz-cal-card__top"><span className={`vz-minitag vz-minitag--${format.tone}`}><FormatIcon size={10} />{format.label}</span>{task.seasonal ? <Lock size={10} /> : null}</div> : null}<span className="vz-cal-card__title">{task.name}</span>
          {show("etapa") ? <span className={`vz-minitag vz-minitag--${statusTone}`}>{status?.label || task.status}</span> : null}<div className="vz-cal-card__foot">
            {show("canal") && channel ? <span className="vz-minitag vz-minitag--outline">{channel}</span> : null}{show("link") && task.driveLink ? <span className="vz-minitag vz-minitag--outline"><Link2 size={9} />Link</span> : null}
            {show("comentarios") && task.comments.length ? <span className="vz-minitag vz-minitag--outline"><MessageSquare size={9} />{task.comments.length}</span> : null}{show("comentarios") && task.images.length ? <span className="vz-minitag vz-minitag--outline"><Paperclip size={9} />{task.images.length}</span> : null}
            {show("responsavel") && assignee ? <span className="calendar-card-avatar"><Avatar name={assignee.name} imageUrl={assignee.avatarUrl} size={20} /></span> : null}
          </div></button>;
      })}</div>; })}
    </div></div>
    <div className="vz-cal__legend"><span><i className="vz-dot vz-dot--violet" />Reels</span><span><i className="vz-dot vz-dot--blue" />Carrossel</span><span><i className="vz-dot vz-dot--green" />Estático</span><span><i className="vz-dot vz-dot--pink" />Stories</span><span><i className="vz-dot vz-dot--amber" />Anúncio</span></div>
  </section>;
}
