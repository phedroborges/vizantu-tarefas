import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, podeAbrirProjeto, requireUser } from "@/lib/authz";
import { listProjectResults } from "@/lib/results/store";

// Relatórios de resultados do cliente. Só leitura: eles são publicados prontos.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  const { id } = await params;
  if (!podeAbrirProjeto(auth, id)) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  try {
    return NextResponse.json({ results: await listProjectResults(id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiFailure(error, "carregar os resultados");
  }
}
