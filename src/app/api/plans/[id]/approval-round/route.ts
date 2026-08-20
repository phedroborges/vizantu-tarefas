import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { ApprovalRoundError, openPlanApprovalRound } from "@/lib/storage";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json();
  if (body.stage !== "copy" && body.stage !== "creative") return NextResponse.json({ error: "Etapa inválida." }, { status: 400 });
  try {
    return NextResponse.json(await openPlanApprovalRound(id, body.stage));
  } catch (error) {
    if (error instanceof ApprovalRoundError) return NextResponse.json({ error: error.message, blockers: error.blockers }, { status: 400 });
    throw error;
  }
}
