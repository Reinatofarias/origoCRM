"use client";

export function LeadMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <div className="truncate text-[11px] uppercase text-zinc-500">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-zinc-100">{value}</div>
    </div>
  );
}

export function LeadSummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="text-xs uppercase text-zinc-500">{label}</div>
      <div className="mt-2 break-words text-sm font-medium text-zinc-100">{value}</div>
    </div>
  );
}
