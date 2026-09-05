"use client";

import { CalendarDays, Lock, Sparkles } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { currentMonthKey, daysInCalendarMonth, monthKeyFromDate, monthLabel, moveMonth } from "@/lib/dates";
import { formatFamily, weekStart, WEEKLY_MINIMUM, type FormatFamily } from "@/lib/plan-schedule";
import type { Tag, Task } from "@/lib/types";
import { MonthCalendar, MonthCalendarDay, MonthCalendarGrid, MonthCalendarHeader, MonthCalendarWeekdays } from "@/components/vz/month-calendar";

// O calendário do plano, com arrastar e soltar.
//
// A lista de itens ordenada por data responde "o que vem agora". Ela não
// responde "como está a semana", que é a pergunta que aparece quando o cliente
// atrasa a aprovação e tudo precisa ser remanejado. Num mês em grade dá pra
// ver de relance o buraco de terça e os três conteúdos empilhados na sexta.
//
// Arrastar altera SÓ a data de entrega. É a mesma edição do campo de prazo no
// modal, feita com a mão em vez de com o teclado, e por isso não existe regra
// nova aqui: dois ou três conteúdos no mesmo dia são permitidos, porque na
// vida real isso acontece quando um plano precisa recuperar atraso.

const CORES: Record<FormatFamily, string> = {
  video: "cal-video",
  carrossel: "cal-carrossel",
  estatico: "cal-estatico",
  outro: "cal-outro",
};

export function PlanCalendar({
  tasks,
  formatTags,
  canEdit,
  onMove,
  onOpen,
}: {
  tasks: Task[];
  formatTags: Tag[];
  canEdit: boolean;
  onMove: (taskId: string, dueDate: string) => void;
  onOpen: (task: Task) => void;
}) {
  const primeiraData = useMemo(
    () => tasks.map((task) => task.dueDate).filter(Boolean).sort()[0],
    [tasks],
  );
  const [monthKey, setMonthKey] = useState(() => (primeiraData ? monthKeyFromDate(primeiraData) : currentMonthKey()));
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);

  const labelById = useMemo(() => new Map(formatTags.map((tag) => [tag.id, tag.label])), [formatTags]);
  const familia = useCallback((task: Task): FormatFamily =>
    formatFamily((task.formatTagIds || []).map((id) => labelById.get(id) || "")), [labelById]);

  const porDia = useMemo(() => {
    const mapa = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const lista = mapa.get(task.dueDate) ?? [];
      lista.push(task);
      mapa.set(task.dueDate, lista);
    }
    return mapa;
  }, [tasks]);

  const dias = daysInCalendarMonth(monthKey);
  const iso = (dia: number) => `${monthKey}-${String(dia).padStart(2, "0")}`;

  // O que falta em cada semana VISÍVEL, pra cobrança aparecer ao lado da
  // semana em que ela acontece, e não numa lista solta embaixo.
  const faltaPorSemana = useMemo(() => {
    const contagem = new Map<string, Record<FormatFamily, number>>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const chave = weekStart(task.dueDate);
      const atual = contagem.get(chave) ?? { video: 0, carrossel: 0, estatico: 0, outro: 0 };
      atual[familia(task)] += 1;
      contagem.set(chave, atual);
    }
    const faltas = new Map<string, string[]>();
    for (const [chave, counts] of contagem) {
      const nomes: Record<string, string> = { video: "vídeo", carrossel: "carrossel", estatico: "estático" };
      const falta = (Object.keys(WEEKLY_MINIMUM) as (keyof typeof WEEKLY_MINIMUM)[])
        .filter((family) => counts[family] < WEEKLY_MINIMUM[family])
        .map((family) => `${WEEKLY_MINIMUM[family] - counts[family]} ${nomes[family]}`);
      if (falta.length) faltas.set(chave, falta);
    }
    return faltas;
  }, [tasks, familia]);

  function soltar(dia: number) {
    setOverDay(null);
    const id = dragId;
    setDragId(null);
    if (!id || !canEdit) return;
    const destino = iso(dia);
    const task = tasks.find((item) => item.id === id);
    if (!task || task.dueDate === destino) return;
    onMove(id, destino);
  }

  const semDataCount = tasks.filter((task) => !task.dueDate).length;

  return (
    <MonthCalendar className="plan-calendar" aria-label="Calendário do plano">
      <MonthCalendarHeader label={monthLabel(monthKey)} onPrevious={() => setMonthKey(moveMonth(monthKey, -1))} onNext={() => setMonthKey(moveMonth(monthKey, 1))} start={<div>
          <h2><CalendarDays size={14} /> Calendário</h2>
          <p>Arraste um conteúdo para mudar a data de entrega.</p>
        </div>} />

      <MonthCalendarGrid>
        <MonthCalendarWeekdays />

        {dias.map((dia, index) => {
          if (dia === null) return <MonthCalendarDay day={null} key={`vazio-${index}`} />;
          const data = iso(dia);
          const doDia = porDia.get(data) ?? [];
          const falta = faltaPorSemana.get(weekStart(data));
          const primeiroDaSemana = new Date(`${data}T12:00:00Z`).getUTCDay() === 1;

          return (
            <MonthCalendarDay
              key={data}
              day={dia}
              hasItems={Boolean(doDia.length)}
              className={`plan-calendar-day${overDay === data ? " is-drop" : ""}${doDia.length ? " has-items" : ""}`}
              dayHeaderEnd={primeiroDaSemana && falta ? <small className="plan-calendar-falta" title={`Falta na semana: ${falta.join(", ")}`}>falta {falta.join(", ")}</small> : null}
              onDragOver={(e) => { if (canEdit && dragId) { e.preventDefault(); setOverDay(data); } }}
              onDragLeave={() => setOverDay((atual) => (atual === data ? null : atual))}
              onDrop={(e) => { e.preventDefault(); soltar(dia); }}
            >
              <div className="vz-calendar__events">
              {doDia.map((task) => (
                <button
                  type="button"
                  key={task.id}
                  className={`vz-calendar__event plan-calendar-item ${CORES[familia(task)]}${task.seasonal ? " is-seasonal" : ""}${dragId === task.id ? " is-dragging" : ""}`}
                  draggable={canEdit && !task.seasonal}
                  onDragStart={() => setDragId(task.id)}
                  onDragEnd={() => { setDragId(null); setOverDay(null); }}
                  onClick={() => onOpen(task)}
                  title={task.seasonal ? `${task.name} (data fixa, não se move)` : task.name}
                >
                  {task.seasonal ? <Lock size={9} /> : null}
                  <span>{task.name}</span>
                </button>
              ))}
              </div>
            </MonthCalendarDay>
          );
        })}
      </MonthCalendarGrid>

      <footer className="plan-calendar-legend">
        <span className="cal-video">vídeo</span>
        <span className="cal-carrossel">carrossel</span>
        <span className="cal-estatico">estático</span>
        <span className="plan-calendar-legend-lock"><Lock size={10} /> data fixa</span>
        {semDataCount ? <span className="plan-calendar-legend-warn"><Sparkles size={10} /> {semDataCount} sem data</span> : null}
      </footer>
    </MonthCalendar>
  );
}
