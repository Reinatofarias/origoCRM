import { ArrowRight, Check, CreditCard, MessageCircle, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

export const metadata: Metadata = {
  title: "Cadastro | OrigoCRM",
  description: "Escolha um plano OrigoCRM e solicite liberacao de acesso.",
};

const checkoutPlans = [
  { name: "CRM Base", price: "R$ 197", slug: "base" },
  { name: "CRM Pro", price: "R$ 297", slug: "pro" },
  { name: "CRM + Prospeccao", price: "R$ 497", slug: "prospecting" },
  { name: "Premium", price: "R$ 797", slug: "premium" },
];

export default function CheckoutPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08080C] px-5 py-8 text-white">
      <div className="glow-breathe absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(ellipse_at_50%_0%,rgba(139,92,246,0.32),transparent_45%),radial-gradient(ellipse_at_88%_18%,rgba(37,211,102,0.12),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.016)_1px,transparent_1px)] bg-[size:72px_72px] opacity-25" />
      <div className="relative mx-auto max-w-5xl">
        <header className="reveal-up flex items-center justify-between gap-4">
          <Link className="relative block h-12 w-44" href="/">
            <Image alt="OrigoCRM" className="object-contain object-left" fill priority sizes="176px" src="/origocrm-logo.png" />
          </Link>
        </header>

        <section className="reveal-up relative mt-14 overflow-hidden rounded-2xl border border-white/10 bg-[#111018]/90 p-6 shadow-2xl shadow-[#8B5CF6]/15 backdrop-blur-xl md:p-8" style={{ "--delay": "100ms" } as CSSProperties}>
          <div className="absolute -right-20 -top-24 h-72 w-72 opacity-[0.06]">
            <Image alt="" className="object-contain" fill sizes="288px" src="/origocrm-icon.png" />
          </div>
          <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(139,92,246,0.85),rgba(37,211,102,0.35),transparent)]" />
          <div className="relative grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#8B5CF6]/35 bg-[#8B5CF6]/12 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-[#DDD6FE]">
                <CreditCard className="h-3.5 w-3.5" />
                Ativacao assistida
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-[-0.02em]">Escolha o plano ideal para sua operacao.</h1>
              <p className="mt-4 text-base leading-7 text-zinc-400">
                A contratacao e assistida para confirmar quantidade de usuarios, modulo de prospeccao e melhor forma de ativacao antes da liberacao do acesso.
              </p>
              <div className="mt-6 space-y-3">
                {["Escolha o plano mais adequado", "Envie sua solicitacao de contratacao", "Receba as instrucoes de pagamento", "Tenha o acesso liberado apos a confirmacao"].map((step, index) => (
                  <div className="reveal-up flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3 text-sm text-zinc-300" key={step} style={{ "--delay": `${180 + index * 80}ms` } as CSSProperties}>
                    <Check className="h-4 w-4 text-[#25D366]" />
                    {step}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3">
              {checkoutPlans.map((plan, index) => (
                <a
                  className="group reveal-up relative overflow-hidden flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/25 p-4 transition hover:-translate-y-0.5 hover:border-[#8B5CF6]/50 hover:bg-[#8B5CF6]/10"
                  href={`mailto:comercial@origocrm.com.br?subject=Cadastro%20${encodeURIComponent(plan.name)}&body=Quero%20contratar%20o%20plano%20${encodeURIComponent(plan.name)}%20do%20OrigoCRM.`}
                  key={plan.slug}
                  style={{ "--delay": `${160 + index * 90}ms` } as CSSProperties}
                >
                  <span className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(139,92,246,0.6),transparent)] opacity-0 transition group-hover:opacity-100" />
                  <div>
                    <div className="font-semibold text-white">{plan.name}</div>
                    <div className="mt-1 text-sm text-zinc-500">{plan.price} / usuario / mes</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-zinc-500 transition group-hover:text-white" />
                </a>
              ))}

              <div className="reveal-up mt-3 rounded-xl border border-[#25D366]/25 bg-[#25D366]/10 p-4 shadow-xl shadow-[#25D366]/10" style={{ "--delay": "560ms" } as CSSProperties}>
                <div className="flex items-center gap-2 text-sm font-semibold text-[#9AF0B8]">
                  <MessageCircle className="h-4 w-4" />
                  Como funciona a ativacao
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  Clique no plano desejado para enviar sua solicitacao. Em seguida, retornamos com pagamento, dados de acesso e orientacao inicial para colocar a operacao no ar.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="reveal-up mt-6 flex items-center gap-2 text-sm text-zinc-500" style={{ "--delay": "220ms" } as CSSProperties}>
          <ShieldCheck className="h-4 w-4 text-[#A78BFA]" />
          A liberacao acontece em ambiente protegido, com acesso individual para cada usuario autorizado.
        </div>
      </div>
    </main>
  );
}
