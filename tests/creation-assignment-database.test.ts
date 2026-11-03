import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";

const db = new PGlite();
const erika = "8f818af5-4e90-4119-b267-7a19ada8a1be";
const other = "00000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  await db.exec(`
    create role service_role;
    create table members(id uuid primary key, active boolean);
    create table tasks(id integer generated always as identity primary key,
      status text, assignee_id uuid references members(id), assignee_source text,
      lists text[] default '{}', status_history jsonb default '[]');
    insert into members values ('${erika}', true), ('${other}', true);
  `);
  await db.exec(readFileSync("supabase/migrations/20261103151522_assign_creation_to_erika.sql", "utf8"));
}, 30000);
afterAll(() => db.close());

it("atribui a Erika ao entrar, mantendo o histórico anterior", async () => {
  const { rows: [created] } = await db.query<{ id: number }>(
    `insert into tasks(status,assignee_id,status_history) values ('aprovacao_copy',$1,$2) returning id`,
    [other, JSON.stringify([{ status: "aprovacao_copy", assigneeId: other, exitedAt: null }])]);
  const { rows: [ready] } = await db.query<{ assignee_id: string; assignee_source: string; lists: string[]; status_history: { assigneeId: string; exitedAt: string | null }[] }>(
    "update tasks set status='pronto_para_criacao' where id=$1 returning *", [created.id]);
  expect(ready.assignee_id).toBe(erika);
  expect(ready.assignee_source).toBe("manual");
  expect(ready.lists).toEqual(["criativa"]);
  expect(ready.status_history).toHaveLength(2);
  expect(ready.status_history[0].assigneeId).toBe(other);
  expect(ready.status_history[0].exitedAt).not.toBeNull();
  expect(ready.status_history[1].assigneeId).toBe(erika);
});

it("corrige o período criado pelo aplicativo sem duplicá-lo", async () => {
  const history = [{ status: "pronto_para_criacao", exitedAt: null, assigneeId: other }];
  const { rows: [row] } = await db.query<{ status_history: typeof history; assignee_id: string }>(
    "insert into tasks(status,assignee_id,status_history) values ('pronto_para_criacao',$1,$2) returning *", [other, JSON.stringify(history)]);
  expect(row.status_history).toHaveLength(1);
  expect(row.status_history[0].assigneeId).toBe(erika);
  expect(row.assignee_id).toBe(erika);
});

it("permite reatribuir depois e aplica novamente ao reentrar no status", async () => {
  const { rows: [row] } = await db.query<{ id: number }>("insert into tasks(status) values ('pronto_para_criacao') returning id");
  const { rows: [reassigned] } = await db.query<{ assignee_id: string }>(
    "update tasks set assignee_id=$1,status='pronto_para_criacao' where id=$2 returning *", [other, row.id]);
  expect(reassigned.assignee_id).toBe(other);
  await db.query("update tasks set status='ajuste' where id=$1", [row.id]);
  const { rows: [again] } = await db.query<{ assignee_id: string }>("update tasks set status='pronto_para_criacao' where id=$1 returning *", [row.id]);
  expect(again.assignee_id).toBe(erika);
});

it("preserva o responsável de outros status", async () => {
  const { rows: [row] } = await db.query<{ assignee_id: string }>(
    "insert into tasks(status,assignee_id) values ('aguardando_captacao',$1) returning *", [other]);
  expect(row.assignee_id).toBe(other);
});

it("não salva a mudança silenciosamente se Erika estiver inativa", async () => {
  await db.query("update members set active=false where id=$1", [erika]);
  try {
    await expect(db.query("insert into tasks(status) values ('pronto_para_criacao')"))
      .rejects.toThrow("precisa estar ativa");
  } finally {
    await db.query("update members set active=true where id=$1", [erika]);
  }
});
