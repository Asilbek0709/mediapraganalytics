"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

import { FoydalanuvchiProvider, type FoydalanuvchiKorinish } from "@/components/auth/FoydalanuvchiProvider";
import { TilProvider } from "@/components/i18n/TilProvider";
import type { Mavzu, Til } from "@/lib/i18n/til";
import { ToastProvider } from "./Toast";

export function Providers({
  til,
  mavzu,
  foydalanuvchi,
  children,
}: {
  til: Til;
  mavzu: Mavzu;
  foydalanuvchi: FoydalanuvchiKorinish | null;
  children: ReactNode;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <TilProvider til={til} mavzu={mavzu}>
        <FoydalanuvchiProvider f={foydalanuvchi}>
          <ToastProvider>{children}</ToastProvider>
        </FoydalanuvchiProvider>
      </TilProvider>
    </MotionConfig>
  );
}
