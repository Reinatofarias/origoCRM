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
  onLookup,
}: {
  company: CompanyByCnpj | null;
  isLoading: boolean;
  onLookup: (cnpj: string) => void;
}) {
  const [cnpj, setCnpj] = useState("12.345.678/0001-90");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onLookup(cnpj);
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-sm font-medium text-[#DDD6FE]">
        <Building2 className="h-4 w-4" />
        Consultar Empresa por CNPJ
      </div>
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-sm text-zinc-100">{value}</div>
    </div>
  );
}
