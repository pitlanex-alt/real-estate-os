import { InternalLoadingState } from "@/app/components/InternalLoadingState";

export default function Loading() {
  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="fixed inset-y-0 left-0 hidden w-[248px] border-r border-black/[0.06] bg-[#fafbf8] px-6 pt-7 lg:block">
        <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-[12px] bg-[var(--accent)] text-[15px] font-bold text-[var(--accent-text)]">K</span><span className="text-[21px] font-bold tracking-[-0.045em]">Kelvo</span></div>
        <div className="mt-10 space-y-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className={`kelvo-skeleton h-10 rounded-[12px] ${index === 0 ? "bg-[var(--surface-accent)]" : ""}`} />)}</div>
      </div>
      <div className="min-h-screen lg:pl-[248px]"><div className="h-[72px] border-b border-black/[0.06] bg-white" /><InternalLoadingState /></div>
    </main>
  );
}
