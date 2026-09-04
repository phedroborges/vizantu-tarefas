"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Link2, MessageSquare, Settings2 } from "lucide-react";
import { Avatar, Button, Card, Check, Count, IconButton } from "@/components/vz";
import { CONTEUDOS, ETAPAS, pessoa, type Conteudo, type FormatoNome } from "./data";
import { FORMATOS } from "./data";
import { MiniTagFormato } from "./formato";

/* ---------- 10 · Calendário ---------- */

// O que cada cartão mostra é escolha do usuário, não decisão nossa. O
// estrategista quer ver etapa e responsável; o criativo quer ver formato e o
// link do material. Um cartão fixo não serve aos dois.
type CampoCartao = "formato" | "etapa" | "dono" | "link" | "canal" | "contadores";

const CAMPOS: { key: CampoCartao; label: string }[] = [
  { key: "formato", label: "Formato" },
  { key: "etapa", label: "Etapa" },
  { key: "dono", label: "Responsável" },
  { key: "canal", label: "Canal" },
  { key: "link", label: "Link do material" },
  { key: "contadores", label: "Comentários e anexos" },
];

const AGENDA: Record<number, string[]> = {
  4: ["c5"], 7: ["c5"], 9: ["c1"], 11: ["c2"], 14: ["c3"],
  17: ["c6"], 22: ["c4"], 25: ["c7"], 18: ["c6"], 29: ["c2"]
};

export function SecaoCalendario() {
  const [visiveis, setVisiveis] = React.useState<CampoCartao[]>(["formato", "etapa", "dono", "link"]);
  const dias = Array.from({ length: 35 }, (_, index) => index - 3);

  function alternar(campo: CampoCartao) {
    setVisiveis((atual) => (atual.includes(campo) ? atual.filter((item) => item !== campo) : [...atual, campo]));
  }

  return (
    <section className="ds-section" id="calendario">
      <header className="ds-section__head">
        <span className="vz-eyebrow">10 · Dados</span>
        <h2 className="vz-h1">Calendário</h2>
        <p className="vz-body">
          Antes o dia tinha só uma pastilha com o título cortado. Agora ele carrega <b>o mesmo cartão do board</b>, na
          versão miúda — e quem decide o que aparece dentro dele é o usuário: formato, etapa, responsável, canal, link
          do material, contadores. Marque e desmarque abaixo para ver.
        </p>
      </header>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div className="vz-cal__head">
          <div className="ds-row" style={{ gap: 10 }}>
            <strong className="vz-cal__month">Setembro de 2026</strong>
            <Count>22 conteúdos</Count>
          </div>
          <div className="vz-cal__nav">
            <IconButton size="sm" aria-label="Mês anterior"><ChevronLeft size={14} /></IconButton>
            <Button variant="ghost" size="sm">Hoje</Button>
            <IconButton size="sm" aria-label="Próximo mês"><ChevronRight size={14} /></IconButton>
          </div>
        </div>

        {/* O configurador do cartão. No app ele mora atrás da engrenagem — aqui
            fica aberto porque é justamente o que precisa ser aprovado. */}
        <div className="vz-toolbar" style={{ gap: 14 }}>
          <span className="ds-label" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Settings2 size={13} />Mostrar no cartão
          </span>
          <div className="vz-cal__config">
            {CAMPOS.map((campo) => (
              <Check
                key={campo.key}
                label={campo.label}
                checked={visiveis.includes(campo.key)}
                onChange={() => alternar(campo.key)}
              />
            ))}
          </div>
        </div>

        <div className="vz-cal__weekdays">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((dia) => <span key={dia}>{dia}</span>)}
        </div>
        <div className="vz-cal__grid">
          {dias.map((dia) => {
            const fora = dia < 1 || dia > 30;
            const rotulo = fora ? (dia < 1 ? 31 + dia : dia - 30) : dia;
            const doDia = fora ? [] : (AGENDA[dia] ?? []).map((id) => CONTEUDOS.find((item) => item.id === id)!);
            return (
              <div key={dia} className={`vz-cal__day${fora ? " vz-cal__day--out" : ""}${dia === 4 ? " vz-cal__day--today" : ""}`}>
                <span className="vz-cal__daynum">{rotulo}</span>
                {dia === 7 && <span className="vz-cal__note">falta 1 vídeo</span>}
                {doDia.map((item) => <CartaoDoDia key={`${dia}-${item.id}`} item={item} visiveis={visiveis} />)}
              </div>
            );
          })}
        </div>
        <div className="vz-cal__legend">
          {(Object.keys(FORMATOS) as FormatoNome[]).map((formato) => (
            <span key={formato}><i className={`vz-dot vz-dot--${FORMATOS[formato].tone}`} />{formato}</span>
          ))}
        </div>
      </Card>

      <p className="ds-demo__note" style={{ padding: 0 }}>
        Dia fora do mês fica rebaixado em vez de sumir: a semana continua com sete colunas do mesmo tamanho. O título
        do cartão quebra em no máximo duas linhas e o resto vira reticências — o cartão tem que ter altura previsível,
        senão a linha da semana inteira estica por causa de um título comprido.
      </p>
    </section>
  );
}

function CartaoDoDia({ item, visiveis }: { item: Conteudo; visiveis: CampoCartao[] }) {
  const dono = pessoa(item.dono);
  const etapa = ETAPAS.find((e) => e.value === item.etapa);
  const mostra = (campo: CampoCartao) => visiveis.includes(campo);
  const rodape = mostra("dono") || mostra("link") || mostra("contadores") || mostra("canal");

  return (
    <button className={`vz-cal-card vz-cal-card--${FORMATOS[item.formato].tone}`} title={item.titulo}>
      {mostra("formato") && (
        <div className="vz-cal-card__top">
          <MiniTagFormato formato={item.formato} />
        </div>
      )}
      <span className="vz-cal-card__title">{item.titulo}</span>
      {mostra("etapa") && etapa && <span className={`vz-minitag vz-minitag--${etapa.tone}`} style={{ justifySelf: "start" }}>{etapa.label}</span>}
      {rodape && (
        <div className="vz-cal-card__foot">
          {mostra("canal") && <span className="vz-minitag vz-minitag--outline">{item.canal}</span>}
          {mostra("link") && item.temLink && (
            <span className="vz-minitag vz-minitag--outline" title="Material anexado"><Link2 size={9} />Link</span>
          )}
          {mostra("contadores") && item.comentarios > 0 && (
            <span className="vz-minitag vz-minitag--outline"><MessageSquare size={9} />{item.comentarios}</span>
          )}
          {mostra("dono") && <Avatar name={dono.name} src={dono.src} size="xs" />}
        </div>
      )}
    </button>
  );
}
