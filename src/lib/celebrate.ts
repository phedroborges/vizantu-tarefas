// Comemoração de "mandei pra aprovar": o mesmo confete que o cliente vê ao
// aprovar um conteúdo, agora também do lado de dentro, quando a demanda sai da
// mão do time. É o momento em que a tarefa deixa de ser trabalho e vira
// entrega — o marco que valia uma reação.

import { burst } from "./confetti";

// A partir do elemento que foi clicado, pra o confete sair de onde a mão está.
// Sem elemento (ex.: mudança pelo teclado), sai do centro da tela.
export function celebrateFrom(element?: HTMLElement | null, count = 55) {
  if (typeof window === "undefined") return;
  // Quem pediu menos movimento no sistema não recebe confete.
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const rect = element?.getBoundingClientRect();
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 3;
  burst(x, y, count);
}
