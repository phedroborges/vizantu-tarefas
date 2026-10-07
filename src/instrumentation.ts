// O Next chama register() uma vez por processo de servidor, na subida. É o
// único gancho que roda tanto em `next start` quanto no standalone do Docker,
// que é como este app é servido.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { agendarVarreduraDeAtrasos } = await import("./lib/overdue-scheduler");
  agendarVarreduraDeAtrasos();
  // Fila do WhatsApp, lembretes de aprovação e prazo. Sem as credenciais do
  // serviço, não faz nada.
  const { agendarWhatsapp } = await import("./lib/whatsapp/service");
  agendarWhatsapp();
}
