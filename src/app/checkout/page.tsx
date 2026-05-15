import { ArrowRight, Check, CreditCard, MessageCircle, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

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
    <main className="min-h-screen bg-[#08080C] px-5 py-8 text-white">
      <div className="absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.26),transparent_42%)]" />
      <div className="relative mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <Link className="relative block h-12 w-44" href="/">
            <Image alt="OrigoCRM" className="object-contain object-left" fill priority sizes="176px" src="/origocrm-logo.png" />
          </Link>
        </header>

        <section className="mt-14 rounded-2xl border border-white/10 bg-[#111018]/90 p-6 shadow-2xl shadow-[#8B5CF6]/10 md:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
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
                {["Escolha o plano mais adequado", "Envie sua solicitacao de contratacao", "Receba as instrucoes de pagamento", "Tenha o acesso liberado apos a confirmacao"].map((step) => (
                  <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3 text-sm text-zinc-300" key={step}>
                    <Check className="h-4 w-4 text-[#25D366]" />
                    {step}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3">
              {checkoutPlans.map((plan) => (
                <a
                  className="group flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/25 p-4 transition hover:border-[#8B5CF6]/50 hover:bg-[#8B5CF6]/10"
                  href={`mailto:comercial@origocrm.com.br?subject=Cadastro%20${encodeURIComponent(plan.name)}&body=Quero%20contratar%20o%20plano%20${encodeURIComponent(plan.name)}%20do%20OrigoCRM.`}
                  key={plan.slug}
                >
                  <div>
                    <div className="font-semibold text-white">{plan.name}</div>
                    <div className="mt-1 text-sm text-zinc-500">{plan.price} / usuario / mes</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-zinc-500 transition group-hover:text-white" />
                </a>
              ))}

              <div className="mt-3 rounded-xl border border-[#25D366]/25 bg-[#25D366]/10 p-4">
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

        <div className="mt-6 flex items-center gap-2 text-sm text-zinc-500">
          <ShieldCheck className="h-4 w-4 text-[#A78BFA]" />
          A liberacao acontece em ambiente protegido, com acesso individual para cada usuario autorizado.
        </div>
      </div>
    </main>
  );
}
