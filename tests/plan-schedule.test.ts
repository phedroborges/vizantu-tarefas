import { describe, expect, it } from "vitest";
import { copyApproved, formatFamily, reschedulePlan, weekStart, weeklyDiagnosis, type ScheduleItem } from "../src/lib/plan-schedule";

const item = (over: Partial<ScheduleItem> & { id: string }): ScheduleItem => ({
  name: over.id, status: "aprovacao_copy", seasonal: false, formats: ["Reels"], ...over,
});

describe("leitura de formato e aprovação", () => {
  it("1. reconhece as escritas que o time usa pra vídeo", () => {
    for (const label of ["Reels", "Reel", "Vídeo", "video", "TikTok"]) {
      expect(formatFamily([label]), label).toBe("video");
    }
    expect(formatFamily(["Carrossel"])).toBe("carrossel");
    expect(formatFamily(["Estático"])).toBe("estatico");
    expect(formatFamily(["Newsletter"])).toBe("outro");
  });

  it("2. texto aprovado é o que já passou da aprovação de copy", () => {
    expect(copyApproved("pronto_para_criacao")).toBe(true);
    expect(copyApproved("aguardando_captacao")).toBe(true);
    expect(copyApproved("aprovado")).toBe(true);
    expect(copyApproved("aprovacao_copy")).toBe(false);
    expect(copyApproved("rascunho")).toBe(false);
  });

  it("3. a semana começa na segunda", () => {
    expect(weekStart("2026-09-03")).toBe("2026-08-31");
    expect(weekStart("2026-08-31")).toBe("2026-08-31");
    expect(weekStart("2026-09-06")).toBe("2026-08-31");
    expect(weekStart("2026-09-07")).toBe("2026-09-07");
  });
});

