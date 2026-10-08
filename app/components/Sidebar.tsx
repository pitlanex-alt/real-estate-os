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
  { label: "Viðskiptavinir", icon: UserRound, href: "/contacts" },
  { label: "Skoðanir", icon: CalendarDays, href: "#" },
  { label: "Tilboð", icon: Handshake, href: "#" },
  { label: "Verkefni", icon: CheckSquare2, href: "/tasks" },
  { label: "Skjöl", icon: FileText, href: "/documents" },
];

const secondaryNavigation: NavItem[] = [
  { label: "Teymi", icon: Users, href: "/team" },
  { label: "Stillingar", icon: Settings, href: "/settings" },
];

function Brand() {
  return (
    <Link href="/" className="flex h-10 items-center gap-3" aria-label="Kelvo heim">
      <span className="relative grid size-9 place-items-center rounded-[12px] border border-[#bfd747] bg-[#d9f65a] text-[15px] font-bold tracking-[-0.04em] text-[#202614] shadow-[0_2px_7px_rgba(54,64,30,0.08)]">
        K
      </span>
      <span className="text-[21px] font-bold tracking-[-0.045em] text-[#171a17]">Kelvo</span>
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
            className={`mo-nav-item group flex h-11 items-center gap-3 rounded-[13px] px-3.5 text-[13px] font-medium transition-colors ${
              isSelected
                ? "bg-[#e8f0e3] text-[#20251f] shadow-[inset_0_0_0_1px_rgba(83,102,70,0.05)]"
                : "text-[#70776f]"
            }`}
          >
            <Icon
              size={17}
              strokeWidth={1.65}
              className={isSelected ? "text-[#53684a]" : "mo-nav-icon text-[#90978f]"}
            />
            {label}
          </Link>
        </li>
      );
    });

  return (
    <nav className="flex min-h-0 flex-1 flex-col pt-9" aria-label="Aðalvalmynd">
      <ul className="space-y-1">{renderItems(mainNavigation)}</ul>
      <div className="mt-auto border-t border-black/[0.06] pt-5">
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
      <div className="mx-2 mt-5 flex items-center gap-2.5 text-[11px] text-[#8a9189]">
        <span className="size-1.5 rounded-full bg-[#9eb33f]" />
        Kerfi virkt
      </div>
    </div>
  );
}

export function Sidebar({ activeItem = "Yfirlit" }: { activeItem?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-black/[0.06] bg-[#fafbf8] md:block">
        <SidebarContent activeItem={activeItem} />
      </aside>

      <div className="fixed left-4 top-[17px] z-30 md:hidden">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mo-button mo-button-secondary grid size-10 place-items-center"
          aria-label="Opna valmynd"
          aria-expanded={isOpen}
        >
          <Menu size={19} strokeWidth={1.7} />
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[#171a17]/30 backdrop-blur-[2px]"
            aria-label="Loka valmynd"
            onClick={() => setIsOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[288px] border-r border-black/[0.08] bg-[#fafbf8] shadow-[12px_0_36px_rgba(20,25,20,0.1)]">
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
