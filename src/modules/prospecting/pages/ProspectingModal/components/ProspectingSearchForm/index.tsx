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
  const [city, setCity] = useState("Palmas");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!niche.trim() || !city.trim()) return;
    onSearch({ niche, city, limit: 20, provider: "outscraper" });
  }

  return (
    <form
      className="rounded-2xl border border-[#8B5CF6]/25 bg-white/[0.06] p-4 shadow-2xl shadow-[#8B5CF6]/10 backdrop-blur-xl"
      onSubmit={submit}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-[#DDD6FE]">
        <Sparkles className="h-4 w-4" />
        Busca Google Businesses
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
        <label className="block text-sm text-zinc-300">
          Nicho
          <input
            className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[#A78BFA] focus:shadow-[0_0_0_3px_rgba(139,92,246,0.16)]"
            onChange={(event) => setNiche(event.target.value)}
            placeholder="Dentistas, energia solar, clínicas..."
            value={niche}
          />
        </label>
        <label className="block text-sm text-zinc-300">
          Cidade
          <input
            className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[#A78BFA] focus:shadow-[0_0_0_3px_rgba(139,92,246,0.16)]"
            onChange={(event) => setCity(event.target.value)}
            placeholder="Recife, Palmas, São Paulo..."
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
