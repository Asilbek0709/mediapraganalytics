"use client";

import { motion } from "framer-motion";

import { useTil } from "@/components/i18n/TilProvider";
import { darajaIndeks } from "@/lib/format";
import type { ShkalaOraliq } from "@/lib/types";
import { spring } from "./motion";

interface Props {
  daraja: string | null;
  lpsi?: number | null;
  shkala: ShkalaOraliq[];
  faqatDaraja?: boolean;
}

export function DarajaBadge({ daraja, lpsi, shkala, faqatDaraja = false }: Props) {
  const { son, atama } = useTil();
  if (!daraja) {
    return <span className="badge" style={{ color: "var(--muted)" }}>—</span>;
  }
  const i = darajaIndeks(daraja, shkala);
  return (
    <motion.span className={`badge lvl-${i ?? 0}`} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={spring}>
      <i />
      {!faqatDaraja && lpsi != null ? `${son(lpsi)} · ` : ""}
      {atama.daraja(daraja)}
    </motion.span>
  );
}

export function HolatTag({ tahlilBor, lpsi }: { tahlilBor: number | boolean; lpsi: number | null }) {
  const { t } = useTil();
  if (lpsi != null) return null;
  return <span className="tag">{tahlilBor ? t("u.toliqEmas") : t("u.tahlilQilinmagan")}</span>;
}
