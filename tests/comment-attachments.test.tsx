// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MentionCommentForm } from "../src/components/mention-comment-form";
import type { CommentAttachment } from "../src/lib/types";

vi.mock("../src/lib/upload-image", async (original) => ({
  ...(await original<typeof import("../src/lib/upload-image")>()),
  uploadImageFile: vi.fn(async (file: File) => `https://bucket.test/${file.name}`),
}));

let root: ReturnType<typeof createRoot> | undefined;
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });

function Harness({ submit, initial = "" }: { submit: (ids: string[], attachments: CommentAttachment[]) => boolean | void; initial?: string }) {
  const [value, setValue] = useState(initial);
  return <MentionCommentForm value={value} onChange={setValue} members={[]} onSubmit={submit} />;
}

async function mount(submit: (ids: string[], attachments: CommentAttachment[]) => boolean | void) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(<Harness submit={submit} />));
  return host;
}

async function pickImage(host: HTMLElement, name: string) {
  const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", { configurable: true, value: [new File(["x"], name, { type: "image/png" })] });
  await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); });
  await act(async () => { await Promise.resolve(); });
}

describe("anexos no comentário", () => {
  it("não envia comentário vazio, mas envia só com imagem", async () => {
    const submit = vi.fn();
    const host = await mount(submit);
    const send = host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(send.disabled).toBe(true);

    await pickImage(host, "print.png");
    expect(host.querySelectorAll(".comment-attachment.is-image img")).toHaveLength(1);
    expect(send.disabled).toBe(false);

    await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(submit).toHaveBeenCalledWith([], [{ type: "image", url: "https://bucket.test/print.png" }]);
    // Enviou: o rascunho dos anexos é limpo.
    expect(host.querySelectorAll(".comment-attachment")).toHaveLength(0);
  });

  it("mantém os anexos quando o envio falha e deixa remover antes de enviar", async () => {
    const submit = vi.fn(() => false);
    const host = await mount(submit);
    await pickImage(host, "a.png");
    await pickImage(host, "b.png");
    await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(host.querySelectorAll(".comment-attachment.is-image")).toHaveLength(2);

    await act(async () => { host.querySelector<HTMLButtonElement>('button[aria-label="Remover imagem"]')!.click(); });
    expect(host.querySelectorAll(".comment-attachment.is-image")).toHaveLength(1);
  });
});
