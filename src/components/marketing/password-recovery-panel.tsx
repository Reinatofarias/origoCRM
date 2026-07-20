"use client";

import { Loader2, LockKeyhole, Save } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { BrandLogo } from "@/components/crm/brand";
import { createSupabaseClient } from "@/lib/db";

type RecoveryState = "idle" | "preparing" | "ready" | "saving" | "done" | "error";

function getRecoveryParams() {
  if (typeof window === "undefined") return null;

  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);

  if (params.get("type") !== "recovery") return null;

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (!accessToken || !refreshToken) return null;

  return { accessToken, refreshToken };
}

export function PasswordRecoveryPanel() {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const [recoveryParams] = useState(() => getRecoveryParams());
  const isRecovery = Boolean(recoveryParams);
  const [state, setState] = useState<RecoveryState>(() => (recoveryParams ? "preparing" : "idle"));
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!recoveryParams) return;

    if (!supabase) {
      return;
    }

    supabase.auth
      .setSession({
        access_token: recoveryParams.accessToken,
        refresh_token: recoveryParams.refreshToken,
      })
      .then(({ error }) => {
        if (error) {
          setMessage(error.message);
          setState("error");
          return;
        }

        window.history.replaceState(null, "", "/");
        setState("ready");
      })
      .catch(() => {
        setMessage("Nao foi possivel validar o link de redefinicao.");
        setState("error");
      });
  }, [recoveryParams, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    if (password.length < 6) {
      setMessage("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("As senhas nao conferem.");
      return;
    }

    setMessage("");
    setState("saving");

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage(error.message);
      setState("ready");
      return;
    }

    await supabase.auth.signOut();
    setState("done");
  }

  if (!isRecovery) return null;

  return (
    <main className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-[#09090D] px-5 text-white">
      <div className="absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(ellipse_at_28%_0%,rgba(139,92,246,0.34),transparent_44%),radial-gradient(ellipse_at_86%_10%,rgba(37,211,102,0.16),transparent_38%)]" />
      <section className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[#8B5CF6]/25 bg-white/[0.045] p-6 shadow-2xl shadow-[#8B5CF6]/15 backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(139,92,246,0.85),rgba(37,211,102,0.35),transparent)]" />
        <BrandLogo className="mb-8 aspect-[3.13/1] w-56" />

        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#8B5CF6]/30 bg-[#8B5CF6]/15 text-[#C4B5FD]">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Redefinir senha</h1>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              Crie uma nova senha para voltar a acessar o OrigoCRM.
            </p>
          </div>
        </div>

        {!supabase ? (
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-100">
            Supabase nao configurado para redefinir senha.
          </div>
        ) : state === "preparing" ? (
          <div className="flex h-40 items-center justify-center rounded-xl border border-white/10 bg-black/25">
            <Loader2 className="h-5 w-5 animate-spin text-[#8B5CF6]" />
          </div>
        ) : state === "done" ? (
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4">
            <p className="font-medium text-emerald-100">Senha atualizada com sucesso.</p>
            <a
              className="mt-4 inline-flex h-11 items-center justify-center rounded-lg bg-[#8B5CF6] px-5 text-sm font-semibold text-white transition hover:bg-[#7C3AED]"
              href="/login"
            >
              Entrar no CRM
            </a>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm text-zinc-300">
              Nova senha
              <input
                className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/35 px-4 text-white outline-none ring-[#8B5CF6]/50 transition focus:border-[#8B5CF6] focus:ring-4"
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            <label className="block text-sm text-zinc-300">
              Confirmar senha
              <input
                className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/35 px-4 text-white outline-none ring-[#8B5CF6]/50 transition focus:border-[#8B5CF6] focus:ring-4"
                minLength={6}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                value={confirmPassword}
              />
            </label>
            <button
              className="shine-cta flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] px-4 font-medium shadow-xl shadow-[#8B5CF6]/20 transition hover:bg-[#7C3AED] disabled:opacity-60"
              disabled={state === "saving" || state === "error"}
              type="submit"
            >
              {state === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar nova senha
            </button>
            {message && <p className="text-sm text-rose-200">{message}</p>}
          </form>
        )}
      </section>
    </main>
  );
}
