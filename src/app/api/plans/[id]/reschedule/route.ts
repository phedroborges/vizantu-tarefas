import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { todayIso } from "@/lib/dates";
import { addDays, reschedulePlan, weeklyDiagnosis, type ScheduleItem } from "@/lib/plan-schedule";
import { getPlan, listPlanTasks, listTags, updateTask } from "@/lib/storage";

// Reorganiza o calendário do plano pelo que o cliente já aprovou.
//
// GET devolve a SIMULAÇÃO: o que mudaria de lugar e como fica cada semana.
// POST aplica. São dois verbos de propósito — reescrever o calendário inteiro
// de um cliente é o tipo de coisa que ninguém deveria disparar sem ver antes.
async function carregar(planId: string) {
  const plan = await getPlan(planId);
  if (!plan) return null;
  const [tasks, tags] = await Promise.all([listPlanTasks(planId), listTags("formato")]);
  const labelById = new Map(tags.map((tag) => [tag.id, tag.label]));
  const items: ScheduleItem[] = tasks.map((task) => ({
    id: task.id,
    name: task.name,
    dueDate: task.dueDate,
    status: task.status,
    seasonal: Boolean(task.seasonal),
    formats: (task.formatTagIds || []).map((id) => labelById.get(id) || ""),
  }));
  // Nada pode ser marcado para hoje ou para trás: o dia já está em andamento.
  return { plan, items, minDate: addDays(todayIso(), 1) };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  try {
    const dados = await carregar(id);
    if (!dados) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });
    const resultado = reschedulePlan(dados.items, { minDate: dados.minDate });
    return NextResponse.json({
      ...resultado,
      minDate: dados.minDate,
      weeks: weeklyDiagnosis(dados.items),
    });
  } catch (error) {
    return apiFailure(error, "simular a reorganização do plano");
  }
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  try {
    const dados = await carregar(id);
    if (!dados) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });
    const { moves } = reschedulePlan(dados.items, { minDate: dados.minDate });
    for (const move of moves) await updateTask(move.id, { dueDate: move.to });
    const tasks = await listPlanTasks(id);
    return NextResponse.json({ moves, tasks });
  } catch (error) {
    return apiFailure(error, "reorganizar o plano");
  }
}
