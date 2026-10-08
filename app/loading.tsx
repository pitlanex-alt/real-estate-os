import { InternalLoadingState } from "@/app/components/InternalLoadingState";
import { KelvoMark } from "@/app/components/KelvoBrand";

export default function Loading() {
  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="fixed inset-y-0 left-0 hidden w-[248px] border-r border-black/[0.06] bg-[#fafbf8] px-6 pt-7 lg:block">
        <KelvoMark black className="h-9" priority />
        <div className="mt-10 space-y-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className={`kelvo-skeleton h-10 rounded-[12px] ${index === 0 ? "bg-[var(--surface-accent)]" : ""}`} />)}</div>
      </div>
      <div className="min-h-screen lg:pl-[248px]"><div className="h-[72px] border-b border-black/[0.06] bg-white" /><InternalLoadingState /></div>
    </main>
  );
}
