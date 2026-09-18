// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FinanceDashboard } from "../src/components/finance-dashboard";
import { financeFixture } from "../src/app/design-system/financeiro-check/mock";
let root: Root, container: HTMLDivElement;
const fetchMock=vi.fn();
const button=(label:string)=>[...document.querySelectorAll("button")].find((b)=>b.textContent?.trim()===label);
const click=async(el:HTMLElement|undefined|null)=>{expect(el).toBeTruthy();await act(async()=>el!.click());};
async function mount(){await act(async()=>root.render(<FinanceDashboard initialData={financeFixture}/>));}
async function change(input: HTMLInputElement|HTMLSelectElement, value:string) {
  await act(async()=>{Object.getOwnPropertyDescriptor(input instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,"value")!.set!.call(input,value);input.dispatchEvent(new Event(input instanceof HTMLSelectElement?"change":"input",{bubbles:true}));});
}
beforeEach(()=>{vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.stubGlobal("fetch",fetchMock);fetchMock.mockReset();container=document.createElement("div");document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
describe("painel financeiro",()=>{
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
    await click(button("Produção da equipe"));expect(container.textContent).toContain("Tabela da equipe");expect(container.textContent).toContain("280,00");
  });
  // O fechamento precisa mostrar de onde o valor saiu, não só o valor.
  it("mostra o extrato de cada diretor criativo com a regra de preço aplicada",async()=>{
    await mount();await click(button("Produção da equipe"));
    const texto=container.textContent||"";
    expect(texto).toContain("Fechamento por diretor criativo");
    expect(texto).toContain("Extrato de entregas");
    expect(texto).toContain("Designer de exemplo");
    // as cinco peças do pacote fecham em pacote de 5, e a linha diz isso
    expect(texto).toContain("Regra de preço");
    expect(texto).toContain("Pacote de 5");
    expect(texto).toContain("Condição");
    expect(texto).toContain("Integral");
    expect(texto).toContain("Falta lançar");
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
  expect(container.textContent).toContain("Fechamento por diretor criativo");
  expect(container.textContent).not.toContain("Contratos indisponíveis");
  fetchMock.mockImplementation(async () => Response.json(financeFixture));
  await click(button("Contratos"));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
  expect(container.textContent).toContain("Aurora Clínica");
});
