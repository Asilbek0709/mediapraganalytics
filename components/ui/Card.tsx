"use client";

import { motion, useReducedMotion, useSpring, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

import { fadeUp, stagger } from "./motion";

interface CardProps extends Omit<HTMLMotionProps<"section">, "title"> {
  children: ReactNode;
  className?: string;
  koarish?: boolean;
  /** sichqoncha tomonga biroz og‘adi (3D) — kichik ko‘rsatkich kartalari uchun */
  egilish?: boolean;
}

const EGILISH = 7; // daraja
const egilishPrujinasi = { stiffness: 220, damping: 20, mass: 0.6 };

/** Sahifaga chiqishda pastdan suzib chiqadigan shisha karta (yoritish va soya — CSS’da). */
export function Card({ children, className = "", koarish = true, egilish = false, style, onPointerMove, onPointerLeave, ...rest }: CardProps) {
  const kamHarakat = useReducedMotion();
  const rx = useSpring(0, egilishPrujinasi);
  const ry = useSpring(0, egilishPrujinasi);
  const faol = egilish && !kamHarakat;

  return (
    <motion.section
      variants={fadeUp}
      whileHover={koarish ? { y: -3 } : undefined}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`card ${className}`}
      style={faol ? { ...style, rotateX: rx, rotateY: ry, transformPerspective: 900 } : style}
      onPointerMove={(e) => {
        if (faol && e.pointerType === "mouse") {
          const r = e.currentTarget.getBoundingClientRect();
          ry.set(((e.clientX - r.left) / r.width - 0.5) * EGILISH * 2);
          rx.set(-((e.clientY - r.top) / r.height - 0.5) * EGILISH * 2);
        }
        onPointerMove?.(e);
      }}
      onPointerLeave={(e) => {
        if (faol) {
          rx.set(0);
          ry.set(0);
        }
        onPointerLeave?.(e);
      }}
      {...rest}
    >
      {children}
    </motion.section>
  );
}

/** Bolalarini navbatma-navbat (stagger) ko‘rsatadigan konteyner. */
export function Stagger({
  children,
  className = "",
  delay = 0.06,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div variants={stagger(delay)} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  );
}

/** Ekranga kirganda ko‘rinadigan blok (scroll reveal). */
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={stagger(0.08)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function CardHead({
  title,
  izoh,
  chap,
  ong,
}: {
  title: string;
  izoh?: string;
  chap?: ReactNode;
  ong?: ReactNode;
}) {
  return (
    <div className="card-title">
      <div className="flex min-w-0 items-baseline gap-3">
        {chap}
        <div className="min-w-0">
          <h2>{title}</h2>
          {izoh && <p className="hint mt-1">{izoh}</p>}
        </div>
      </div>
      {ong}
    </div>
  );
}
