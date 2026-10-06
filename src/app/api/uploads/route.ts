import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { getSupabase, getSupabaseStorageBucket } from "@/lib/supabase-client";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Áudio de comentário: o que o gravador dos navegadores produz (webm no
// Chrome/Firefox, mp4 no Safari) e os formatos comuns de arquivo.
const AUDIO_EXTENSION_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  // Todo cargo com login edita tarefa, e imagem na descrição faz parte disso —
  // a barreira que existia aqui separava editor de visualizador, papéis que não
  // existem mais.
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo de imagem." }, { status: 400 });
  }
  // O gravador manda "audio/webm;codecs=opus": o codec não muda o contêiner.
  const mime = file.type.split(";")[0].trim().toLowerCase();
  const audioExtension = AUDIO_EXTENSION_BY_MIME[mime];
  if (audioExtension) {
    if (file.size > MAX_AUDIO_BYTES) return NextResponse.json({ error: "Áudio muito grande (máximo 15MB)." }, { status: 400 });
    if (!file.size) return NextResponse.json({ error: "A gravação ficou vazia. Grave de novo." }, { status: 400 });
    const audioName = `${crypto.randomUUID()}.${audioExtension}`;
    const audioBucket = getSupabaseStorageBucket();
    const { error: audioError } = await getSupabase().storage.from(audioBucket).upload(audioName, file, { contentType: mime, cacheControl: "31536000" });
    if (audioError) return apiFailure(audioError, "enviar o áudio");
    return NextResponse.json({ url: getSupabase().storage.from(audioBucket).getPublicUrl(audioName).data.publicUrl }, { status: 201 });
  }
  const extension = EXTENSION_BY_MIME[file.type];
  if (!extension) {
    return NextResponse.json({ error: "Formato de imagem não suportado. Use PNG, JPG, WEBP ou GIF." }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Imagem muito grande (máximo 8MB)." }, { status: 400 });
  }

  const filename = `${crypto.randomUUID()}.${extension}`;
  const bucket = getSupabaseStorageBucket();
  const { error } = await getSupabase()
    .storage.from(bucket)
    .upload(filename, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) return apiFailure(error, "enviar a imagem");

  const { data } = getSupabase().storage.from(bucket).getPublicUrl(filename);
  return NextResponse.json({ url: data.publicUrl }, { status: 201 });
}
