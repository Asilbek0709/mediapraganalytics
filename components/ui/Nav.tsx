"use client";

import { AnimatePresence, motion, useScroll, useSpring } from "framer-motion";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useFoydalanuvchi } from "@/components/auth/FoydalanuvchiProvider";
import { chiqish } from "@/components/auth/ProfilView";
import { useTil } from "@/components/i18n/TilProvider";
import { MENYU_COOKIE, type MenyuHolati } from "@/lib/menyu";
import { boshSahifa } from "@/lib/ruxsat";
import { boshHarflar, faolmi, korinadiganBolimlar } from "./bolimlar";
import { qidiruvniOchish } from "./Buyruqlar";
import { Sozlamalar } from "./Sozlamalar";

const pill = { type: "spring", stiffness: 380, damping: 32 } as const;

function Logo({ katta = false }: { katta?: boolean }) {
  return (
    <motion.span
      className={`logo-mark ${katta ? "logo-mark-katta" : ""}`}
      whileHover={{ rotate: -8, scale: 1.08 }}
      transition={{ type: "spring", stiffness: 400, damping: 14 }}
      aria-hidden
    >
      MP
    </motion.span>
  );
}

/** Ctrl+K yoki Mac’da ⌘K — sahifa yuklangandan keyin aniqlanadi. */
function useQisqaTugma() {
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  return mac ? "⌘K" : "Ctrl K";
}

