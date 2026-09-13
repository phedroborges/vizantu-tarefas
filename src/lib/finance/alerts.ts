import { createNotifications, listMembers, type NotificationInput } from "../storage";
import { brl, contractAlerts, receivableAlerts } from "./calculations";
import { loadFinance } from "./storage";

// ---------- Régua de cobrança e fim de contrato, por dentro ----------
//
// O cliente não vê nada disto. O plano dele abre por link, sem login, e basta o
// endereço para entrar — colocar saldo, vencimento ou atraso naquela tela seria
// publicar a situação financeira de um cliente para quem passar o link adiante.
// Então a régua não fala com o cliente: ela avisa o dono, dentro do app, e a
// cobrança sai pela mão de uma pessoa.
//
// Vencido não avisa todo dia. Um aviso diário vira ruído e some junto com o
// resto; a régua toca em marcos e cala no meio.
const ETAPAS_DE_VENCIDO = [1, 7, 15, 30];

export async function varrerAvisosFinanceiros(hoje: string): Promise<number> {
  const donos = (await listMembers()).filter((membro) => membro.role === "dono" && membro.active);
  if (!donos.length) return 0;
  const data = await loadFinance(donos[0].id);
  const nomeDoProjeto = new Map(data.projects.map((projeto) => [projeto.id, projeto.name]));
  const avisos: NotificationInput[] = [];

  for (const alerta of receivableAlerts(data.entries, data.payments, hoje)) {
    if (alerta.stage === "vencido" && !ETAPAS_DE_VENCIDO.includes(alerta.days)) continue;
    const cliente = alerta.entry.projectId ? nomeDoProjeto.get(alerta.entry.projectId) : null;
    const title = alerta.stage === "vencido" ? `Recebível vencido há ${alerta.days} dia${alerta.days === 1 ? "" : "s"}`
      : alerta.stage === "vence_hoje" ? "Recebível vence hoje"
      : `Recebível vence em ${alerta.days} dia${alerta.days === 1 ? "" : "s"}`;
    const dedupeKey = alerta.stage === "vencido"
      ? `receivable:${alerta.entry.id}:vencido:${alerta.days}`
      : `receivable:${alerta.entry.id}:${alerta.stage}`;
    for (const dono of donos) {
      avisos.push({ recipientMemberId: dono.id, type: "finance_receivable", title,
        body: `${cliente ? `${cliente} · ` : ""}${alerta.entry.description} · ${brl(alerta.open)} em aberto`,
        actionUrl: "/financeiro", dedupeKey: `${dedupeKey}:${dono.id}` });
    }
  }

  for (const alerta of contractAlerts(data.contracts, hoje)) {
    const cliente = alerta.projectId ? nomeDoProjeto.get(alerta.projectId) : null;
    for (const dono of donos) {
      avisos.push({ recipientMemberId: dono.id, type: "contract_ending",
        title: alerta.days === 0 ? "Contrato termina hoje" : `Contrato termina em ${alerta.days} dia${alerta.days === 1 ? "" : "s"}`,
        body: `${cliente ? `${cliente} · ` : ""}${alerta.title} · vigência até ${alerta.endsOn}`,
        actionUrl: "/contratos", dedupeKey: `contract-ending:${alerta.contractId}:${alerta.endsOn}:${dono.id}` });
    }
  }

  await createNotifications(avisos);
  return avisos.length;
}
