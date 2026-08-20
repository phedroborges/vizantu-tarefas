import { describe, expect, it } from "vitest";
import { inheritsCaptureEditor } from "../src/lib/assignee-inheritance";

describe("herança do editor da captação", () => {
  it("preenche conteúdos legados sem responsável", () => {
    expect(inheritsCaptureEditor(undefined, undefined)).toBe(true);
  });

  it("continua atualizando conteúdos que herdaram da captação", () => {
    expect(inheritsCaptureEditor("editor-anterior", "captacao")).toBe(true);
  });

  it("preserva responsável escolhido manualmente", () => {
    expect(inheritsCaptureEditor("outra-pessoa", "manual")).toBe(false);
  });

  it("preserva a exceção manual sem responsável", () => {
    expect(inheritsCaptureEditor(undefined, "manual")).toBe(false);
  });
});
