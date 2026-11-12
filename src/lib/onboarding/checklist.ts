// O checklist de onboard de cada cliente: o processo padrão da Vizantu.
//
// Esta é a única fonte da lista. A tela, a API e os testes leem daqui. O id de
// cada item é uma chave escrita à mão (e não a posição) de propósito: o que já
// foi marcado fica guardado por chave, então reordenar ou inserir um item no
// meio da lista não troca a marcação de ninguém.
//
// A ficha do cliente (tem site? CRM? ERP?) decide quais itens valem. Item que
// não vale não entra na conta do progresso.

export type FieldKey = "site" | "crm" | "erp";
export type OnboardingFields = Partial<Record<FieldKey | "erpOutro" | "crmOutro", string>>;
export type OnboardingData = { checks: Record<string, string>; fields: OnboardingFields; notes: string; updatedAt: string | null };

/** Quando o item vale. Sem condição, vale sempre. */
export type ItemWhen = "site" | "nosite" | "chat" | "crm" | "erp";

export type ChecklistItem = { key: string; title: string; hint?: string; when?: ItemWhen };
export type ChecklistSection = { id: string; title: string; notice?: { when: "nosite" | "nocrm" | "noerp"; text: string }; items: ChecklistItem[] };

export const SECTIONS: ChecklistSection[] = [
  { id: "base", title: "Antes de começar", items: [
    { key: "base.escopo", title: "Escopo fechado: entregas do mês e valor combinados", hint: "No máximo 12 entregas por mês. Datas sazonais ficam à parte." },
    { key: "base.responsavel", title: "Responsável da Vizantu definido para o cliente" },
    { key: "base.contato", title: "Contato do cliente anotado para acessos e aprovações", hint: "Nome e WhatsApp de quem decide e de quem abre as contas." },
    { key: "base.plano", title: "Plano do mês criado neste projeto" },
    { key: "base.marca", title: "Materiais de marca recebidos", hint: "Logo, cores, fotos e tom de voz." },
    { key: "base.briefing", title: "Briefing feito", hint: "Público, região atendida, produtos e concorrentes." },
    { key: "base.objetivo", title: "Objetivo definido: o que o cliente quer medir", hint: "Conversas, agendamentos ou vendas. Isso decide os eventos lá na frente." },
    { key: "base.verba", title: "Verba de anúncios e forma de pagamento combinadas" },
    { key: "base.lista", title: "Cliente recebeu a lista do que vamos pedir de acesso" },
    { key: "base.lgpd", title: "Cliente autorizou o uso dos dados (LGPD)", hint: "Vale para WhatsApp, CRM e ERP, que têm dados dos clientes dele." },
  ] },
  { id: "meta", title: "Meta (Facebook e Instagram)", items: [
    { key: "meta.perfil", title: "Perfil no Facebook" },
    { key: "meta.pagina", title: "Página no Facebook" },
    { key: "meta.negocio", title: "Negócio no Facebook (Meta Business)" },
    { key: "meta.anuncios", title: "Conta de anúncios" },
    { key: "meta.ig-pagina", title: "Instagram conectado à página" },
    { key: "meta.ig-anuncios", title: "Instagram conectado à conta de anúncios" },
    { key: "meta.wa-pagina", title: "WhatsApp conectado à página" },
    { key: "meta.wa-anuncios", title: "WhatsApp conectado à conta de anúncios" },
    { key: "meta.pagamento", title: "Forma de pagamento cadastrada na conta de anúncios", hint: "Sem isso nenhum anúncio sai do rascunho." },
    { key: "meta.acesso", title: "Acessos enviados para euphedroborges@gmail.com" },
    { key: "meta.admin", title: "Segundo administrador no negócio", hint: "Para a conta não depender de uma pessoa só." },
    { key: "meta.ok", title: "Meta conferida: tudo acima está ligado e ok" },
  ] },
  { id: "gmn", title: "Google Meu Negócio", items: [
    { key: "gmn.ficha", title: "Ficha existe (se não existe, criar)" },
    { key: "gmn.verificada", title: "Ficha verificada pelo Google" },
    { key: "gmn.acesso", title: "Acesso de administrador compartilhado com euphedroborges@gmail.com" },
    { key: "gmn.gestor", title: "Segundo gestor na ficha, além do Phedro" },
    { key: "gmn.dados", title: "Dados conferidos", hint: "Endereço, horário, categoria, telefone e fotos." },
    { key: "gmn.whatsapp", title: "Link do WhatsApp na ficha" },
  ] },
  { id: "site", title: "Site", notice: { when: "nosite", text: "O cliente ainda não tem site. Registre na lista de clientes sem site e ofereça: domínio e hospedagem na nossa VPS." }, items: [
    { key: "site.oferecer", title: "Oferecer o site ao cliente", hint: "Hoje todos os sites ficam hospedados na nossa VPS.", when: "nosite" },
    { key: "site.dominio", title: "Domínio: de onde vem (quem registrou)", when: "site" },
    { key: "site.hospedagem", title: "Hospedagem: onde está", hint: "Hoje todos os sites, nossos e de clientes, ficam na nossa VPS.", when: "site" },
    { key: "site.acesso", title: "E-mail e senha da hospedagem e do domínio recebidos", hint: "Cadastrar na aba Acessos deste projeto.", when: "site" },
    { key: "site.clarity", title: "Clarity instalado", hint: "Mapa de calor. Mostra com mais veracidade a qualidade da página.", when: "site" },
    { key: "site.analytics", title: "Analytics instalado", hint: "Dados de tráfego.", when: "site" },
    { key: "site.botao", title: "Botão de WhatsApp no site, com mensagem pronta", when: "site" },
    { key: "site.pixel", title: "Pixel do Tintim instalado", hint: "Só se o site tiver botão de WhatsApp.", when: "site" },
    { key: "site.teste", title: "Teste: uma visita aparece no Clarity e no Analytics", when: "site" },
  ] },
  { id: "wa", title: "WhatsApp e Tintim", items: [
    { key: "wa.conta", title: "Conta do cliente criada no Tintim" },
    { key: "wa.link", title: "Link de autenticação enviado ao cliente" },
    { key: "wa.qr", title: "Cliente autenticou pelo QR code" },
    { key: "wa.numero", title: "Número conferido", hint: "Precisa ser o mesmo do atendimento e dos anúncios." },
    { key: "wa.teste", title: "Teste: mensagem de teste aparece no Tintim" },
    { key: "wa.origem", title: "Teste: conversa vinda de anúncio mostra a origem" },
  ] },
  { id: "trg", title: "Mensagens de gatilho (eventos para a Meta)", items: [
    { key: "trg.etapas", title: "Etapas do funil do cliente definidas", hint: "Contato, lead qualificado, agendamento, compra. Cada negócio tem as suas." },
    { key: "trg.frases", title: "Uma frase fixa escrita para cada etapa", hint: "O trecho fixo nunca muda, senão o Tintim não reconhece." },
    { key: "trg.eventos", title: "Evento criado no Tintim para cada frase" },
    { key: "trg.resposta", title: "Resposta rápida criada para a etapa manual", hint: "A frase sai igual todas as vezes." },
    { key: "trg.automaticas", title: "Mensagens das etapas automáticas configuradas no sistema do cliente", hint: "Agenda ou ERP. Ninguém digita essas à mão." },
    { key: "trg.teste", title: "Teste: cada frase dispara o seu evento no Tintim" },
    { key: "trg.meta", title: "Teste: o evento chega à Meta" },
    { key: "trg.tutorial", title: "Tutorial enviado ao cliente", hint: "Como o da Target: etapa, frase exata e quem envia." },
  ] },
  { id: "crm", title: "CRM", notice: { when: "nocrm", text: "O cliente não precisa de CRM por enquanto. Reveja se o volume de conversas crescer." }, items: [
    { key: "crm.definido", title: "CRM definido", hint: "Indicação do cliente ou o Chatwoot, que é o que temos hoje, principalmente para pet shop.", when: "crm" },
    { key: "crm.chatwoot", title: "Chatwoot criado e ligado ao WhatsApp", when: "chat" },
    { key: "crm.etapas", title: "Etapas do atendimento montadas no CRM", when: "crm" },
    { key: "crm.treino", title: "Equipe do cliente treinada", when: "crm" },
    { key: "crm.dados", title: "Resultado do atendimento e tempo de resposta aparecendo", when: "crm" },
  ] },
  { id: "erp", title: "ERP do cliente", notice: { when: "noerp", text: "O cliente não usa ERP. Anote o sistema que ele usa para registrar venda e agenda." }, items: [
    { key: "erp.qual", title: "ERP identificado", hint: "Para pet shop, em geral Simples Vet ou OnePet. Existem outros no mercado.", when: "erp" },
    { key: "erp.suporte", title: "Contato do suporte do ERP anotado", when: "erp" },
    { key: "erp.acesso", title: "Acesso ao ERP: usuário só de leitura ou relatórios", hint: "Peça o mínimo necessário e cadastre na aba Acessos.", when: "erp" },
    { key: "erp.api", title: "Visto se o ERP tem API ou integração", hint: "Anote o que o fornecedor responder.", when: "erp" },
    { key: "erp.exporta", title: "Visto se dá para exportar vendas e agendamentos por período", when: "erp" },
    { key: "erp.mensagem", title: "Visto se o ERP envia mensagem automática no WhatsApp", hint: "Confirmação de agendamento ou de venda pode virar o evento de compra.", when: "erp" },
    { key: "erp.telefone", title: "Telefone do cliente no ERP no mesmo formato do WhatsApp", hint: "É o que permite casar a venda com o anúncio de origem.", when: "erp" },
    { key: "erp.venda", title: "Combinado como a venda volta para a Meta", hint: "Evento automático, planilha ou relatório mensal.", when: "erp" },
    { key: "erp.rotina", title: "Rotina combinada: quem exporta os dados e quando", hint: "Se o ERP não tem API.", when: "erp" },
  ] },
  { id: "acc", title: "Acessos de redes e anúncios", items: [
    { key: "acc.facebook", title: "Facebook" },
    { key: "acc.instagram", title: "Instagram" },
    { key: "acc.metaads", title: "Meta Ads", hint: "Enviar o acesso para phedro@vizantu.com.br." },
    { key: "acc.googleads", title: "Google Ads", hint: "Acesso para euphedroborges@gmail.com." },
    { key: "acc.tiktok", title: "TikTok", hint: "Com login e senha já resolvemos tudo." },
  ] },
  { id: "zr", title: "Zernio e Claude Code", items: [
    { key: "zr.facebook", title: "Facebook do cliente conectado na Zernio" },
    { key: "zr.instagram", title: "Instagram do cliente conectado na Zernio" },
    { key: "zr.gmn", title: "Google Meu Negócio conectado na Zernio" },
    { key: "zr.insights", title: "Insights aparecendo na Zernio" },
    { key: "zr.metaads", title: "Meta Ads conectado ao Claude" },
    { key: "zr.tintim", title: "Tintim conectado ao Claude" },
    { key: "zr.clarity", title: "Clarity conectado ao Claude", when: "site" },
    { key: "zr.teste", title: "Teste: pedir um resultado de cada canal ao Claude Code", hint: "Se vier, o cliente entrou no fluxo." },
  ] },
  { id: "sec", title: "Acessos e segurança", items: [
    { key: "sec.cadastro", title: "Todos os acessos cadastrados na aba Acessos deste projeto", hint: "A equipe de social media enxerga tudo ali." },
    { key: "sec.senhas", title: "Senhas só ali, nunca soltas em conversa ou e-mail" },
    { key: "sec.dois-fatores", title: "Verificação em duas etapas anotada", hint: "Quem recebe o código de cada conta." },
    { key: "sec.data", title: "Data da conferência registrada" },
  ] },
  { id: "fin", title: "Fechamento", items: [
    { key: "fin.reuniao", title: "Reunião de alinhamento feita", hint: "O que esperar, como aprovar e prazos." },
    { key: "fin.login", title: "Cliente com login para aprovar as peças" },
    { key: "fin.baseline", title: "Ponto de partida registrado", hint: "Seguidores, conversas e vendas do mês antes de começar. Sem isso o resultado não prova nada." },
    { key: "fin.calendario", title: "Calendário do primeiro mês montado", hint: "Inclui as datas comemorativas." },
    { key: "fin.entrega", title: "Primeira entrega agendada" },
    { key: "fin.relatorio", title: "Cliente entrou na rotina do relatório de resultados" },
  ] },
];

