"use client";

import { animate, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { useTil } from "@/components/i18n/TilProvider";

interface Props {
  value: number | null | undefined;
  kasr?: number;
  davomiylik?: number;
  suffix?: string;
}

/**
 * Raqam 0 dan qiymatgacha «sanab» chiqadi.
 * Serverda va JS o‘chirilgan holatda ham to‘g‘ri qiymat ko‘rinadi — boshlang‘ich
 * holat sifatida aynan yakuniy qiymat chiqariladi.
 */
export function AnimatedNumber({ value, kasr = 1, davomiylik = 1.1, suffix = "" }: Props) {
  const { son } = useTil();
  const ref = useRef<HTMLSpanElement>(null);
  const korinmoqda = useInView(ref, { once: true, margin: "-40px" });
  const kamHarakat = useReducedMotion();
  const joriy = useRef<number | null>(null);
  const [qiymat, setQiymat] = useState<number | null>(value ?? null);

  useEffect(() => {
    if (value == null) {
      setQiymat(null);
      joriy.current = null;
      return;
    }
    if (!korinmoqda || kamHarakat) {
      setQiymat(value);
      joriy.current = value;
      return;
    }
    const boshlanish = joriy.current ?? 0;
    if (boshlanish === value) return;
    const controls = animate(boshlanish, value, {
      duration: davomiylik,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        joriy.current = v;
        setQiymat(v);
      },
      onComplete: () => {
        joriy.current = value;
      },
    });
    return () => controls.stop();
  }, [value, davomiylik, korinmoqda, kamHarakat]);

  return (
    <span ref={ref} style={{ fontVariantNumeric: "tabular-nums" }}>
      {qiymat == null ? "—" : son(qiymat, kasr)}
      {value == null ? "" : suffix}
    </span>
  );
}
