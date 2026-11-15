"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useId, useState } from "react";

import { useTil } from "@/components/i18n/TilProvider";

export interface ChiziqSeriya {
  kalit: string;
  nomi: string;
  rang: string;
  qiymatlar: (number | null)[];
  sonlar: (number | null)[];
}

const W = 760;
const H = 300;
const CHAP = 40;
const ONG = 18;
const USTKI = 14;
const PASTKI = 34;

/**
 * Chiziqli grafik: chiziqlar chizilib boradi, nuqtalar ketma-ket paydo bo‘ladi,
 * sichqoncha ostida vertikal chiziq va barcha seriyalar qiymati ko‘rinadi.
 * Ma’lumot yo‘q davrlarda chiziq uziladi.
 */
export function LineChart({
  davrlar,
  seriyalar,
  max = 100,
}: {
  davrlar: { kalit: string; nomi: string }[];
  seriyalar: ChiziqSeriya[];
  max?: number;
}) {
  const { t, son } = useTil();
  const [hover, setHover] = useState<number | null>(null);
  const n = davrlar.length;
  const grafikW = W - CHAP - ONG;
  const grafikH = H - USTKI - PASTKI;
  const x = (i: number) => (n === 1 ? CHAP + grafikW / 2 : CHAP + (i / (n - 1)) * grafikW);
  const y = (v: number) => USTKI + grafikH - (v / max) * grafikH;
  const qadam = Math.max(1, Math.ceil(n / 12));
  const kalit = davrlar.map((d) => d.kalit).join("|");
  const uid = useId().replace(/:/g, "");
  const tag = USTKI + grafikH;

  function bolaklar(qiymatlar: (number | null)[]): string[] {
    const natija: string[] = [];
    let joriy: string[] = [];
    qiymatlar.forEach((v, i) => {
      if (v == null) {
        if (joriy.length) natija.push(joriy.join(" "));
        joriy = [];
      } else {
        joriy.push(`${joriy.length ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`);
      }
    });
    if (joriy.length) natija.push(joriy.join(" "));
    return natija;
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t("an.dinamika")}>
        <defs>
          {seriyalar.map((s) => (
            <linearGradient key={s.kalit} id={`lc-${uid}-${s.kalit}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.rang} stopOpacity={0.28} />
              <stop offset="100%" stopColor={s.rang} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        {[0, 20, 40, 60, 80, 100].map((t) => (
          <g key={t}>
            <line x1={CHAP} x2={W - ONG} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} strokeDasharray={t === 0 ? undefined : "3 5"} />
            <text x={CHAP - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
              {t}
            </text>
          </g>
        ))}
        {davrlar.map((d, i) =>
          i % qadam === 0 || i === n - 1 ? (
            <text key={d.kalit} x={x(i)} y={H - 12} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--muted)">
              {d.nomi}
            </text>
          ) : null,
        )}

        {hover != null && (
          <line x1={x(hover)} x2={x(hover)} y1={USTKI} y2={USTKI + grafikH} stroke="var(--line-strong)" strokeWidth={1.5} />
        )}

        {/* chiziq ostidagi yumshoq rangli maydon */}
        {seriyalar.map((s, si) =>
          bolaklar(s.qiymatlar).map((d, bi) => {
            const nuqtalar = d.match(/[\d.]+,[\d.]+/g) ?? [];
            if (nuqtalar.length < 2) return null;
            const birinchiX = (nuqtalar[0] ?? "").split(",")[0];
            const oxirgiX = (nuqtalar[nuqtalar.length - 1] ?? "").split(",")[0];
            return (
              <motion.path
                key={`${kalit}-${s.kalit}-m${bi}`}
                d={`${d} L${oxirgiX},${tag} L${birinchiX},${tag} Z`}
                fill={`url(#lc-${uid}-${s.kalit})`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.9, delay: 0.5 + 0.12 * si }}
              />
            );
          }),
        )}

        {seriyalar.map((s, si) =>
          bolaklar(s.qiymatlar).map((d, bi) => (
            <motion.path
              key={`${kalit}-${s.kalit}-${bi}`}
              d={d}
              fill="none"
              stroke={s.rang}
              strokeWidth={2.75}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 4px 8px color-mix(in oklab, ${s.rang} 55%, transparent))` }}
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.12 * si }}
            />
          )),
        )}

        {seriyalar.map((s, si) =>
          s.qiymatlar.map((v, i) =>
            v == null ? null : (
              <motion.circle
                key={`${kalit}-${s.kalit}-p${i}`}
                cx={x(i)}
                cy={y(v)}
                r={hover === i ? 6 : 4.5}
                fill={s.rang}
                stroke="var(--surface)"
                strokeWidth={2}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.35 + 0.12 * si + (i / Math.max(1, n)) * 0.7 }}
                style={{ transformOrigin: `${x(i)}px ${y(v)}px` }}
              />
            ),
          ),
        )}

        {davrlar.map((d, i) => {
          const kenglik = n === 1 ? grafikW : grafikW / (n - 1);
          return (
            <rect
              key={`hit-${d.kalit}`}
              x={x(i) - kenglik / 2}
              y={USTKI}
              width={kenglik}
              height={grafikH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
      </svg>

      <AnimatePresence>
        {hover != null && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute top-2 z-10 min-w-[170px] rounded-[14px] border px-3 py-2.5 text-[12.5px]"
            style={{
              left: `${(x(hover) / W) * 100}%`,
              transform: `translateX(${x(hover) / W > 0.6 ? "-105%" : "8%"})`,
              background: "var(--glass-strong)",
              borderColor: "var(--glass-line)",
              boxShadow: "var(--shadow-lg)",
              backdropFilter: "blur(16px)",
            }}
          >
            <div className="mb-1.5 font-extrabold" style={{ color: "var(--ink)" }}>
              {davrlar[hover].nomi}
            </div>
            {seriyalar.map((s) => (
              <div key={s.kalit} className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5" style={{ color: "var(--ink-2)" }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.rang }} />
                  {s.nomi}
                </span>
                <span className="font-bold tabular-nums" style={{ color: "var(--ink)" }}>
                  {son(s.qiymatlar[hover])}
                  {s.sonlar[hover] ? (
                    <span className="ml-1 font-medium" style={{ color: "var(--muted)" }}>
                      (n={s.sonlar[hover]})
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
