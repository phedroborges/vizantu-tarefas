import { promises as fs } from "fs";
import path from "path";
import type { Project, Task } from "./types";

type Db = { projects: Project[]; tasks: Task[] };

const DB_PATH = path.join(process.cwd(), "data", "db.json");

let writeQueue: Promise<unknown> = Promise.resolve();

function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(fn, fn);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function newId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

async function readDb(): Promise<Db> {
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    return JSON.parse(raw) as Db;
  } catch {
    const empty: Db = { projects: [], tasks: [] };
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }
}

async function writeDb(db: Db): Promise<void> {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

// ---------- Projetos ----------

export async function listProjects(): Promise<Project[]> {
  const db = await readDb();
  return [...db.projects].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await readDb();
  return db.projects.find((project) => project.id === id);
}

export async function createProject(input: { name: string; client?: string; status?: Project["status"] }): Promise<Project> {
  return withWriteLock(async () => {
    const db = await readDb();
    const now = nowIso();
    const project: Project = {
      id: newId(),
      name: input.name.trim(),
      client: input.client?.trim() || undefined,
      status: input.status || "ativo",
      createdAt: now,
      updatedAt: now,
    };
    db.projects.push(project);
    await writeDb(db);
    return project;
  });
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<Project, "name" | "client" | "status">>,
): Promise<Project | undefined> {
  return withWriteLock(async () => {
    const db = await readDb();
    const project = db.projects.find((item) => item.id === id);
    if (!project) return undefined;
    if (patch.name !== undefined) project.name = patch.name.trim();
    if (patch.client !== undefined) project.client = patch.client.trim() || undefined;
    if (patch.status !== undefined) project.status = patch.status;
    project.updatedAt = nowIso();
    await writeDb(db);
    return project;
  });
}

export async function deleteProject(id: string): Promise<boolean> {
  return withWriteLock(async () => {
    const db = await readDb();
    const before = db.projects.length;
    db.projects = db.projects.filter((project) => project.id !== id);
    db.tasks = db.tasks.filter((task) => task.projectId !== id);
    await writeDb(db);
    return db.projects.length < before;
  });
}

// ---------- Tarefas ----------

export type TaskInput = {
  projectId: string;
  name: string;
  dueDate?: string;
  assignee?: string;
  description?: string;
  driveLink?: string;
  format?: Task["format"];
  channel?: string;
  status?: Task["status"];
};

export async function listTasks(): Promise<Task[]> {
  const db = await readDb();
  return [...db.tasks].sort((a, b) => (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99"));
}

export async function getTask(id: string): Promise<Task | undefined> {
  const db = await readDb();
  return db.tasks.find((task) => task.id === id);
}

export async function createTask(input: TaskInput): Promise<Task> {
  return withWriteLock(async () => {
    const db = await readDb();
    const now = nowIso();
    const task: Task = {
      id: newId(),
      projectId: input.projectId,
      name: input.name.trim(),
      dueDate: input.dueDate || undefined,
      assignee: input.assignee?.trim() || undefined,
      description: input.description?.trim() || undefined,
      driveLink: input.driveLink?.trim() || undefined,
      format: input.format,
      channel: input.channel?.trim() || undefined,
      status: input.status || "a_fazer",
      comments: [],
      createdAt: now,
      updatedAt: now,
    };
    db.tasks.push(task);
    await writeDb(db);
    return task;
  });
}

export async function updateTask(id: string, patch: Partial<TaskInput>): Promise<Task | undefined> {
  return withWriteLock(async () => {
    const db = await readDb();
    const task = db.tasks.find((item) => item.id === id);
    if (!task) return undefined;
    if (patch.projectId !== undefined) task.projectId = patch.projectId;
    if (patch.name !== undefined) task.name = patch.name.trim();
    if (patch.dueDate !== undefined) task.dueDate = patch.dueDate || undefined;
    if (patch.assignee !== undefined) task.assignee = patch.assignee.trim() || undefined;
    if (patch.description !== undefined) task.description = patch.description.trim() || undefined;
    if (patch.driveLink !== undefined) task.driveLink = patch.driveLink.trim() || undefined;
    if (patch.format !== undefined) task.format = patch.format;
    if (patch.channel !== undefined) task.channel = patch.channel.trim() || undefined;
    if (patch.status !== undefined) task.status = patch.status;
    task.updatedAt = nowIso();
    await writeDb(db);
    return task;
  });
}

export async function deleteTask(id: string): Promise<boolean> {
  return withWriteLock(async () => {
    const db = await readDb();
    const before = db.tasks.length;
    db.tasks = db.tasks.filter((task) => task.id !== id);
    await writeDb(db);
    return db.tasks.length < before;
  });
}

export async function addComment(taskId: string, input: { author: string; text: string }): Promise<Task | undefined> {
  return withWriteLock(async () => {
    const db = await readDb();
    const task = db.tasks.find((item) => item.id === taskId);
    if (!task) return undefined;
    task.comments.push({
      id: newId(),
      author: input.author.trim() || "Equipe",
      text: input.text.trim(),
      createdAt: nowIso(),
    });
    task.updatedAt = nowIso();
    await writeDb(db);
    return task;
  });
}
