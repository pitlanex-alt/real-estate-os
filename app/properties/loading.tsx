import { AppShell } from "@/app/components/AppShell";

export default function PropertiesLoading() {
  return (
    <AppShell activeItem="Fasteignir">
      <div className="mx-auto w-full max-w-[1336px] px-4 pb-16 pt-9 sm:px-6 lg:px-10 xl:px-12" aria-busy="true" aria-label="Sæki eignir">
        <div className="border-b border-white/[0.07] pb-7">
          <div className="h-8 w-36 animate-pulse rounded-[6px] bg-white/[0.05]" />
          <div className="mt-3 h-3 w-64 animate-pulse rounded bg-white/[0.035]" />
        </div>
        <div className="mt-7 h-11 animate-pulse rounded-[9px] bg-white/[0.035]" />
        <div className="mt-7 divide-y divide-white/[0.06] border-y border-white/[0.07]">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-[92px] animate-pulse bg-white/[0.012]" />)}
        </div>
      </div>
    </AppShell>
  );
}