/** Yon menyu ichi — kompyuterdagi panel ham, telefondagi chiquvchi oyna ham shuni ko‘rsatadi. */
function MenyuIchi({ turi, yigiq, almashtir }: { turi: "sb" | "drawer"; yigiq: boolean; almashtir?: () => void }) {
  const pathname = usePathname();
  const { t } = useTil();
  const { f } = useFoydalanuvchi();
  const qisqa = useQisqaTugma();
  if (!f) return null;
  const bolimlar = korinadiganBolimlar(f.rol);
  const sarlavha = (matn: string) => (yigiq ? matn : undefined);

  return (
    <>
      <div className="sb-ust flex items-center gap-3 px-4 pb-3 pt-4">
        <Link href={boshSahifa(f.rol)} className="flex min-w-0 items-center gap-3 no-underline" title={sarlavha("MediaPrag-Analytics")}>
          <Logo />
          <span className="sb-yozuv leading-tight">
            <span className="block text-[15.5px] font-extrabold tracking-tight" style={{ color: "var(--ink)" }}>
              MediaPrag
            </span>
            <span className="text-aurora block text-[11.5px] font-bold tracking-wide">Analytics</span>
          </span>
        </Link>
        {turi === "sb" && almashtir && (
          <button className="icon-btn sb-faqat-yoyiq ml-auto" onClick={almashtir} title={t("nav.menyuYigish")} aria-label={t("nav.menyuYigish")}>
            <PanelLeftClose size={18} />
          </button>
        )}
      </div>

      {turi === "sb" && almashtir && (
        <div className="sb-faqat-yigiq px-4 pb-2">
          <button className="icon-btn mx-auto" onClick={almashtir} title={t("nav.menyuYoyish")} aria-label={t("nav.menyuYoyish")} style={{ display: "grid" }}>
            <PanelLeftOpen size={18} />
          </button>
        </div>
      )}

      <div className="px-3 pb-3">
        <button className="sb-qidiruv" onClick={qidiruvniOchish} title={sarlavha(`${t("nav.qidirish")} (${qisqa})`)} aria-label={t("nav.qidirish")}>
          <Search size={16} strokeWidth={2.3} className="flex-none" />
          <span className="sb-yozuv flex-1 text-left">{t("nav.qidirish")}…</span>
          <span className="sb-yozuv kbd">{qisqa}</span>
        </button>
      </div>

      <nav className="scroll-thin flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-3 pb-3">
        {bolimlar.map(({ href, kalit, belgi: Belgi }, i) => {
          const faol = faolmi(href, pathname);
          return (
            <div key={href} className="sb-kirish" style={{ animationDelay: `${0.04 * i}s` }}>
              <Link href={href} className="sb-link" data-faol={faol} title={sarlavha(t(kalit))} aria-current={faol ? "page" : undefined}>
                {faol && (
                  <motion.span
                    layoutId={`${turi}-pill`}
                    className="absolute inset-0 -z-10 rounded-[13px]"
                    style={{ background: "var(--brand-grad)", boxShadow: "var(--glow)" }}
                    transition={pill}
                  />
                )}
                <Belgi size={19} strokeWidth={2.1} />
                <span className="sb-yozuv">{t(kalit)}</span>
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="flex flex-col gap-3 border-t px-3 pb-3 pt-3" style={{ borderColor: "var(--line)" }}>
        <div className="sb-faqat-yoyiq">
          <Sozlamalar id={turi} />
        </div>
        {turi === "sb" && (
          <div className="sb-faqat-yigiq">
            <Sozlamalar ixcham />
          </div>
        )}
        <div className="sb-foydalanuvchi">
          <Link href="/profil" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[13px] p-1.5 no-underline sb-profil" title={t("au.profil")}>
            <span className="avatar">{boshHarflar(f.ism)}</span>
            <span className="sb-yozuv min-w-0 leading-tight">
              <span className="block truncate text-[13px] font-bold" style={{ color: "var(--ink)" }}>
                {f.ism}
              </span>
              <span className="block text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>
                {t(`au.rol.${f.rol}`)}
              </span>
            </span>
          </Link>
          <button className="icon-btn flex-none" onClick={chiqish} title={t("au.chiqish")} aria-label={t("au.chiqish")}>
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </>
  );
}

export function Nav({ menyu }: { menyu: MenyuHolati }) {
  const { f } = useFoydalanuvchi();
  const { t } = useTil();
  const pathname = usePathname();
  const [yigiq, setYigiq] = useState(menyu === "yigiq");
  const [ochiq, setOchiq] = useState(false);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 26, restDelta: 0.001 });

  // Sahifa almashganda telefondagi menyu yopiladi
  useEffect(() => setOchiq(false), [pathname]);

  useEffect(() => {
    if (!ochiq) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOchiq(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ochiq]);

  if (!f) return null;

  function almashtir() {
    const yangi = !yigiq;
    setYigiq(yangi);
    if (yangi) document.documentElement.setAttribute("data-menyu", "yigiq");
    else document.documentElement.removeAttribute("data-menyu");
    document.cookie = `${MENYU_COOKIE}=${yangi ? "yigiq" : "yoyiq"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <>
      <motion.div
        className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px] origin-left"
        style={{ scaleX: progress, background: "var(--aurora)" }}
        aria-hidden
      />

      {/* Kompyuter: chapdagi suzuvchi shisha panel */}
      <aside className="sidebar hidden lg:flex" aria-label={t("nav.menyu")}>
        <MenyuIchi turi="sb" yigiq={yigiq} almashtir={almashtir} />
      </aside>

      {/* Telefon va planshet: yuqori panel + chiquvchi menyu */}
      <header className="mobil-panel flex lg:hidden">
        <button className="icon-btn" onClick={() => setOchiq(true)} aria-label={t("nav.menyu")} aria-expanded={ochiq}>
          <Menu size={20} />
        </button>
        <Link href={boshSahifa(f.rol)} className="flex items-center gap-2.5 no-underline">
          <Logo />
          <span className="text-[15px] font-extrabold tracking-tight" style={{ color: "var(--ink)" }}>
            MediaPrag
          </span>
        </Link>
        <button className="icon-btn ml-auto" onClick={qidiruvniOchish} aria-label={t("nav.qidirish")}>
          <Search size={19} />
        </button>
      </header>

      <AnimatePresence>
        {ochiq && (
          <div className="fixed inset-0 z-[80] lg:hidden">
            <motion.div
              className="absolute inset-0"
              style={{ background: "rgba(5, 6, 13, 0.55)", backdropFilter: "blur(4px)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOchiq(false)}
            />
            <motion.aside
              className="drawer"
              aria-label={t("nav.menyu")}
              initial={{ x: "-105%" }}
              animate={{ x: 0 }}
              exit={{ x: "-105%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
            >
              <button className="icon-btn absolute right-3 top-4 z-10" onClick={() => setOchiq(false)} aria-label={t("u.yopish")}>
                <X size={19} />
              </button>
              <MenyuIchi turi="drawer" yigiq={false} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
