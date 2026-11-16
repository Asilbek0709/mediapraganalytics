"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

import { useTil } from "@/components/i18n/TilProvider";
import { darajaIndeks } from "@/lib/format";
import type { MezonIzohi, ShkalaOraliq } from "@/lib/types";

const RADIUS = 78;
const AYLANA = 2 * Math.PI * RADIUS;
const BOSHLANISH = 0.72; // yoyning ko‘rinadigan qismi

/** LPSI uchun yoysimon indikator: yoy to‘lib boradi, raqam sanab chiqadi. */
export function LpsiGauge({
  lpsi,
  daraja,
  shkala,
}: {
  lpsi: number | null;
  daraja: string | null;
  shkala: ShkalaOraliq[];
}) {
  const { t, son, atama } = useTil();
  const progress = useMotionValue(0);
  const yumshoq = useSpring(progress, { stiffness: 90, damping: 20, mass: 0.6 });
  const dashoffset = useTransform(yumshoq, (v) => AYLANA * (1 - (v / 100) * BOSHLANISH));

  useEffect(() => {
    progress.set(lpsi ?? 0);
  }, [lpsi, progress]);

  const i = darajaIndeks(daraja, shkala);
  const rang = i == null ? "var(--line-strong)" : `var(--lvl-${i})`;

  return (
    <div className="relative grid place-items-center" style={{ width: 196, height: 196 }}>
      <svg viewBox="0 0 196 196" className="h-full w-full -rotate-[198deg]">
        <circle
          cx="98"
          cy="98"
          r={RADIUS}
          fill="none"
          stroke="color-mix(in oklab, var(--line) 70%, transparent)"
          strokeWidth={16}
          strokeLinecap="round"
          strokeDasharray={`${AYLANA * BOSHLANISH} ${AYLANA}`}
        />
        {/* yorug‘lik: shu yoyning xiralashtirilgan nusxasi */}
        <motion.circle
          cx="98"
          cy="98"
          r={RADIUS}
          fill="none"
          stroke={rang}
          strokeWidth={16}
          strokeLinecap="round"
          strokeDasharray={`${AYLANA} ${AYLANA}`}
          className="yoy-nur"
          style={{ strokeDashoffset: dashoffset }}
        />
        <motion.circle
          cx="98"
          cy="98"
          r={RADIUS}
          fill="none"
          stroke={rang}
          strokeWidth={16}
          strokeLinecap="round"
          strokeDasharray={`${AYLANA} ${AYLANA}`}
          style={{ strokeDashoffset: dashoffset }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <motion.div
          key={lpsi ?? "yoq"}
          initial={{ opacity: 0, scale: 0.82 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="text-[46px] font-extrabold leading-none tabular-nums"
          style={{ color: "var(--ink)" }}
        >
          {lpsi == null ? "—" : son(lpsi)}
        </motion.div>
        <div className="mt-1.5 text-[11.5px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          {t("u.balldan")}
        </div>
        {daraja && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-2 text-[13px] font-extrabold"
            style={{ color: rang }}
          >
            {atama.daraja(daraja)}
          </motion.div>
        )}
      </div>
    </div>
  );
}

type MezonBall = "k1" | "k2" | "k3" | "k4" | "k5";
type NatijaQismi = {
  izohlar?: Partial<Record<string, MezonIzohi | null>>;
} & Partial<Record<MezonBall, number | null>>;

/** K1–K5 mezonlari: ingichka ustunlar, ball va formula. */
export function MezonBars({
  mezonlar,
  natija,
}: {
  mezonlar: { kod: string; nomi: string; vazn: number }[];
  natija: NatijaQismi;
}) {
  const { t, son, atama, izohMatni } = useTil();
  return (
    <div className="mt-4 flex flex-col gap-3.5">
      {mezonlar.map((m, i) => {
        const ball = natija[m.kod.toLowerCase() as MezonBall] ?? null;
        const izoh = izohMatni(natija.izohlar?.[m.kod]);
        return (
          <div key={m.kod}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                {m.kod}. {atama.mezon(m.kod, m.nomi)}
                <span className="ml-2 text-[11.5px] font-medium" style={{ color: "var(--muted)" }}>
                  {t("u.vazn", { v: son(m.vazn) })}
                </span>
              </span>
              <span className="text-[14px] font-extrabold tabular-nums" style={{ color: "var(--ink)" }}>
                {son(ball)}
              </span>
            </div>
            <div
              className="mt-1.5 h-2.5 overflow-hidden rounded-full"
              style={{ background: "color-mix(in oklab, var(--surface-2) 80%, transparent)", boxShadow: "inset 0 0 0 1px var(--line)" }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: "var(--brand-grad)", boxShadow: "0 0 12px -2px rgba(124, 58, 237, 0.6)" }}
                initial={{ width: 0 }}
                animate={{ width: `${ball ?? 0}%` }}
                transition={{ type: "spring", stiffness: 170, damping: 24, delay: 0.05 * i }}
              />
            </div>
            {izoh && (
              <motion.p
                key={izoh}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mono mt-1.5"
                style={{ color: "var(--muted)" }}
              >
                {m.kod} = {izoh}
              </motion.p>
            )}
          </div>
        );
      })}
    </div>
  );
}
