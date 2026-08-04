"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/browser-client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // /auth/confirm já autenticou a sessão de recuperação antes de redirecionar
    // pra cá — só confirmamos que ela existe antes de mostrar o formulário.
    createClient()
      .auth.getUser()
      .then(({ data }) => setHasSession(Boolean(data.user)));
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    if (password !== confirmPassword) return setError("As senhas não coincidem.");
    setError("");
    setIsSubmitting(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    setIsSubmitting(false);
    if (updateError) return setError("Não foi possível atualizar a senha. Peça um novo link.");
    router.push("/login");
  }

  if (hasSession === null) return <AuthShell title="Nova senha" subtitle="Verificando link..." />;

  if (!hasSession) {
    return (
      <AuthShell title="Link inválido ou expirado" subtitle="Peça um novo link de redefinição de senha.">
        <a className="primary-button" href="/forgot-password" style={{ width: "100%", minHeight: 40, textAlign: "center" }}>
          Pedir novo link
        </a>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Nova senha" subtitle="Escolha uma nova senha para sua conta.">
      <form className="auth-form" onSubmit={submit}>
        {error ? <div className="form-message">{error}</div> : null}
        <div className="field">
          <label htmlFor="reset-password">Nova senha</label>
          <input id="reset-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="reset-password-confirm">Confirmar nova senha</label>
          <input id="reset-password-confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        </div>
        <button className="primary-button" type="submit" disabled={isSubmitting} style={{ width: "100%", minHeight: 40 }}>
          {isSubmitting ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
    </AuthShell>
  );
}
