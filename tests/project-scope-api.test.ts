import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { removeProject, removeTask, task } = vi.hoisted(() => ({
  removeProject: vi.fn(async () => true),
  removeTask: vi.fn(async () => true),
  task: { id: "task-9", projectId: "outro-cliente", lists: [] as string[] },
}));
vi.mock("@/lib/current-user", () => ({
  getCurrentUser: async () => ({ id: "sm-1", name: "Social", email: "", role: "social_media", aiEnabled: false, active: true, accessibleProjectIds: ["meu-cliente"], accessibleListKinds: "all" }),
}));
vi.mock("@/lib/storage", () => ({ deleteProject: removeProject, deleteTask: removeTask, getTask: async () => task, getPlan: async () => undefined }));
import { DELETE as deleteProjectRoute } from "../src/app/api/projects/[id]/route";
import { DELETE as deleteTaskRoute } from "../src/app/api/tasks/[id]/route";

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const request = new NextRequest("http://localhost/api", { method: "DELETE" });
beforeEach(() => { removeProject.mockClear(); removeTask.mockClear(); });

it("social media não apaga o projeto de um cliente fora da equipe dele", async () => {
  expect((await deleteProjectRoute(request, params("outro-cliente"))).status).toBe(403);
  expect(removeProject).not.toHaveBeenCalled();
  expect((await deleteProjectRoute(request, params("meu-cliente"))).status).toBe(200);
});

it("social media não apaga a tarefa de um cliente fora da equipe dele", async () => {
  expect((await deleteTaskRoute(request, params("task-9"))).status).toBe(403);
  expect(removeTask).not.toHaveBeenCalled();
});
