"use client";

import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";

type Position = { left: number; top: number; width: number; maxHeight: number };

export function Popover({ open, onClose, triggerRef, children, minWidth = 220, labelledBy }: { open: boolean; onClose: (restoreFocus?: boolean) => void; triggerRef: RefObject<HTMLElement | null>; children: ReactNode; minWidth?: number; labelledBy?: string }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position>({ left: 8, top: 8, width: minWidth, maxHeight: 320 });

  useLayoutEffect(() => {
    if (!open) return;
    function update() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const margin = 8;
      const gap = 6;
      const desiredWidth = Math.max(rect.width, minWidth);
      const width = Math.min(desiredWidth, window.innerWidth - margin * 2);
      const left = Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin);
      const spaceBelow = window.innerHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      const useAbove = spaceBelow < 240 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(160, Math.min(360, (useAbove ? spaceAbove : spaceBelow) - gap));
      const contentHeight = Math.min(contentRef.current?.scrollHeight ?? 320, maxHeight);
      setPosition({ left, width, maxHeight, top: useAbove ? Math.max(margin, rect.top - contentHeight - gap) : rect.bottom + gap });
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [minWidth, open, triggerRef]);

  useEffect(() => {
    if (!open) return;
    function pointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!contentRef.current?.contains(target) && !triggerRef.current?.contains(target)) onClose();
    }
    document.addEventListener("pointerdown", pointerDown);
    return () => document.removeEventListener("pointerdown", pointerDown);
  }, [onClose, open, triggerRef]);

  if (typeof document === "undefined" || !open) return null;
  return createPortal(
    <div
      ref={contentRef}
      role="presentation"
      aria-labelledby={labelledBy}
      className="fixed z-[100] overflow-auto rounded-[14px] border border-black/[0.09] bg-white shadow-[0_18px_44px_rgba(25,34,24,0.14)]"
      style={{ left: position.left, top: position.top, width: position.width, maxHeight: position.maxHeight }}
    >
      {children}
    </div>,
    document.body,
  );
}
