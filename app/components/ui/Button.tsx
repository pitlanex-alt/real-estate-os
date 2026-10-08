"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "positive" | "ghost" | "danger" | "text" | "icon";
export type ButtonSize = "normal" | "compact" | "icon";

export function buttonClassName(variant: ButtonVariant = "secondary", className = "", size?: ButtonSize) {
  const resolvedSize = size ?? (variant === "icon" ? "icon" : "normal");
  const sizeClass = resolvedSize === "icon" ? "size-10" : resolvedSize === "compact" ? "min-h-10 px-3 text-[11px]" : "min-h-11 px-4 text-[12px]";
  return `mo-button mo-button-${variant} ${sizeClass} ${className}`.trim();
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }>(
  function Button({ variant = "secondary", size, className = "", type = "button", ...props }, ref) {
    return <button ref={ref} type={type} className={buttonClassName(variant, className, size)} {...props} />;
  },
);
