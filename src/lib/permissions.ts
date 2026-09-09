import type { UserRole } from "./types";

// Um lugar só decide quem enxerga o quê. Antes a resposta estava espalhada
// entre o menu, cada página e cada rota de API — e as três discordavam entre
// si com facilidade: o menu escondia Contratos, mas a rota deixava passar.
// Aqui a área é declarada uma vez e as três leem daqui.

export type AppArea =
  | "dashboard" | "projetos" | "tarefas" | "notificacoes" | "planos"
  | "pesquisas" | "marcas" | "contratos" | "membros" | "conhecimento" | "assistente";

type RoleProfile = {
  areas: AppArea[];
  /** Criar e apagar o que organiza o trabalho: projeto, plano, marca, pesquisa.
   * O diretor criativo trabalha no que já existe — e abre tarefa avulsa. */
  planeja: boolean;
  /** Montar a equipe de um cliente. */
  gerenciaEquipe: boolean;
  /** Criar pessoa, trocar cargo, ligar a IA de alguém. */
  gerenciaMembros: boolean;
  /** Ver e revelar os logins do cliente. Quem publica precisa entrar na conta. */
  veCredenciais: boolean;
  /** Cadastrar, alterar e apagar esses logins. */
  gerenciaCredenciais: boolean;
  /** Enxerga todos os clientes, sem depender da equipe do projeto. */
  veTodosOsProjetos: boolean;
  /** Onde a pessoa cai ao entrar no app. */
  inicio: string;
};

const TODAS_AS_AREAS: AppArea[] = [
  "dashboard", "projetos", "tarefas", "notificacoes", "planos",
  "pesquisas", "marcas", "contratos", "membros", "conhecimento", "assistente",
];

export const ROLE_PROFILES: Record<UserRole, RoleProfile> = {
  dono: {
    areas: TODAS_AS_AREAS,
    planeja: true, gerenciaEquipe: true, gerenciaMembros: true, veCredenciais: true,
    gerenciaCredenciais: true, veTodosOsProjetos: true, inicio: "/",
  },
  gestor: {
    // Vê o que o social media vê, mais o painel e os contratos. Membros e base
    // de conhecimento continuam fora: ele gerencia entrega, não o time nem a
    // documentação interna.
    areas: ["dashboard", "projetos", "tarefas", "notificacoes", "planos", "pesquisas", "contratos", "assistente"],
    planeja: true, gerenciaEquipe: true, gerenciaMembros: false, veCredenciais: true,
    gerenciaCredenciais: false, veTodosOsProjetos: true, inicio: "/",
  },
  social_media: {
    areas: ["projetos", "tarefas", "notificacoes", "planos", "pesquisas", "assistente"],
    // Quem publica precisa da senha do Instagram do cliente. Cadastrar e apagar
    // esses acessos continua sendo do dono.
    planeja: true, gerenciaEquipe: false, gerenciaMembros: false, veCredenciais: true,
    gerenciaCredenciais: false, veTodosOsProjetos: false, inicio: "/planos",
  },
  diretor_criativo: {
    areas: ["projetos", "tarefas", "notificacoes", "planos", "marcas", "assistente"],
    planeja: false, gerenciaEquipe: false, gerenciaMembros: false, veCredenciais: false,
    gerenciaCredenciais: false, veTodosOsProjetos: false, inicio: "/tarefas",
  },
};

/** Quais clientes um cargo com escopo enxerga.
 *
 * Cliente sem ninguém na equipe é de todo mundo. É o que faz um projeto recém-
 * criado nascer visível em vez de invisível, e o que impede que ligar o escopo
 * pela primeira vez apague a tela de quem ainda não foi colocado em equipe
 * nenhuma. Assim que a primeira pessoa entra, o cliente passa a ser só dela. */
export function projetosDoMembro(
  memberId: string,
  equipes: { projectId: string; memberId: string }[],
  todosOsProjetos: string[],
): string[] {
  const comEquipe = new Set(equipes.map((linha) => linha.projectId));
  const minhas = new Set(equipes.filter((linha) => linha.memberId === memberId).map((linha) => linha.projectId));
  return todosOsProjetos.filter((id) => !comEquipe.has(id) || minhas.has(id));
}

