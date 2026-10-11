import { Sidebar } from "@/app/components/Sidebar";
import { InternalLoadingState } from "@/app/components/InternalLoadingState";

export function InternalRouteLoading({ activeItem = "Yfirlit", rows = 4 }: { activeItem?: string; rows?: number }) {
  return (
    <div className="kelvo-app min-h-screen bg-[var(--background)] text-[var(--text-primary)]" aria-busy="true" aria-label="Augnablik">
      <Sidebar activeItem={activeItem} />
      <div className="fixed inset-x-0 top-0 z-20 h-[72px] border-b border-black/[0.06] bg-white md:left-[248px]">
        <div className="ml-auto flex h-full max-w-[1336px] items-center justify-end gap-3 px-4 sm:px-6 lg:px-10">
          <div className="kelvo-skeleton hidden h-10 w-72 rounded-[12px] sm:block" />
          <div className="kelvo-skeleton size-9 rounded-full" />
        </div>
      </div>
      <main className="min-w-0 pt-[72px] md:pl-[248px]">
        <InternalLoadingState rows={rows} />
      </main>
    </div>
  );
}
