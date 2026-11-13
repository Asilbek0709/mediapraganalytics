"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

import { fadeUp, stagger } from "./motion";

interface CardProps extends Omit<HTMLMotionProps<"section">, "title"> {
  children: ReactNode;
  className?: string;
  koarish?: boolean;
}

/** Sahifaga chiqishda pastdan suzib chiqadigan karta. */
export function Card({ children, className = "", koarish = true, ...rest }: CardProps) {
  return (
    <motion.section
      variants={fadeUp}
      whileHover={koarish ? { y: -3, boxShadow: "var(--shadow-md)" } : undefined}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`card ${className}`}
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
