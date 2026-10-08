import type { HTMLAttributes } from "react";

export function Panel({ className = "", padding = "default", ...props }: HTMLAttributes<HTMLDivElement> & { padding?: "default" | "none" }) {
  return <div className={`kelvo-card ${padding === "default" ? "p-5 sm:p-6" : ""} ${className}`} {...props} />;
}
