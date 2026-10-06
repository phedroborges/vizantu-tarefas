"use client";

import { ImagePlus, Loader2, Mic, Send, Square, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { IconButton } from "@/components/vz";
import type { CommentAttachment, Member } from "@/lib/types";
import { uploadAudioBlob } from "@/lib/upload-audio";
import { imagesFromTransfer, isUploadableImage, uploadImageFile } from "@/lib/upload-image";

const MAX_ATTACHMENTS = 6;

function clock(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }

// `onSubmit` pode devolver `false` (ou uma promessa de `false`) para dizer que
// o envio falhou: aí os anexos continuam no formulário em vez de sumirem.
export function MentionCommentForm({ value, onChange, members, disabled, onSubmit }: {
  value: string; onChange: (value: string) => void; members: Member[]; disabled?: boolean;
  onSubmit: (mentionedMemberIds: string[], attachments: CommentAttachment[]) => void | boolean | Promise<void | boolean>;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [mentioned, setMentioned] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [attachments, setAttachments] = useState<CommentAttachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const [recordingSeconds, setRecordingSeconds] = useState<number | null>(null);
  const [problem, setProblem] = useState("");
  const match = /(?:^|\s)@([^@\s]*)$/.exec(value);
  const options = useMemo(() => {
    if (!match) return [];
    const query = match[1].toLocaleLowerCase("pt-BR");
    return members.filter((member) => member.active && member.name.toLocaleLowerCase("pt-BR").includes(query)).slice(0, 6);
  }, [match, members]);
  const isRecording = recordingSeconds !== null;
  const full = attachments.length >= MAX_ATTACHMENTS;
  const busy = uploading > 0 || isRecording;

  // Fechar a tarefa no meio de uma gravação não pode deixar o microfone aberto.
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") { recorder.onstop = null; recorder.stop(); }
    recorder?.stream.getTracks().forEach((track) => track.stop());
  }, []);

  function choose(member: Member) {
    if (!match) return;
    const at = match.index + match[0].lastIndexOf("@");
    const next = `${value.slice(0, at)}@${member.name} `;
    onChange(next);
    setMentioned((current) => current.includes(member.id) ? current : [...current, member.id]);
    setActiveIndex(0);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(next.length, next.length);
    });
  }

  async function attach(upload: () => Promise<CommentAttachment>) {
    setProblem("");
    setUploading((count) => count + 1);
    try {
      const attachment = await upload();
      setAttachments((current) => current.length >= MAX_ATTACHMENTS ? current : [...current, attachment]);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Não foi possível enviar o anexo.");
    } finally {
      setUploading((count) => count - 1);
    }
  }

  function attachImages(files: File[]) {
    const room = MAX_ATTACHMENTS - attachments.length;
    if (files.length > room) setProblem(`Cada comentário leva até ${MAX_ATTACHMENTS} anexos.`);
    for (const file of files.slice(0, Math.max(0, room))) void attach(async () => ({ type: "image", url: await uploadImageFile(file) }));
  }

  async function startRecording() {
    setProblem("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      const startedAt = Date.now();
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const durationMs = Date.now() - startedAt;
        if (!blob.size) return setProblem("A gravação ficou vazia. Grave de novo.");
        void attach(async () => ({ type: "audio", url: await uploadAudioBlob(blob), durationMs }));
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds((seconds) => (seconds ?? 0) + 1), 1000);
    } catch {
      setProblem("Não consegui acessar o microfone. Verifique a permissão do navegador.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setRecordingSeconds(null);
  }

  const canSend = !disabled && !busy && Boolean(value.trim() || attachments.length);

  async function submit(event: React.SyntheticEvent) {
    event.preventDefault();
    if (!canSend) return;
    const valid = mentioned.filter((id) => { const member = members.find((item) => item.id === id); return member && value.includes(`@${member.name}`); });
    const sent = await onSubmit(valid, attachments);
    if (sent === false) return;
    setMentioned([]);
    setAttachments([]);
  }

  return <form className="comment-form mention-composer" onSubmit={submit}>
    <textarea
      ref={inputRef}
      value={value}
      onChange={(event) => { onChange(event.target.value); setActiveIndex(0); }}
      onPaste={(event) => {
        const images = imagesFromTransfer(event.clipboardData);
        if (!images.length) return;
        event.preventDefault();
        attachImages(images);
      }}
      onKeyDown={(event) => {
        if (options.length && event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => (index + 1) % options.length); }
        else if (options.length && event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => (index - 1 + options.length) % options.length); }
        else if (options.length && (event.key === "Enter" || event.key === "Tab")) { event.preventDefault(); choose(options[activeIndex] || options[0]); }
        else if (event.key === "Escape") { event.preventDefault(); onChange(value.replace(/(?:^|\s)@[^@\s]*$/, "")); }
        else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void submit(event);
      }}
      placeholder="Escreva um comentário ou use @ para mencionar"
      aria-label="Adicionar comentário"
      rows={3}
      maxLength={600}
    />
    <IconButton bare type="submit" disabled={!canSend} aria-label="Enviar comentário"><Send size={15} /></IconButton>
    {attachments.length || uploading ? <div className="comment-attachments is-draft">
      {attachments.map((attachment) => <span className={`comment-attachment is-${attachment.type}`} key={attachment.url}>
        {attachment.type === "image"
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={attachment.url} alt="Imagem anexada" />
          : <audio controls preload="metadata" src={attachment.url} />}
        <button type="button" aria-label={attachment.type === "image" ? "Remover imagem" : "Remover áudio"} onClick={() => setAttachments((current) => current.filter((item) => item.url !== attachment.url))}><X size={11} /></button>
      </span>)}
      {uploading ? <span className="comment-attachment is-loading"><Loader2 size={13} className="ai-spin" /> Enviando…</span> : null}
    </div> : null}
    <div className="mention-composer__tools">
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={(event) => { const files = Array.from(event.target.files || []).filter(isUploadableImage); event.target.value = ""; if (files.length) attachImages(files); }} />
      <button type="button" className="mention-composer__tool" disabled={disabled || full || isRecording} onClick={() => fileRef.current?.click()} title="Anexar imagem (ou cole com Ctrl+V)" aria-label="Anexar imagem"><ImagePlus size={14} /></button>
      {isRecording
        ? <button type="button" className="mention-composer__tool is-recording" onClick={stopRecording} aria-label="Parar gravação"><Square size={11} fill="currentColor" /> {clock(recordingSeconds)} · parar</button>
        : <button type="button" className="mention-composer__tool" disabled={disabled || full} onClick={startRecording} title="Gravar áudio" aria-label="Gravar áudio"><Mic size={14} /></button>}
      <small className="mention-composer__hint">⌘ + Enter para enviar</small>
    </div>
    {problem ? <small className="mention-composer__problem" role="alert">{problem}</small> : null}
    {options.length ? <div className="mention-menu" role="listbox" aria-label="Mencionar usuário">{options.map((member, index) => <button type="button" role="option" aria-selected={index === activeIndex} key={member.id} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(member)}><Avatar name={member.name} imageUrl={member.avatarUrl} size={25} /><span><strong>{member.name}</strong><small>{member.email}</small></span></button>)}</div> : null}
  </form>;
}
