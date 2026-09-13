import { addDays, formatFamily } from "./plan-schedule";

export type ClientPackage = {
  id: string;
  planId: string;
  label: string;
  packageKind: "capture" | "creation";
  sequenceOrder: number;
  date?: string | null;
};

export type PackageContent = {
  id: string;
  planId?: string;
  planTitle?: string;
  planKind?: string;
  captacaoId?: string | null;
  captacaoLabel: string | null;
  formatLabel: string | null;
  dueDate: string | null;
  sequenceOrder?: number;
  status: string;
  reviewVersion?: number;
};

export type ClientPackageAssignment = {
  clientPackageId: string;
  clientPackageLabel: string;
  clientPackageDate: string | null;
  clientPackageKind: "capture" | "creation";
  clientPackageOrder: number;
  clientPackageWarning: string | null;
};

// A produção já iniciada mantém seu vínculo. Esta distribuição organiza a
// apresentação do plano, sem reescrever tarefas, responsáveis ou datas.
const IN_PRODUCTION = new Set(["em_criacao", "revisao", "para_aprovacao", "aprovado", "finalizado", "publicado"]);
export const DEFAULT_EDITING_DAYS = 3;

export function organizeClientPackages<T extends PackageContent>(
  items: T[], packages: ClientPackage[], editingDays = DEFAULT_EDITING_DAYS,
): (T & ClientPackageAssignment)[] {
  const assigned = new Map<string, ClientPackageAssignment>();
  const planIds = [...new Set(items.map((item) => item.planId || "legacy"))];
  for (const planId of planIds) {
    const contents = items.filter((item) => (item.planId || "legacy") === planId)
      .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999") || (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0) || a.id.localeCompare(b.id));
    const existing = packages.filter((pkg) => pkg.planId === planId);
    const byId = new Map(existing.map((pkg) => [pkg.id, pkg]));
    const videos = contents.filter((item) => item.planKind !== "process" && formatFamily([item.formatLabel || ""]) === "video" && byId.get(item.captacaoId || "")?.packageKind !== "creation");
    let captures = existing.filter((pkg) => pkg.packageKind === "capture");
    const allCapturesDated = captures.every((pkg) => pkg.date);
    captures.sort((a, b) => (allCapturesDated ? a.date!.localeCompare(b.date!) : 0) || a.sequenceOrder - b.sequenceOrder || a.id.localeCompare(b.id));
    if (!captures.length && videos.length) {
      captures = [0, 1].map((index) => ({ id: `${planId}:capture:${index}`, planId, label: `${index + 1}ª Captação`, packageKind: "capture", sequenceOrder: index }));
    }
    // Distribui todo o volume nas sessões existentes (10 → 5/5, 12 → 6/6).
    // Datas têm precedência: um vídeo que sai antes da segunda sessão volta
    // para a primeira mesmo que isso ultrapasse a divisão equilibrada.
    const loads = captures.map(() => 0);
    function assign(item: T, pkg: ClientPackage, warning: string | null = null) {
      assigned.set(item.id, {
        clientPackageId: pkg.id, clientPackageLabel: pkg.label,
        clientPackageDate: pkg.date || null, clientPackageKind: pkg.packageKind,
        clientPackageOrder: pkg.packageKind === "capture" ? captures.findIndex((capture) => capture.id === pkg.id) : 1000 + pkg.sequenceOrder,
        clientPackageWarning: warning,
      });
    }
    for (const item of videos) {
      const current = byId.get(item.captacaoId || "");
      if ((IN_PRODUCTION.has(item.status) || (item.reviewVersion ?? 1) >= 100) && current) {
        assign(item, current);
        const index = captures.findIndex((pkg) => pkg.id === current.id);
        if (index >= 0) loads[index]++;
      }
    }
    for (const item of videos) {
      if (assigned.has(item.id)) continue;
      const eligible = captures.map((pkg, index) => ({ pkg, index })).filter(({ pkg }) => !item.dueDate || !pkg.date || addDays(pkg.date, editingDays) <= item.dueDate);
      const choice = eligible.find(({ index }) => loads[index] < Math.floor(videos.length / captures.length) + (index < videos.length % captures.length ? 1 : 0)) ?? eligible.at(-1) ?? { pkg: captures[0], index: 0 };
      loads[choice.index]++;
      const warning = !item.dueDate ? "Publicação sem data: distribuição provisória."
        : !eligible.length ? "Rever datas: a captação não deixa prazo para editar antes da publicação."
        : !choice.pkg.date ? "Data da captação a definir."
        : null;
      assign(item, choice.pkg, warning);
    }
    for (const item of contents) {
      if (assigned.has(item.id)) continue;
      const current = byId.get(item.captacaoId || "");
      if (current) { assign(item, current); continue; }
      const family = formatFamily([item.formatLabel || ""]);
      const label = item.captacaoLabel || (item.planKind === "process" ? "Etapas do processo" : family === "carrossel" ? "Carrosséis" : family === "estatico" ? "Estáticos" : "Outros conteúdos");
      assign(item, { id: `${planId}:creation:${label}`, planId, label, packageKind: "creation", sequenceOrder: family === "carrossel" ? 0 : family === "estatico" ? 1 : 2 });
    }
  }
  return items.map((item) => ({ ...item, ...assigned.get(item.id)! }));
}
