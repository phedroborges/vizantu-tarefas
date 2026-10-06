import { VzLoading } from "@/components/vz/loading";

// Vale para todas as rotas: enquanto o servidor monta a próxima tela, a
// navegação mostra o símbolo da Vizantu em vez de ficar parada na tela antiga.
export default function Loading() {
  return <VzLoading size="page" />;
}
