import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";

const db = new PGlite();
const plan1 = "00000000-0000-4000-8000-000000000001";
const plan2 = "00000000-0000-4000-8000-000000000002";
const video = "00000000-0000-4000-8000-000000000011";
const carousel = "00000000-0000-4000-8000-000000000012";
const ad = "00000000-0000-4000-8000-000000000013";
type Task = { id: string; name: string; naming_number: number; naming_prefix: string; comments: unknown[] };
const insert = async (name: string, formats: string[] = [video], plan = plan1) => (
  await db.query<Task>("insert into tasks(name,format_tag_ids,plan_id) values($1,$2,$3) returning *", [name, formats, plan])
).rows[0];

beforeAll(async () => {
  await db.exec(`
    create role service_role bypassrls; create role anon; create role authenticated;
    create table plans(id uuid primary key);
    create table tags(id uuid primary key, kind text, label text);
    create table tasks(id uuid primary key default gen_random_uuid(), plan_id uuid not null references plans(id),
      project_id uuid, name text not null, format_tag_ids uuid[] default '{}', due_date date,
      created_at timestamptz default now(), comments jsonb default '[]');
    insert into plans values('${plan1}'),('${plan2}');
    insert into tags values('${video}','formato','Reels'),('${carousel}','formato','Carrossel'),('${ad}','formato','Anúncios');
    grant all on tasks, plans, tags to service_role;
    insert into tasks(plan_id,name,format_tag_ids,due_date) values
      ('${plan1}','V2 · Segundo',array['${video}']::uuid[],'2026-11-01'),
      ('${plan1}','V1 · Primeiro',array['${video}']::uuid[],'2026-11-02'),
      ('${plan1}','Sem código',array['${video}']::uuid[],'2026-10-01');
  `);
  await db.exec(readFileSync("supabase/migrations/20261103205305_task_naming_standard.sql", "utf8"));
}, 30000);
afterAll(() => db.close());

it("padroniza o legado preservando os códigos já corretos", async () => {
  const { rows } = await db.query<Task>("select * from tasks order by naming_number");
  expect(rows.map(r => r.name)).toEqual(["V1 · Primeiro", "V2 · Segundo", "V3 · Sem código"]);
  expect(rows[2].comments).toEqual(expect.arrayContaining([expect.objectContaining({ oldValue: "Sem código" })]));
});

it("mantém sequências independentes por plano/formato e dá prioridade ao formato físico", async () => {
  expect((await insert("Anúncio", [ad, video], plan2)).name).toBe("V1 · Anúncio");
  expect((await insert("Explicação", [carousel], plan2)).name).toBe("C1 · Explicação");
  expect((await insert("Operacional", [], plan2)).name).toBe("T1 · Operacional");
});

it("corrige prefixos escritos à mão e conserva o número ao renomear e reagendar", async () => {
  const row = await insert("c99 - v88 · Assunto");
  expect(row.name).toMatch(/^V\d+ · Assunto$/);
  const { rows: [edited] } = await db.query<Task>("update tasks set name='Outro título',due_date='2026-12-01',naming_number=999 where id=$1 returning *", [row.id]);
  expect(edited.name).toBe(`V${row.naming_number} · Outro título`);
});

it("duplicação, transferência e mudança de formato geram códigos distintos", async () => {
  const first = await insert("Duplicar");
  const duplicate = await insert(first.name);
  expect(duplicate.name).not.toBe(first.name);
  const { rows: [moved] } = await db.query<Task>("update tasks set plan_id=$1 where id=$2 returning *", [plan2, first.id]);
  expect(moved.name).toMatch(/^V\d+ · Duplicar$/);
  const { rows: [changed] } = await db.query<Task>("update tasks set format_tag_ids=$1 where id=$2 returning *", [[carousel], first.id]);
  expect(changed.name).toBe("C2 · Duplicar");
});

it("não reutiliza número excluído e serializa criações concorrentes", async () => {
  const deleted = await insert("Apagar");
  await db.query("delete from tasks where id=$1", [deleted.id]);
  const rows = await Promise.all(Array.from({ length: 10 }, (_, i) => insert(`Lote ${i}`)));
  expect(new Set(rows.map(r => r.name)).size).toBe(10);
  expect(rows.every(r => r.naming_number > deleted.naming_number)).toBe(true);
});

it("funciona com o papel do servidor e protege os contadores do acesso público", async () => {
  await db.exec("set role service_role");
  try { expect((await insert("Servidor")).name).toMatch(/^V\d+ · Servidor$/); }
  finally { await db.exec("reset role"); }
  await db.exec("set role anon");
  try { await expect(db.query("select * from task_naming_counters")).rejects.toThrow(/permission denied/); }
  finally { await db.exec("reset role"); }
});

it("rejeita código sem título", async () => {
  await expect(insert("V1 · ")).rejects.toThrow("Informe o título");
});
