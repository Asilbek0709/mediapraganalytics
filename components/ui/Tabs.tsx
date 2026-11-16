"use client";

import { motion } from "framer-motion";

/** Segmentli tanlov: faol element ostidagi plashka bir joydan ikkinchisiga suzib o‘tadi. */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  layoutId,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { kalit: T; nomi: string }[];
  layoutId: string;
}) {
  return (
    <div
      role="tablist"
      className="inline-flex flex-wrap gap-1 rounded-[14px] border p-1"
      style={{ borderColor: "var(--line)", background: "color-mix(in oklab, var(--surface-2) 75%, transparent)" }}
    >
      {items.map((it) => {
        const faol = it.kalit === value;
        return (
          <button
            key={it.kalit}
            type="button"
            role="tab"
            aria-selected={faol}
            onClick={() => onChange(it.kalit)}
            className="relative rounded-[10px] px-3 py-1.5 text-[12.5px] font-bold transition-colors hover:text-[var(--ink)]"
            style={{ color: faol ? "#fff" : "var(--ink-2)" }}
          >
            {faol && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 -z-0 rounded-[10px]"
                style={{ background: "var(--brand-grad)", boxShadow: "var(--glow)" }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{it.nomi}</span>
          </button>
        );
      })}
    </div>
  );
}
