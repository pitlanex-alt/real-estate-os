import type { ReactNode } from "react";

const tones = { success: "kelvo-status-success", progress: "kelvo-status-progress", warning: "kelvo-status-warning", danger: "kelvo-status-danger", neutral: "kelvo-status-neutral" };

export function StatusChip({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: keyof typeof tones; className?: string }) {
  return <span className={`${tones[tone]} inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${className}`}>{children}</span>;
}
