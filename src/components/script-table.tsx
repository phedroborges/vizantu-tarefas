// A tabela do roteiro de vídeo: cena, fala e lettering, lado a lado.
//
// É só uma forma de LER o roteiro que está salvo em texto (ver
// video-script.ts). Serve ao mesmo texto nos dois lados da casa: no modal da
// tarefa, pra quem escreve, e no painel do cliente, pra quem aprova — que é
// onde a tabela mais paga: em três colunas fica óbvio o que é imagem, o que
// alguém fala e o que aparece escrito na tela.

import type { ReactNode } from "react";
import { renderMarkdownLite } from "@/components/markdown-lite";
import { parseVideoScript, sceneLabel, type VideoScript } from "@/lib/video-script";

export function ScriptTable({ script, className }: { script: VideoScript; className?: string }) {
  return (
    <div className={className ? `script-table-wrap ${className}` : "script-table-wrap"}>
      {script.intro ? <div className="script-table-intro">{renderMarkdownLite(script.intro)}</div> : null}
      <table className="script-table">
        <thead>
          <tr>
            <th scope="col">Cena</th>
            <th scope="col">Fala</th>
            <th scope="col">Lettering</th>
          </tr>
        </thead>
        <tbody>
          {script.scenes.map((scene, index) => (
            <tr key={`${scene.number}-${index}`}>
              <td>
                <span className="script-scene-label">
                  {sceneLabel(scene)}
                  {scene.title ? <em>{scene.title}</em> : null}
                </span>
                {scene.cena ? <span className="script-cell-text">{renderMarkdownLite(scene.cena)}</span> : null}
              </td>
              <td>{scene.fala ? <span className="script-cell-text">{renderMarkdownLite(scene.fala)}</span> : null}</td>
              {/* Cena sem lettering é o caso NORMAL, não um campo esquecido:
                  lettering só existe quando dá pra tirar duas ou três palavras
                  da própria fala. Por isso a célula vazia fica vazia mesmo, sem
                  placeholder pedindo preenchimento. */}
              <td className={scene.lettering ? "script-lettering" : "script-lettering is-empty"}>
                {scene.lettering ? <span className="script-cell-text">{renderMarkdownLite(scene.lettering)}</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Ponte pros dois campos que mostram roteiro: devolve a tabela quando o texto
// é um roteiro de vídeo e null quando não é (aí quem chamou renderiza o texto
// normal, como sempre fez).
export function renderScriptView(value: string, className?: string): ReactNode | null {
  const script = parseVideoScript(value);
  return script ? <ScriptTable script={script} className={className} /> : null;
}
