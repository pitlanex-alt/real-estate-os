import type { ReactNode } from "react";

export function EmptyState({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`py-10 text-center text-[13px] text-[var(--text-secondary)] ${className}`}>{children}</div>;
}
