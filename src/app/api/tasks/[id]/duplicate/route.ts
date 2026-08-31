import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { duplicateTask } from "@/lib/storage";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  try {
    const task = await duplicateTask(id);
    if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return apiFailure(error, "duplicar a tarefa");
  }
}
