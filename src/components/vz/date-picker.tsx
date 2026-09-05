"use client";

import { CalendarDays, X } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function fromIso(value: string) { return value ? new Date(`${value}T12:00:00`) : undefined; }
function toIso(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }

export function DatePicker({ value, onChange, placeholder = "Selecionar data", className = "", disabled = false }: { value: string; onChange: (value: string) => void; placeholder?: string; className?: string; disabled?: boolean }) {
  return <Popover>
    <PopoverTrigger disabled={disabled} className={`vz-date-picker ${value ? "has-value" : ""} ${className}`.trim()}>
      <CalendarDays size={13} /><span>{value ? fromIso(value)?.toLocaleDateString("pt-BR") : placeholder}</span>
    </PopoverTrigger>
    <PopoverContent align="start" className="vz-date-picker__popover !w-auto !p-0">
      <Calendar mode="single" locale={ptBR} selected={fromIso(value)} onSelect={(date) => date && onChange(toIso(date))} />
      {value ? <button type="button" className="vz-date-picker__clear" onClick={() => onChange("")}><X size={12} /> Limpar data</button> : null}
    </PopoverContent>
  </Popover>;
}
