"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "text" | "icon";

export function buttonClassName(variant: ButtonVariant = "secondary", className = "") {
  return `mo-button mo-button-${variant} ${className}`.trim();
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }>(
  function Button({ variant = "secondary", className = "", type = "button", ...props }, ref) {
    return <button ref={ref} type={type} className={buttonClassName(variant, className)} {...props} />;
  },
);
