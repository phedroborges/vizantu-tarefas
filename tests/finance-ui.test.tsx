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
  it("mostra DRE e troca entre clientes e produção",async()=>{
    await mount();expect(container.textContent).toContain("DRE gerencial");await click(button("Clientes"));expect(container.textContent).toContain("Aurora Clínica");expect(container.textContent).toContain("Índice de satisfação");await click(button("Produção da equipe"));expect(container.textContent).toContain("Tabela da equipe");expect(container.textContent).toContain("R$ 280,00");
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
    fetchMock.mockResolvedValue({ok:false,json:async()=>({error:"Valor inválido."})});
    await act(async()=>document.querySelector('.fin-modal form')!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
    expect(document.querySelector('.fin-modal')).not.toBeNull();expect(document.querySelector('.fin-modal [role="alert"]')?.textContent).toContain("Valor inválido");
  });
});
