"use client";

import { motion } from "framer-motion";

import { useTil } from "@/components/i18n/TilProvider";
import type { AlphaTalqini } from "@/lib/statistika";

export const TALQIN_RANGI: Record<AlphaTalqini, string> = {
  ishonchli: "var(--lvl-2)",
  shartli: "var(--lvl-1)",
  ishonchsiz: "var(--lvl-0)",
};

/**
 * α shkalasi 0…1: ustun α gacha to‘ladi, 0,667 va 0,800 chegaralari belgilangan.
 * Qiymat va talqin har doim matn bilan ham yoziladi.
 */
export function AlphaBar({ alpha, talqin, kechikish = 0 }: { alpha: number | null; talqin: AlphaTalqini | null; kechikish?: number }) {
  const { t, son } = useTil();
  const kenglik = alpha == null ? 0 : Math.max(0, Math.min(1, alpha)) * 100;
  const rang = talqin ? TALQIN_RANGI[talqin] : "var(--line-strong)";
  return (
    <div className="flex items-center gap-3">
      <div
        className="relative h-2.5 w-36 flex-none overflow-hidden rounded-full"
        style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
      >
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: rang }}
          initial={{ width: 0 }}
          whileInView={{ width: `${kenglik}%` }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 140, damping: 22, delay: kechikish }}
        />
        {[66.7, 80].map((x) => (
          <span key={x} className="absolute inset-y-0 w-px" style={{ left: `${x}%`, background: "var(--ink-2)", opacity: 0.55 }} />
        ))}
      </div>
      <span className="w-14 text-right font-extrabold tabular-nums" style={{ color: "var(--ink)" }}>
        {son(alpha, 3)}
      </span>
      {talqin ? (
        <span className="badge">
          <i style={{ background: rang }} />
          {t(`eks.t.${talqin}`)}
        </span>
      ) : (
        <span className="hint">{t("eks.aniqlanmaydi")}</span>
      )}
    </div>
  );
}
