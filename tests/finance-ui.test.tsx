// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FinanceDashboard } from "../src/components/finance-dashboard";
import { financeFixture } from "../src/app/design-system/financeiro-check/mock";
let root: Root, container: HTMLDivElement;
const fetchMock=vi.fn();
const button=(label:string)=>[...document.querySelectorAll("button")].find((b)=>b.textContent?.trim()===label);
const metric=(label:string)=>[...container.querySelectorAll<HTMLElement>(".fin-metric")].find((item)=>item.querySelector(":scope > span")?.textContent===label)?.querySelector("strong")?.textContent;
const click=async(el:HTMLElement|undefined|null)=>{expect(el).toBeTruthy();await act(async()=>el!.click());};
async function mount(){await act(async()=>root.render(<FinanceDashboard initialData={financeFixture}/>));}
async function change(input: HTMLInputElement|HTMLSelectElement, value:string) {
  await act(async()=>{Object.getOwnPropertyDescriptor(input instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,"value")!.set!.call(input,value);input.dispatchEvent(new Event(input instanceof HTMLSelectElement?"change":"input",{bubbles:true}));});
}
beforeEach(()=>{vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.stubGlobal("fetch",fetchMock);fetchMock.mockReset();container=document.createElement("div");document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
describe("painel financeiro",()=>{
  it("oferece PDF por diretor e informa falha ao carregar detalhes sem exportar parcialmente",async()=>{
    await mount();await change(container.querySelector('[aria-label="Mês de análise"]')!,"2026-09");await click(button("Produção da equipe"));
    fetchMock.mockResolvedValue({ok:false,status:500,text:async()=>"",json:async()=>({error:"Falha nos detalhes"})});
    await click(container.querySelector<HTMLElement>('[aria-label="Exportar extrato PDF de Designer de exemplo"]'));
    expect(container.querySelector('[role="alert"]')).toBeTruthy();
    expect(button("Exportar extrato PDF")?.disabled).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
  // A tela abre no que o dono pediu: quanto os contratos valem e até quando.
  // Fluxo de caixa não aparece em lugar nenhum — se voltar, este teste grita.
  it("abre nos contratos, com valor mensal e fim de cada um",async()=>{
    await mount();
    expect(container.textContent).toContain("Contratado por mês");
    expect(container.textContent).toContain("Contratos ativos");
    expect(container.textContent).toContain("Contratado mês a mês");
    expect(container.textContent).toContain("Aurora Clínica");
    for (const sumiu of ["Saldo de caixa","Inadimplência","A receber","Dar baixa","Vencimento"]) expect(container.textContent).not.toContain(sumiu);
  });
  it("troca entre visão geral, avulsos e produção",async()=>{
    await mount();
    await click(button("Visão geral"));expect(container.textContent).toContain("DRE gerencial");
    await click(button("Avulsos"));expect(container.textContent).toContain("Receita esporádica");
    await click(button("Produção da equipe"));expect(container.textContent).toContain("Painel da equipe criativa");expect(container.textContent).toContain("Tabela da equipe");
  });
  it("filtra a competência pelo mês e permite navegar entre meses",async()=>{
    await mount();
    const month=container.querySelector('[aria-label="Mês de análise"]') as HTMLInputElement;
    await change(month,"2026-09");
    await click(button("Visão geral"));
    expect(metric("Receita do mês")).toContain("12.000,00");
    await click(container.querySelector<HTMLElement>('[aria-label="Próximo mês"]'));
    expect(month.value).toBe("2026-10");
    expect(metric("Receita do mês")).toContain("12.300,00");
    await click(button("Produção da equipe"));
    expect(container.textContent).toContain("Visão rápida · outubro de 2026");
    expect(container.textContent).toContain("Sem demanda em outubro de 2026");
    await click(container.querySelector<HTMLElement>('[aria-label="Mês anterior"]'));
    expect(container.textContent).toContain("Visão rápida · setembro de 2026");
    expect(container.textContent).toContain("Demandas computadas5");
  });
  it("mostra as demandas por responsável atual sem fluxo de conferência",async()=>{
    await mount();await change(container.querySelector('[aria-label="Mês de análise"]')!,"2026-09");await click(button("Produção da equipe"));
    const texto=container.textContent||"";
    expect(texto).toContain("Aprovado ou Finalizado + responsável atual");
    expect(texto).toContain("O que cada pessoa fez");
    expect(texto).toContain("Responsável atual");
    expect(texto).toContain("Designer de exemplo");
    expect(texto).toContain("Falta lançar");
    expect(texto).toContain("Clique no nome da demanda");
    expect(texto).not.toContain("Conferir");
    expect(texto).not.toContain("Salvar conferência");
  });
  it("abre a tarefa dentro do financeiro sem navegar para outra página",async()=>{
    await mount();await change(container.querySelector('[aria-label="Mês de análise"]')!,"2026-09");await click(button("Produção da equipe"));
    fetchMock.mockResolvedValueOnce(Response.json({ task: { ...financeFixture.tasks[0], dueDate:"2026-09-08", driveLink:"https://drive.example/item" } }));
    await click(container.querySelector<HTMLElement>(".fin-task-link"));
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Tarefa computada no financeiro");
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Responsável atual");
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Mostrar os bastidores da marca");
    expect(fetchMock).toHaveBeenCalledWith("/api/tasks/task-0?detail=1",{cache:"no-store"});
    expect(window.location.pathname).not.toContain("task-0");
  });
  it("campanha avulsa desmarca recorrência e envia centavos",async()=>{
    await mount();await click(button("Novo lançamento"));
    const form=document.querySelector('.fin-modal form') as HTMLFormElement;
    const category=[...form.querySelectorAll('select')][1];await change(category,"campanha");expect((form.querySelector('[name="recurring"]') as HTMLInputElement).checked).toBe(false);
    await change(form.querySelector('[name="description"]')!,"Campanha lançamento");await change(form.querySelector('[name="amount"]')!,"1.250,50");
    fetchMock.mockResolvedValueOnce({ok:true,json:async()=>({ok:true})}).mockResolvedValueOnce({ok:true,json:async()=>financeFixture});
    await act(async()=>form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({category:"campanha",recurring:false,amount:125050,months:1});expect(document.querySelector('.fin-modal')).toBeNull();
  });
  it("não fecha o formulário quando a API falha",async()=>{
    await mount();await click(button("Novo lançamento"));
    fetchMock.mockImplementation(async()=>new Response(JSON.stringify({error:"Valor inválido."}),{status:400,headers:{"Content-Type":"application/json"}}));
    await act(async()=>document.querySelector('.fin-modal form')!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
    expect(document.querySelector('.fin-modal')).not.toBeNull();expect(document.querySelector('.fin-modal [role="alert"]')?.textContent).toContain("Valor inválido");
  });
});

it("erro na visão geral não bloqueia a equipe e permite tentar novamente", async () => {
  fetchMock.mockImplementation(async (url: string) => url.includes("production") ? Response.json(financeFixture) : Response.json({ error: "Contratos indisponíveis" }, { status: 500 }));
  await act(async () => { root.render(<FinanceDashboard />); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
  expect(container.textContent).toContain("Contratos indisponíveis");
  await click(button("Produção da equipe"));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
  expect(container.textContent).toContain("Painel da equipe criativa");
  expect(container.textContent).not.toContain("Contratos indisponíveis");
  fetchMock.mockImplementation(async () => Response.json(financeFixture));
  await click(button("Contratos"));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
  expect(container.textContent).toContain("Aurora Clínica");
});