export const FIELDS: { key: FieldKey; label: string; hint?: string; options: { value: string; label: string }[] }[] = [
  { key: "site", label: "O cliente tem site?", hint: "Se não tem, vira oportunidade de oferecer.", options: [{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }] },
  { key: "crm", label: "CRM", options: [{ value: "", label: "A definir" }, { value: "chat", label: "Chatwoot (nosso)" }, { value: "outro", label: "Outro, indicado ou já usado" }, { value: "nao", label: "Não precisa" }] },
  { key: "erp", label: "ERP", hint: "Anote qual é, mesmo que ainda não tenhamos acesso.", options: [{ value: "", label: "Ainda não sei" }, { value: "simplesvet", label: "Simples Vet" }, { value: "onepet", label: "OnePet" }, { value: "outro", label: "Outro" }, { value: "nao", label: "Não usa ERP" }] },
];

export const EMPTY_ONBOARDING: OnboardingData = { checks: {}, fields: {}, notes: "", updatedAt: null };

const TEXT_FIELDS = ["erpOutro", "crmOutro"] as const;
const NOTES_MAX = 4000;
const TEXT_MAX = 80;

const ALL_KEYS = new Set(SECTIONS.flatMap((section) => section.items.map((item) => item.key)));

/** O cliente sem resposta na ficha conta como "tem site": só some o que não vale
 * quando alguém marca "Não" de propósito. */
