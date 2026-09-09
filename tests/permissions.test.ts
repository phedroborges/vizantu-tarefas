import { describe, expect, it } from "vitest";
import {
  ROLES_DE_GESTAO, ROLES_DO_TIME, ROLES_QUE_PLANEJAM,
  abasDoProjeto, podePlanejar, podeVer, podeVerCredenciais, podeGerenciarCredenciais, podeGerenciarMembros,
  projetosDoMembro, rolesQueVeem, telaInicial, veTodosOsProjetos,
  type AppArea,
} from "../src/lib/permissions";
import { podeAbrirProjeto } from "../src/lib/authz";
import type { CurrentUser } from "../src/lib/current-user";
import { USER_ROLES, type UserRole } from "../src/lib/types";

const CARGOS = USER_ROLES.map((papel) => papel.value);

describe("o que cada cargo enxerga", () => {
  it("o dono não tem exceção", () => {
    const areas: AppArea[] = ["dashboard", "projetos", "tarefas", "notificacoes", "planos", "pesquisas", "marcas", "contratos", "membros", "conhecimento", "assistente"];
    for (const area of areas) expect(podeVer("dono", area), area).toBe(true);
  });

  it("o gestor gerencia entrega: painel e contratos sim, membros e base não", () => {
    for (const area of ["dashboard", "contratos", "pesquisas", "planos", "projetos", "tarefas"] as AppArea[]) {
      expect(podeVer("gestor", area), area).toBe(true);
    }
    for (const area of ["membros", "conhecimento", "marcas"] as AppArea[]) {
      expect(podeVer("gestor", area), area).toBe(false);
    }
  });

  it("o social media planeja e pesquisa, mas não vê painel, contrato nem marca", () => {
    for (const area of ["projetos", "tarefas", "planos", "pesquisas", "notificacoes"] as AppArea[]) {
      expect(podeVer("social_media", area), area).toBe(true);
    }
    for (const area of ["dashboard", "contratos", "marcas", "membros", "conhecimento"] as AppArea[]) {
      expect(podeVer("social_media", area), area).toBe(false);
    }
  });

  it("o diretor criativo executa: tarefas, planos e marcas, sem pesquisa nem painel", () => {
    for (const area of ["projetos", "tarefas", "planos", "marcas", "notificacoes"] as AppArea[]) {
      expect(podeVer("diretor_criativo", area), area).toBe(true);
    }
    for (const area of ["dashboard", "pesquisas", "contratos", "membros", "conhecimento"] as AppArea[]) {
      expect(podeVer("diretor_criativo", area), area).toBe(false);
    }
  });

  it("membros e base de conhecimento não saem do dono", () => {
    expect(rolesQueVeem("membros")).toEqual(["dono"]);
    expect(rolesQueVeem("conhecimento")).toEqual(["dono"]);
    expect(CARGOS.filter(podeGerenciarMembros)).toEqual(["dono"]);
  });

  // Quem publica precisa entrar na conta do cliente. O diretor criativo produz
  // o material mas não sobe nada, então fica de fora — e cadastrar ou apagar
  // senha continua sendo só do dono.
  it("a senha do cliente abre para quem publica, mas só o dono cadastra", () => {
    expect(CARGOS.filter(podeVerCredenciais)).toEqual(["dono", "gestor", "social_media"]);
    expect(CARGOS.filter(podeGerenciarCredenciais)).toEqual(["dono"]);
    expect(podeVerCredenciais("diretor_criativo")).toBe(false);
  });

  it("painel e contrato são de quem gerencia", () => {
    expect(rolesQueVeem("dashboard")).toEqual(["dono", "gestor"]);
    expect(rolesQueVeem("contratos")).toEqual(["dono", "gestor"]);
    expect(ROLES_DE_GESTAO).toEqual(["dono", "gestor"]);
  });

  it("marca é do diretor criativo, não do social media", () => {
    expect(rolesQueVeem("marcas")).toEqual(["dono", "diretor_criativo"]);
  });

  // Se a tela inicial de um cargo fosse uma área que ele não pode ver, o guarda
  // de página o mandaria para ela e de volta, para sempre.
  it("a tela inicial de cada cargo é uma tela que ele pode abrir", () => {
    const AREA_POR_ROTA: Record<string, AppArea> = { "/": "dashboard", "/planos": "planos", "/tarefas": "tarefas" };
    for (const cargo of CARGOS) {
      const rota = telaInicial(cargo);
      expect(podeVer(cargo, AREA_POR_ROTA[rota]), `${cargo} cairia em ${rota}`).toBe(true);
    }
  });
});

