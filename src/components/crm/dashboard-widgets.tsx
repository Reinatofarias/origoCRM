"use client";

export function DashboardPriorityCard({
  label,
  value,
  tone,
  description,
  onClick,
}: {
  label: string;
  value: number;
  tone: "danger" | "success" | "warning";
  description: string;
  onClick?: () => void;
}) {
  const toneClass = {
    danger: "border-red-400/25 bg-red-500/10 text-red-200",
    success: "border-[#25D366]/25 bg-[#25D366]/10 text-[#9AF0B8]",
    warning: "border-amber-400/25 bg-amber-500/10 text-amber-100",
  }[tone];
  const Element = onClick ? "button" : "div";

  return (
    <Element
      className={`rounded-lg border p-4 text-left transition ${toneClass} ${onClick ? "hover:brightness-110" : ""}`}
      onClick={onClick}
      type={onClick ? "button" : undefined}
    >
      <div className="text-xs uppercase text-current/70">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-current/70">{description}</div>
    </Element>
  );
}

export function DashboardCompactMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-zinc-100">{value}</div>
    </div>
  );
}

export function DashboardMiniLegend({
  label,
  tone,
  value,
}: {
  label: string;
  tone: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500">
      <span className={`h-2.5 w-2.5 rounded-full ${tone}`} />
      <span>{label}</span>
      <span className="font-medium text-zinc-300">{value}</span>
    </div>
  );
}

export function DashboardEmpty({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-zinc-500">
      {text}
    </div>
  );
}
