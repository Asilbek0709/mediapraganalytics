"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useTil } from "@/components/i18n/TilProvider";
import { spring } from "./motion";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  keng?: boolean;
}

export function Dialog({ open, onClose, title, children, footer, keng = false }: Props) {
  const { t } = useTil();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const oldingi = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = oldingi;
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto p-4 sm:p-8">
          <motion.div
            className="fixed inset-0"
            style={{ background: "rgba(6, 8, 12, 0.6)", backdropFilter: "blur(3px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative w-full overflow-hidden rounded-2xl border shadow-lg"
            style={{
              maxWidth: keng ? 960 : 720,
              background: "var(--surface)",
              borderColor: "var(--line-strong)",
              boxShadow: "var(--shadow-lg)",
            }}
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12, transition: { duration: 0.16 } }}
            transition={spring}
          >
            <div
              className="flex items-center justify-between gap-3 border-b px-5 py-4"
              style={{ borderColor: "var(--line)" }}
            >
              <h2>{title}</h2>
              <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label={t("u.yopish")}>
                ✕
              </button>
            </div>
            <div className="scroll-thin max-h-[min(70vh,640px)] overflow-y-auto px-5 py-5">{children}</div>
            {footer && (
              <div
                className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-4"
                style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
