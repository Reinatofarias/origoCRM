"use client";

import { Building2, Search } from "lucide-react";
import { FormEvent, useState } from "react";

import type { CompanyByCnpj } from "../../../../types";

function maskCnpj(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function CnpjLookupCard({
  company,
  isLoading,
  onLookupCnae,
  onLookup,
}: {
  company: CompanyByCnpj | null;
  isLoading: boolean;
  onLookupCnae: (input: { cnae: string; state: string }) => void;
  onLookup: (cnpj: string) => void;
}) {
  const [cnpj, setCnpj] = useState("");
  const [cnae, setCnae] = useState("");
  const [state, setState] = useState("TO");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onLookup(cnpj);
  }

  function submitCnae(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cnae.trim() || !state.trim()) return;
    onLookupCnae({ cnae, state });
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-sm font-medium text-[#DDD6FE]">
        <Building2 className="h-4 w-4" />
        Receita Federal
      </div>
      <p className="mt-1 text-xs leading-5 text-zinc-500">
        Consulte um CNPJ especifico via BrasilAPI ou pesquise empresas por CNAE/UF usando provedor comercial.
      </p>
      <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={submit}>
        <input
          className="h-11 flex-1 rounded-xl border border-white/10 bg-black/35 px-4 text-sm text-white outline-none transition focus:border-[#A78BFA]"
          onChange={(event) => setCnpj(maskCnpj(event.target.value))}
          placeholder="00.000.000/0000-00"
          value={cnpj}
        />
        <button
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#8B5CF6]/35 bg-[#8B5CF6]/15 px-4 text-sm text-[#DDD6FE] transition hover:bg-[#8B5CF6]/25 disabled:opacity-60"
          disabled={isLoading}
        >
          <Search className="h-4 w-4" />
          Consultar
        </button>
      </form>
      <form className="mt-3 grid gap-2 sm:grid-cols-[1fr_0.7fr_auto]" onSubmit={submitCnae}>
        <input
          className="h-11 rounded-xl border border-white/10 bg-black/35 px-4 text-sm text-white outline-none transition focus:border-[#A78BFA]"
          onChange={(event) => setCnae(event.target.value.replace(/\D/g, "").slice(0, 7))}
          placeholder="CNAE. Ex.: 8630503"
          value={cnae}
        />
        <select
          className="h-11 rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white outline-none transition focus:border-[#A78BFA]"
          onChange={(event) => setState(event.target.value)}
          value={state}
        >
          {BRAZIL_STATES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <button
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#25D366]/25 bg-[#25D366]/10 px-4 text-sm text-[#9AF0B8] transition hover:bg-[#25D366]/20 disabled:opacity-60"
          disabled={isLoading}
        >
          <Search className="h-4 w-4" />
          Buscar CNAE
        </button>
      </form>
      {company && (
        <div className="mt-4 grid gap-3">
          <div className="rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="text-xs text-zinc-500">Razão social</div>
            <div className="mt-1 text-sm font-medium text-white">{company.legalName}</div>
            <div className="mt-1 text-sm text-zinc-400">{company.tradeName}</div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Info label="Situação" value={company.registrationStatus} />
            <Info label="Abertura" value={company.openedAt} />
            <Info label="Capital social" value={company.shareCapital} />
            <Info label="Score" value={`${company.leadScore}/100`} />
          </div>
          <Info label="CNAE" value={company.cnae} />
          <Info label="Endereço" value={company.address} />
          <Info label="Telefones" value={company.phones.join(" · ")} />
          <Info label="Emails" value={company.emails.join(" · ")} />
          <div className="rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="text-xs text-zinc-500">Sócios</div>
            <div className="mt-2 space-y-1">
              {company.partners.map((partner) => (
                <div className="text-sm text-zinc-200" key={`${partner.name}-${partner.role}`}>
                  {partner.name} <span className="text-zinc-500">· {partner.role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const BRAZIL_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-sm text-zinc-100">{value}</div>
    </div>
  );
}
