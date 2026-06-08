"use client";

import {
  BarChart3,
  CalendarClock,
  LogOut,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
} from "lucide-react";
import Image from "next/image";

import { BrandLogo } from "@/components/crm/brand";
import type { View } from "@/lib/navigation";

type SidebarUser = {
  email: string;
};

export function CrmSidebar({
  user,
  view,
  collapsed,
  canUseProspecting,
  onToggleCollapsed,
  onNavigate,
  onOpenProspecting,
  onLogout,
}: {
  user: SidebarUser;
  view: View;
  collapsed: boolean;
  canUseProspecting: boolean;
  onToggleCollapsed: () => void;
  onNavigate: (view: View) => void;
  onOpenProspecting: () => void;
  onLogout: () => void;
}) {
  return (
    <aside
      className={`crm-sidebar relative overflow-hidden border-b border-white/10 bg-[#07070B]/95 px-4 py-4 shadow-2xl shadow-black/30 backdrop-blur-xl transition-[width] duration-300 lg:border-b-0 lg:border-r ${
        collapsed ? "lg:w-20" : "lg:w-72"
      }`}
    >
      <div className="pointer-events-none absolute -left-16 top-10 h-52 w-52 opacity-[0.05]">
        <Image alt="" className="object-contain" fill sizes="208px" src="/origocrm-icon.png" />
      </div>
      <div className="absolute inset-y-0 right-0 hidden w-px bg-[linear-gradient(180deg,transparent,rgba(139,92,246,0.7),rgba(37,211,102,0.22),transparent)] lg:block" />
      <div
        className={`relative flex gap-3 ${
          collapsed ? "flex-col items-center" : "items-center justify-between"
        }`}
      >
        <div className={collapsed ? "flex justify-center" : "min-w-0"}>
          {collapsed ? (
            <div className="hidden h-12 w-12 rounded-xl border border-[#8B5CF6]/35 bg-[#8B5CF6]/10 p-2 shadow-lg shadow-[#8B5CF6]/15 lg:block">
              <Image alt="OrigoCRM" className="object-contain" height={32} src="/origocrm-icon.png" width={32} />
            </div>
          ) : (
            <>
              <BrandLogo compact className="aspect-[3.13/1] w-56 max-w-full" />
              <div className="mt-3 max-w-full truncate text-xs text-zinc-500">{user.email}</div>
            </>
          )}
        </div>
        <button
          className={`hidden rounded-lg border border-white/10 text-zinc-400 transition hover:bg-white/[0.06] hover:text-white lg:flex lg:items-center lg:justify-center ${
            collapsed ? "h-9 w-12" : "p-2"
          }`}
          onClick={onToggleCollapsed}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          type="button"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
        <button
          className="rounded-lg border border-white/10 p-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-white lg:hidden"
          onClick={onLogout}
          title="Sair"
          type="button"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
      <nav className="relative mt-4 grid grid-cols-4 gap-2 lg:grid-cols-1">
        {[
          ["dashboard", "Dashboard", BarChart3],
          ["pipeline", "CRM", Sparkles],
          ["tasks", "Tarefas", CalendarClock],
          ["conversations", "Conversas", MessageCircle],
          ["settings", "Configurações", Settings],
        ].map(([key, label, Icon]) => (
          <button
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
              collapsed ? "lg:h-11 lg:px-0" : "lg:justify-start"
            } ${
              view === key
                ? "bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/25"
                : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
            }`}
            key={key as string}
            onClick={() => onNavigate(key as View)}
            title={collapsed ? (label as string) : undefined}
            type="button"
          >
            <Icon className="h-4 w-4" />
            {!collapsed && <span className="hidden sm:inline">{label as string}</span>}
          </button>
        ))}
      </nav>
      <button
        className={`shine-cta relative mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#8B5CF6]/35 bg-[#8B5CF6]/10 text-sm text-[#DDD6FE] shadow-lg shadow-[#8B5CF6]/10 transition hover:bg-[#8B5CF6]/20 ${
          collapsed ? "h-11 px-0" : "px-3 py-2"
        } disabled:cursor-not-allowed disabled:opacity-50`}
        disabled={!canUseProspecting}
        onClick={onOpenProspecting}
        title={!canUseProspecting ? "Sem permissão para usar prospecção" : collapsed ? "Prospecção" : undefined}
        type="button"
      >
        <Sparkles className="h-4 w-4" />
        {!collapsed && <span className="hidden sm:inline lg:inline">Prospecção</span>}
      </button>
      <button
        className={`mt-4 hidden w-full items-center justify-center gap-2 rounded-lg border border-white/10 text-sm text-zinc-400 transition hover:bg-white/[0.06] hover:text-white lg:flex ${
          collapsed ? "h-11 px-0" : "px-3 py-2"
        }`}
        onClick={onLogout}
        title={collapsed ? "Sair" : undefined}
        type="button"
      >
        <LogOut className="h-4 w-4" />
        {!collapsed && <span>Sair</span>}
      </button>
    </aside>
  );
}
