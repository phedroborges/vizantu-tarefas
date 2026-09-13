import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { it } from 'vitest';
it("protege o razão financeiro, serializa baixas e mantém histórico", async () => {
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create table public.members(id uuid primary key); create table public.projects(id uuid primary key); create table public.tasks(id uuid primary key);`);
const sql = readFileSync(new URL('../supabase/migrations/20260913132158_finance_dashboard.sql', import.meta.url),'utf8');
await db.exec(sql);
const actor='11111111-1111-4111-8111-111111111111', entry='22222222-2222-4222-8222-222222222222', pay='33333333-3333-4333-8333-333333333333';
await db.exec(`insert into public.members values ('${actor}'); set role service_role; insert into finance_entries(id,direction,category,description,amount,due_date,competence,updated_by) values ('${entry}','income','servicos','Teste',10000,'2026-09-01','2026-09','${actor}');`);
await db.query(`select finance_edit($1,10000,'2026-09-01','2026-09','Teste editado','nota',$2)`,[entry,actor]);
await db.query(`select finance_settle($1,4000,'2026-09-01','Pix','ref',$2,$3)`,[entry,actor,pay]);
await db.query(`select finance_settle($1,4000,'2026-09-01','Pix','ref',$2,$3)`,[entry,actor,pay]);
assert.equal((await db.query<{n:number}>('select count(*)::int as n from finance_payments')).rows[0].n,1);
await assert.rejects(db.query(`select finance_settle($1,7000,'2026-09-01','Pix','ref',$2,gen_random_uuid())`,[entry,actor]), /saldo/);
await assert.rejects(db.query(`select finance_cancel($1,$2)`,[entry,actor]), /Estorne/);
await assert.rejects(db.query(`select finance_edit($1,10000,'2026-09-01','2026-09','Alterado','',$2)`,[entry,actor]), /Estorne/);
await db.query(`select finance_reverse($1,$2)`,[pay,actor]);
await db.query(`select finance_cancel($1,$2)`,[entry,actor]);
assert.equal((await db.query<{cancelled:boolean}>('select cancelled from finance_entries')).rows[0].cancelled,true);
assert.ok((await db.query<{n:number}>('select count(*)::int as n from finance_audit')).rows[0].n>=4);
const series='44444444-4444-4444-8444-444444444444';
const future='55555555-5555-4555-8555-555555555555';
await db.query(`insert into finance_entries(id,direction,category,description,amount,due_date,competence,series_id,updated_by) values ($1,'income','servicos','Recorrente',10000,'2026-10-01','2026-10',$2,$3)`,[future,series,actor]);
await db.query(`insert into finance_entries(direction,category,description,amount,due_date,competence,series_id,updated_by) values ('income','servicos','Recorrente 2',10000,'2026-11-01','2026-11',$1,$2)`,[series,actor]);
assert.equal((await db.query<{n:number}>(`select finance_cancel_series($1,$2) as n`,[future,actor])).rows[0].n,2);
await db.exec('reset role; set role authenticated;');
await assert.rejects(db.query('select * from finance_entries'), /permission denied/);
await assert.rejects(db.query(`select finance_cancel($1,$2)`,[entry,actor]), /permission denied/);
await db.exec('reset role; set role anon;');
await assert.rejects(db.query('select * from finance_payments'), /permission denied/);

await db.close();

});
