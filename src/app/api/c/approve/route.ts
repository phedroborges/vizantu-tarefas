import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { CLIENT_SESSION_COOKIE, verifyClientSession } from "@/lib/client-session";
import { ApprovalResponseError, submitPlanApprovalResponse } from "@/lib/storage";

const VALID_STATUSES = new Set(["approved", "changes_requested", "rejected"]);

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const projectId = verifyClientSession(cookieStore.get(CLIENT_SESSION_COOKIE)?.value);
  if (!projectId) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  const body = await request.json();
  if (!body?.taskId || typeof body.taskId !== "string") {
    return NextResponse.json({ error: "Item inválido." }, { status: 400 });
  }
  if (!VALID_STATUSES.has(body.status)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }
  if (!body?.reviewerName || typeof body.reviewerName !== "string" || !body.reviewerName.trim()) {
    return NextResponse.json({ error: "Informe seu nome." }, { status: 400 });
  }
  if (body.comment !== undefined && typeof body.comment !== "string") {
    return NextResponse.json({ error: "Comentário inválido." }, { status: 400 });
  }
  if (body.reviewVersion !== undefined && (!Number.isInteger(body.reviewVersion) || body.reviewVersion < 1)) {
    return NextResponse.json({ error: "Rodada inválida." }, { status: 400 });
  }
  if ((body.status === "changes_requested" || body.status === "rejected") && (!body.comment || !body.comment.trim())) {
    return NextResponse.json({ error: "Informe o motivo da reprovação ou o ajuste necessário." }, { status: 400 });
  }

  try {
    const result = await submitPlanApprovalResponse({
      projectId,
      taskId: body.taskId,
      reviewerName: body.reviewerName.trim(),
      status: body.status,
      comment: body.comment,
      reviewVersion: body.reviewVersion,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApprovalResponseError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    throw error;
  }
}
