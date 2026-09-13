import { NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/client-access";
import { listProjectPlanItems } from "@/lib/storage";

export async function GET() {
  const projectId = await requireClientAccess();
  if (projectId instanceof NextResponse) return projectId;
  return NextResponse.json({ items: await listProjectPlanItems(projectId) }, { headers: { "Cache-Control": "private, no-store" } });
}
