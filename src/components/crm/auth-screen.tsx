"use client";

import { Loader2, Send } from "lucide-react";
import Image from "next/image";
import { CSSProperties, FormEvent, useMemo, useState } from "react";

import { BrandLogo } from "@/components/crm/brand";
import { createSupabaseClient } from "@/lib/db";

export function MissingSupabaseConfig() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090D] px-5 text-white">
      <section className="w-full max-w-lg rounded-xl border border-white/10 bg-white/[0.04] p-6">
        <BrandLogo className="mb-5 aspect-[3.13/1] w-full" />
        <h1 className="text-2xl font-semibold">Supabase não configurado</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Configure as variáveis `NEXT_PUBLIC_SUPABASE_URL` e
          `NEXT_PUBLIC_SUPABASE_ANON_KEY` na Vercel para ativar login e banco real.
        </p>
      </section>
    </main>
  );
}

export function AuthScreen() {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    setMessage("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#09090D] px-5 py-8 text-white">
      <div className="glow-breathe absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(ellipse_at_24%_12%,rgba(139,92,246,0.3),transparent_42%),radial-gradient(ellipse_at_86%_18%,rgba(37,211,102,0.13),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.016)_1px,transparent_1px)] bg-[size:72px_72px] opacity-25" />
      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1fr_0.9fr]">
        <section className="reveal-up relative flex justify-center lg:justify-start">
          <div className="absolute -inset-8 bg-[linear-gradient(135deg,rgba(139,92,246,0.2),rgba(37,211,102,0.08),transparent)] blur-3xl" />
          <BrandLogo className="relative aspect-[3.13/1] w-[min(92vw,640px)]" />
        </section>

        <section
          className="reveal-up relative overflow-hidden rounded-2xl border border-[#8B5CF6]/25 bg-white/[0.045] p-6 shadow-2xl shadow-[#8B5CF6]/15 backdrop-blur-xl"
          style={{ "--delay": "120ms" } as CSSProperties}
        >
          <div className="absolute -right-20 -top-24 h-72 w-72 opacity-[0.06]">
            <Image alt="" className="object-contain" fill sizes="288px" src="/origocrm-icon.png" />
          </div>
          <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(139,92,246,0.85),rgba(37,211,102,0.35),transparent)]" />
          <div className="relative mb-6">
            <h2 className="text-2xl font-semibold">Entrar</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Acesse com seu usuário autorizado.
            </p>
          </div>
          <form className="relative space-y-4" onSubmit={handleAuth}>
            <label className="block text-sm text-zinc-300">
              Email
              <input
                className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/35 px-4 text-white outline-none ring-[#8B5CF6]/50 transition focus:border-[#8B5CF6] focus:ring-4"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="email"
                required
                type="email"
                value={email}
              />
            </label>
            <label className="block text-sm text-zinc-300">
              Senha
              <input
                className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/35 px-4 text-white outline-none ring-[#8B5CF6]/50 transition focus:border-[#8B5CF6] focus:ring-4"
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="mínimo 6 caracteres"
                required
                type="password"
                value={password}
              />
            </label>
            <button
              className="shine-cta flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] px-4 font-medium shadow-xl shadow-[#8B5CF6]/20 transition hover:bg-[#7C3AED] disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Entrar
            </button>
          </form>
          {message && <p className="relative mt-4 text-sm text-zinc-300">{message}</p>}
        </section>
      </div>
    </main>
  );
}
