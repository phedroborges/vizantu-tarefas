"use client";

/* eslint-disable @next/next/no-img-element */
// <img> e não next/image de propósito: as fotos vêm do Storage do Supabase por
// URL pública arbitrária, e são sempre pequenas (no máximo 44px na tela). O
// otimizador do Next não traria ganho e exigiria configurar domínio remoto.

import { avatarColor, initialsOf } from "@/lib/avatar";

export function Avatar({
  name,
  imageUrl,
  color,
  size = 24,
  className = "",
}: {
  name: string;
  imageUrl?: string | null;
  color?: string | null;
  size?: number;
  className?: string;
}) {
  const background = avatarColor(name, color);
  const style = { width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.4)) };

  return (
    <span className={`avatar ${className}`.trim()} style={style} title={name} aria-hidden="true">
      {imageUrl ? (
        <img src={imageUrl} alt="" width={size} height={size} loading="lazy" />
      ) : (
        <span className="avatar-initials" style={{ background }}>{initialsOf(name)}</span>
      )}
    </span>
  );
}

// Avatar + nome, que é como a pessoa aparece na tabela e nos seletores.
export function AvatarName({
  name,
  imageUrl,
  color,
  size = 22,
  muted = false,
}: {
  name: string;
  imageUrl?: string | null;
  color?: string | null;
  size?: number;
  muted?: boolean;
}) {
  return (
    <span className={`avatar-name ${muted ? "is-muted" : ""}`.trim()}>
      <Avatar name={name} imageUrl={imageUrl} color={color} size={size} />
      <span>{name}</span>
    </span>
  );
}