// Um cargo que o código não conhece não deveria derrubar a página inteira com
// um perfil indefinido, mas também não pode virar uma porta aberta. Cai no mais
// restrito dos quatro: trabalha as tarefas e nada além disso — sem painel, sem
// contrato, sem senha de cliente, sem planejar.
function perfilDe(role: UserRole) {
  return ROLE_PROFILES[role] ?? ROLE_PROFILES.diretor_criativo;
}

export function podeVer(role: UserRole, area: AppArea): boolean {
  return perfilDe(role).areas.includes(area);
}

export function rolesQueVeem(area: AppArea): UserRole[] {
  return (Object.keys(ROLE_PROFILES) as UserRole[]).filter((role) => podeVer(role, area));
}

export function podePlanejar(role: UserRole): boolean {
  return perfilDe(role).planeja;
}

export function podeGerenciarEquipe(role: UserRole): boolean {
  return perfilDe(role).gerenciaEquipe;
}

export function podeGerenciarMembros(role: UserRole): boolean {
  return perfilDe(role).gerenciaMembros;
}

export function podeVerCredenciais(role: UserRole): boolean {
  return perfilDe(role).veCredenciais;
}

export function podeGerenciarCredenciais(role: UserRole): boolean {
  return perfilDe(role).gerenciaCredenciais;
}

export function veTodosOsProjetos(role: UserRole): boolean {
  return perfilDe(role).veTodosOsProjetos;
}

/** A rota "/" é o painel, e o painel é de quem gerencia. Quem não gerencia
 * entra direto no trabalho: o social media no planejamento que ele monta, o
 * diretor criativo na fila que ele executa. */
export function telaInicial(role: UserRole): string {
  return perfilDe(role).inicio;
}

// Abas de dentro do cliente. "Documentos" são os contratos e "Acessos" são as
// senhas — as duas seguem as mesmas regras do resto do app.
export type ProjectTab = "informacoes" | "calendario" | "planos" | "pesquisas" | "documentos" | "acessos" | "equipe";

export function abasDoProjeto(role: UserRole): ProjectTab[] {
  const abas: ProjectTab[] = ["informacoes", "calendario", "planos"];
  if (podeVer(role, "pesquisas")) abas.push("pesquisas");
  if (podeVer(role, "contratos")) abas.push("documentos");
  if (podeVerCredenciais(role)) abas.push("acessos");
  if (podeGerenciarEquipe(role)) abas.push("equipe");
  return abas;
}

// Conjuntos prontos para as rotas de API, derivados dos perfis acima — assim
// uma mudança no cargo não exige caçar array literal espalhado por 20 arquivos.
const TODOS_OS_ROLES = Object.keys(ROLE_PROFILES) as UserRole[];

/** Todo mundo que tem login: mexe em tarefa, comenta, muda status. */
export const ROLES_DO_TIME: UserRole[] = TODOS_OS_ROLES;

/** Quem monta o trabalho: cria projeto, plano, pacote, pesquisa. */
export const ROLES_QUE_PLANEJAM: UserRole[] = TODOS_OS_ROLES.filter(podePlanejar);

/** Quem gerencia a operação: painel, contratos, equipe de cliente, aviso ao time. */
export const ROLES_DE_GESTAO: UserRole[] = TODOS_OS_ROLES.filter(podeGerenciarEquipe);

/** Quem abre a senha do cliente. Ver não é o mesmo que cadastrar: alterar e
 * apagar continua só com o dono (ROLES_QUE_GERENCIAM_CREDENCIAIS). */
export const ROLES_QUE_VEEM_CREDENCIAIS: UserRole[] = TODOS_OS_ROLES.filter(podeVerCredenciais);
export const ROLES_QUE_GERENCIAM_CREDENCIAIS: UserRole[] = TODOS_OS_ROLES.filter(podeGerenciarCredenciais);
