"use client";

import type { Transition, Variants } from "framer-motion";

/** Butun ilovada bir xil ishlatiladigan animatsiya sozlamalari. */

export const spring: Transition = { type: "spring", stiffness: 280, damping: 28, mass: 0.8 };
export const softSpring: Transition = { type: "spring", stiffness: 160, damping: 22 };
export const ease = [0.22, 1, 0.36, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.35, ease } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 10 },
  show: { opacity: 1, scale: 1, y: 0, transition: spring },
  exit: { opacity: 0, scale: 0.96, y: 6, transition: { duration: 0.15 } },
};

export const stagger = (delay = 0.06, boshlash = 0.04): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: delay, delayChildren: boshlash } },
});

export const rowIn: Variants = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease } },
  exit: { opacity: 0, x: 12, transition: { duration: 0.18 } },
};

export const pressable = {
  whileHover: { y: -1 },
  whileTap: { scale: 0.97 },
  transition: spring,
};
