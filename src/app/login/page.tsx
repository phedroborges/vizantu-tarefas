"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/browser-client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const { error: signInError } = await createClient().auth.signInWithPassword({ email, password });
    setIsSubmitting(false);
    if (signInError) return setError("E-mail ou senha incorretos.");
    router.push(searchParams.get("next") || "/");
    router.refresh();
  }

  return (
    <AuthShell title="Entrar" subtitle="Acesse o painel de tarefas da Vizantu.">
      <form className="auth-form" onSubmit={submit}>
        {error ? <div className="form-message">{error}</div> : null}
        <div className="field">
          <label htmlFor="login-email">E-mail</label>
          <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="login-password">Senha</label>
          <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="primary-button" type="submit" disabled={isSubmitting} style={{ width: "100%", minHeight: 40 }}>
          {isSubmitting ? "Entrando..." : "Entrar"}
        </button>
        <div className="auth-links">
          <Link href="/forgot-password">Esqueci minha senha</Link>
        </div>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
