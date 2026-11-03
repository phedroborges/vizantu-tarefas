import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";

const db = new PGlite();
let task: string;
beforeAll(async () => {
  await db.exec(`
    create role service_role;
    create table members (id uuid primary key default gen_random_uuid(), name text, role text, created_at timestamptz default now());
    create table assistant_conversations (id uuid primary key default gen_random_uuid(), title text, messages jsonb default '[]', created_at timestamptz default now(), updated_at timestamptz default now());
    create table tasks (id uuid primary key default gen_random_uuid(), comments jsonb not null default '[]', updated_at timestamptz);
    insert into members (name, role) values ('Phedro', 'dono');
    insert into assistant_conversations (title) values ('Antiga');
  `);
  await db.exec(readFileSync("supabase/migrations/20261103120000_comentarios_e_conversas.sql", "utf8"));
  task = (await db.query<{ id: string }>(`insert into tasks (comments) values ('[{"id":"a"}]') returning id`)).rows[0].id;
}, 30000);
afterAll(() => db.close());

it("dois comentários seguidos somam à lista, sem um apagar o outro", async () => {
  await Promise.all([
    db.query("select * from append_task_comments($1, $2)", [task, JSON.stringify([{ id: "b" }])]),
    db.query("select * from append_task_comments($1, $2)", [task, JSON.stringify([{ id: "c" }])]),
  ]);
  const { rows } = await db.query<{ comments: { id: string }[] }>("select comments from tasks where id = $1", [task]);
  expect(rows[0].comments.map((comment) => comment.id).sort()).toEqual(["a", "b", "c"]);
});

it("conversa antiga do assistente fica com o dono da conta", async () => {
  const { rows } = await db.query<{ role: string }>("select m.role from assistant_conversations c join members m on m.id = c.member_id");
  expect(rows).toEqual([{ role: "dono" }]);
});
