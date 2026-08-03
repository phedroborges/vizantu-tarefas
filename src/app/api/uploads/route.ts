import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(request: NextRequest) {
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

  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const filename = `${crypto.randomUUID()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOADS_DIR, filename), buffer);

  return NextResponse.json({ url: `/uploads/${filename}` }, { status: 201 });
}
