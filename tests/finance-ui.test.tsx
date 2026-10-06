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
async function mount(data=financeFixture){await act(async()=>root.render(<FinanceDashboard initialData={data}/>));}
async function change(input: HTMLInputElement|HTMLSelectElement, value:string) {
  await act(async()=>{Object.getOwnPropertyDescriptor(input instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,"value")!.set!.call(input,value);input.dispatchEvent(new Event(input instanceof HTMLSelectElement?"change":"input",{bubbles:true}));});
}
beforeEach(()=>{vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.stubGlobal("fetch",fetchMock);fetchMock.mockReset();container=document.createElement("div");document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
describe("painel financeiro",()=>{
  it.each([false, true])("move uma receita avulsa para outubro e atualiza os totais (todos os meses: %s)",async(allMonths)=>{
    const data=structuredClone(financeFixture);
    const entry={...data.entries[0],id:"oneoff-september",description:"Campanha avulsa",category:"campanha" as const,recurring:false,amount:140000,competence:"2026-09",seriesId:"campaign-series",sourceKey:"manual:campaign:0",notes:"Campanha aprovada"};
    data.entries.push(entry,{...entry,id:"oneoff-second",description:"Segunda parcela",sourceKey:"manual:campaign:1",amount:200000});
    await mount(data); await change(container.querySelector('[aria-label="Mês de análise"]')!,"2026-09"); await click(button("Avulsos"));
    if(allMonths) await click(container.querySelector<HTMLInputElement>('.fin-filters input[type="checkbox"]'));
    expect(container.querySelector('.fin-panel h2')?.textContent).toContain("3.400,00");
    await click(container.querySelector<HTMLElement>('[aria-label="Editar receita Campanha avulsa"]'));
    const form=document.querySelector('.fin-modal form') as HTMLFormElement;
    expect(form.querySelector<HTMLInputElement>('[name="competence"]')?.value).toBe("2026-09");
    await change(form.querySelector('[name="competence"]')!,"2026-10");
    const updated=structuredClone(data);
    updated.entries.find((item)=>item.id===entry.id)!.competence="2026-10";
    fetchMock.mockResolvedValueOnce(Response.json({ok:true})).mockResolvedValueOnce(Response.json(updated));
    await act(async()=>form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({action:"edit",entryId:entry.id,description:entry.description,amount:entry.amount,competence:"2026-10",notes:entry.notes});
    expect(document.querySelector('.fin-modal')).toBeNull();
    if(allMonths) {
      const row=[...container.querySelectorAll('tbody tr')].find((item)=>item.textContent?.includes(entry.description));
      expect(row?.textContent).toContain("2026-10");
      await click(container.querySelector<HTMLInputElement>('.fin-filters input[type="checkbox"]'));
    }
    expect(container.querySelector('.fin-panel h2')?.textContent).toContain("2.000,00");
    expect(container.textContent).not.toContain(entry.description);
    expect(container.textContent).toContain("Segunda parcela");
    await click(button("Visão geral"));
    expect(metric("Receita do mês")).toContain("14.000,00");
    expect(metric("MRR")).toContain("12.000,00");
    await change(container.querySelector('[aria-label="Mês de análise"]')!,"2026-10");
    expect(metric("Receita do mês")).toContain("13.700,00");
    expect(metric("MRR")).toContain("12.300,00");
    await click(button("Avulsos"));
    expect(container.textContent).toContain(entry.description);
    expect(container.textContent).not.toContain("Segunda parcela");
    expect(container.querySelector('.fin-panel h2')?.textContent).toContain("1.400,00");
  });
  it("abre uma despesa já na categoria de impostos e envia o valor real",async()=>{
    await mount(); await change(container.querySelector('[aria-label="Mês de análise"]')!,"2026-09"); await click(button("Custos"));
    await click(container.querySelector<HTMLElement>('[aria-label="Adicionar gasto em Impostos pagos"]'));
    const form=document.querySelector('.fin-modal form') as HTMLFormElement;
    expect([...form.querySelectorAll('select')][0].value).toBe("expense"); expect([...form.querySelectorAll('select')][1].value).toBe("impostos");
    await change(form.querySelector('[name="description"]')!,"Multa adicional de imposto"); await change(form.querySelector('[name="amount"]')!,"150,00");
    fetchMock.mockResolvedValueOnce(Response.json({ok:true})).mockResolvedValueOnce(Response.json(financeFixture));
    await act(async()=>form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({direction:"expense",category:"impostos",amount:15000,recurring:false});
  });
  it("cadastra contrato manual como receita recorrente e exige cliente",async()=>{
    await mount(); await click(button("Novo contrato"));
    const form=document.querySelector('.fin-modal form') as HTMLFormElement;
    expect(form.querySelector<HTMLSelectElement>('[name="projectId"]')?.required).toBe(true);
    await change(form.querySelector('[name="description"]')!,"Contrato mensal"); await change(form.querySelector('[name="amount"]')!,"2.000,00");
    await change(form.querySelector('[name="projectId"]')!,financeFixture.projects[0].id);
    fetchMock.mockResolvedValueOnce(Response.json({ok:true})).mockResolvedValueOnce(Response.json(financeFixture));
    await act(async()=>form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({direction:"income",category:"servicos",recurring:true,contract:true,amount:200000});
  });
  it("salva salário fixo com competência e valor em centavos",async()=>{
    await mount(); await change(container.querySelector('[aria-label="Mês de análise"]')!,"2026-09"); await click(button("Produção da equipe"));
    const form=container.querySelector('.fin-compensation-row') as HTMLFormElement;
    await change(form.querySelector('select')!,"salary"); await change(form.querySelector('[name="salary"]')!,"1.800,00");
    fetchMock.mockResolvedValueOnce(Response.json({ok:true})).mockResolvedValueOnce(Response.json(financeFixture));
    await act(async()=>form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({action:"compensation",mode:"salary",salary:180000,fromMonth:"2026-09",memberId:financeFixture.members[0].id});
  });
  it("lança salário mensal e atualiza o fechamento sem criar despesas por peça",async()=>{
    const data=structuredClone(financeFixture);
    data.settings.compensationRules=[{memberId:data.members[0].id,fromMonth:"2026-09",mode:"salary",salary:180000}];
    await mount(data); await change(container.querySelector('[aria-label="Mês de análise"]')!,"2026-09"); await click(button("Produção da equipe"));
    expect(container.textContent).toContain("Incluído no salário"); expect(button("Lançar a pagar")).toBeUndefined();
    await click(button("Lançar salário do mês"));
    fetchMock.mockResolvedValueOnce(Response.json({ok:true})).mockResolvedValueOnce(Response.json(data));
    await click(button("Lançar fechamento"));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({action:"salary",memberId:data.members[0].id,competence:"2026-09"});
  });
  it("permite escolher contrato assinado e depois excluir do financeiro",async()=>{
    const data=structuredClone(financeFixture);
    const id="22222222-2222-4222-8222-222222222222";
    data.contracts=[{id,title:"Contrato opcional",projectId:data.projects[0].id,status:"assinado",templateId:"gestao_marca",paymentMode:"pre",paymentStructure:"mensal",fields:{valor_mensal:"900,00",vigencia_inicio:"2026-09-01",vigencia_meses:"3"},body:"",createdAt:"",updatedAt:""}];
    await mount(data); await click(button("Adicionar ao financeiro"));
    const included=structuredClone(data);
    included.entries.push({...data.entries[0],id:"new-contract",seriesId:id,sourceKey:`contract:${id}:0`,description:"Contrato opcional",amount:90000});
    fetchMock.mockResolvedValueOnce(Response.json({ok:true})).mockResolvedValueOnce(Response.json(included));
    await click(button("Adicionar contrato"));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({action:"importContract",contractId:id,restore:false});
    const row=[...container.querySelectorAll('tr')].find((row)=>row.textContent?.includes("Contrato opcional"));
    await click([...row!.querySelectorAll('button')].find((item)=>item.textContent==="Excluir do financeiro"));
    fetchMock.mockResolvedValueOnce(Response.json({ok:true})).mockResolvedValueOnce(Response.json(data));
    await click([...document.querySelectorAll<HTMLElement>('[role="dialog"] button')].find((item)=>item.textContent==="Excluir do financeiro"));
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({action:"removeContract",seriesId:id});
  });
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
