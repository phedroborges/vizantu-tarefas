"use client";

// O ícone do formato. Fica num módulo só porque ele aparece na tabela, no
// board, no calendário, no seletor de pacote e no cabeçalho do pacote — e nos
// cinco lugares tem que ser o mesmo desenho.

import { Image as ImageIcon, Layers, Megaphone, Smartphone, Video } from "lucide-react";
import { Tag } from "@/components/vz";
import { FORMATOS, type FormatoNome } from "./data";

const DESENHO = { video: Video, layers: Layers, image: ImageIcon, smartphone: Smartphone, megafone: Megaphone };

export function IconeFormato({ formato, size = 12 }: { formato: FormatoNome; size?: number }) {
  const Desenho = DESENHO[FORMATOS[formato].icone as keyof typeof DESENHO] ?? ImageIcon;
  return <Desenho size={size} strokeWidth={2.2} />;
}

export function TagFormato({ formato, size }: { formato: FormatoNome; size?: "md" | "lg" }) {
  return (
    <Tag tone={FORMATOS[formato].tone} size={size} icon={<IconeFormato formato={formato} />}>
      {formato}
    </Tag>
  );
}

export function MiniTagFormato({ formato }: { formato: FormatoNome }) {
  return (
    <span className={`vz-minitag vz-minitag--${FORMATOS[formato].tone}`}>
      <IconeFormato formato={formato} size={10} />
      {formato}
    </span>
  );
}
