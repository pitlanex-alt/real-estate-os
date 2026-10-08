type JourneyStage = { value: string; label: string };
type JourneyState = "completed" | "current" | "future";

const workflowOrder = ["valuation", "preparation", "listed", "viewings", "offers", "contract", "closing", "handover"];

function journeyState(index: number, currentIndex: number, isCompleted: boolean): JourneyState {
  if (isCompleted || index < currentIndex) return "completed";
  if (index === currentIndex) return "current";
  return "future";
}

function resolveCurrentIndex(stages: JourneyStage[], currentStage: string | null | undefined) {
  const exactIndex = stages.findIndex((stage) => stage.value === currentStage);
  if (exactIndex >= 0) return exactIndex;
  if (currentStage === "completed") return stages.length - 1;
  if (currentStage === "cancelled") return -1;

  const workflowIndex = currentStage ? workflowOrder.indexOf(currentStage) : -1;
  if (workflowIndex < 0) return 0;

  const reachedStage = stages.reduce((resolvedIndex, stage, index) => {
    const stageWorkflowIndex = workflowOrder.indexOf(stage.value);
    return stageWorkflowIndex >= 0 && stageWorkflowIndex <= workflowIndex ? index : resolvedIndex;
  }, -1);

  return reachedStage >= 0 ? reachedStage : 0;
}

export function CustomerJourney({ stages, currentStage }: { stages: JourneyStage[]; currentStage: string | null | undefined }) {
  const isCompleted = currentStage === "completed";
  const currentIndex = resolveCurrentIndex(stages, currentStage);
  const currentLabel = isCompleted ? "Lokið" : currentIndex >= 0 ? stages[currentIndex].label : "Staða ekki skráð";
  const previousStage = currentIndex > 0 ? stages[currentIndex - 1] : null;
  const nextStage = currentIndex >= 0 && currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null;
  const edge = 100 / stages.length / 2;
  const desktopProgress = currentIndex < 0 ? 0 : currentIndex / Math.max(stages.length - 1, 1) * 100;
  const mobileProgress = currentIndex < 0 ? 0 : (currentIndex + 1) / stages.length * 100;

  return (
    <div className="mt-5">
      <div className="relative hidden md:block">
        <div className="absolute top-[6px] h-[2px] rounded-full bg-[#e2e6e0]" style={{ left: `${edge}%`, right: `${edge}%` }} aria-hidden="true">
          <span className="block h-full rounded-full bg-[#8faa95]" style={{ width: `${desktopProgress}%` }} />
        </div>
        <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }} aria-label="Framvinda ferlis">
          {stages.map((stage, index) => {
            const state = journeyState(index, currentIndex, isCompleted);
            return (
              <li key={stage.value} aria-current={state === "current" ? "step" : undefined} className="relative min-w-0 pt-6 text-center">
                <span className={`absolute left-1/2 top-0 grid -translate-x-1/2 place-items-center rounded-full ${state === "current" ? "size-[18px] -translate-y-[3px] border border-[#adc62f] bg-[var(--accent)] ring-4 ring-[#edf5bf]" : state === "completed" ? "size-3.5 -translate-y-px bg-[#829f89] ring-2 ring-white" : "size-3.5 -translate-y-px border border-[#d5dad3] bg-[#e9ede7] ring-2 ring-white"}`} aria-hidden="true">
                  {state === "current" && <span className="size-1.5 rounded-full bg-[#596923]" />}
                </span>
                <span className={`block whitespace-nowrap text-[12px] tracking-[-0.02em] ${state === "current" ? "font-semibold text-[var(--text-primary)]" : state === "completed" ? "font-medium text-[#47604d]" : "text-[#9ba19a]"}`}>{stage.label}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="md:hidden">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[16px] font-semibold tracking-[-0.025em] text-[var(--text-primary)]">{currentLabel}</p>
          <p className="shrink-0 text-[11px] font-semibold text-[#5b6c57]">{currentIndex >= 0 ? `${currentIndex + 1} af ${stages.length}` : `— af ${stages.length}`}</p>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e2e6e0]" aria-hidden="true"><div className="relative h-full rounded-full bg-[#8faa95]" style={{ width: `${mobileProgress}%` }}><span className="absolute right-0 top-1/2 size-2 -translate-y-1/2 rounded-full bg-[var(--accent)] ring-2 ring-[#edf5bf]" /></div></div>
        <ol className="sr-only" aria-label="Framvinda ferlis">{stages.map((stage, index) => <li key={stage.value} aria-current={journeyState(index, currentIndex, isCompleted) === "current" ? "step" : undefined}>{stage.label}</li>)}</ol>
        {(previousStage || nextStage) && <div className="mt-3 grid grid-cols-2 gap-4 text-[10px] text-[var(--text-muted)]"><p>{previousStage ? `Fyrri: ${previousStage.label}` : ""}</p><p className="text-right">{nextStage ? `Næst: ${nextStage.label}` : ""}</p></div>}
      </div>
    </div>
  );
}
