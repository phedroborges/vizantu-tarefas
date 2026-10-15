import { NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/client-access";
import { clientPlanView } from "@/lib/storage";

export async function GET(request: Request) {
  const projectId = await requireClientAccess();
  if (projectId instanceof NextResponse) return projectId;
  return NextResponse.json(await clientPlanView(projectId, new URL(request.url).searchParams.get("planId") || undefined), { headers: { "Cache-Control": "private, no-store" } });
}
