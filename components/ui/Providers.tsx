"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

import { TilProvider } from "@/components/i18n/TilProvider";
import type { Mavzu, Til } from "@/lib/i18n/til";
import { ToastProvider } from "./Toast";

export function Providers({ til, mavzu, children }: { til: Til; mavzu: Mavzu; children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <TilProvider til={til} mavzu={mavzu}>
        <ToastProvider>{children}</ToastProvider>
      </TilProvider>
    </MotionConfig>
  );
}
