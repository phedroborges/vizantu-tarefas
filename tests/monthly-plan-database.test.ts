import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PGlite();
let project: string;
let current: string;
beforeAll(async () => {
  await db.exec(`
    create role service_role;
    create table projects (id uuid primary key default gen_random_uuid(), name text, status text default 'ativo');
    create table plans (id uuid primary key default gen_random_uuid(), project_id uuid references projects(id), title text, kind text, status text, source text, period_month text);
    create unique index plans_project_period_month_key on plans(project_id, period_month) where period_month is not null;
    create table tags (id uuid primary key default gen_random_uuid(), kind text, label text);
    create table plan_captacoes (id uuid primary key default gen_random_uuid(), plan_id uuid references plans(id), label text, package_kind text, sequence_order int, editing_assignee_id uuid, recording_assignee_id uuid);
    create table tasks (id uuid primary key default gen_random_uuid(), project_id uuid references projects(id), plan_id uuid references plans(id), captacao_id uuid references plan_captacoes(id), created_at timestamptz default now(), due_date date, name text, kind text, status text, lists text[], format_tag_ids uuid[], assignee_id uuid, assignee_source text, sequence_order int, status_history jsonb, comments jsonb, updated_at timestamptz);
    insert into projects (name) values ('Legado');
    insert into tasks (project_id, created_at) select id, '2026-01-15T12:00:00Z' from projects;
  `);
  await db.exec(readFileSync("supabase/migrations/20261015191508_automatic_monthly_plan_lifecycle.sql", "utf8"));
  project = (await db.query<{ id: string }>("insert into projects (name) values ('Cliente novo') returning id")).rows[0].id;
  current = (await db.query<{ month: string }>("select to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM') as month")).rows[0].month;
}, 30000);
afterAll(() => db.close());
describe("garantias transacionais do plano", () => {
  it("cliente novo já tem três meses, sem duplicação", async () => {
    await db.query("select ensure_monthly_plan($1, $2)", [project, current]);
    expect((await db.query("select id from plans where project_id = $1", [project])).rows).toHaveLength(3);
  });
  it("migra tarefas soltas pelo mês de criação", async () => {
    const result = await db.query<{ period_month: string }>("select p.period_month from tasks t join plans p on p.id = t.plan_id where t.created_at < '2026-02-01'");
    expect(result.rows[0].period_month).toBe("2026-01");
  });
  it("sem prazo ou com prazo futuro, novas tarefas recebem o mês atual", async () => {
    await db.query("insert into tasks (project_id, due_date) values ($1, null), ($1, '2099-12-01')", [project]);
    const rows = (await db.query<{ period_month: string }>("select p.period_month from tasks t join plans p on p.id = t.plan_id where t.project_id = $1", [project])).rows;
    expect(rows).toHaveLength(2);
    expect(rows.every(r => r.period_month === current)).toBe(true);
  });
  it("aceita campanha explícita e impede plano de outro cliente ou mês encerrado", async () => {
    const campaign = (await db.query<{ id: string }>("insert into plans (project_id, title, kind, status) values ($1, 'Lançamento', 'content', 'draft') returning id", [project])).rows[0].id;
    await db.query("insert into tasks (project_id, plan_id) values ($1, $2)", [project, campaign]);
    const old = (await db.query<{ id: string }>("select id from plans where period_month = '2026-01'")).rows[0].id;
    await expect(db.query("insert into tasks (project_id, plan_id) values ($1, $2)", [project, old])).rejects.toThrow("cliente");
    const expired = (await db.query<{ id: string }>("select ensure_monthly_plan($1, '2020-01') as id", [project])).rows[0].id;
    await expect(db.query("insert into tasks (project_id, plan_id) values ($1, $2)", [project, expired])).rejects.toThrow("encerrado");
  });
  it("cria os cinco conteúdos dentro do pacote com formato, responsável e histórico", async () => {
    const format = (await db.query<{ id: string }>("insert into tags (kind, label) values ('formato', 'Reels') returning id")).rows[0].id;
    const target = (await db.query<{ id: string }>("select ensure_monthly_plan($1, $2) as id", [project, current])).rows[0].id;
    const editor = "00000000-0000-0000-0000-000000000001";
    const result = await db.query<{ id: string }>("select create_ready_package($1, '1ª Captação', 'capture', 5, $2, $3) as id", [target, format, editor]);
    const tasks = (await db.query<{ plan_id: string; assignee_id: string; name: string }>("select * from tasks where captacao_id = $1 order by sequence_order", [result.rows[0].id])).rows;
    expect(tasks).toHaveLength(5);
    expect(tasks.every(t => t.plan_id === target && t.assignee_id === editor)).toBe(true);
    expect(tasks[0].name).toBe("Reels 1 · 1ª Captação");
    const before = (await db.query("select * from plan_captacoes")).rows.length;
    await expect(db.query("select create_ready_package($1, 'Falha', 'capture', 5, $2)", [target, editor])).rejects.toThrow();
    expect((await db.query("select * from plan_captacoes")).rows).toHaveLength(before);
  });
});
