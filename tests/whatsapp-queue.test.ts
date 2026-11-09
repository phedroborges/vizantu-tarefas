import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/lib/supabase-client", () => ({ getSupabase: getDb }));
vi.mock("@/lib/whatsapp/provider", () => ({ whatsappConfigured: () => true, sendWhatsappText: vi.fn(), sendWhatsappMedia: vi.fn() }));
import { queueApprovalNotice, queueStandaloneNotice } from "@/lib/whatsapp/queue";
import { sendWhatsappText } from "@/lib/whatsapp/provider";
import { pendingApprovalsByProject, processOutbox } from "@/lib/whatsapp/service";

type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
// Cada teste anda uma hora no relógio: o intervalo mínimo entre envios da fila
// fica na memória do módulo, e um teste não pode segurar o próximo.
let hour = 12;
const message = (row: Row) => ({ id: crypto.randomUUID(), kind: "approval", group_id: "grupo", status: "pending", scheduled_at: "2026-11-04T12:00:00Z", ...row });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`2026-11-04T${hour++}:00:00-03:00`)); // quarta-feira, dentro da janela
  tables = {
    whatsapp_messages: [],
    whatsapp_settings: [{ id: 1, settings: { enabled: true } }],
    project_communication: [{ project_id: "cliente", whatsapp_group_id: "grupo", notify_enabled: true, approval_deadline_days: 7 }],
  };
  getDb.mockReturnValue(createClient("https://database.example", "test", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, init) => {
    const url = new URL(String(input)); const table = url.pathname.split("/").at(-1)!;
    // Tabela que o teste não montou responde como banco fora do ar.
    if (!tables[table]) return Response.json({ message: "banco fora do ar" }, { status: 503 });
    const rows = tables[table];
    const matches = (row: Row) => [...url.searchParams].every(([key, value]) => {
      if (value.startsWith("eq.")) return String(row[key]) === value.slice(3);
      if (value.startsWith("lte.")) return String(row[key]) <= value.slice(4);
      if (value.startsWith("gte.")) return row[key] != null && new Date(String(row[key])) >= new Date(value.slice(4));
      if (value.startsWith("in.(")) return value.slice(4, -1).split(",").map((item) => item.replace(/"/g, "")).includes(String(row[key]));
      if (value.startsWith("like.")) return String(row[key]).startsWith(value.slice(5).replace(/%$/, ""));
      if (value === "not.is.null") return row[key] != null;
      if (value === "is.null") return row[key] == null;
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
afterEach(() => vi.useRealTimers());

it("cliente que já recebeu aviso hoje espera o de amanhã; os outros seguem", async () => {
  tables.tasks = []; tables.plans = []; tables.tags = [];
  tables.whatsapp_messages.push(
    message({ project_id: "cliente", dedupe_key: "approval:cliente:enviado", status: "sent", sent_at: "2026-11-04T09:00:00-03:00" }),
    message({ project_id: "cliente", dedupe_key: "approval:cliente:pending" }),
    message({ project_id: "outro", dedupe_key: "approval:outro:pending" }),
  );
  await processOutbox();
  expect(tables.whatsapp_messages.find((row) => row.dedupe_key === "approval:cliente:pending")?.status).toBe("pending");
  expect(tables.whatsapp_messages.find((row) => row.project_id === "outro")?.status).not.toBe("pending");
});

it("um envio que falha não barra o próximo aviso do mesmo cliente", async () => {
  await queueApprovalNotice("cliente");
  const [first] = tables.whatsapp_messages;
  first.scheduled_at = new Date(Date.now() - 1000).toISOString();

  await processOutbox(); // a leitura das tarefas falha antes de a chave ser liberada
  expect(first).toMatchObject({ status: "failed" });
  expect(first.dedupe_key).not.toBe("approval:cliente:pending");

  await queueApprovalNotice("cliente");
  expect(tables.whatsapp_messages.filter((row) => row.status === "pending" && row.dedupe_key === "approval:cliente:pending")).toHaveLength(1);
});

it("a mensagem só lista o que o cliente consegue aprovar no portal", async () => {
  const task = (id: string, status: string, due: string, link: string | null = null) => ({ id, project_id: "cliente", plan_id: "novembro", name: id, status, due_date: due, drive_link: link, description: null, format_tag_ids: [], status_history: [], updated_at: "2026-11-03T12:00:00Z" });
  tables.tasks = [
    task("texto", "aprovacao_copy", "2026-11-20"),
    task("voltou-para-texto", "aprovacao_copy", "2026-11-20"),
    task("ja-passou", "para_aprovacao", "2026-11-01", "https://drive.example/material"),
  ];
  tables.plans = [{ id: "novembro", title: "Plano", period_month: "2026-11", status: "draft", kind: "content", source: "native" }];
  tables.tags = [];
  tables.plan_item_approvals = [
    { task_id: "texto", status: "pending", review_version: 1 },
    { task_id: "voltou-para-texto", status: "pending", review_version: 100 },
    { task_id: "ja-passou", status: "pending", review_version: 100 },
  ];
  expect((await pendingApprovalsByProject()).get("cliente")?.map((item) => item.taskId)).toEqual(["texto"]);
});

it("com a pausa geral ligada, só o aviso de tarefa avulsa entra na fila", async () => {
  tables.whatsapp_settings[0].settings = { enabled: true, paused: true };
  await queueApprovalNotice("cliente");
  expect(tables.whatsapp_messages).toHaveLength(0);
  await queueStandaloneNotice("cliente", "tarefa");
  expect(tables.whatsapp_messages.map((row) => row.dedupe_key)).toEqual(["standalone:tarefa:pending"]);
});

it("com a pausa geral ligada, o aviso de tarefa avulsa sai e o do plano continua parado", async () => {
  tables.whatsapp_settings[0].settings = { enabled: true, paused: true };
  tables.projects = [{ id: "cliente", name: "Cliente", client: null }];
  tables.tags = [];
  tables.tasks = [{ id: "tarefa", name: "Peça avulsa", status: "para_aprovacao", drive_link: "https://drive.example/material", due_date: null, description: null, format_tag_ids: [] }];
  const old = "2026-11-04T12:00:00Z";
  tables.whatsapp_messages.push(
    message({ project_id: "cliente", dedupe_key: "approval:cliente:pending", scheduled_at: old }),
    message({ project_id: "cliente", dedupe_key: "standalone:tarefa:pending", scheduled_at: old }),
  );
  vi.mocked(sendWhatsappText).mockClear();
  await processOutbox();
  expect(sendWhatsappText).toHaveBeenCalledTimes(1);
  expect(tables.whatsapp_messages.find((row) => String(row.dedupe_key).startsWith("standalone:"))?.status).toBe("sent");
  expect(tables.whatsapp_messages.find((row) => row.dedupe_key === "approval:cliente:pending")?.status).toBe("pending");
});
