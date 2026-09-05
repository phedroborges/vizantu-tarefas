"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { IconButton } from "./index";

const cx = (...values: (string | undefined | false)[]) => values.filter(Boolean).join(" ");
export const CALENDAR_WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function MonthCalendar({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cx("vz-calendar", className)} {...props} />;
}
export function MonthCalendarHeader({ label, onPrevious, onNext, start, end }: { label: string; onPrevious: () => void; onNext: () => void; start?: ReactNode; end?: ReactNode }) {
  return <header className="vz-calendar__head">{start}<div className="vz-calendar__nav"><IconButton size="sm" aria-label="Mês anterior" onClick={onPrevious}><ChevronLeft size={15} /></IconButton><strong>{label}</strong><IconButton size="sm" aria-label="Próximo mês" onClick={onNext}><ChevronRight size={15} /></IconButton></div>{end}</header>;
}
export function MonthCalendarGrid({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("vz-calendar__grid", className)} role="grid" {...props}>{children}</div>;
}
export function MonthCalendarWeekdays({ compact = false }: { compact?: boolean }) {
  return <>{CALENDAR_WEEKDAYS.map((day) => <div className="vz-calendar__weekday" role="columnheader" key={day}>{compact ? day[0] : day}</div>)}</>;
}
export function MonthCalendarDay({ day, dayHeaderEnd, today, muted, selected, hasItems, className, children, ...props }: HTMLAttributes<HTMLDivElement> & { day?: number | null; dayHeaderEnd?: ReactNode; today?: boolean; muted?: boolean; selected?: boolean; hasItems?: boolean }) {
  return <div className={cx("vz-calendar__day", !day && "is-empty", today && "is-today", muted && "is-muted", selected && "is-selected", hasItems && "has-items", className)} role="gridcell" {...props}>{day ? <div className="vz-calendar__day-number"><span>{day}</span>{dayHeaderEnd}</div> : null}{children}</div>;
}
export function MonthCalendarEvent({ className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={cx("vz-calendar__event", className)} {...props} />;
}
