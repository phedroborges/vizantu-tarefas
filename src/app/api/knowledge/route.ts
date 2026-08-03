import { NextRequest, NextResponse } from "next/server";
import { createKnowledgeDoc, listKnowledgeDocs } from "@/lib/storage";

export async function GET() {
  const docs = await listKnowledgeDocs();
  return NextResponse.json({ docs });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body?.title || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "Informe o título do documento." }, { status: 400 });
  }
  const doc = await createKnowledgeDoc({ title: body.title, content: body.content });
  return NextResponse.json({ doc }, { status: 201 });
}
