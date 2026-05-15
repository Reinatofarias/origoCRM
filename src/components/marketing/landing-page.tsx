import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarClock,
  Check,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Tags,
  Workflow,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ComponentType } from "react";

const plans = [
  {
    name: "CRM Base",
    price: "R$ 197",
    description: "Para organizar leads, tarefas e funil comercial.",
    features: ["CRM visual", "Lead 360", "Tarefas", "Tags", "Templates"],
    highlight: false,
    href: "/checkout?plan=base",
  },
  {
    name: "CRM Pro",
    price: "R$ 297",
    description: "Para operar vendas pelo WhatsApp com mais controle.",
    features: ["Inbox WhatsApp", "Auditoria", "Dashboard", "Exportacao CSV", "Filtros salvos"],
    highlight: false,
    href: "/checkout?plan=pro",
  },
  {
    name: "CRM + Prospeccao",
    price: "R$ 497",
    description: "Para buscar empresas, validar WhatsApp e iniciar campanhas.",
    features: ["Busca Google", "Validacao WhatsApp", "Campanhas por lote", "Historico", "Tags automaticas"],
    highlight: true,
    href: "/checkout?plan=prospecting",
  },
  {
    name: "Premium",
    price: "R$ 797",
    description: "Para times que precisam de volume e acompanhamento proximo.",
    features: ["Mais volume", "Suporte prioritario", "Onboarding", "Campanhas avancadas", "Diagnostico WhatsApp"],
    highlight: false,
    href: "/checkout?plan=premium",
  },
];

const capabilities = [
  { icon: Workflow, title: "CRM Comercial", text: "Funil, etapas customizadas, Lead 360, filtros e tarefas." },
  { icon: MessageCircle, title: "WhatsApp Operacional", text: "Inbox, mensagens, templates, conversas e historico vinculado ao lead." },
  { icon: Search, title: "Prospeccao Google", text: "Busque empresas por nicho, estado e cidade, com telefone e score comercial." },
  { icon: CalendarClock, title: "Tarefas E Follow-up", text: "Acoes comerciais e operacionais em uma rotina diaria controlada." },
  { icon: Tags, title: "Tags E Segmentos", text: "Organize oportunidades por campanha, interesse, prioridade e origem." },
  { icon: BarChart3, title: "Dashboard De Decisao", text: "Prioridades, WhatsApp, tarefas, riscos e performance em uma tela." },
];

const segments = ["Agencias", "Clinicas", "Energia solar", "Estetica", "Imobiliarias", "Servicos locais"];

