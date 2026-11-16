"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CornerDownLeft, FileText, Languages, LogOut, Monitor, Moon, Plus, Search, Sun, Upload, UserRound, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useFoydalanuvchi } from "@/components/auth/FoydalanuvchiProvider";
import { chiqish } from "@/components/auth/ProfilView";
import { useTil } from "@/components/i18n/TilProvider";
import { TILLAR, type Mavzu } from "@/lib/i18n/til";
import type { Material } from "@/lib/types";
import { korinadiganBolimlar } from "./bolimlar";

const HODISA = "mp:qidiruv";

/** Qidiruv oynasini istalgan joydan ochish (yon menyudagi tugma, telefon paneli). */
export function qidiruvniOchish() {
  window.dispatchEvent(new Event(HODISA));
}

type Guruh = "bolim" | "material" | "amal";
interface Qator {
  id: string;
  guruh: Guruh;
  nomi: string;
  izoh?: string;
  belgi: LucideIcon;
  bajar: () => void;
}

const kichik = (s: string) => s.toLocaleLowerCase().replace(/[‘’ʻʼ`']/g, "'");

/** Tezkor qidiruv (Ctrl+K): bo‘limlar, materiallar (administrator) va amallar — klaviaturadan boshqariladi. */
export function Buyruqlar() {
  const { f, admin } = useFoydalanuvchi();
  const materialQidiruvi = f?.rol === "admin" || f?.rol === "ekspert";
  const { t, til, setTil, mavzu, setMavzu } = useTil();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [ochiq, setOchiq] = useState(false);
  const [q, setQ] = useState("");
  const [faol, setFaol] = useState(0);
  const [materiallar, setMateriallar] = useState<Material[]>([]);
  const [izlanmoqda, setIzlanmoqda] = useState(false);
  const royxat = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // e.code — klaviatura tartibidan qat’i nazar (kirill tartibida ham ishlaydi)
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.code === "KeyK") {
        e.preventDefault();
        setOchiq((o) => !o);
      }
    };
    const onOch = () => setOchiq(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(HODISA, onOch);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(HODISA, onOch);
    };
  }, []);

  useEffect(() => {
    if (!ochiq) {
      setQ("");
      setMateriallar([]);
      return;
    }
    const oldingi = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = oldingi;
    };
  }, [ochiq]);

  // Materiallar serverda qidiriladi (sarlavha, lid, matn) — yozish to‘xtagach
  useEffect(() => {
    const soz = q.trim();
    if (!ochiq || !materialQidiruvi || soz.length < 2) {
      setMateriallar([]);
      setIzlanmoqda(false);
      return;
    }
    const ctrl = new AbortController();
    setIzlanmoqda(true);
    const taymer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/materiallar?q=${encodeURIComponent(soz)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const d = (await res.json()) as Material[];
        setMateriallar(d.slice(0, 8));
      } catch {
        if (!ctrl.signal.aborted) setMateriallar([]);
      } finally {
        if (!ctrl.signal.aborted) setIzlanmoqda(false);
      }
    }, 220);
    return () => {
      ctrl.abort();
      window.clearTimeout(taymer);
    };
  }, [q, ochiq, materialQidiruvi]);

  const yop = useCallback(() => setOchiq(false), []);
  const ot = useCallback(
    (href: string) => {
      setOchiq(false);
      router.push(href);
    },
    [router],
  );

  const elementlar = useMemo<Qator[]>(() => {
    if (!f) return [];
    const mavzuNomi: Record<Mavzu, string> = { light: t("nav.yorug"), system: t("nav.tizim"), dark: t("nav.qorongi") };
    const mavzuBelgi: Record<Mavzu, LucideIcon> = { light: Sun, system: Monitor, dark: Moon };
    const hammasi: Qator[] = [
      ...korinadiganBolimlar(f.rol).map((b) => ({
        id: `b:${b.href}`,
        guruh: "bolim" as const,
        nomi: t(b.kalit),
        belgi: b.belgi,
        bajar: () => ot(b.href),
      })),
      ...materiallar.map((m) => ({
        id: `m:${m.id}`,
        guruh: "material" as const,
        nomi: m.sarlavha,
        izoh: [m.nashr, m.sana].filter(Boolean).join(" · "),
        belgi: FileText,
        bajar: () => ot(`/tahlil/${m.id}`),
      })),
      ...(admin
        ? [
            { id: "a:yangi", guruh: "amal" as const, nomi: t("bq.yangiMaterial"), belgi: Plus, bajar: () => ot("/mediabaza?yangi=1") },
            { id: "a:import", guruh: "amal" as const, nomi: t("nav.import"), belgi: Upload, bajar: () => ot("/mediabaza/import") },
          ]
        : []),
      ...(["light", "dark", "system"] as Mavzu[])
        .filter((m) => m !== mavzu)
        .map((m) => ({
          id: `a:mavzu:${m}`,
          guruh: "amal" as const,
          nomi: t("bq.mavzu", { v: mavzuNomi[m] }),
          belgi: mavzuBelgi[m],
          bajar: () => {
            setOchiq(false);
            setMavzu(m);
          },
        })),
      ...TILLAR.filter((x) => x.kod !== til).map((x) => ({
        id: `a:til:${x.kod}`,
        guruh: "amal" as const,
        nomi: t("bq.til", { v: x.nomi }),
        belgi: Languages,
        bajar: () => {
          setOchiq(false);
          setTil(x.kod);
        },
      })),
      { id: "a:profil", guruh: "amal" as const, nomi: t("au.profil"), belgi: UserRound, bajar: () => ot("/profil") },
      { id: "a:chiqish", guruh: "amal" as const, nomi: t("au.chiqish"), belgi: LogOut, bajar: () => void chiqish() },
    ];
    const soz = kichik(q.trim());
    if (!soz) return hammasi;
    // Materiallarni server allaqachon saralagan; qolganlari nomi bo‘yicha
    return hammasi.filter((e) => e.guruh === "material" || kichik(`${e.nomi} ${e.izoh ?? ""}`).includes(soz));
  }, [f, admin, materiallar, q, t, til, mavzu, ot, setMavzu, setTil]);

  useEffect(() => setFaol(0), [q]);
  useEffect(() => {
    if (faol >= elementlar.length) setFaol(Math.max(0, elementlar.length - 1));
  }, [elementlar.length, faol]);
  useEffect(() => {
    royxat.current?.querySelector(`[data-indeks="${faol}"]`)?.scrollIntoView({ block: "nearest" });
  }, [faol]);

  function klaviatura(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      yop();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFaol((i) => (elementlar.length ? (i + 1) % elementlar.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFaol((i) => (elementlar.length ? (i - 1 + elementlar.length) % elementlar.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      elementlar[faol]?.bajar();
    }
  }

  if (!mounted || !f) return null;

  const guruhNomi: Record<Guruh, string> = { bolim: t("bq.bolimlar"), material: t("bq.materiallar"), amal: t("bq.amallar") };
  const guruhlar = (["bolim", "material", "amal"] as Guruh[])
    .map((g) => ({ g, el: elementlar.map((e, i) => ({ e, i })).filter((x) => x.e.guruh === g) }))
    .filter((x) => x.el.length);
  const materialIzohi = materialQidiruvi && q.trim().length < 2;

  return createPortal(
    <AnimatePresence>
      {ochiq && (
        <div className="fixed inset-0 z-[95] flex items-start justify-center px-3 pt-[10vh]" onKeyDown={klaviatura}>
          <motion.div
            className="parda absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={yop}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.qidirish")}
            className="buyruq-oyna relative w-full max-w-[640px] overflow-hidden"
            initial={{ opacity: 0, scale: 0.95, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6, transition: { duration: 0.14 } }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          >
            <div className="flex items-center gap-3 px-5 py-4">
              <Search size={19} strokeWidth={2.3} style={{ color: "var(--brand)" }} className="flex-none" />
              <input
                type="text"
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("bq.placeholder")}
                className="buyruq-input"
                aria-label={t("nav.qidirish")}
                role="combobox"
                aria-expanded="true"
                aria-controls="buyruq-royxat"
                aria-activedescendant={elementlar[faol] ? `bq-${faol}` : undefined}
              />
              {izlanmoqda && <span className="buyruq-aylana" aria-label={t("bq.qidirilmoqda")} />}
              <span className="kbd flex-none">Esc</span>
            </div>
            <div className="h-px" style={{ background: "var(--line)" }} />

            <div ref={royxat} id="buyruq-royxat" role="listbox" className="scroll-thin max-h-[min(56vh,460px)] overflow-y-auto p-2">
              {guruhlar.map(({ g, el }) => (
                <div key={g} className="mb-1.5">
                  <div className="eyebrow px-3 pb-1.5 pt-2.5">{guruhNomi[g]}</div>
                  {el.map(({ e, i }) => {
                    const Belgi = e.belgi;
                    const tanlangan = i === faol;
                    return (
                      <button
                        key={e.id}
                        id={`bq-${i}`}
                        data-indeks={i}
                        role="option"
                        aria-selected={tanlangan}
                        className="buyruq-qator"
                        onMouseMove={() => !tanlangan && setFaol(i)}
                        onClick={e.bajar}
                      >
                        {tanlangan && (
                          <motion.span
                            layoutId="bq-faol"
                            className="absolute inset-0 rounded-[12px]"
                            style={{
                              background: "color-mix(in oklab, var(--brand) 12%, transparent)",
                              boxShadow: "inset 0 0 0 1px color-mix(in oklab, var(--brand) 35%, transparent)",
                            }}
                            transition={{ type: "spring", stiffness: 500, damping: 38 }}
                          />
                        )}
                        <span className="buyruq-belgi" data-faol={tanlangan}>
                          <Belgi size={16} strokeWidth={2.2} />
                        </span>
                        <span className="relative min-w-0 flex-1 text-left">
                          <span className="block truncate text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>
                            {e.nomi}
                          </span>
                          {e.izoh && (
                            <span className="block truncate text-[12px]" style={{ color: "var(--muted)" }}>
                              {e.izoh}
                            </span>
                          )}
                        </span>
                        {tanlangan && <CornerDownLeft size={15} className="relative flex-none" style={{ color: "var(--muted)" }} />}
                      </button>
                    );
                  })}
                </div>
              ))}
              {!elementlar.length && !izlanmoqda && (
                <p className="hint px-3 py-10 text-center">{t("bq.topilmadi")}</p>
              )}
              {materialIzohi && <p className="hint px-3 pb-2 pt-1">{t("bq.materialIzlash")}</p>}
            </div>

            <div className="flex items-center justify-between gap-3 border-t px-5 py-2.5 text-[11.5px]" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
              <span>{t("bq.yordam")}</span>
              <span className="text-aurora font-bold">MediaPrag</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
