"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { useTil } from "@/components/i18n/TilProvider";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Card, CardHead } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { pressable, spring } from "@/components/ui/motion";
import { api, xatoMatni } from "@/lib/client";
import { sana } from "@/lib/format";
import type { Kalit } from "@/lib/i18n";
import type { ImportNatijasi, ImportQatori, KoribChiqish } from "@/lib/importlash";
import type { MediaTuri } from "@/lib/types";

type Bosqich = "tanlash" | "yuklanmoqda" | "korish" | "import" | "tayyor";
type Filtr = "hammasi" | "tayyor" | "xato" | "takroriy";

const MAYDON_KALITI: Record<string, Kalit> = {
  nashr: "u.nashr",
  turi: "u.mediaTuri",
  sana: "u.sana",
  janr: "u.janr",
  mavzu: "u.mavzu",
  havola: "u.havola",
  sarlavha: "u.sarlavha",
  lid: "u.lid",
  matn: "u.matn",
};
const KORSATILADI = 300;
const QADAMLAR: Kalit[] = ["imp.q.fayl", "imp.q.tekshirish", "imp.q.import"];

function Qadamlar({ bosqich }: { bosqich: Bosqich }) {
  const { t } = useTil();
  const joriy = bosqich === "tanlash" || bosqich === "yuklanmoqda" ? 0 : bosqich === "tayyor" ? 3 : bosqich === "import" ? 2 : 1;
  return (
    <div className="flex items-center gap-2">
      {QADAMLAR.map((kalit, i) => {
        const bajarildi = i < joriy;
        const faol = i === joriy;
        return (
          <div key={kalit} className="flex items-center gap-2">
            <motion.span
              className="grid h-7 w-7 place-items-center rounded-full text-[12.5px] font-extrabold"
              animate={{
                background: bajarildi || faol ? "var(--brand-grad)" : "var(--surface-2)",
                color: bajarildi || faol ? "var(--brand-ink)" : "var(--muted)",
                scale: faol ? 1.12 : 1,
              }}
              transition={spring}
              style={{ border: "1.5px solid var(--line-strong)" }}
            >
              {bajarildi ? "✓" : i + 1}
            </motion.span>
            <span className="text-[13px] font-bold" style={{ color: faol ? "var(--ink)" : "var(--muted)" }}>
              {t(kalit)}
            </span>
            {i < QADAMLAR.length - 1 && (
              <span className="relative mx-1 h-[3px] w-10 overflow-hidden rounded-full" style={{ background: "var(--line)" }}>
                <motion.span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ background: "var(--brand-grad)" }}
                  animate={{ width: i < joriy ? "100%" : "0%" }}
                  transition={{ duration: 0.45 }}
                />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function holat(q: ImportQatori, otkazish: boolean): { belgi: string; kalit: Kalit; rang: string } {
  if (q.xatolar.length) return { belgi: "✗", kalit: "imp.h.xato", rang: "var(--lvl-0)" };
  if (q.takroriy) {
    return otkazish
      ? { belgi: "⧉", kalit: q.takroriy === "baza" ? "imp.h.bazada" : "imp.h.faylda", rang: "var(--lvl-1)" }
      : { belgi: "⧉", kalit: "imp.h.takrorQoshiladi", rang: "var(--lvl-1)" };
  }
  return { belgi: "✓", kalit: "imp.h.tayyor", rang: "var(--lvl-2)" };
}

export function ImportView() {
  const toast = useToast();
  const router = useRouter();
  const { t, x, til } = useTil();
  const inputRef = useRef<HTMLInputElement>(null);
  const [bosqich, setBosqich] = useState<Bosqich>("tanlash");
  const [sudralmoqda, setSudralmoqda] = useState(false);
  const [xato, setXato] = useState("");
  const [data, setData] = useState<KoribChiqish | null>(null);
  const [turlar, setTurlar] = useState<Record<string, MediaTuri>>({});
  const [otkazish, setOtkazish] = useState(true);
  const [filtr, setFiltr] = useState<Filtr>("hammasi");
  const [natija, setNatija] = useState<ImportNatijasi | null>(null);

  async function faylniYuborish(fayl: File) {
    setXato("");
    setBosqich("yuklanmoqda");
    const forma = new FormData();
    forma.append("fayl", fayl);
    try {
      const res = await fetch("/api/import/korib-chiqish", { method: "POST", body: forma });
      const javob = await res.json();
      if (!res.ok) throw new Error(javob?.detail ?? t("u.xatolik", { s: res.status }));
      const d = javob as KoribChiqish;
      setData(d);
      setTurlar(Object.fromEntries(d.yangiNashrlar.map((n) => [n.nomi, n.turi])));
      setFiltr(d.qatorlar.some((q) => q.xatolar.length) ? "xato" : "hammasi");
      setBosqich("korish");
    } catch (e) {
      setXato(xatoMatni(e));
      setBosqich("tanlash");
    }
  }

  const sanoq = useMemo(() => {
    const q = data?.qatorlar ?? [];
    const xatolar = q.filter((r) => r.xatolar.length).length;
    const takroriy = q.filter((r) => !r.xatolar.length && r.takroriy).length;
    return {
      jami: q.length,
      xato: xatolar,
      takroriy,
      tayyor: q.length - xatolar - takroriy,
      qoshiladi: q.length - xatolar - (otkazish ? takroriy : 0),
    };
  }, [data, otkazish]);

  const korinadigan = useMemo(() => {
    const q = data?.qatorlar ?? [];
    if (filtr === "xato") return q.filter((r) => r.xatolar.length);
    if (filtr === "takroriy") return q.filter((r) => !r.xatolar.length && r.takroriy);
    if (filtr === "tayyor") return q.filter((r) => !r.xatolar.length && !r.takroriy);
    return q;
  }, [data, filtr]);

  async function importQilish() {
    if (!data) return;
    setBosqich("import");
    try {
      const r = await api.post<ImportNatijasi>("/api/import", {
        // Fayldagi asl qiymatlar qaytariladi — server ularni qayta tekshiradi
        qatorlar: data.qatorlar.map((q) => ({ qator: q.qator, ...q.xom })),
        yangiNashrlar: Object.entries(turlar).map(([nomi, turi]) => ({ nomi, turi })),
        takroriylarniOtkazish: otkazish,
      });
      setNatija(r);
      setBosqich("tayyor");
      router.refresh();
    } catch (e) {
      toast(xatoMatni(e), "error");
      setBosqich("korish");
    }
  }

  function qaytaBoshlash() {
    setData(null);
    setNatija(null);
    setXato("");
    setBosqich("tanlash");
    if (inputRef.current) inputRef.current.value = "";
  }

  const sonFormat = (n: number) => n.toLocaleString(til === "en" ? "en-US" : "ru-RU");

  return (
    <div className="flex flex-col gap-5">
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/mediabaza" className="text-[12.5px] font-semibold">
            ← {t("nav.mediabaza")}
          </Link>
          <h1 className="mt-1.5">{t("imp.sarlavha")}</h1>
          <p className="hint mt-2 max-w-[74ch]">{t("imp.tavsif")}</p>
        </div>
        <Qadamlar bosqich={bosqich} />
      </motion.header>

      <AnimatePresence mode="popLayout" initial={false}>
        {(bosqich === "tanlash" || bosqich === "yuklanmoqda") && (
          <motion.div
            key="tanlash"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"
          >
            <Card koarish={false}>
              <CardHead title={t("imp.shablon")} izoh={t("imp.shablonIzoh")} />
              <ul className="mb-4 flex flex-col gap-1.5 text-[13px]">
                {Object.entries(MAYDON_KALITI).map(([k, kalit]) => (
                  <li key={k} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: k === "nashr" || k === "sarlavha" ? "var(--danger)" : "var(--line-strong)" }} />
                    <span className="font-semibold">{t(kalit)}</span>
                    {(k === "nashr" || k === "sarlavha") && <span className="tag">{t("imp.majburiy")}</span>}
                  </li>
                ))}
              </ul>
              <motion.a className="btn" href="/api/import/shablon" {...pressable}>
                {t("imp.shablonYuklash")}
              </motion.a>
              <p className="hint mt-3">{t("imp.shablonMatni")}</p>
            </Card>

            <Card koarish={false}>
              <CardHead title={t("imp.faylTanlang")} izoh={t("imp.faylCheklov")} />
              <motion.label
                onDragOver={(e) => {
                  e.preventDefault();
                  setSudralmoqda(true);
                }}
                onDragLeave={() => setSudralmoqda(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setSudralmoqda(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) faylniYuborish(f);
                }}
                animate={{
                  scale: sudralmoqda ? 1.02 : 1,
                  borderColor: sudralmoqda ? "var(--accent)" : "var(--line-strong)",
                  background: sudralmoqda ? "var(--accent-soft)" : "var(--surface-2)",
                }}
                transition={spring}
                className="relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed p-6 text-center"
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.csv,.txt"
                  className="hidden"
                  disabled={bosqich === "yuklanmoqda"}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) faylniYuborish(f);
                  }}
                />
                {bosqich === "yuklanmoqda" ? (
                  <>
                    <motion.span
                      className="h-10 w-10 rounded-full border-4"
                      style={{ borderColor: "var(--line)", borderTopColor: "var(--accent)" }}
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                    />
                    <span className="font-bold">{t("imp.oqilmoqda")}</span>
                  </>
                ) : (
                  <>
                    <motion.span
                      className="grid h-14 w-14 place-items-center rounded-2xl text-[26px]"
                      style={{ background: "var(--brand-grad)", color: "var(--brand-ink)" }}
                      animate={{ y: sudralmoqda ? -6 : [0, -4, 0] }}
                      transition={sudralmoqda ? spring : { repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
                    >
                      ⇪
                    </motion.span>
                    <span className="text-[15px] font-bold">{t("imp.tashlang")}</span>
                    <span className="hint">{t("imp.varaqIzoh")}</span>
                  </>
                )}
              </motion.label>
              <AnimatePresence>
                {xato && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 rounded-xl border-2 px-4 py-3 text-[13px] font-semibold"
                    style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
                  >
                    {xato}
                  </motion.p>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>
        )}

        {(bosqich === "korish" || bosqich === "import") && data && (
          <motion.div key="korish" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="flex flex-col gap-4">
            <Card koarish={false}>
              <CardHead
                title={data.fayl}
                izoh={[data.varaq ? t("imp.varaq", { v: data.varaq }) : null, data.kodirovka ? t("imp.kodirovka", { v: data.kodirovka }) : null]
                  .filter(Boolean)
                  .join(" · ")}
                ong={
                  <button className="btn btn-sm" onClick={qaytaBoshlash} disabled={bosqich === "import"}>
                    {t("imp.boshqaFayl")}
                  </button>
                }
              />
              <div className="flex flex-wrap gap-2">
                {data.ustunlar.map((u) => (
                  <span key={u.maydon} className="tag">
                    {t(MAYDON_KALITI[u.maydon])} ← «{u.ustun}»
                  </span>
                ))}
              </div>
              {data.tanilmagan.length > 0 && (
                <p className="hint mt-2.5">{t("imp.tanilmagan", { v: data.tanilmagan.map((u) => `«${u}»`).join(", ") })}</p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {(
                  [
                    ["imp.k.jami", sanoq.jami, "var(--ink)"],
                    ["imp.k.qoshiladi", sanoq.qoshiladi, "var(--lvl-2)"],
                    ["imp.k.xato", sanoq.xato, "var(--lvl-0)"],
                    ["imp.k.takroriy", sanoq.takroriy, "var(--lvl-1)"],
                    ["imp.k.yangiNashr", data.yangiNashrlar.length, "var(--s1)"],
                  ] as const
                ).map(([kalit, qiymat, rang]) => (
                  <div key={kalit} className="rounded-xl border px-3.5 py-3" style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}>
                    <div className="eyebrow">{t(kalit)}</div>
                    <div className="mt-1 text-[26px] font-extrabold leading-none" style={{ color: rang }}>
                      <AnimatedNumber value={qiymat} kasr={0} davomiylik={0.7} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {data.yangiNashrlar.length > 0 && (
              <Card koarish={false}>
                <CardHead title={t("imp.yangiNashrlar")} izoh={t("imp.yangiNashrlarIzoh")} />
                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                  {data.yangiNashrlar.map((n) => (
                    <div key={n.nomi} className="flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5" style={{ borderColor: "var(--line)" }}>
                      <div className="min-w-0">
                        <div className="truncate font-bold">{n.nomi}</div>
                        <div className="hint">{t("u.nMaterial", { n: n.qatorlar })}</div>
                      </div>
                      <select
                        className="!w-36"
                        value={turlar[n.nomi]}
                        onChange={(e) => setTurlar((v) => ({ ...v, [n.nomi]: e.target.value as MediaTuri }))}
                      >
                        <option value="bosma">{t("u.bosma")}</option>
                        <option value="raqamli">{t("u.raqamli")}</option>
                      </select>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card koarish={false}>
              <CardHead
                title={t("imp.qatorlar")}
                ong={
                  <Tabs
                    value={filtr}
                    onChange={setFiltr}
                    layoutId="import-filtr"
                    items={[
                      { kalit: "hammasi", nomi: t("imp.f.hammasi", { n: sanoq.jami }) },
                      { kalit: "tayyor", nomi: t("imp.f.tayyor", { n: sanoq.tayyor }) },
                      { kalit: "xato", nomi: t("imp.f.xato", { n: sanoq.xato }) },
                      { kalit: "takroriy", nomi: t("imp.f.takroriy", { n: sanoq.takroriy }) },
                    ]}
                  />
                }
              />
              <label className="mb-3 inline-flex cursor-pointer items-center gap-2.5 text-[13px] font-semibold">
                <input type="checkbox" checked={otkazish} onChange={(e) => setOtkazish(e.target.checked)} className="h-4 w-4" />
                {t("imp.otkazish")}
              </label>
              <div className="table-wrap max-h-[560px] overflow-y-auto">
                <table className="data">
                  <thead className="sticky top-0 z-10" style={{ background: "var(--surface)" }}>
                    <tr>
                      <th className="num">{t("imp.ustun.qator")}</th>
                      <th>{t("imp.ustun.holat")}</th>
                      <th>{t("u.nashr")}</th>
                      <th className="num">{t("u.sana")}</th>
                      <th>{t("u.janr")}</th>
                      <th>{t("u.sarlavha")}</th>
                      <th className="num">{t("imp.ustun.lidMatn")}</th>
                      <th>{t("imp.ustun.izoh")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {korinadigan.slice(0, KORSATILADI).map((q) => {
                      const h = holat(q, otkazish);
                      return (
                        <tr key={q.qator}>
                          <td className="num id">{q.qator}</td>
                          <td className="whitespace-nowrap">
                            <span className="badge">
                              <i style={{ background: h.rang }} />
                              {h.belgi} {t(h.kalit)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap font-semibold">{q.nashr || "—"}</td>
                          <td className="num">{sana(q.sana)}</td>
                          <td>{q.janr ?? "—"}</td>
                          <td className="min-w-[260px] max-w-[420px]">
                            <span className="line-clamp-2">{q.sarlavha || "—"}</span>
                          </td>
                          <td className="num hint">
                            {sonFormat(q.lid?.length ?? 0)} / {sonFormat(q.matn?.length ?? 0)}
                          </td>
                          <td className="min-w-[220px] text-[12.5px]">
                            {q.xatolar.map((m, i) => (
                              <div key={`x${i}`} style={{ color: "var(--danger)" }} className="font-semibold">
                                {x(m)}
                              </div>
                            ))}
                            {q.ogohlantirishlar.map((m, i) => (
                              <div key={`o${i}`} style={{ color: "var(--ink-2)" }}>
                                {x(m)}
                              </div>
                            ))}
                          </td>
                        </tr>
                      );
                    })}
                    {!korinadigan.length && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center" style={{ color: "var(--muted)" }}>
                          {t("imp.guruhBosh")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {korinadigan.length > KORSATILADI && (
                <p className="hint mt-2">{t("imp.birinchiN", { k: KORSATILADI, n: korinadigan.length })}</p>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="hint">{t("imp.xatoliIzoh")}</p>
                <motion.button className="btn btn-primary" disabled={!sanoq.qoshiladi || bosqich === "import"} onClick={importQilish} {...pressable}>
                  {bosqich === "import" ? t("imp.qilinmoqda") : t("imp.nImport", { n: sanoq.qoshiladi })}
                </motion.button>
              </div>
            </Card>
          </motion.div>
        )}

        {bosqich === "tayyor" && natija && (
          <motion.div key="tayyor" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={spring}>
            <Card koarish={false}>
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <motion.span
                  className="grid h-16 w-16 place-items-center rounded-full text-[30px] font-extrabold"
                  style={{ background: "var(--lvl-2)", color: "#fff" }}
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 14 }}
                >
                  ✓
                </motion.span>
                <div className="text-[40px] font-extrabold leading-none">
                  <AnimatedNumber value={natija.qoshildi} kasr={0} /> {t("imp.qoshildiQoldiq", { n: natija.qoshildi })}
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {natija.xato_tufayli > 0 && <span className="tag">{t("imp.xatoOtkazildi", { n: natija.xato_tufayli })}</span>}
                  {natija.takroriy_tufayli > 0 && <span className="tag">{t("imp.takrorOtkazildi", { n: natija.takroriy_tufayli })}</span>}
                  {natija.yangi_nashrlar.length > 0 && (
                    <span className="tag">{t("imp.yangiNashrlarRoyxat", { v: natija.yangi_nashrlar.join(", ") })}</span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-2.5">
                  <Link className="btn btn-primary" href="/mediabaza?holat=tahlil_qilinmagan">
                    {t("imp.mediabazagaOtish")}
                  </Link>
                  <button className="btn" onClick={qaytaBoshlash}>
                    {t("imp.yana")}
                  </button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
