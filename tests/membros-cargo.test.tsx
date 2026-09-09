// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { MembrosView } from "../src/components/membros-view";
import { USER_ROLES, type Member, type UserRole } from "../src/lib/types";

// Um <select> cujo value não bate com nenhuma <option> exibe a PRIMEIRA da
// lista. Como "Dono" abre a lista de cargos, todo mundo gravado com um cargo
// antigo aparecia como dono — a tela dizendo o contrário do banco, justo na
// tela onde se define permissão.

const NOW = "2026-09-09T12:00:00.000Z";
const membro = (id: string, name: string, role: string): Member => ({
  id, name, email: `${id}@teste.com`, role: role as UserRole,
  aiEnabled: false, active: true, createdAt: NOW, updatedAt: NOW,
});

// MembrosView guarda a lista em useState(initialMembers), então trocar a prop
// numa raiz já montada não muda nada. Cada caso monta do zero.
const montados: { container: HTMLDivElement; root: Root }[] = [];

function render(members: Member[]) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  montados.push({ container, root });
  act(() => {
    root.render(<MembrosView initialMembers={members} projects={[]} initialProjectAccess={{}} initialListAccess={{}} />);
  });
  // O último <select> da tela é o da pessoa listada; o primeiro é o do
  // formulário de cadastro.
  return [...container.querySelectorAll("select")].at(-1)!;
}

afterEach(() => {
  for (const { container, root } of montados.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
});

describe("seletor de cargo na tela de Membros", () => {
  it("mostra o cargo real de quem tem um cargo válido", () => {
    expect(render([membro("m1", "Erika", "diretor_criativo")]).value).toBe("diretor_criativo");
  });

  it("não deixa um cargo antigo se passar por Dono", () => {
    const alvo = render([membro("m1", "Erika", "editor")]);
    expect(alvo.value).toBe("editor");
    expect(alvo.value).not.toBe("dono");
    const opcao = [...alvo.options].find((item) => item.value === "editor");
    expect(opcao?.textContent).toContain("Cargo antigo");
    expect(alvo.className).toContain("is-cargo-antigo");
  });

  it("o dono continua aparecendo como dono", () => {
    expect(render([membro("m1", "Phedro", "dono")]).value).toBe("dono");
  });

  it("todo cargo válido tem opção própria", () => {
    for (const papel of USER_ROLES) {
      expect(render([membro("m1", "Alguém", papel.value)]).value, papel.value).toBe(papel.value);
    }
  });
});