describe("reordenar pelo que o cliente já aprovou", () => {
  it("4. aprovado sobe para a vaga mais cedo, não aprovado desce", () => {
    const itens = [
      item({ id: "a", dueDate: "2026-09-10", status: "aprovacao_copy" }),
      item({ id: "b", dueDate: "2026-09-11", status: "pronto_para_criacao" }),
    ];
    const { moves } = reschedulePlan(itens, { minDate: "2026-09-04" });
    expect(moves).toEqual([
      { id: "b", name: "b", from: "2026-09-11", to: "2026-09-10" },
      { id: "a", name: "a", from: "2026-09-10", to: "2026-09-11" },
    ]);
  });

  it("5. as vagas são as MESMAS datas: nada é criado nem apagado", () => {
    const datas = ["2026-09-10", "2026-09-12", "2026-09-15"];
    const itens = datas.map((dueDate, i) => item({ id: `i${i}`, dueDate, status: i === 2 ? "pronto_para_criacao" : "aprovacao_copy" }));
    const { moves, unscheduled } = reschedulePlan(itens, { minDate: "2026-09-04" });
    expect(unscheduled).toEqual([]);
    const finais = new Map(itens.map((i) => [i.id, i.dueDate!]));
    for (const move of moves) finais.set(move.id, move.to);
    expect([...finais.values()].sort()).toEqual(datas);
  });

  it("6. sazonal não sai do lugar nem cede a vaga", () => {
    const itens = [
      item({ id: "sete-setembro", dueDate: "2026-09-07", seasonal: true }),
      item({ id: "comum", dueDate: "2026-09-08", status: "pronto_para_criacao" }),
    ];
    const { moves } = reschedulePlan(itens, { minDate: "2026-09-04" });
    expect(moves.find((m) => m.id === "sete-setembro")).toBeUndefined();
    // A única vaga livre é o dia 8; o aprovado fica onde já estava.
    expect(moves).toEqual([]);
  });

  it("7. atrasado volta pra dentro do plano, não pro mês seguinte", () => {
    const itens = [
      item({ id: "atrasado", dueDate: "2026-09-01" }),
      item({ id: "futuro", dueDate: "2026-09-10" }),
    ];
    const { moves } = reschedulePlan(itens, { minDate: "2026-09-04" });
    const destinos = moves.map((m) => m.to);
    // O primeiro dia livre a partir de amanhã, e não 11/09 (depois do fim).
    expect(destinos).toContain("2026-09-04");
    for (const move of moves) expect(move.to >= "2026-09-04").toBe(true);
  });

  it("8. dia de sazonal nunca recebe um item remanejado", () => {
    const itens = [
      item({ id: "atrasado", dueDate: "2026-09-01" }),
      item({ id: "sazonal", dueDate: "2026-09-04", seasonal: true }),
      item({ id: "ultimo", dueDate: "2026-09-10" }),
    ];
    const { moves } = reschedulePlan(itens, { minDate: "2026-09-04" });
    const finais = new Map(itens.map((i) => [i.id, i.dueDate!]));
    for (const move of moves) finais.set(move.id, move.to);
    expect(finais.get("sazonal")).toBe("2026-09-04");
    expect([...finais.entries()].filter(([id]) => id !== "sazonal").map(([, d]) => d)).not.toContain("2026-09-04");
  });

  it("8a. dia vazio vem antes de dobrar num dia que já tem conteúdo", () => {
    const itens = [
      item({ id: "atrasado", dueDate: "2026-09-01" }),
      item({ id: "ocupado", dueDate: "2026-09-04" }),
      item({ id: "fim", dueDate: "2026-09-08" }),
    ];
    const { moves } = reschedulePlan(itens, { minDate: "2026-09-04" });
    const finais = new Map(itens.map((i) => [i.id, i.dueDate!]));
    for (const move of moves) finais.set(move.id, move.to);
    // 05/09 está vazio, então ninguém precisa dividir o dia 04 com o outro.
    const porDia = new Map<string, number>();
    for (const data of finais.values()) porDia.set(data, (porDia.get(data) ?? 0) + 1);
    expect([...porDia.values()].every((qtd) => qtd === 1)).toBe(true);
  });

  it("8b. dobra no mesmo dia, mas não passa de três", () => {
    // Quatro atrasados e só dois dias disponíveis (05 e 06): cada um recebe
    // no máximo três, e o que não coube vai pra depois do fim.
    const itens = [
      ...["2026-09-01", "2026-09-02", "2026-08-30", "2026-08-31", "2026-08-29"].map((dueDate, i) => item({ id: `atr${i}`, dueDate })),
      item({ id: "a", dueDate: "2026-09-05" }),
      item({ id: "b", dueDate: "2026-09-06" }),
    ];
    const { moves } = reschedulePlan(itens, { minDate: "2026-09-05" });
    const finais = new Map(itens.map((i) => [i.id, i.dueDate!]));
    for (const move of moves) finais.set(move.id, move.to);
    const porDia = new Map<string, number>();
    for (const data of finais.values()) porDia.set(data, (porDia.get(data) ?? 0) + 1);
    for (const [data, qtd] of porDia) expect(qtd, data).toBeLessThanOrEqual(3);
    for (const data of finais.values()) expect(data >= "2026-09-05", data).toBe(true);
  });

  it("9. nenhuma data anterior a amanhã sobra em qualquer cenário", () => {
    const itens = ["2026-08-20", "2026-09-01", "2026-09-02", "2026-09-12"].map((dueDate, i) =>
      item({ id: `i${i}`, dueDate, status: i % 2 ? "pronto_para_criacao" : "aprovacao_copy" }),
    );
    const { moves } = reschedulePlan(itens, { minDate: "2026-09-04" });
    const finais = new Map(itens.map((i) => [i.id, i.dueDate!]));
    for (const move of moves) finais.set(move.id, move.to);
    for (const data of finais.values()) expect(data >= "2026-09-04", data).toBe(true);
  });

  it("10. entre dois aprovados, entra o formato que falta na semana", () => {
    // Semana de 07/09 com três vagas. A fila tem dois vídeos e um carrossel,
    // todos aprovados: o mínimo semanal pede vídeo, vídeo e carrossel.
    const itens = [
      item({ id: "video1", dueDate: "2026-09-07", status: "pronto_para_criacao", formats: ["Reels"] }),
      item({ id: "video2", dueDate: "2026-09-08", status: "pronto_para_criacao", formats: ["Reels"] }),
      item({ id: "video3", dueDate: "2026-09-09", status: "pronto_para_criacao", formats: ["Reels"] }),
      item({ id: "carrossel", dueDate: "2026-09-10", status: "pronto_para_criacao", formats: ["Carrossel"] }),
    ];
    const { moves } = reschedulePlan(itens, { minDate: "2026-09-04" });
    const finais = new Map(itens.map((i) => [i.id, i.dueDate!]));
    for (const move of moves) finais.set(move.id, move.to);
    // O carrossel sobe pra terceira vaga da semana, porque dois vídeos já
    // fecharam o mínimo de vídeo e o carrossel ainda estava faltando.
    expect(finais.get("carrossel")).toBe("2026-09-09");
    expect(finais.get("video3")).toBe("2026-09-10");
  });

  it("11. item sem data não recebe vaga inventada", () => {
    const itens = [item({ id: "sem-data", dueDate: undefined }), item({ id: "com-data", dueDate: "2026-09-10" })];
    const { moves, unscheduled } = reschedulePlan(itens, { minDate: "2026-09-04" });
    expect(moves).toEqual([]);
    expect(unscheduled).toEqual([]);
  });

  it("12. rodar de novo não muda mais nada", () => {
    const itens = ["2026-09-07", "2026-09-08", "2026-09-09"].map((dueDate, i) =>
      item({ id: `i${i}`, dueDate, status: i === 2 ? "pronto_para_criacao" : "aprovacao_copy", formats: [i ? "Carrossel" : "Reels"] }),
    );
    const primeira = reschedulePlan(itens, { minDate: "2026-09-04" });
    const depois = itens.map((i) => ({ ...i, dueDate: primeira.moves.find((m) => m.id === i.id)?.to ?? i.dueDate }));
    expect(reschedulePlan(depois, { minDate: "2026-09-04" }).moves).toEqual([]);
  });
});

describe("diagnóstico semanal", () => {
  it("13. cobra o que falta pro mínimo combinado", () => {
    const itens = [
      item({ id: "a", dueDate: "2026-09-07", formats: ["Reels"] }),
      item({ id: "b", dueDate: "2026-09-09", formats: ["Carrossel"] }),
    ];
    const [semana] = weeklyDiagnosis(itens);
    expect(semana.weekStart).toBe("2026-09-07");
    expect(semana.counts.video).toBe(1);
    expect(semana.missing).toEqual([
      { family: "video", quantidade: 1 },
      { family: "estatico", quantidade: 1 },
    ]);
  });

  it("14. semana completa não cobra nada", () => {
    const itens = [
      item({ id: "a", dueDate: "2026-09-07", formats: ["Reels"] }),
      item({ id: "b", dueDate: "2026-09-08", formats: ["Vídeo"] }),
      item({ id: "c", dueDate: "2026-09-09", formats: ["Carrossel"] }),
      item({ id: "d", dueDate: "2026-09-10", formats: ["Estático"] }),
    ];
    expect(weeklyDiagnosis(itens)[0].missing).toEqual([]);
  });
});
