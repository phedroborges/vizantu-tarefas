import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser, semAcesso } from "@/lib/authz";
import { attachInvoice, FinanceInputError, getClosing, invoiceLink } from "@/lib/finance/storage";
import { podeVerFinanceiroDe } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// A nota fiscal de um fechamento: quem recebeu sobe, e só ela e o dono abrem.
async function closingFor(paramsPromise: Params["params"]) {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  const { id } = await paramsPromise;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Fechamento não encontrado." }, { status: 404 });
  const closing = await getClosing(id);
  if (!closing) return NextResponse.json({ error: "Fechamento não encontrado." }, { status: 404 });
  if (!podeVerFinanceiroDe(auth.role, auth.id, closing.memberId)) return semAcesso();
  return { auth, closing };
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const found = await closingFor(params);
    if (found instanceof NextResponse) return found;
    const url = await invoiceLink(found.closing);
    if (!url) return NextResponse.json({ error: "A nota fiscal ainda não foi enviada." }, { status: 404 });
    return NextResponse.redirect(url, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiFailure(error, "abrir a nota fiscal");
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const found = await closingFor(params);
    if (found instanceof NextResponse) return found;
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Envie o arquivo da nota fiscal." }, { status: 400 });
    await attachInvoice(found.closing, file, found.auth.id);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof FinanceInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiFailure(error, "enviar a nota fiscal");
  }
}
