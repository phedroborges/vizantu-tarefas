import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { createMember, listMembers } from "@/lib/storage";
import { getSupabase } from "@/lib/supabase-client";
import { USER_ROLES } from "@/lib/types";

export async function GET() {
  // Aberto a qualquer autenticado: a lista de nomes alimenta o dropdown de
  // responsável nas tarefas em toda a UI, não só o painel de usuários.
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  const members = await listMembers();
  return NextResponse.json({ members });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(["dono"]);
  if (isResponse(auth)) return auth;

  const body = await request.json();
  if (!body?.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Informe o nome." }, { status: 400 });
  }
  if (!body?.email || typeof body.email !== "string" || !body.email.trim()) {
    return NextResponse.json({ error: "Informe o e-mail." }, { status: 400 });
  }
  if (!body?.password || typeof body.password !== "string" || body.password.length < 8) {
    return NextResponse.json({ error: "A senha precisa ter pelo menos 8 caracteres." }, { status: 400 });
  }
  if (!USER_ROLES.some((r) => r.value === body.role)) {
    return NextResponse.json({ error: "Papel inválido." }, { status: 400 });
  }

  const admin = getSupabase().auth.admin;
  const { data: authUser, error: authError } = await admin.createUser({
    email: body.email.trim().toLowerCase(),
    password: body.password,
    email_confirm: true,
  });
  if (authError || !authUser.user) {
    return NextResponse.json({ error: authError?.message || "Não foi possível criar o usuário." }, { status: 400 });
  }

  try {
    const member = await createMember({
      id: authUser.user.id,
      name: body.name,
      email: body.email,
      role: body.role,
      aiEnabled: Boolean(body.aiEnabled),
    });
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    // Não deixa sobrar um usuário órfão no Auth se o insert em members falhar.
    await admin.deleteUser(authUser.user.id);
    const message = error instanceof Error ? error.message : "Não foi possível salvar o usuário.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
