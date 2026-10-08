export function InternalLoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mx-auto w-full max-w-[1336px] px-4 pb-16 pt-8 sm:px-6 lg:px-10 xl:px-12" aria-busy="true" aria-label="Augnablik">
      <div className="flex items-end justify-between gap-6">
        <div>
          <div className="kelvo-skeleton h-8 w-40 rounded-[10px]" />
          <div className="kelvo-skeleton mt-3 h-3 w-64 max-w-[70vw] rounded-full" />
        </div>
        <div className="kelvo-skeleton hidden h-11 w-28 rounded-[12px] sm:block" />
      </div>
      <div className="kelvo-card mt-7 overflow-hidden p-3 sm:p-4">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex min-h-[84px] items-center gap-4 border-b border-black/[0.05] px-2 last:border-b-0">
            <div className="kelvo-skeleton size-14 shrink-0 rounded-[13px]" />
            <div className="min-w-0 flex-1">
              <div className="kelvo-skeleton h-3.5 w-44 max-w-[70%] rounded-full" />
              <div className="kelvo-skeleton mt-2.5 h-2.5 w-28 rounded-full" />
            </div>
            <div className="kelvo-skeleton hidden h-8 w-28 rounded-[10px] md:block" />
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-[11px] text-[var(--text-muted)]">Augnablik…</p>
    </div>
  );
}
