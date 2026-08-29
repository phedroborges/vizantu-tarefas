"use client";

import { Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { AVATAR_COLORS } from "@/lib/avatar";

// Escolha da identidade visual: envia uma foto ou (quando `withColor`) escolhe
// uma cor. A cor existe pro cliente que ainda está construindo a marca e não
// tem logo — sem ela, a única saída seria subir um placeholder qualquer.
export function AvatarPicker({
  name,
  imageUrl,
  color,
  withColor = false,
  onChange,
}: {
  name: string;
  imageUrl?: string | null;
  color?: string | null;
  withColor?: boolean;
  onChange: (next: { avatarUrl?: string | null; avatarColor?: string | null }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || "Não foi possível enviar a imagem.");
        return;
      }
      onChange({ avatarUrl: result.url });
    } catch {
      setError("Falha de conexão ao enviar a imagem.");
    } finally {
      setBusy(false);
      // Permite reenviar o MESMO arquivo depois de remover — sem isto o input
      // não dispara change por o value não ter mudado.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="avatar-picker">
      <div className="avatar-picker-top">
        <Avatar name={name || "?"} imageUrl={imageUrl} color={color} size={52} />
        <div className="avatar-picker-actions">
          <button type="button" className="secondary-button" disabled={busy} onClick={() => inputRef.current?.click()}>
            <Upload size={13} /> {busy ? "Enviando..." : imageUrl ? "Trocar foto" : "Enviar foto"}
          </button>
          {imageUrl ? (
            <button type="button" className="avatar-picker-remove" onClick={() => onChange({ avatarUrl: null })}>
              <Trash2 size={13} /> Remover
            </button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
          }}
        />
      </div>

      {withColor ? (
        <div className="avatar-picker-colors">
          <span className="avatar-picker-label">Ou escolha uma cor</span>
          <div className="avatar-swatches">
            {AVATAR_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                className={`avatar-swatch ${color === swatch ? "is-selected" : ""}`}
                style={{ background: swatch }}
                aria-label={`Usar a cor ${swatch}`}
                // Escolher cor tira a foto: os dois juntos não fazem sentido,
                // e a foto sempre venceria na hora de exibir.
                onClick={() => onChange({ avatarColor: swatch, avatarUrl: null })}
              />
            ))}
            {color ? (
              <button type="button" className="avatar-picker-remove" onClick={() => onChange({ avatarColor: null })}>
                Usar a cor automática
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? <p className="avatar-picker-error" role="alert">{error}</p> : null}
    </div>
  );
}
