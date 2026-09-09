import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { getSupabase, getSupabaseStorageBucket } from "@/lib/supabase-client";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
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
