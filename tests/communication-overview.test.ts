import { describe, expect, it } from "vitest";
import { clientState } from "../src/lib/whatsapp/overview";

const base = { hasGroup: true, notifyEnabled: true, hasLink: true, waiting: 3, notNotified: 0 };

describe("situação da comunicação com cada cliente", () => {
  it("avisado quando o grupo já recebeu tudo que está pendente", () => {
    expect(clientState(base)).toBe("avisado");
  });

  it("falta avisar quando há conteúdo que o grupo ainda não recebeu", () => {
    expect(clientState({ ...base, notNotified: 1 })).toBe("falta_avisar");
  });

  // O que impede qualquer aviso vem antes de perguntar se há o que avisar.
  it("sem grupo e avisos desligados aparecem como tal, com ou sem pendência", () => {
    expect(clientState({ ...base, hasGroup: false, notNotified: 3 })).toBe("sem_grupo");
    expect(clientState({ ...base, notifyEnabled: false, notNotified: 3 })).toBe("avisos_desligados");
  });

  it("sem link do portal só é problema quando há o que aprovar", () => {
    expect(clientState({ ...base, hasLink: false, notNotified: 3 })).toBe("sem_link");
    expect(clientState({ ...base, hasLink: false, waiting: 0 })).toBe("em_dia");
  });

  it("nada pendente quando não há conteúdo com o cliente", () => {
    expect(clientState({ ...base, waiting: 0 })).toBe("em_dia");
  });
});