describe("o que cada cargo pode fazer", () => {
  it("só o diretor criativo fica de fora do planejamento", () => {
    expect(ROLES_QUE_PLANEJAM).toEqual(["dono", "gestor", "social_media"]);
    expect(podePlanejar("diretor_criativo")).toBe(false);
  });

  it("mexer em tarefa é de todo mundo que tem login", () => {
    expect(ROLES_DO_TIME).toEqual(CARGOS);
  });

  it("as abas do cliente seguem as mesmas regras do menu", () => {
    expect(abasDoProjeto("dono")).toEqual(["informacoes", "calendario", "planos", "pesquisas", "documentos", "acessos", "equipe"]);
    expect(abasDoProjeto("gestor")).toEqual(["informacoes", "calendario", "planos", "pesquisas", "documentos", "acessos", "equipe"]);
    expect(abasDoProjeto("social_media")).toEqual(["informacoes", "calendario", "planos", "pesquisas", "acessos"]);
    expect(abasDoProjeto("diretor_criativo")).toEqual(["informacoes", "calendario", "planos"]);
    // Contrato não aparece para quem não o vê no menu; senha, só para quem publica.
    for (const cargo of ["social_media", "diretor_criativo"] as UserRole[]) {
      expect(abasDoProjeto(cargo), cargo).not.toContain("documentos");
      expect(abasDoProjeto(cargo), cargo).not.toContain("equipe");
    }
    expect(abasDoProjeto("diretor_criativo")).not.toContain("acessos");
  });
});

// Um valor de cargo que o código não conhece não pode derrubar a página nem
// virar porta aberta — cai no mais restrito dos quatro.
describe("cargo desconhecido não derruba a tela nem abre portas", () => {
  const antigo = "editor" as unknown as UserRole;

  it("trabalha as tarefas e nada além disso", () => {
    expect(podeVer(antigo, "tarefas")).toBe(true);
    expect(podeVer(antigo, "planos")).toBe(true);
    expect(telaInicial(antigo)).toBe("/tarefas");
    for (const area of ["dashboard", "membros", "conhecimento", "contratos", "pesquisas"] as AppArea[]) {
      expect(podeVer(antigo, area), area).toBe(false);
    }
    expect(podeVerCredenciais(antigo)).toBe(false);
    expect(podePlanejar(antigo)).toBe(false);
    expect(veTodosOsProjetos(antigo)).toBe(false);
  });
});

// A rota de revelar senha recebe o id da CREDENCIAL, não o do cliente. Enquanto
// só o dono lia, o cargo bastava como resposta; com o social media entrando,
// não basta mais.
describe("senha só sai para quem trabalha naquele cliente", () => {
  const social = (projetos: string[] | "all"): CurrentUser => ({
    id: "m1", name: "Cyntthia", email: "sm@teste.com", role: "social_media",
    aiEnabled: false, active: true, accessibleProjectIds: projetos, accessibleListKinds: "all",
  });

  it("dono e gestor passam por qualquer cliente", () => {
    expect(podeAbrirProjeto({ ...social("all"), role: "dono" }, "qualquer")).toBe(true);
    expect(podeAbrirProjeto({ ...social("all"), role: "gestor" }, "qualquer")).toBe(true);
  });

  it("quem tem escopo só abre o cliente de que faz parte", () => {
    expect(podeAbrirProjeto(social(["p1", "p2"]), "p1")).toBe(true);
    expect(podeAbrirProjeto(social(["p1", "p2"]), "p3")).toBe(false);
    expect(podeAbrirProjeto(social([]), "p1")).toBe(false);
  });
});

describe("equipe do cliente", () => {
  const projetos = ["p1", "p2", "p3"];

  it("dono e gestor não dependem de equipe", () => {
    expect(CARGOS.filter(veTodosOsProjetos)).toEqual(["dono", "gestor"]);
  });

  // A regra que impede o pior acidente possível: ligar o escopo e todo mundo
  // abrir o app em uma tela vazia.
  it("sem nenhuma equipe montada, todo mundo continua vendo tudo", () => {
    expect(projetosDoMembro("m1", [], projetos)).toEqual(["p1", "p2", "p3"]);
  });

  it("cliente com equipe fica só para quem está nela", () => {
    const equipes = [{ projectId: "p1", memberId: "m2" }];
    expect(projetosDoMembro("m1", equipes, projetos)).toEqual(["p2", "p3"]);
    expect(projetosDoMembro("m2", equipes, projetos)).toEqual(["p1", "p2", "p3"]);
  });

  it("um cliente novo nasce visível mesmo com outros já divididos", () => {
    const equipes = [{ projectId: "p1", memberId: "m2" }, { projectId: "p2", memberId: "m2" }];
    expect(projetosDoMembro("m1", equipes, projetos)).toEqual(["p3"]);
    expect(projetosDoMembro("m3", equipes, [...projetos, "novo"])).toEqual(["p3", "novo"]);
  });
});
