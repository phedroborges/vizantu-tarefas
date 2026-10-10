import { describe, expect, it } from "vitest";
import { systemSourcesForGuide, temMaterialDoSistema } from "../src/lib/guide-system-sources";
import type { Contract, Plan, Project, Survey, Task } from "../src/lib/types";

// A IA do guia ficava apagada enquanto ninguém colasse uma reunião. Agora ela
// lê o que o sistema já tem, e é este arquivo que decide o que sai daqui para
// o modelo: o escopo entra, o documento do cliente não.

const NOW = "2026-10-10T12:00:00.000Z";
const project: Project = { id: "p1", name: "Campanha do Dr Lourival", client: "Lourival Lobo", clientRole: "Pediatra", status: "ativo", createdAt: NOW, updatedAt: NOW };
const contract = (fields: Record<string, string>): Contract => ({ id: "c1", projectId: "p1", title: "Gestão de marca", templateId: "gestao_marca", paymentMode: "pre", paymentStructure: "mensal", status: "assinado", fields, body: "CLÁUSULA 1", createdAt: NOW, updatedAt: NOW });
const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, projectId: "p1", name: `Tarefa ${id}`, kind: "conteudo" as Task["kind"], images: [], formatTagIds: [], channelTagIds: [], categoryTagIds: [], lists: [], status: "finalizado", statusHistory: [], comments: [], createdAt: NOW, updatedAt: NOW, ...extra });
const base = { project, contracts: [], plans: [], tasks: [], surveys: [], tags: [], team: [] };
const texto = (fontes: ReturnType<typeof systemSourcesForGuide>, titulo: string) => fontes.find((fonte) => fonte.title === titulo)?.content ?? "";

describe("registros do sistema como fonte do guia", () => {
  it("só o cadastro não conta como material", () => {
    const fontes = systemSourcesForGuide(base);
    expect(fontes.map((fonte) => fonte.title)).toEqual(["Cadastro do cliente"]);
    expect(temMaterialDoSistema(fontes)).toBe(false);
    expect(temMaterialDoSistema(systemSourcesForGuide({ ...base, tasks: [task("t1")] }))).toBe(true);
  });

  it("leva o escopo do contrato e deixa de fora documento, endereço, e-mail e as cláusulas", () => {
    const conteudo = texto(systemSourcesForGuide({ ...base, contracts: [contract({
      marca: "a carreira do Dr. Lourival", qtd_videos: "10", vigencia_meses: "6",
      contratante_documento: "123.456.789-00", contratante_endereco: "Rua A, 10", contratante_email: "lourival@exemplo.com",
    })] }), "Contratos");
    expect(conteudo).toContain("Vídeos por mês: 10");
    expect(conteudo).toContain("a carreira do Dr. Lourival");
    expect(conteudo).toContain("Assinado");
    for (const privado of ["123.456.789-00", "Rua A, 10", "lourival@exemplo.com", "CLÁUSULA"]) expect(conteudo).not.toContain(privado);
  });

  it("descreve a tarefa com status, formato e a descrição cortada", () => {
    const conteudo = texto(systemSourcesForGuide({
      ...base,
      tags: [{ id: "f1", kind: "formato", label: "Reels", createdAt: NOW }],
      tasks: [task("t1", { name: "Febre em bebê", formatTagIds: ["f1"], dueDate: "2026-10-20", description: "x".repeat(2000) })],
    }), "Tarefas e conteúdos produzidos");
    expect(conteudo).toContain("- Febre em bebê (Finalizado, prazo 2026-10-20, Reels)");
    expect(conteudo.length).toBeLessThan(700);
  });

  it("limita a quantidade de tarefas às mais recentes", () => {
    const tasks = Array.from({ length: 80 }, (_, i) => task(`t${i}`, { createdAt: `2026-01-01T00:${String(i).padStart(2, "0")}:00.000Z` }));
    const conteudo = texto(systemSourcesForGuide({ ...base, tasks }), "Tarefas e conteúdos produzidos");
    expect(conteudo.split("\n")).toHaveLength(60);
    expect(conteudo).toContain("Tarefa t79");
    expect(conteudo).not.toContain("Tarefa t0 ");
  });

  it("traz pergunta e resposta das pesquisas respondidas, e ignora as sem resposta", () => {
    const survey = (id: string, responses: Survey["responses"]): Survey => ({ id, projectId: "p1", title: `Pesquisa ${id}`, description: "", status: "published", token: id, questions: [{ id: "q1", title: "O que você espera?", type: "long_text", required: true }], responses, createdAt: NOW, updatedAt: NOW });
    const conteudo = texto(systemSourcesForGuide({ ...base, surveys: [
      survey("a", [{ id: "r1", respondentName: "Lourival", answers: [{ questionId: "q1", value: "Lotar a agenda" }], createdAt: NOW }]),
      survey("b", []),
    ] }), "Pesquisas respondidas pelo cliente");
    expect(conteudo).toContain("- O que você espera?: Lotar a agenda");
    expect(conteudo).not.toContain("Pesquisa b");
  });

  it("lista os planos pelo nome e tipo", () => {
    const plan: Plan = { id: "pl1", projectId: "p1", title: "Outubro", kind: "content", status: "draft", source: "native", createdAt: NOW, updatedAt: NOW };
    expect(texto(systemSourcesForGuide({ ...base, plans: [plan] }), "Planos")).toContain("- Outubro (Conteúdo");
  });
});
