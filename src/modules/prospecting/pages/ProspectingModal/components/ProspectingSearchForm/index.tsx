"use client";

import { Search, Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";

import type { ProspectingSearchInput } from "../../../../types";

export function ProspectingSearchForm({
  isLoading,
  onSearch,
}: {
  isLoading: boolean;
  onSearch: (input: ProspectingSearchInput) => void;
}) {
  const [niche, setNiche] = useState("Clínicas de estética");
  const [state, setState] = useState("TO");
  const [city, setCity] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!niche.trim() || !state.trim()) return;
    onSearch({ niche, state, city: city.trim() || undefined, limit: 50, provider: "outscraper" });
  }

  return (
    <form
      className="rounded-2xl border border-[#8B5CF6]/25 bg-white/[0.06] p-4 shadow-2xl shadow-[#8B5CF6]/10 backdrop-blur-xl"
      onSubmit={submit}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-[#DDD6FE]">
        <Sparkles className="h-4 w-4" />
        Buscar empresas no Google
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_0.7fr_0.9fr_auto]">
        <label className="block text-sm text-zinc-300">
          Tipo de empresa/profissional
          <input
            className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[#A78BFA] focus:shadow-[0_0_0_3px_rgba(139,92,246,0.16)]"
            onChange={(event) => setNiche(event.target.value)}
            placeholder="Dentistas, energia solar, clínicas..."
            value={niche}
          />
        </label>
        <label className="block text-sm text-zinc-300">
          Estado
          <select
            className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-sm text-white outline-none transition focus:border-[#A78BFA] focus:shadow-[0_0_0_3px_rgba(139,92,246,0.16)]"
            onChange={(event) => setState(event.target.value)}
            value={state}
          >
            {BRAZIL_STATES.map((item) => (
              <option key={item.uf} value={item.uf}>
                {item.uf} - {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-zinc-300">
          Cidade opcional
          <input
            className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[#A78BFA] focus:shadow-[0_0_0_3px_rgba(139,92,246,0.16)]"
            onChange={(event) => setCity(event.target.value)}
            placeholder="Palmas, Recife..."
            value={city}
          />
        </label>
        <button
          className="mt-0 flex h-12 items-center justify-center gap-2 rounded-xl bg-[#8B5CF6] px-5 text-sm font-semibold text-white shadow-lg shadow-[#8B5CF6]/25 transition hover:bg-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-60 lg:mt-7"
          disabled={isLoading}
        >
          <Search className="h-4 w-4" />
          {isLoading ? "Buscando..." : "Buscar Empresas"}
        </button>
      </div>
    </form>
  );
}

const BRAZIL_STATES = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Pará" },
  { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "São Paulo" },
  { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" },
];
