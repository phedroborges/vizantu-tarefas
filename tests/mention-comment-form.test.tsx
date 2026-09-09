// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MentionCommentForm } from "../src/components/mention-comment-form";
import type { Member } from "../src/lib/types";

const members: Member[] = [{ id: "erika", name: "Erika Iorrana", email: "erika@vizantu.com.br", role: "editor", aiEnabled: false, active: true, createdAt: "2026-01-01", updatedAt: "2026-01-01" }];
let root: ReturnType<typeof createRoot> | undefined;
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });

function Harness({ submit }: { submit: (ids: string[]) => void }) {
  const [value, setValue] = useState("@Eri");
  return <MentionCommentForm value={value} onChange={setValue} members={members} onSubmit={submit} />;
}

describe("menções no comentário", () => {
  it("seleciona com Enter, mantém o foco e não envia o comentário", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const submit = vi.fn();
    root = createRoot(host);
    await act(async () => root!.render(<Harness submit={submit} />));
    const textarea = host.querySelector("textarea")!;
    textarea.focus();
    await act(async () => textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    expect(textarea.value).toBe("@Erika Iorrana ");
    expect(document.activeElement).toBe(textarea);
    expect(submit).not.toHaveBeenCalled();
  });
});
