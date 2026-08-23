import { describe, expect, it } from "vitest";
import { BRAND_STAGES } from "../src/lib/types";

describe("fluxo padrão de marca", () => {
  it("mantém as sete entregas na ordem operacional", () => {
    expect(BRAND_STAGES).toEqual([
      "Briefing",
      "Entrevistas",
      "Diagnóstico de marca",
      "Plataforma de marca",
      "Identidade visual",
      "Manual de marca",
      "Apresentação",
    ]);
  });
});
