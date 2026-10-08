const transactionStages = [
  { value: "valuation", label: "Verðmat" },
  { value: "preparation", label: "Undirbúningur" },
  { value: "listed", label: "Á sölu" },
  { value: "viewings", label: "Skoðanir" },
  { value: "offers", label: "Tilboð" },
  { value: "contract", label: "Samningur" },
  { value: "closing", label: "Frágangur" },
  { value: "handover", label: "Afhending" },
] as const;

const exceptionalStageLabels: Record<string, string> = {
  completed: "Lokið",
  cancelled: "Hætt við",
};

type StageState = "completed" | "current" | "future";

function stageState(index: number, currentIndex: number, isCompleted: boolean): StageState {
  if (isCompleted || index < currentIndex) return "completed";
  if (index === currentIndex) return "current";
  return "future";
}

export function TransactionLifecycle({ currentStage }: { currentStage: string }) {
  const stageIndex = transactionStages.findIndex((stage) => stage.value === currentStage);
  const isCompleted = currentStage === "completed";
  const currentIndex = isCompleted ? transactionStages.length - 1 : stageIndex;
  const currentLabel = isCompleted
    ? exceptionalStageLabels.completed
    : stageIndex >= 0
      ? transactionStages[stageIndex].label
      : exceptionalStageLabels[currentStage] ?? currentStage;
  const previousStage = currentIndex > 0 ? transactionStages[currentIndex - 1] : null;
  const nextStage = currentIndex >= 0 && currentIndex < transactionStages.length - 1 ? transactionStages[currentIndex + 1] : null;
  const desktopProgress = currentIndex < 0 ? 0 : (currentIndex / (transactionStages.length - 1)) * 100;
  const mobileProgress = currentIndex < 0 ? 0 : ((currentIndex + 1) / transactionStages.length) * 100;

  return (
    <section className="kelvo-card mt-5 px-5 py-4 sm:px-6" aria-label="Ferli viðskipta">
      <div className="relative hidden lg:block">
        <div className="absolute left-[6.25%] right-[6.25%] top-[5px] h-[2px] rounded-full bg-[#e5e8e3]" aria-hidden="true">
          <span className="block h-full rounded-full bg-[var(--mint-strong)]" style={{ width: `${desktopProgress}%` }} />
        </div>
        <ol className="relative grid grid-cols-8" aria-label="Stig viðskiptaferlis">
        {transactionStages.map((stage, index) => {
          const state = stageState(index, currentIndex, isCompleted);
          const isCurrent = state === "current";
          return (
            <li
              key={stage.value}
              aria-current={isCurrent ? "step" : undefined}
              className="relative min-w-0 pt-6 text-center"
            >
              <span
                className={`absolute left-1/2 top-0 -translate-x-1/2 rounded-full ${isCurrent ? "size-4 -translate-y-[2px] border border-[#bfd747] bg-[var(--accent)] ring-4 ring-[#eef6c9]" : state === "completed" ? "size-3 bg-[var(--mint-strong)] ring-2 ring-white" : "size-3 border border-[#d9ddd7] bg-[#edf0eb] ring-2 ring-white"}`}
                aria-hidden="true"
              />
              <span className={`block min-w-0 whitespace-nowrap text-[12px] tracking-[-0.02em] ${isCurrent ? "font-semibold text-[var(--text-primary)]" : state === "completed" ? "font-medium text-[#526750]" : "text-[var(--text-muted)]"}`}>
                {stage.label}
              </span>
            </li>
          );
        })}
        </ol>
      </div>

      <div className="lg:hidden">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-[16px] font-semibold tracking-[-0.025em] text-[var(--text-primary)]">{currentLabel}</p>
          </div>
          <p className="shrink-0 text-[11px] font-semibold text-[#5b6c57]">
            {currentIndex >= 0 ? `${currentIndex + 1} af ${transactionStages.length}` : `— af ${transactionStages.length}`}
          </p>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e5e8e3]" aria-hidden="true">
          <div className="h-full rounded-full bg-[var(--mint-strong)]" style={{ width: `${mobileProgress}%` }} />
        </div>
        <ol className="sr-only" aria-label="Stig viðskiptaferlis">
          {transactionStages.map((stage, index) => <li key={stage.value} aria-current={stageState(index, currentIndex, isCompleted) === "current" ? "step" : undefined}>{stage.label}</li>)}
        </ol>
        {(previousStage || nextStage) && (
          <div className="mt-3 grid grid-cols-2 gap-4 text-[10px] text-[var(--text-muted)]">
            <p>{previousStage ? `Fyrri: ${previousStage.label}` : ""}</p>
            <p className="text-right">{nextStage ? `Næst: ${nextStage.label}` : ""}</p>
          </div>
        )}
      </div>
    </section>
  );
}