export function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#08080C] text-white">
      <div className="absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_30%_0%,rgba(139,92,246,0.28),transparent_35%),radial-gradient(circle_at_85%_12%,rgba(37,211,102,0.12),transparent_32%)]" />
      <header className="relative z-10 border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-5">
          <Link className="relative block h-12 w-44 shrink-0" href="/">
            <Image alt="OrigoCRM" className="object-contain object-left" fill priority sizes="176px" src="/origocrm-logo.png" />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-zinc-400 md:flex">
            <a className="transition hover:text-white" href="#solucao">Solucao</a>
            <a className="transition hover:text-white" href="#prospeccao">Prospeccao</a>
            <a className="transition hover:text-white" href="#planos">Planos</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link className="h-10 rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/[0.06]" href="/login">
              Entrar
            </Link>
            <Link className="hidden h-10 rounded-lg bg-[#8B5CF6] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#8B5CF6]/25 transition hover:bg-[#7C3AED] sm:block" href="/checkout">
              Cadastrar-se
            </Link>
          </div>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-12 px-5 py-14 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#8B5CF6]/35 bg-[#8B5CF6]/12 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-[#DDD6FE]">
            <Sparkles className="h-3.5 w-3.5" />
            CRM + WhatsApp + Prospeccao
          </div>
          <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.02em] text-white md:text-6xl">
            Converse, organize e feche mais vendas pelo WhatsApp.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
            O OrigoCRM centraliza leads, conversas, tarefas, campanhas e prospeccao em uma operacao comercial simples de acompanhar.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link className="flex h-12 items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] px-5 text-sm font-semibold shadow-xl shadow-[#8B5CF6]/25 transition hover:bg-[#7C3AED]" href="/checkout">
              Cadastrar-se
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link className="flex h-12 items-center justify-center gap-2 rounded-lg border border-white/10 px-5 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06]" href="/login">
              Entrar no CRM
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 text-sm text-zinc-400 sm:grid-cols-4">
            {["CRM visual", "Inbox WhatsApp", "Prospeccao Google", "Campanhas"].map((item) => (
              <div className="flex items-center gap-2" key={item}>
                <Check className="h-4 w-4 text-[#25D366]" />
                {item}
              </div>
            ))}
          </div>
        </div>
        <ProductMockup />
      </section>

      <section className="relative z-10 border-y border-white/10 bg-white/[0.025]">
        <div className="mx-auto grid max-w-7xl gap-3 px-5 py-5 md:grid-cols-6">
          {segments.map((segment) => (
            <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-center text-sm text-zinc-300" key={segment}>
              {segment}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20" id="solucao">
        <SectionHeader
          eyebrow="Operacao comercial"
          title="Uma central para captar, atender e acompanhar oportunidades."
          text="O CRM foi pensado para quem vende pelo WhatsApp e precisa enxergar o que fazer agora, nao apenas guardar contatos."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {capabilities.map((item) => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#0D0D13] px-5 py-20" id="prospeccao">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <SectionHeader
              eyebrow="Prospeccao inteligente"
              title="Encontre empresas no Google e inicie conversas em minutos."
              text="Busque por nicho, estado e cidade, valide contatos com WhatsApp, selecione lotes e dispare mensagens prontas sem criar leads desnecessarios."
            />
            <div className="mt-8 space-y-3">
              {["Busca por tipo de empresa/profissional", "Retorno com nome, cidade, UF e telefone", "Validacao de WhatsApp", "Campanhas por lote com historico"].map((item) => (
                <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3 text-sm text-zinc-300" key={item}>
                  <Check className="h-4 w-4 text-[#25D366]" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <ProspectingMockup />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20" id="planos">
        <SectionHeader
          eyebrow="Planos"
          title="Escolha entre CRM operacional ou CRM com prospeccao."
          text="Valores por usuario. Contratos semestrais e anuais podem reduzir o custo mensal."
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-4">
          {plans.map((plan) => (
            <PlanCard key={plan.name} {...plan} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20">
        <div className="rounded-2xl border border-[#8B5CF6]/25 bg-[#111018] p-8 shadow-2xl shadow-[#8B5CF6]/10 md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-[#DDD6FE]">
                <ShieldCheck className="h-4 w-4" />
                Dados, auditoria e operacao rastreavel
              </div>
              <h2 className="mt-4 text-3xl font-semibold">Pronto para transformar WhatsApp em operacao comercial?</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                Comece com cadastro assistido e libere o acesso depois da confirmacao do plano escolhido.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link className="flex h-12 items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] px-5 text-sm font-semibold transition hover:bg-[#7C3AED]" href="/checkout">
                Cadastrar-se
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link className="flex h-12 items-center justify-center rounded-lg border border-white/10 px-5 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06]" href="/login">
                Entrar
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function SectionHeader({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="max-w-3xl">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A78BFA]">{eyebrow}</div>
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.01em] text-white md:text-4xl">{title}</h2>
      <p className="mt-4 text-base leading-7 text-zinc-400">{text}</p>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, text }: { icon: ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <article className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
      <Icon className="h-5 w-5 text-[#A78BFA]" />
      <h3 className="mt-4 font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
    </article>
  );
}

function PlanCard({
  name,
  price,
  description,
  features,
  highlight,
  href,
}: {
  name: string;
  price: string;
  description: string;
  features: string[];
  highlight: boolean;
  href: string;
}) {
  return (
    <article className={`rounded-xl border p-5 ${highlight ? "border-[#8B5CF6]/55 bg-[#8B5CF6]/12 shadow-2xl shadow-[#8B5CF6]/10" : "border-white/10 bg-white/[0.035]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">{name}</h3>
          <p className="mt-2 min-h-12 text-sm leading-6 text-zinc-400">{description}</p>
        </div>
        {highlight && <span className="rounded-full bg-[#25D366]/15 px-2 py-1 text-xs text-[#9AF0B8]">Mais vendido</span>}
      </div>
      <div className="mt-5">
        <span className="text-3xl font-semibold">{price}</span>
        <span className="text-sm text-zinc-500"> / usuario</span>
      </div>
      <ul className="mt-5 space-y-2">
        {features.map((feature) => (
          <li className="flex items-center gap-2 text-sm text-zinc-300" key={feature}>
            <Check className="h-4 w-4 text-[#25D366]" />
            {feature}
          </li>
        ))}
      </ul>
      <Link className={`mt-6 flex h-11 items-center justify-center rounded-lg text-sm font-semibold transition ${highlight ? "bg-[#8B5CF6] text-white hover:bg-[#7C3AED]" : "border border-white/10 text-zinc-200 hover:bg-white/[0.06]"}`} href={href}>
        Cadastrar-se
      </Link>
    </article>
  );
}

function ProductMockup() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111018]/90 p-4 shadow-2xl shadow-[#8B5CF6]/15 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#F43F5E]" />
          <span className="h-3 w-3 rounded-full bg-[#F59E0B]" />
          <span className="h-3 w-3 rounded-full bg-[#25D366]" />
        </div>
        <span className="text-xs text-zinc-500">Dashboard OrigoCRM</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MockMetric label="Respostas novas" value="38" tone="green" />
        <MockMetric label="Follow-ups" value="12" tone="amber" />
        <MockMetric label="Leads quentes" value="9" tone="purple" />
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-white/10 bg-black/25 p-4">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-semibold">CRM</span>
            <span className="text-xs text-zinc-500">5 etapas</span>
          </div>
          {["Novos Leads", "Primeiro Contato", "Respondendo", "Proposta"].map((stage, index) => (
            <div className="mb-3 rounded-lg border border-white/10 bg-white/[0.035] p-3" key={stage}>
              <div className="flex items-center justify-between text-sm">
                <span>{stage}</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-zinc-400">{index + 2}</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#8B5CF6]" style={{ width: `${32 + index * 15}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 p-4">
          <div className="text-sm font-semibold">Inbox WhatsApp</div>
          {["Lead respondeu", "Campanha enviada", "Follow-up hoje"].map((item, index) => (
            <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.035] p-3" key={item}>
              <div className="text-sm text-white">{item}</div>
              <div className="mt-1 text-xs text-zinc-500">{index + 1} nova acao</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProspectingMockup() {
  return (
    <div className="rounded-2xl border border-[#25D366]/20 bg-[#07130D]/70 p-4 shadow-2xl shadow-[#25D366]/10">
      <div className="grid gap-3 md:grid-cols-[1fr_0.7fr_auto]">
        <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-300">Pizzarias</div>
        <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-300">PE</div>
        <div className="rounded-lg bg-[#8B5CF6] px-4 py-3 text-sm font-semibold">Buscar</div>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
        {["Ricco Pizzaria", "Real Pizza Igarassu", "Forno Nobre", "Bella Massa"].map((name, index) => (
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-white/10 bg-black/20 p-3 last:border-b-0" key={name}>
            <div>
              <div className="font-medium text-white">{name}</div>
              <div className="text-xs text-zinc-500">Telefone capturado</div>
            </div>
            <span className="rounded-full border border-[#25D366]/25 bg-[#25D366]/10 px-2 py-1 text-xs text-[#9AF0B8]">WhatsApp</span>
            <span className="text-sm text-amber-200">{92 - index * 4}/100</span>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-[#25D366]/25 bg-[#25D366]/10 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#9AF0B8]">
          <Bot className="h-4 w-4" />
          Campanha pronta
        </div>
        <p className="mt-2 text-sm leading-6 text-zinc-300">Selecione 20 contatos validados e envie uma mensagem pronta pelo WhatsApp conectado.</p>
      </div>
    </div>
  );
}

function MockMetric({ label, value, tone }: { label: string; value: string; tone: "green" | "amber" | "purple" }) {
  const color = tone === "green" ? "text-[#9AF0B8]" : tone === "amber" ? "text-amber-200" : "text-[#DDD6FE]";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{label}</div>
    </div>
  );
}
