import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { saveProjectProfile } from "@/lib/storage";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json();
  try {
    return NextResponse.json({ profile: await saveProjectProfile(id, body) });
  } catch (error) {
    return apiFailure(error, "salvar o perfil do cliente");
  }
}
