"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

import { useTil } from "@/components/i18n/TilProvider";

export interface HeatQator {
  nomi: string;
  izoh?: string;
  soni?: number;
  qiymatlar: (number | null)[];
}

/**
 * Issiqlik jadvali: katak rangi qiymatga mutanosib (bitta rang, ochdan to‘qqa).
 * Har bir katakda raqam yozilgan — rangni ajrata olmaydigan o‘quvchi uchun ham.
 * To‘yinganlik 65% bilan cheklangan: shunda katakdagi oddiy matn ikkala mavzuda ham
 * kamida 5:1 kontrastda qoladi.
 */
const MIN_FOIZ = 8;
const MAX_FOIZ = 65;
export function HeatTable({
  qatorlar,
  ustunlar,
  rang = "var(--s1)",
  max = 100,
  suffix = "",
  birinchiUstun,
  soniUstuni = false,
  havola,
}: {
  qatorlar: HeatQator[];
  ustunlar: { kalit: string; nomi: string; title?: string }[];
  rang?: string;
  max?: number;
  suffix?: string;
  birinchiUstun: string;
  soniUstuni?: boolean;
  /** katak havolasi (masalan, misollar korpusiga); null — havolasiz */
  havola?: (qator: number, ustun: number) => string | null;
}) {
  const { t, son } = useTil();
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);

  if (!qatorlar.length) return <p className="hint py-8 text-center">{t("an.filtrBosh")}</p>;

  return (
    <div className="table-wrap">
      <table className="w-full border-separate text-[13px]" style={{ borderSpacing: 3 }}>
        <thead>
          <tr>
            <th className="px-2 pb-2 text-left align-bottom text-[11.5px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              {birinchiUstun}
            </th>
            {soniUstuni && (
              <th className="px-2 pb-2 text-right align-bottom text-[11.5px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                {t("u.soni")}
              </th>
            )}
            {ustunlar.map((u, c) => (
              <th
                key={u.kalit}
                title={u.title}
                className="min-w-[74px] px-1.5 pb-2 text-center align-bottom text-[11.5px] font-bold leading-tight transition-colors"
                style={{ color: hover?.c === c ? "var(--ink)" : "var(--muted)" }}
              >
                {u.nomi}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {qatorlar.map((q, r) => (
            <tr key={q.nomi}>
              <td
                className="whitespace-nowrap px-2 py-1.5 font-semibold transition-colors"
                style={{ color: hover?.r === r ? "var(--ink)" : "var(--ink-2)" }}
                title={q.izoh}
              >
                {q.nomi}
              </td>
              {soniUstuni && (
                <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: "var(--muted)" }}>
                  {q.soni ?? "—"}
                </td>
              )}
              {q.qiymatlar.map((v, c) => {
                const ulush = v == null ? 0 : Math.max(0, Math.min(1, v / (max || 1)));
                const foiz = v == null ? 0 : Math.round(MIN_FOIZ + ulush * (MAX_FOIZ - MIN_FOIZ));
                const faol = hover?.r === r || hover?.c === c;
                const href = v != null && v > 0 ? (havola?.(r, c) ?? null) : null;
                const yozuv = `${son(v)}${v == null ? "" : suffix}`;
                const sarlavha = `${q.nomi} · ${ustunlar[c]?.title ?? ustunlar[c]?.nomi}: ${yozuv}`;
                return (
                  <motion.td
                    key={ustunlar[c]?.kalit ?? c}
                    initial={{ opacity: 0, scale: 0.6 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true, margin: "-30px" }}
                    transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.02 * r + 0.035 * c }}
                    onMouseEnter={() => setHover({ r, c })}
                    onMouseLeave={() => setHover(null)}
                    title={href ? t("an.katakTitle", { v: sarlavha }) : sarlavha}
                    className={`rounded-md text-center font-bold tabular-nums ${href ? "p-0" : "px-2 py-2"}`}
                    style={{
                      background: v == null ? "var(--surface-2)" : `color-mix(in oklab, ${rang} ${foiz}%, var(--surface))`,
                      color: v == null ? "var(--muted)" : "var(--ink)",
                      outline: hover?.r === r && hover?.c === c ? "2px solid var(--ink)" : faol ? "1px solid var(--line-strong)" : "none",
                      outlineOffset: -1,
                    }}
                  >
                    {href ? (
                      <Link href={href} className="block rounded-md px-2 py-2 no-underline" style={{ color: "inherit" }}>
                        {yozuv}
                      </Link>
                    ) : (
                      yozuv
                    )}
                  </motion.td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Rang shkalasi izohi: och → to‘q. */
export function HeatLegend({ rang, pastki, yuqori }: { rang: string; pastki: string; yuqori: string }) {
  return (
    <div className="mt-3 flex items-center gap-2.5 text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
      <span>{pastki}</span>
      <span
        className="h-2.5 w-40 rounded-full"
        style={{
          background: `linear-gradient(90deg, color-mix(in oklab, ${rang} ${MIN_FOIZ}%, var(--surface)), color-mix(in oklab, ${rang} ${MAX_FOIZ}%, var(--surface)))`,
          border: "1px solid var(--line)",
        }}
      />
      <span>{yuqori}</span>
    </div>
  );
}
