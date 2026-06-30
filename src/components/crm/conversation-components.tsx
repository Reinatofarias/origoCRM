"use client";

import { AlertTriangle, Check, CheckCheck, Clock3, UserRound } from "lucide-react";

import type { WhatsAppMessage } from "@/lib/types";

export function messageStatusIcon(status: WhatsAppMessage["status"]) {
  const className = "h-3.5 w-3.5";

  if (status === "pending") return <Clock3 className={className} />;
  if (status === "sent") return <Check className={className} />;
  if (status === "delivered") return <CheckCheck className={className} />;
  if (status === "read") return <CheckCheck className={`${className} text-[#0EA5E9]`} />;
  return <AlertTriangle className={className} />;
}

export function ContactAvatar({
  avatarUrl,
  label,
  size = "md",
}: {
  avatarUrl: string | null;
  label: string;
  size?: "sm" | "md";
}) {
  const dimension = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const initials = label
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  if (avatarUrl) {
    // Profile picture URLs come from WhatsApp/Evolution and are not handled by next/image.
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={label} className={`${dimension} rounded-full object-cover`} src={avatarUrl} />;
  }

  return (
    <div className={`${dimension} flex shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-zinc-300`}>
      {initials || <UserRound className="h-4 w-4" />}
    </div>
  );
}

export function ConversationInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="text-[11px] uppercase text-zinc-500">{label}</div>
      <div className="mt-1 truncate text-sm text-zinc-100">{value}</div>
    </div>
  );
}

export function ConversationDateDivider({ value }: { value: string }) {
  return (
    <div className="flex justify-center py-2">
      <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] font-medium text-zinc-400 backdrop-blur">
        {new Date(value).toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })}
      </span>
    </div>
  );
}

export function ConversationSystemEvent({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-[#8B5CF6]/25 bg-[#8B5CF6]/10 px-4 py-3 text-center shadow-lg shadow-[#8B5CF6]/10">
      <div className="text-xs font-semibold text-[#DDD6FE]">{title}</div>
      <div className="mt-1 text-xs text-zinc-400">{detail}</div>
    </div>
  );
}
