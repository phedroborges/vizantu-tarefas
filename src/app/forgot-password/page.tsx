"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/browser-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/reset-password`,
    });
    setIsSubmitting(false);
    // Sempre mostra a mesma mensagem, exista ou não a conta — evita confirmar
    // pra quem está tentando adivinhar e-mails cadastrados.
    setSent(true);
  }

  return (
    <AuthShell title="Esqueci minha senha" subtitle="Informe seu e-mail e enviaremos um link para redefinir sua senha.">
      {sent ? (
        <div className="auth-success">Se esse e-mail estiver cadastrado, você vai receber um link de redefinição em instantes.</div>
      ) : (
        <form className="auth-form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="forgot-email">E-mail</label>
            <input id="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <button className="primary-button" type="submit" disabled={isSubmitting} style={{ width: "100%", minHeight: 40 }}>
            {isSubmitting ? "Enviando..." : "Enviar link"}
          </button>
        </form>
      )}
      <div className="auth-links" style={{ justifyContent: "center", marginTop: 18 }}>
        <Link href="/login">Voltar para o login</Link>
      </div>
    </AuthShell>
  );
}
