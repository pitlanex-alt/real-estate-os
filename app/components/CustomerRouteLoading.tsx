import { KelvoLogo } from "@/app/components/KelvoBrand";

export function CustomerRouteLoading({ detail = false }: { detail?: boolean }) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]" aria-busy="true" aria-label="Augnablik">
      <header className="border-b border-black/[0.06] bg-white">
        <div className="mx-auto flex h-[72px] max-w-[1180px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <KelvoLogo className="w-[100px] sm:w-[108px]" priority />
          <div className="flex items-center gap-3">
            <div className="hidden sm:block"><div className="kelvo-skeleton h-3 w-28 rounded-full" /><div className="kelvo-skeleton mt-2 h-2.5 w-16 rounded-full" /></div>
            <div className="kelvo-skeleton size-9 rounded-full" />
          </div>
        </div>
      </header>
      <main className={`mx-auto px-4 py-8 sm:px-6 sm:py-10 ${detail ? "max-w-[920px]" : "max-w-[1180px]"}`}>
        {detail ? (
          <>
            <div className="kelvo-skeleton h-11 w-36 rounded-[12px]" />
            <section className="kelvo-card mt-4 p-6 sm:p-8">
              <div className="kelvo-skeleton h-3 w-24 rounded-full" />
              <div className="kelvo-skeleton mt-4 h-10 w-64 max-w-[75%] rounded-[10px]" />
              <div className="kelvo-skeleton mt-4 h-8 w-28 rounded-full" />
              <div className="mt-7 grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="rounded-[12px] border border-black/[0.05] bg-white p-4"><div className="kelvo-skeleton h-2.5 w-20 rounded-full" /><div className="kelvo-skeleton mt-3 h-4 w-28 rounded-full" /></div>)}</div>
              <div className="kelvo-skeleton mt-6 h-14 w-full rounded-[14px]" />
            </section>
          </>
        ) : (
          <>
            <section className="kelvo-card grid min-h-[280px] overflow-hidden md:grid-cols-[1.1fr_.9fr]">
              <div className="kelvo-skeleton min-h-[220px] rounded-none" />
              <div className="p-6 sm:p-8"><div className="kelvo-skeleton h-3 w-28 rounded-full" /><div className="kelvo-skeleton mt-4 h-9 w-64 max-w-full rounded-[10px]" /><div className="kelvo-skeleton mt-3 h-3 w-36 rounded-full" /><div className="kelvo-skeleton mt-8 h-20 w-full rounded-[14px]" /></div>
            </section>
            <section className="kelvo-card mt-6 p-5 sm:p-7"><div className="kelvo-skeleton h-5 w-32 rounded-full" /><div className="kelvo-skeleton mt-8 h-2 w-full rounded-full" /><div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="kelvo-skeleton h-20 rounded-[12px]" />)}</div></section>
          </>
        )}
      </main>
    </div>
  );
}
