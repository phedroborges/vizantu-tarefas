import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicSurvey } from "@/components/public-survey";
import { SurveyManager } from "@/components/survey-manager";
import type { Project, Survey } from "@/lib/types";

const project = { id: "project-1", name: "Sanfér", status: "ativo", createdAt: "", updatedAt: "" } as Project;
const survey: Survey = {
  id: "survey-1", projectId: project.id, title: "Onboarding de gestão de marca", description: "Vamos conhecer a marca.",
  status: "published", token: "public-token", responses: [], createdAt: "", updatedAt: "",
  questions: [
    { id: "q1", title: "Conte a história da marca", type: "long_text", required: true },
    { id: "q2", title: "O quanto indicaria a Vizantu?", type: "nps", required: true },
  ],
};

describe("pesquisas", () => {
  it("renderiza o construtor contextual com publicação e resultados", () => {
    const html = renderToStaticMarkup(<SurveyManager initialSurveys={[survey]} projects={[project]} lockedProjectId={project.id} />);
    expect(html).toContain("Onboarding de gestão de marca");
    expect(html).toContain("Perguntas");
    expect(html).toContain("Copiar link");
    expect(html).toContain("Resultados");
  });

  it("renderiza o formulário público com descrição completa e escala NPS", () => {
    const html = renderToStaticMarkup(<PublicSurvey survey={survey} projectName={project.name} />);
    expect(html).toContain("Vamos conhecer a marca.");
    expect(html).toContain("Conte a história da marca");
    expect(html).toContain(">0<");
    expect(html).toContain(">10<");
    expect(html).toContain("Enviar respostas");
  });
});