export function itemApplies(item: ChecklistItem, fields: OnboardingFields): boolean {
  const site = fields.site !== "nao";
  switch (item.when) {
    case "site": return site;
    case "nosite": return !site;
    case "chat": return fields.crm === "chat";
    case "crm": return fields.crm !== "nao";
    case "erp": return fields.erp !== "nao";
    default: return true;
  }
}

export function noticeApplies(section: ChecklistSection, fields: OnboardingFields): boolean {
  switch (section.notice?.when) {
    case "nosite": return fields.site === "nao";
    case "nocrm": return fields.crm === "nao";
    case "noerp": return fields.erp === "nao";
    default: return false;
  }
}

export function progressOf(data: Pick<OnboardingData, "checks" | "fields">) {
  const perSection: Record<string, { done: number; total: number }> = {};
  let done = 0, total = 0;
  for (const section of SECTIONS) {
    let d = 0, t = 0;
    for (const item of section.items) {
      if (!itemApplies(item, data.fields)) continue;
      t += 1;
      if (data.checks[item.key]) d += 1;
    }
    perSection[section.id] = { done: d, total: t };
    done += d; total += t;
  }
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0, perSection };
}

export type OnboardingPatch = { checks?: Record<string, boolean>; fields?: Record<string, string>; notes?: string };

