import { Bell, LogOut } from "lucide-react";
import { logoutInternal } from "@/app/login/logout";
import type { InternalIdentity } from "@/lib/auth/post-auth";
import { PropertySearch } from "@/app/components/PropertySearch";
import type { PropertySearchOption } from "@/lib/properties/search";

export function Topbar({ identity, searchOptions }: { identity: InternalIdentity; searchOptions: PropertySearchOption[] }) {
  return (
    <header className="fixed left-0 right-0 top-0 z-20 h-[74px] border-b border-white/[0.07] bg-[#111412]/95 pl-[68px] backdrop-blur-sm lg:left-[232px] lg:pl-0">
      <div className="mx-auto flex h-full max-w-[1336px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10 xl:px-12">
        <PropertySearch options={searchOptions} />

        <div className="flex shrink-0 items-center gap-3 sm:gap-5">
          <button
            type="button"
            aria-label="Tilkynningar"
            className="relative grid size-9 place-items-center rounded-[9px] text-[#8f9791] transition-colors hover:bg-white/5 hover:text-[#f3f1ea]"
          >
            <Bell size={18} strokeWidth={1.65} />
            <span className="absolute right-[7px] top-[7px] size-1.5 rounded-full bg-[#c99a52] ring-2 ring-[#111412]" />
          </button>
          <div className="h-7 w-px bg-white/[0.07]" />
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full bg-[#2a332b] text-[10px] font-semibold tracking-wide text-[#bac8b8] ring-1 ring-inset ring-white/[0.08]">
              {identity.initials}
            </span>
            <div className="hidden leading-none sm:block">
              <p className="text-[12px] font-medium text-[#e9e8e1]">{identity.displayName}</p>
              <p className="mt-1.5 text-[10px] text-[#737b75]">{identity.roleLabel}</p>
            </div>
            <form action={logoutInternal}>
              <button
                type="submit"
                aria-label="Skrá út"
                title="Skrá út"
                className="grid size-9 place-items-center rounded-[9px] text-[#737b75] transition-colors hover:bg-white/5 hover:text-[#d8dcd7]"
              >
                <LogOut size={16} strokeWidth={1.6} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
