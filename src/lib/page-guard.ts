import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "./current-user";
import { podeVer, telaInicial, type AppArea } from "./permissions";

// Esconder o item do menu não é proteger a tela — quem souber a URL entra do
// mesmo jeito. Cada página do app começa por aqui, e quem não deveria estar
// nela volta para a sua própria tela inicial, não para uma que ela também não
// pode ver.
export async function requirePageAccess(area: AppArea): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!podeVer(user.role, area)) redirect(telaInicial(user.role));
  return user;
}
