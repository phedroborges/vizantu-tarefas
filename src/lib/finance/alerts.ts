import { createNotifications, listContracts, listProjects, listMembers, type NotificationInput } from "../storage";
import { contractAlerts, daysAdd, monthName, productionLines, teamClosingsFromLines } from "./calculations";
import { loadFinanceProduction } from "./storage";

// ---------- Aviso de fim de contrato ----------
//
// A régua de cobrança não mora aqui. Vencimento, atraso e cobrança são do Asaas,
// que é onde o dinheiro realmente circula — duplicar isso no app só criaria uma
// segunda versão da verdade, sempre desatualizada.
//
// O que o app sabe e o Asaas não é quando a relação acaba: contrato que chega ao
// fim da vigência sem ninguém renovar tira o cliente do MRR em silêncio, e o
// churn só conta depois de consumado. Este aviso existe para chegar antes.
export async function varrerAvisosFinanceiros(hoje: string): Promise<number> {
  const donos = (await listMembers()).filter((membro) => membro.role === "dono" && membro.active);
  if (!donos.length) return 0;
  const [contracts, projects] = await Promise.all([listContracts(), listProjects()]);
  const nomeDoProjeto = new Map(projects.map((projeto) => [projeto.id, projeto.name]));
  const avisos: NotificationInput[] = [];

  for (const alerta of contractAlerts(contracts, hoje)) {
    const cliente = alerta.projectId ? nomeDoProjeto.get(alerta.projectId) : null;
    for (const dono of donos) {
      avisos.push({ recipientMemberId: dono.id, type: "contract_ending",
        title: alerta.days === 0 ? "Contrato termina hoje" : `Contrato termina em ${alerta.days} dia${alerta.days === 1 ? "" : "s"}`,
        body: `${cliente ? `${cliente} · ` : ""}${alerta.title} · vigência até ${alerta.endsOn}`,
        actionUrl: "/contratos", dedupeKey: `contract-ending:${alerta.contractId}:${alerta.endsOn}:${dono.id}` });
    }
  }

  // No último dia do mês, quem ainda tem valor a receber e não foi fechado.
  const mes = hoje.slice(0, 7);
  if (daysAdd(hoje, 1).slice(0, 7) !== mes) {
    const data = await loadFinanceProduction();
    const linhas = productionLines(data.tasks, data.tags, data.settings, data.members, data.closings);
    const abertos = teamClosingsFromLines(linhas, data.entries, data.members, data.settings, mes)
      .filter((fechamento) => fechamento.total > 0 && !data.closings.some((closing) => closing.memberId === fechamento.producerId && closing.competence === mes));
    const nomes = abertos.map((fechamento) => data.members.find((membro) => membro.id === fechamento.producerId)?.name).filter(Boolean);
    if (nomes.length) for (const dono of donos) {
      avisos.push({ recipientMemberId: dono.id, type: "finance_closing",
        title: `Fechamento de ${monthName(mes)}: ${nomes.length} ${nomes.length === 1 ? "pessoa" : "pessoas"} para fechar`,
        body: nomes.join(", "), actionUrl: "/financeiro", dedupeKey: `closing-reminder:${mes}:${dono.id}` });
    }
  }

  await createNotifications(avisos);
  return avisos.length;
}
