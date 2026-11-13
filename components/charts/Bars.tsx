"use client";

import { motion } from "framer-motion";

import { useTil } from "@/components/i18n/TilProvider";
import { spring } from "@/components/ui/motion";

export interface BarItem {
  nomi: string;
  qiymat: number | null;
  rang: string;
  izoh?: string;
}

/** Gorizontal ustunlar: nomi — ustun — qiymat. */
export function BarsH({
  items,
  max = 100,
  suffix = "",
  nomKengligi = 150,
}: {
  items: BarItem[];
  max?: number;
  suffix?: string;
  nomKengligi?: number;
}) {
  const { t, son } = useTil();
  if (!items.length) return <p className="hint py-6 text-center">{t("u.malumotYoq")}</p>;
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((it, i) => (
        <div
          key={it.nomi}
          title={it.izoh}
          className="grid items-center gap-3"
          style={{ gridTemplateColumns: `minmax(84px, ${nomKengligi}px) 1fr auto` }}
        >
          <span className="truncate text-[13px] font-semibold" style={{ color: "var(--ink-2)" }}>
            {it.nomi}
          </span>
          <div
            className="relative h-[18px] overflow-hidden rounded-full"
            style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
          >
            <motion.div
              className="absolute inset-y-0 left-0"
              style={{ background: it.rang, borderRadius: "0 4px 4px 0" }}
              initial={{ width: 0 }}
              whileInView={{ width: `${Math.max(0, Math.min(100, ((it.qiymat ?? 0) / max) * 100))}%` }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ ...spring, delay: 0.05 + i * 0.055 }}
            />
          </div>
          <span className="w-[54px] text-right text-[13px] font-bold tabular-nums" style={{ color: "var(--ink)" }}>
            {son(it.qiymat)}
            {it.qiymat == null ? "" : suffix}
          </span>
        </div>
      ))}
    </div>
  );
}

export interface Seriya {
  nomi: string;
  rang: string;
  qiymatlar: (number | null)[];
}

/** Vertikal guruhlangan ustunlar (SVG). */
export function GroupedBars({
  belgilar,
  seriyalar,
  max = 100,
  balandlik = 260,
}: {
  belgilar: string[];
  seriyalar: Seriya[];
  max?: number;
  balandlik?: number;
}) {
  const { son } = useTil();
  const W = 620;
  const H = balandlik;
  const pastki = 30;
  const chap = 36;
  const ustki = 12;
  const grafikH = H - pastki - ustki;
  const grafikW = W - chap - 10;
  const guruhKengligi = grafikW / belgilar.length;
  const ustunKengligi = Math.min(26, (guruhKengligi - 14) / seriyalar.length);
  const yTicks = [0, 20, 40, 60, 80, 100];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={belgilar.join(", ")}>
      {yTicks.map((t) => {
        const y = ustki + grafikH - (t / max) * grafikH;
        return (
          <g key={t}>
            <line x1={chap} x2={W - 10} y1={y} y2={y} stroke="var(--grid)" strokeWidth={1} />
            <text x={chap - 8} y={y + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
              {t}
            </text>
          </g>
        );
      })}
      {belgilar.map((belgi, gi) => {
        const guruhX = chap + gi * guruhKengligi;
        const jamiKenglik = ustunKengligi * seriyalar.length + 2 * (seriyalar.length - 1);
        const boshlanish = guruhX + (guruhKengligi - jamiKenglik) / 2;
        return (
          <g key={belgi}>
            {seriyalar.map((s, si) => {
              const qiymat = s.qiymatlar[gi] ?? 0;
              const h = Math.max(0, (qiymat / max) * grafikH);
              const x = boshlanish + si * (ustunKengligi + 2);
              return (
                <motion.rect
                  key={s.nomi}
                  x={x}
                  width={ustunKengligi}
                  rx={4}
                  fill={s.rang}
                  initial={{ height: 0, y: ustki + grafikH }}
                  whileInView={{ height: h, y: ustki + grafikH - h }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ ...spring, delay: 0.08 + gi * 0.07 + si * 0.04 }}
                >
                  <title>{`${s.nomi} · ${belgi}: ${son(s.qiymatlar[gi])}`}</title>
                </motion.rect>
              );
            })}
            <text
              x={guruhX + guruhKengligi / 2}
              y={H - 10}
              textAnchor="middle"
              fontSize={12}
              fontWeight={600}
              fill="var(--muted)"
            >
              {belgi}
            </text>
          </g>
        );
      })}
      <line x1={chap} x2={W - 10} y1={ustki + grafikH} y2={ustki + grafikH} stroke="var(--line-strong)" strokeWidth={1.5} />
    </svg>
  );
}

/** Bitta seriya: vertikal ustunlar (daraja taqsimoti uchun). */
export function ColumnBars({
  items,
  balandlik = 230,
}: {
  items: { nomi: string; qiymat: number; rang: string; izoh?: string }[];
  balandlik?: number;
}) {
  const max = Math.max(1, ...items.map((i) => i.qiymat));
  return (
    <div className="flex items-end gap-3" style={{ height: balandlik }}>
      {items.map((it, i) => (
        <div key={it.nomi} className="flex h-full flex-1 flex-col items-center justify-end gap-2" title={it.izoh}>
          <span className="text-[13px] font-bold tabular-nums" style={{ color: "var(--ink)" }}>
            {it.qiymat}
          </span>
          <motion.div
            className="w-full rounded-t-[6px]"
            style={{ background: it.rang, minHeight: 2 }}
            initial={{ height: 0 }}
            whileInView={{ height: `${(it.qiymat / max) * 78}%` }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ ...spring, delay: 0.06 * i }}
          />
          <span className="text-center text-[11.5px] font-semibold leading-tight" style={{ color: "var(--muted)" }}>
            {it.nomi}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { nomi: string; rang: string }[] }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <span key={it.nomi} className="inline-flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: "var(--ink-2)" }}>
          <span className="h-3 w-3 rounded-[3px]" style={{ background: it.rang }} />
          {it.nomi}
        </span>
      ))}
    </div>
  );
}
