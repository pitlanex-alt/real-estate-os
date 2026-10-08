"use client";

import { Search } from "lucide-react";
import { forwardRef, type InputHTMLAttributes } from "react";

export type InputSize = "normal" | "compact";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { controlSize?: InputSize }>(
  function Input({ controlSize = "normal", className = "", ...props }, ref) {
    return <input ref={ref} className={`mo-control w-full outline-none ${controlSize === "compact" ? "min-h-10 rounded-[10px] px-3 text-[12px]" : "min-h-12 px-4 text-base"} ${className}`} {...props} />;
  },
);

export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { controlSize?: InputSize }>(
  function SearchInput({ controlSize = "normal", className = "", ...props }, ref) {
    return <span className="relative block"><Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-[var(--text-muted)]" /><Input ref={ref} controlSize={controlSize} className={`pl-10 ${className}`} type="search" {...props} /></span>;
  },
);
