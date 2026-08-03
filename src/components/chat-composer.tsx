"use client";

import { FileAudio, Loader2, Mic, Paperclip, Send, Square, X } from "lucide-react";
import { useRef, useState } from "react";
import { resizeImageFile } from "@/lib/resize-image";

type Attachment = { id: string; status: "uploading" | "done" | "error"; localPreview: string; url?: string };

function newId() {
  return Math.random().toString(36).slice(2);
}

function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function ChatComposer({
  onSubmit,
  disabled,
  placeholder,
  variant = "compact",
}: {
  onSubmit: (text: string, images: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  variant?: "compact" | "full";
}) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState("");

  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const busy = Boolean(disabled) || isTranscribing || attachments.some((a) => a.status === "uploading");

  async function addImageFile(file: File) {
    const id = newId();
    const localPreview = URL.createObjectURL(file);
    setAttachments((current) => [...current, { id, status: "uploading", localPreview }]);
    try {
      const resized = await resizeImageFile(file);
      const formData = new FormData();
      formData.append("file", resized);
      const response = await fetch("/api/uploads", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha ao enviar imagem.");
      setAttachments((current) => current.map((a) => (a.id === id ? { ...a, status: "done", url: result.url } : a)));
    } catch {
      setAttachments((current) => current.map((a) => (a.id === id ? { ...a, status: "error" } : a)));
    }
  }

  function removeAttachment(id: string) {
    setAttachments((current) => current.filter((a) => a.id !== id));
  }

  async function handleImageFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    for (const file of files) await addImageFile(file);
  }

  async function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;
    event.preventDefault();
    await addImageFile(file);
  }

  async function transcribeAndInsert(blob: Blob, filename: string) {
    setError("");
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", blob, filename);
      const response = await fetch("/api/assistant/transcribe", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha ao transcrever áudio.");
      setText((current) => (current.trim() ? `${current.trim()} ${result.text}` : result.text));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao transcrever áudio.");
    } finally {
      setIsTranscribing(false);
    }
  }

  async function handleAudioFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await transcribeAndInsert(file, file.name);
  }

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        transcribeAndInsert(blob, "gravacao.webm");
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      setError("Não consegui acessar o microfone. Verifique a permissão do navegador.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function submit() {
    const readyImages = attachments.filter((a) => a.status === "done").map((a) => a.url!);
    if ((!text.trim() && !readyImages.length) || busy) return;
    onSubmit(text, readyImages);
    setText("");
    setAttachments([]);
  }

  return (
    <div className={`composer composer--${variant}`}>
      {error ? <p className="composer-error">{error}</p> : null}
      {attachments.length ? (
        <div className="composer-attachments">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="composer-attachment">
              <img src={attachment.localPreview} alt="Anexo" />
              {attachment.status === "uploading" ? <Loader2 size={14} className="ai-spin composer-attachment-spin" /> : null}
              {attachment.status === "error" ? <span className="composer-attachment-error">Falhou</span> : null}
              <button type="button" onClick={() => removeAttachment(attachment.id)} aria-label="Remover imagem">
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="composer-toolbar">
        <button type="button" className="composer-tool" onClick={() => imageInputRef.current?.click()} disabled={disabled} aria-label="Anexar imagem" title="Anexar imagem">
          <Paperclip size={variant === "full" ? 16 : 14} />
        </button>
        <button
          type="button"
          className={`composer-tool ${isRecording ? "recording" : ""}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled || isTranscribing}
          aria-label={isRecording ? "Parar gravação" : "Gravar áudio"}
          title={isRecording ? "Parar gravação" : "Gravar áudio"}
        >
          {isRecording ? <Square size={variant === "full" ? 15 : 13} /> : <Mic size={variant === "full" ? 16 : 14} />}
        </button>
        <button
          type="button"
          className="composer-tool"
          onClick={() => audioInputRef.current?.click()}
          disabled={disabled || isRecording}
          aria-label="Enviar arquivo de áudio para transcrever"
          title="Enviar arquivo de áudio para transcrever"
        >
          <FileAudio size={variant === "full" ? 16 : 14} />
        </button>
        {isRecording ? <span className="composer-status recording">● {formatSeconds(recordingSeconds)}</span> : null}
        {isTranscribing ? (
          <span className="composer-status">
            <Loader2 size={12} className="ai-spin" /> Transcrevendo...
          </span>
        ) : null}
        <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={handleImageFiles} />
        <input ref={audioInputRef} type="file" accept="audio/*" hidden onChange={handleAudioFile} />
      </div>
      <form
        className="composer-input-row"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onPaste={handlePaste}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={4000}
          rows={variant === "full" ? 2 : 1}
        />
        <button type="submit" className={variant === "full" ? "primary-button" : "icon-button"} disabled={busy || (!text.trim() && !attachments.some((a) => a.status === "done"))}>
          <Send size={14} /> {variant === "full" ? "Enviar" : null}
        </button>
      </form>
    </div>
  );
}
