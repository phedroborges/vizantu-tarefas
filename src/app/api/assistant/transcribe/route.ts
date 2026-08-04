import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { isResponse, requireUser } from "@/lib/authz";

const MAX_AUDIO_BYTES = 24 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  if (!auth.aiEnabled) return NextResponse.json({ error: "O assistente de IA não está disponível para o seu usuário." }, { status: 403 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY não configurada no servidor. Adicione a chave em .env.local e reinicie o servidor." },
      { status: 500 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("audio");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo de áudio." }, { status: 400 });
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Áudio muito grande (máximo 24MB)." }, { status: 400 });
  }

  const client = new OpenAI({ apiKey });
  const transcription = await client.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "pt",
  });

  return NextResponse.json({ text: transcription.text });
}
