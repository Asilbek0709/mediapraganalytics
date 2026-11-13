"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";

import { tarjimon, type Tarjimon } from "@/lib/i18n";
import { MAVZU_COOKIE, TIL_COOKIE, type Mavzu, type Til } from "@/lib/i18n/til";

interface TilKonteksti extends Tarjimon {
  setTil: (til: Til) => void;
  almashmoqda: boolean;
  mavzu: Mavzu;
  setMavzu: (mavzu: Mavzu, nuqta?: { x: number; y: number }) => void;
}

const Kontekst = createContext<TilKonteksti | null>(null);

export function useTil(): TilKonteksti {
  const k = useContext(Kontekst);
  if (!k) throw new Error("useTil faqat TilProvider ichida ishlaydi");
  return k;
}

function cookieYozish(nom: string, qiymat: string) {
  document.cookie = `${nom}=${qiymat}; path=/; max-age=31536000; samesite=lax`;
}

function mavzuniQollash(mavzu: Mavzu) {
  const el = document.documentElement;
  if (mavzu === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", mavzu);
}

type ViewTransitionHujjat = Document & {
  startViewTransition?: (fn: () => void) => {
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
    skipTransition: () => void;
  };
};

export function TilProvider({ til: boshTil, mavzu: boshMavzu, children }: { til: Til; mavzu: Mavzu; children: ReactNode }) {
  const router = useRouter();
  const [til, setTilHolat] = useState<Til>(boshTil);
  const [mavzu, setMavzuHolat] = useState<Mavzu>(boshMavzu);
  const [almashmoqda, startTransition] = useTransition();

  // Server yangi til bilan qayta chizganda holatni moslashtirish
  useEffect(() => setTilHolat(boshTil), [boshTil]);

  const setTil = useCallback(
    (yangi: Til) => {
      cookieYozish(TIL_COOKIE, yangi);
      document.documentElement.lang = yangi;
      setTilHolat(yangi);
      // Server komponentlari (sarlavhalar, jadvallar) yangi tilda qayta chiziladi
      startTransition(() => router.refresh());
    },
    [router],
  );

  const setMavzu = useCallback((yangi: Mavzu, nuqta?: { x: number; y: number }) => {
    cookieYozish(MAVZU_COOKIE, yangi);
    let bajarildi = false;
    const qollash = () => {
      if (bajarildi) return;
      bajarildi = true;
      mavzuniQollash(yangi);
      setMavzuHolat(yangi);
    };
    const hujjat = document as ViewTransitionHujjat;
    const kamHarakat = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!hujjat.startViewTransition || kamHarakat || document.visibilityState !== "visible") {
      qollash();
      return;
    }
    // Yangi mavzu tugmadan boshlab aylana shaklida ochiladi (View Transitions API)
    const otish = hujjat.startViewTransition(qollash);
    // Sahifa kadr chizmasa (yashirin yoki kichraytirilgan oyna), o‘tish callback’ni kechiktiradi —
    // bunda animatsiyasiz darhol qo‘llanadi
    const zaxira = window.setTimeout(() => {
      otish.skipTransition();
      qollash();
    }, 300);
    otish.updateCallbackDone.finally(() => window.clearTimeout(zaxira)).catch(() => {});
    otish.ready
      .then(() => {
        const x = nuqta?.x ?? window.innerWidth - 60;
        const y = nuqta?.y ?? 30;
        const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
          { duration: 600, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
        );
      })
      .catch(() => {});
  }, []);

  const qiymat = useMemo<TilKonteksti>(
    () => ({ ...tarjimon(til), setTil, almashmoqda, mavzu, setMavzu }),
    [til, setTil, almashmoqda, mavzu, setMavzu],
  );

  return <Kontekst.Provider value={qiymat}>{children}</Kontekst.Provider>;
}
