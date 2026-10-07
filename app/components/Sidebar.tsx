"use client";

import {
  Building2,
  CalendarDays,
  CheckSquare2,
  FileText,
  Handshake,
  LayoutDashboard,
  Menu,
  Settings,
  Users,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";

type NavItem = {
  label: string;
  icon: LucideIcon;
  href: string;
};

const mainNavigation: NavItem[] = [
  { label: "Yfirlit", icon: LayoutDashboard, href: "/" },
  { label: "Fasteignir", icon: Building2, href: "/properties" },
  { label: "Viðskiptavinir", icon: UserRound, href: "#" },
  { label: "Skoðanir", icon: CalendarDays, href: "#" },
  { label: "Tilboð", icon: Handshake, href: "#" },
  { label: "Verkefni", icon: CheckSquare2, href: "/tasks" },
  { label: "Skjöl", icon: FileText, href: "/documents" },
];

const secondaryNavigation: NavItem[] = [
  { label: "Teymi", icon: Users, href: "#" },
  { label: "Stillingar", icon: Settings, href: "#" },
];

function Brand() {
  return (
    <Link href="/" className="flex h-9 items-center gap-3" aria-label="Mó heim">
      <span className="relative grid size-8 place-items-center rounded-full border border-white/12 bg-[#171b18]">
        <span className="absolute h-3.5 w-px -rotate-45 bg-[#9caf9a]" />
        <span className="absolute h-3.5 w-px rotate-45 bg-[#687b68]" />
      </span>
      <span className="text-[20px] font-semibold tracking-[-0.04em] text-[#f3f1ea]">Mó</span>
    </Link>
  );
}

function Navigation({ onNavigate, activeItem }: { onNavigate?: () => void; activeItem: string }) {
  const renderItems = (items: NavItem[]) =>
    items.map(({ label, icon: Icon, href }) => {
      const isSelected = label === activeItem;

      return (
        <li key={label}>
          <Link
            href={href}
            onClick={onNavigate}
            aria-current={isSelected ? "page" : undefined}
            className={`mo-nav-item group flex h-10 items-center gap-3 rounded-[10px] px-3 text-[13px] font-medium transition-colors ${
              isSelected
                ? "bg-[#202820] text-[#eef1e9]"
                : "text-[#89918b]"
            }`}
          >
            <Icon
              size={17}
              strokeWidth={1.65}
              className={isSelected ? "text-[#9caf9a]" : "mo-nav-icon text-[#747c76]"}
            />
            {label}
          </Link>
        </li>
      );
    });

  return (
    <nav className="flex min-h-0 flex-1 flex-col pt-10" aria-label="Aðalvalmynd">
      <ul className="space-y-1">{renderItems(mainNavigation)}</ul>
      <div className="mt-auto border-t border-white/[0.06] pt-5">
        <ul className="space-y-1">{renderItems(secondaryNavigation)}</ul>
      </div>
    </nav>
  );
}

function SidebarContent({ onNavigate, activeItem }: { onNavigate?: () => void; activeItem: string }) {
  return (
    <div className="flex h-full flex-col px-4 pb-5 pt-6">
      <div className="px-2">
        <Brand />
      </div>
      <Navigation onNavigate={onNavigate} activeItem={activeItem} />
      <div className="mx-2 mt-5 flex items-center gap-2.5 text-[11px] text-[#5f6761]">
        <span className="size-1.5 rounded-full bg-[#6f846f]" />
        Kerfi virkt
      </div>
    </div>
  );
}

export function Sidebar({ activeItem = "Yfirlit" }: { activeItem?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] border-r border-white/[0.07] bg-[#0d100e] lg:block">
        <SidebarContent activeItem={activeItem} />
      </aside>

      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mo-button mo-button-secondary fixed left-4 top-[17px] z-30 grid size-10 place-items-center lg:hidden"
        aria-label="Opna valmynd"
        aria-expanded={isOpen}
      >
        <Menu size={19} strokeWidth={1.7} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Loka valmynd"
            onClick={() => setIsOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[280px] border-r border-white/[0.08] bg-[#0d100e]">
            <button
              type="button"
              className="mo-button mo-button-icon absolute right-4 top-5 z-10 grid size-9 place-items-center"
              onClick={() => setIsOpen(false)}
              aria-label="Loka valmynd"
            >
              <X size={19} />
            </button>
            <SidebarContent activeItem={activeItem} onNavigate={() => setIsOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
