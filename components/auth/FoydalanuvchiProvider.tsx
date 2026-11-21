"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { Rol } from "@/lib/ruxsat";

/** Joriy foydalanuvchining qisqa ma’lumoti (mijozga faqat ism, rol va demo belgisi uzatiladi). */
export interface FoydalanuvchiKorinish {
  ism: string;
  rol: Rol;
  /** umumiy demo hisobi — faqat ko‘rish */
  demo?: boolean;
}

const Kontekst = createContext<FoydalanuvchiKorinish | null>(null);

export function FoydalanuvchiProvider({ f, children }: { f: FoydalanuvchiKorinish | null; children: ReactNode }) {
  return <Kontekst.Provider value={f}>{children}</Kontekst.Provider>;
}

/** Interfeysda nimani ko‘rsatish uchun (haqiqiy tekshiruv serverda): admin — tahrirlash va tahlil havolalari. */
export function useFoydalanuvchi() {
  const f = useContext(Kontekst);
  return { f, admin: f?.rol === "admin", demo: !!f?.demo };
}