/** Valida o que a tela manda. Chave desconhecida ou valor fora da lista é
 * recusado, para o banco nunca guardar lixo que a tela não saberia mostrar. */
export function parsePatch(body: unknown): OnboardingPatch {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Pedido inválido.");
  const input = body as Record<string, unknown>;
  const patch: OnboardingPatch = {};
  if (input.checks !== undefined) {
    if (!input.checks || typeof input.checks !== "object" || Array.isArray(input.checks)) throw new Error("Marcações inválidas.");
    patch.checks = {};
    for (const [key, value] of Object.entries(input.checks)) {
      if (!ALL_KEYS.has(key)) throw new Error(`Item desconhecido: ${key}.`);
      if (typeof value !== "boolean") throw new Error("Marcação inválida.");
      patch.checks[key] = value;
    }
  }
  if (input.fields !== undefined) {
    if (!input.fields || typeof input.fields !== "object" || Array.isArray(input.fields)) throw new Error("Ficha inválida.");
    patch.fields = {};
    for (const [key, value] of Object.entries(input.fields)) {
      if (typeof value !== "string") throw new Error("Resposta inválida.");
      const select = FIELDS.find((field) => field.key === key);
      if (select) {
        if (!select.options.some((option) => option.value === value)) throw new Error(`Resposta fora da lista em ${select.label}.`);
        patch.fields[key] = value;
      } else if ((TEXT_FIELDS as readonly string[]).includes(key)) {
        patch.fields[key] = value.trim().slice(0, TEXT_MAX);
      } else throw new Error(`Campo desconhecido: ${key}.`);
    }
  }
  if (input.notes !== undefined) {
    if (typeof input.notes !== "string") throw new Error("Observação inválida.");
    patch.notes = input.notes.slice(0, NOTES_MAX);
  }
  return patch;
}

/** Aplica o pedido sobre o que já estava guardado. `today` é a data de quem
 * marcou o item; item já marcado mantém a data original. */
export function applyPatch(current: OnboardingData, patch: OnboardingPatch, today: string): OnboardingData {
  const checks = { ...current.checks };
  for (const [key, on] of Object.entries(patch.checks ?? {})) {
    if (on) checks[key] = checks[key] || today; else delete checks[key];
  }
  return { checks, fields: { ...current.fields, ...(patch.fields ?? {}) }, notes: patch.notes ?? current.notes, updatedAt: current.updatedAt };
}
