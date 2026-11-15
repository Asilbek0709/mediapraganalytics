"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card } from "./Card";

/** Ko‘rsatkich kartasi: yozuv, rangli belgi, katta raqam; sichqoncha tomonga biroz og‘adi. */
export function Kpi({
  label,
  belgi: Belgi,
  izoh,
  aurora = false,
  children,
}: {
  label: string;
  belgi?: LucideIcon;
  izoh?: ReactNode;
  /** raqam rangli gradientda (sahifadagi asosiy ko‘rsatkich uchun) */
  aurora?: boolean;
  children: ReactNode;
}) {
  return (
    <Card className="!p-5" egilish>
      <div className="flex items-start justify-between gap-3">
        <div className="eyebrow pt-1.5">{label}</div>
        {Belgi && (
          <span className="kpi-belgi flex-none" aria-hidden>
            <Belgi size={18} strokeWidth={2.2} />
          </span>
        )}
      </div>
      <div
        className={`mt-1 flex min-w-0 items-center gap-3 text-[34px] font-extrabold leading-tight tracking-tight ${aurora ? "text-aurora" : ""}`}
        style={aurora ? undefined : { color: "var(--ink)" }}
      >
        {children}
      </div>
      {izoh && (
        <div className="mt-2 text-[12.5px]" style={{ color: "var(--muted)" }}>
          {izoh}
        </div>
      )}
    </Card>
  );
}
