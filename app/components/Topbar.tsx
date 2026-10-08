import { Bell, LogOut } from "lucide-react";
import Image from "next/image";
import { logoutInternal } from "@/app/login/logout";
import type { InternalIdentity } from "@/lib/auth/post-auth";
import { PropertySearch } from "@/app/components/PropertySearch";
import type { PropertySearchOption } from "@/lib/properties/search";

export function Topbar({ identity, searchOptions }: { identity: InternalIdentity; searchOptions: PropertySearchOption[] }) {
  return (
    <header className="fixed left-0 right-0 top-0 z-20 h-[72px] border-b border-black/[0.06] bg-white/90 pl-[68px] backdrop-blur-md md:left-[248px] md:pl-0">
      <div className="mx-auto flex h-full max-w-[1336px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10 xl:px-12">
        <PropertySearch options={searchOptions} />

        <div className="flex shrink-0 items-center gap-3 sm:gap-5">
          <button
            type="button"
            aria-label="Tilkynningar"
            className="mo-button mo-button-icon relative grid size-9 place-items-center"
          >
            <Bell size={18} strokeWidth={1.65} />
            <span className="absolute right-[7px] top-[7px] size-1.5 rounded-full bg-[#b98a3f] ring-2 ring-white" />
          </button>
          <div className="h-7 w-px bg-black/[0.07]" />
          <div className="flex items-center gap-3">
            <span className="relative grid size-9 overflow-hidden rounded-full bg-[#cde6da] text-[10px] font-bold tracking-wide text-[#33483d] ring-1 ring-inset ring-black/[0.06]">
              {identity.profilePhotoUrl ? <Image unoptimized fill sizes="32px" src={identity.profilePhotoUrl} alt="" className="object-cover" /> : <span className="grid size-full place-items-center">{identity.initials}</span>}
            </span>
            <div className="hidden leading-none sm:block">
              <p className="text-[12px] font-semibold text-[#262a26]">{identity.displayName}</p>
              <p className="mt-1.5 text-[10.5px] text-[#838a82]">{identity.professionalTitle ?? identity.roleLabel}</p>
            </div>
            <form action={logoutInternal}>
              <button
                type="submit"
                aria-label="Skrá út"
                title="Skrá út"
                className="mo-button mo-button-icon grid size-9 place-items-center"
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
