// Dados de exemplo do painel financeiro, usados pela prévia pública em
// /design-system/financeiro-check e pelo teste de interface. Ficam em src/ e
// não em tests/ pelo mesmo motivo do mock de /design-system/previa: a prévia é
// página de produção, e página de produção não importa de tests/ — isso
// arrastaria a pasta de teste para dentro do bundle publicado.
//
// Nada aqui pode ser dado real de cliente: a prévia é uma das poucas rotas que
// abrem sem login.
import type { FinanceData, Entry } from "@/lib/finance/types";
import { DEFAULT_SETTINGS } from "@/lib/finance/types";
const iso = "2026-09-01T12:00:00Z";
const projects = ["Aurora Clínica", "Lume Arquitetura", "Mova Studio"].map((name, i) => ({ id: `00000000-0000-4000-8000-00000000000${i+1}`, name, status: "ativo" as const, createdAt: iso, updatedAt: iso }));
const entries: Entry[] = [];
for (const [monthIndex, month] of ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"].entries()) {
  for (const [i, project] of projects.entries()) entries.push({ id: `income-${month}-${i}`, direction: "income", category: "servicos", description: `Gestão de marca · ${project.name}`, amount: 300000 + i*70000 + monthIndex*10000, competence: month, projectId: project.id, memberId: null, recurring: true, seriesId: project.id, sourceKey: `demo:${month}:${i}`, cancelled: false, notes: "Dados demonstrativos", createdAt: iso });
  for (const [i, category] of ["producao", "operacional", "ferramentas", "prolabore"].entries()) entries.push({ id: `expense-${month}-${i}`, direction:"expense",category: category as Entry["category"],description: ["Produção do mês", "Operação", "Licenças e ferramentas", "Pró-labore"][i],amount:[230000,90000,56000,200000][i],competence:month,projectId:null,memberId:null,recurring:false,seriesId:null,sourceKey:null,cancelled:false,notes:"",createdAt:iso });
}
export const financeFixture: FinanceData = {
  entries,
  settings: { ...DEFAULT_SETTINGS, taxRate:6,taxRegime:"Alíquota demonstrativa" },
  projects, members:[{id:"00000000-0000-4000-8000-000000000009",name:"Designer de exemplo",email:"demo@example.com",role:"diretor_criativo",active:true,aiEnabled:false,createdAt:iso,updatedAt:iso}],
  tasks:Array.from({length:5},(_,i)=>({id:`task-${i}`,projectId:projects[0].id,name:`Reels ${i+1}: bastidores da marca`,kind:"conteudo",status:"aprovado",assigneeId:"00000000-0000-4000-8000-000000000009",captacaoId:"capture",createdAt:iso,updatedAt:iso,statusHistory:[{status:"para_aprovacao",enteredAt:"2026-09-04T12:00:00Z",exitedAt:null}],images:[],formatTagIds:[],channelTagIds:[],categoryTagIds:[],lists:[],comments:[]})),
  tags:[],contracts:[],scores:projects.map((p,i)=>({projectId:p.id,score:[9,8,6][i],createdAt:iso})),reviews:[],blocks:[],audit:[],warnings:[],
};
