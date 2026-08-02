import { NextRequest, NextResponse } from "next/server";
import { createTag, listTags } from "@/lib/storage";
import type { TagKind } from "@/lib/types";

const VALID_KINDS: TagKind[] = ["formato", "canal"];

export async function GET(request: NextRequest) {
  const kindParam = request.nextUrl.searchParams.get("kind");
  if (kindParam && !VALID_KINDS.includes(kindParam as TagKind)) {
    return NextResponse.json({ error: "Tipo de etiqueta inválido." }, { status: 400 });
  }
  const tags = await listTags(kindParam as TagKind | undefined);
  return NextResponse.json({ tags });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!VALID_KINDS.includes(body?.kind)) {
    return NextResponse.json({ error: "Tipo de etiqueta inválido." }, { status: 400 });
  }
  if (!body?.label || typeof body.label !== "string" || !body.label.trim()) {
    return NextResponse.json({ error: "Informe o nome da etiqueta." }, { status: 400 });
  }
  const tag = await createTag({ kind: body.kind, label: body.label });
  return NextResponse.json({ tag }, { status: 201 });
}
