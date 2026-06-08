"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type MigrationStatus = "ok" | "missing" | "checking";

export function SettingsStatusPill({
  status,
  okLabel = "Aplicada",
  missingLabel = "Pendente",
}: {
  status: MigrationStatus;
  okLabel?: string;
  missingLabel?: string;
}) {
  const className =
    status === "ok"
      ? "border-[#25D366]/25 bg-[#25D366]/10 text-[#9AF0B8]"
      : status === "missing"
        ? "border-amber-400/25 bg-amber-400/10 text-amber-100"
        : "border-white/10 bg-white/[0.04] text-zinc-400";

  return (
    <span className={`rounded-full border px-2 py-1 text-xs ${className}`}>
      {status === "ok" ? okLabel : status === "missing" ? missingLabel : "Verificando"}
    </span>
  );
}

export function SettingsMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="flex items-center gap-2 text-xs uppercase text-zinc-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-2 truncate text-sm font-medium text-zinc-100">{value}</div>
    </div>
  );
}

export function SettingsInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm text-zinc-300">
      {label}
      <input
        className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-[#8B5CF6]"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

export function SettingsDetailPanel({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="mt-4 rounded-lg border border-white/10 bg-black/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium text-zinc-100">{title}</h3>
        <button className="text-sm text-zinc-500 hover:text-zinc-200" onClick={onClose} type="button">
          Fechar
        </button>
      </div>
      <div className="mt-3 max-h-80 overflow-auto">{children}</div>
    </div>
  );
}
