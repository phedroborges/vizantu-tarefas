import { createClient } from "@supabase/supabase-js";
import { beforeEach, expect, it, vi } from "vitest";
const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/lib/supabase-client", () => ({ getSupabase: getDb }));
vi.mock("@/lib/whatsapp/provider", () => ({ whatsappConfigured: () => true, sendWhatsappText: vi.fn(), sendWhatsappMedia: vi.fn() }));
import { queueApprovalNotice } from "@/lib/whatsapp/queue";
import { processApprovalNotices } from "@/lib/whatsapp/service";

type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
beforeEach(() => {
  tables = {
    whatsapp_messages: [],
    whatsapp_settings: [{ id: 1, settings: { enabled: true } }],
    project_communication: [{ project_id: "cliente", whatsapp_group_id: "grupo", notify_enabled: true, approval_deadline_days: 7 }],
  };
  getDb.mockReturnValue(createClient("https://database.example", "test", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, init) => {
    const url = new URL(String(input)); const table = url.pathname.split("/").at(-1)!;
    // Leitura das tarefas falha: é a falha passageira que acontece antes de a chave ser liberada.
    if (!tables[table]) return Response.json({ message: "banco fora do ar" }, { status: 503 });
    const rows = tables[table];
    const matches = (row: Row) => [...url.searchParams].every(([key, value]) => {
      if (value.startsWith("eq.")) return String(row[key]) === value.slice(3);
      if (value.startsWith("lte.")) return String(row[key]) <= value.slice(4);
      return true;
    });
    let result = rows.filter(matches);
    if (init?.method === "PATCH") result.forEach((row) => Object.assign(row, JSON.parse(String(init.body))));
    if (init?.method === "POST") {
      const row = JSON.parse(String(init.body)) as Row;
      result = rows.some((existing) => existing.dedupe_key === row.dedupe_key) ? [] : [row];
      rows.push(...result);
    }
    const single = new Headers(init?.headers).get("accept")?.includes("vnd.pgrst.object");
    return Response.json(single ? result[0] ?? null : result);
  } } }));
});

it("um envio que falha não barra o próximo aviso do mesmo cliente", async () => {
  await queueApprovalNotice("cliente");
  const [first] = tables.whatsapp_messages;
  first.scheduled_at = new Date(Date.now() - 1000).toISOString();

  await processApprovalNotices();
  expect(first).toMatchObject({ status: "failed" });
  expect(first.dedupe_key).not.toBe("approval:cliente:pending");

  await queueApprovalNotice("cliente");
  expect(tables.whatsapp_messages.filter((row) => row.status === "pending" && row.dedupe_key === "approval:cliente:pending")).toHaveLength(1);
});
