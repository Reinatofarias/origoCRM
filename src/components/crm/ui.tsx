import Image from "next/image";
import type { ReactNode } from "react";

export function Input({
  label,
  value,
  required,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm text-zinc-300">
      {label}
      <input
        className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-white outline-none transition focus:border-[#8B5CF6]"
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div
        className={`crm-modal-surface reveal-up relative max-h-[90vh] w-full overflow-y-auto rounded-xl border border-[#8B5CF6]/25 bg-[#0F0F16]/95 p-5 text-white shadow-2xl shadow-[#8B5CF6]/15 ${
          wide ? "max-w-6xl" : "max-w-xl"
        }`}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(139,92,246,0.85),rgba(37,211,102,0.3),transparent)]" />
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 opacity-[0.04]">
          <Image alt="" className="object-contain" fill sizes="256px" src="/origocrm-icon.png" />
        </div>
        <div className="relative mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
            onClick={onClose}
            type="button"
          >
            Fechar
          </button>
        </div>
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}
