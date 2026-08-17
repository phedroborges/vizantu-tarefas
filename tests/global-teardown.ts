import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { FIXTURE_PATH } from "./global-setup";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

export default async function globalTeardown() {
  if (!existsSync(FIXTURE_PATH)) return;
  const { memberId, viewerId, projectId } = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));

  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // projects -> tasks -> plans (cascade) já limpa quase tudo; announcements
  // criados pelo membro de teste também somem (created_by não é FK cascade,
  // então apagamos explicitamente).
  if (projectId) await db.from("projects").delete().eq("id", projectId);
  for (const id of [memberId, viewerId].filter(Boolean)) {
    await db.from("announcements").delete().eq("created_by", id);
    await db.from("member_list_access").delete().eq("member_id", id);
    await db.auth.admin.deleteUser(id).catch(() => {});
  }

  rmSync(FIXTURE_PATH, { force: true });
}
