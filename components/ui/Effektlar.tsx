"use client";

import { useEffect } from "react";

/**
 * Sichqoncha effektlari — butun sahifa uchun bitta tinglovchi (har bir kartaga alohida emas):
 *  • kartada sichqoncha turgan joy yoritiladi (.card --mx/--my);
 *  • asosiy tugma sichqonchaga biroz «tortiladi» (.btn-primary --tx/--ty).
 * Faqat sichqoncha uchun; «harakatni kamaytirish» yoqilgan bo‘lsa o‘chadi.
 */
const MAGNIT = 0.22;
const MAGNIT_MAX = 6;

export function Effektlar() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let kadr = 0;
    let oxirgi: PointerEvent | null = null;
    let tugma: HTMLElement | null = null;

    const qoyib = (el: HTMLElement | null) => {
      if (tugma && tugma !== el) {
        tugma.style.removeProperty("--tx");
        tugma.style.removeProperty("--ty");
      }
      tugma = el;
    };

    const ishlov = () => {
      kadr = 0;
      const e = oxirgi;
      if (!e || !(e.target instanceof Element)) return;
      const karta = e.target.closest<HTMLElement>(".card");
      if (karta) {
        const r = karta.getBoundingClientRect();
        karta.style.setProperty("--mx", `${(e.clientX - r.left).toFixed(0)}px`);
        karta.style.setProperty("--my", `${(e.clientY - r.top).toFixed(0)}px`);
      }
      const b = e.target.closest<HTMLElement>(".btn-primary:not(:disabled)");
      qoyib(b);
      if (b) {
        const r = b.getBoundingClientRect();
        const cheg = (v: number) => Math.max(-MAGNIT_MAX, Math.min(MAGNIT_MAX, v));
        b.style.setProperty("--tx", `${cheg((e.clientX - (r.left + r.width / 2)) * MAGNIT).toFixed(1)}px`);
        b.style.setProperty("--ty", `${cheg((e.clientY - (r.top + r.height / 2)) * MAGNIT).toFixed(1)}px`);
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      oxirgi = e;
      if (!kadr) kadr = requestAnimationFrame(ishlov);
    };
    const onLeave = () => qoyib(null);

    document.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      if (kadr) cancelAnimationFrame(kadr);
      qoyib(null);
    };
  }, []);

  return null;
}
