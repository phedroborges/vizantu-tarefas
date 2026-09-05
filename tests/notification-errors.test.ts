import { describe, expect, it } from "vitest";
import { isNotificationsTableMissing } from "../src/lib/storage";

describe("compatibilidade enquanto a migration de notificações é aplicada", () => {
  it("reconhece o erro real devolvido pelo cache de schema do PostgREST", () => {
    expect(isNotificationsTableMissing(new Error("Could not find the table 'public.notifications' in the schema cache"))).toBe(true);
  });

  it("não mascara falhas de outras tabelas", () => {
    expect(isNotificationsTableMissing(new Error("relation public.tasks does not exist"))).toBe(false);
  });
});
