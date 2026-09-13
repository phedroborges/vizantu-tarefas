import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { FinanceInputError, loadFinance, mutateFinance } from "@/lib/finance/storage";

export const dynamic = "force-dynamic";
export async function GET() {
  const auth = await requireUser(["dono"]);
  if (isResponse(auth)) return auth;
  try { return NextResponse.json(await loadFinance(auth.id), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return apiFailure(error, "carregar o financeiro"); }
}
export async function POST(request: NextRequest) {
  const auth = await requireUser(["dono"]);
  if (isResponse(auth)) return auth;
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new FinanceInputError("Solicitação inválida.");
    await mutateFinance(body, auth.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof FinanceInputError || error instanceof SyntaxError) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiFailure(error, "salvar o financeiro");
  }
}
