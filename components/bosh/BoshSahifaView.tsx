"use client";

import {
  ArrowRight,
  Eye,
  FileText,
  GitCompareArrows,
  GraduationCap,
  Highlighter,
  LayoutDashboard,
  Lightbulb,
  LogIn,
  Newspaper,
  Scale,
  Sigma,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useTil } from "@/components/i18n/TilProvider";
import { Kpi } from "@/components/ui/Kpi";
import { Sozlamalar } from "@/components/ui/Sozlamalar";
import type { Kalit } from "@/lib/i18n";
import type { OchiqMalumot } from "@/lib/ochiq";

const QADAMLAR: { nomi: Kalit; izoh: Kalit; belgi: LucideIcon }[] = [
  { nomi: "bh.q1", izoh: "bh.q1i", belgi: FileText },
  { nomi: "bh.q2", izoh: "bh.q2i", belgi: Highlighter },
  { nomi: "bh.q3", izoh: "bh.q3i", belgi: Scale },
  { nomi: "bh.q4", izoh: "bh.q4i", belgi: GitCompareArrows },
  { nomi: "bh.q5", izoh: "bh.q5i", belgi: Lightbulb },
];

/** Bo‘limlar ketma-ket paydo bo‘ladi — CSS animatsiyasi, kontent JavaScript’ni kutmaydi */
const kechikish = (i: number) => ({ animationDelay: `${0.06 * i}s` });

/**
 * Ochiq bosh sahifa: platforma, dissertatsiya mavzusi va muallifi, «Qanday ishlaydi», LPSI formulasi va shkalasi,
 * umumiy ko‘rsatkichlar (haqiqiy bazadan). Kirmagan — «Demo ko‘rish» / «Kirish», kirgan — «Panelga o‘tish».
 */
export function BoshSahifaView({ m, kirgan }: { m: OchiqMalumot; kirgan: boolean }) {
  const { t, til, son, atama } = useTil();
  const [ochilmoqda, setOchilmoqda] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const mavzu = m.matnlar.mavzu[til] || m.matnlar.mavzu.uz || m.matnlar.mavzu.ru || m.matnlar.mavzu.en;
  const jamiVazn = m.mezonlar.reduce((a, x) => a + x.vazn, 0) || 1;
  const darajaIndeksi = m.ortacha_daraja ? m.shkala.findIndex((s) => s.nomi === m.ortacha_daraja) : -1;

  async function demoniOchish() {
    setXato(null);
    setOchilmoqda(true);
    try {
      const res = await fetch("/api/demo", { method: "POST" });
      const j = (await res.json().catch(() => ({}))) as { yonalish?: string; detail?: string };
      if (!res.ok) throw new Error(j.detail || t("x.server"));
      // to‘liq yuklash: menyu va foydalanuvchi ma’lumoti serverdan yangidan keladi
      window.location.assign(j.yonalish ?? "/");
    } catch (e) {
      setXato(e instanceof Error ? e.message : String(e));
      setOchilmoqda(false);
    }
  }

  // Shkala: «0–40, 41–60, …» — oldingi chegaradan keyingi butun son
  let quyi = 0;
  const oraliqlar = m.shkala.map((s, i) => {
    const boshi = i === 0 ? 0 : Number.isInteger(quyi) ? quyi + 1 : quyi;
    const kenglik = Math.max(s.gacha - quyi, 1);
    quyi = s.gacha;
    return { ...s, boshi, kenglik, i };
  });
  const shkalaJami = oraliqlar.reduce((a, o) => a + o.kenglik, 0) || 1;

  return (
    <div className="bosh-sahifa flex flex-col gap-10 sm:gap-14">
      {!kirgan && (
        <header className="sahifa-kirish flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-3">
            <span className="logo-mark" aria-hidden>
              MP
            </span>
            <span className="leading-tight">
              <span className="block text-[15.5px] font-extrabold tracking-tight" style={{ color: "var(--ink)" }}>
                MediaPrag
              </span>
              <span className="text-aurora block text-[11.5px] font-bold tracking-wide">Analytics</span>
            </span>
          </span>
          <div className="ml-auto flex items-center gap-2.5">
            <div className="hidden w-[220px] sm:block">
              <Sozlamalar id="bosh" />
            </div>
            <Link className="btn" href="/kirish">
              <LogIn size={16} />
              {t("au.kirish")}
            </Link>
          </div>
          <div className="w-full sm:hidden">
            <Sozlamalar id="bosh-mobil" />
          </div>
        </header>
      )}

      {/* ---------------------------------------------------------------- hero */}
      <section className="sahifa-kirish grid items-center gap-8 lg:grid-cols-[1.35fr_1fr]" style={kechikish(1)}>
        <div className="min-w-0">
          <div className="eyebrow">{t("bh.eyebrow")}</div>
          <h1 className="bosh-sarlavha mt-3">
            MediaPrag<span className="text-aurora">-Analytics</span>
          </h1>
          <p className="mt-3 text-[17px] font-semibold" style={{ color: "var(--ink-2)" }}>
            {t("nav.brendSub")}
          </p>
          <p className="mt-3 max-w-[68ch] text-[14.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
            {t("bh.tavsif")}
          </p>

          {(mavzu || m.matnlar.muallif) && (
            <div className="bosh-mavzu mt-6">
              {mavzu && (
                <div className="flex gap-3">
                  <GraduationCap size={20} className="mt-0.5 flex-none" style={{ color: "var(--brand)" }} aria-hidden />
                  <div className="min-w-0">
                    <div className="eyebrow">{t("bh.mavzu")}</div>
                    <p className="mt-1 text-[15px] font-bold leading-snug" style={{ color: "var(--ink)" }}>
                      «{mavzu}»
                    </p>
                  </div>
                </div>
              )}
              {m.matnlar.muallif && (
                <div className={`flex gap-3 ${mavzu ? "mt-3" : ""}`}>
                  <UserRound size={20} className="mt-0.5 flex-none" style={{ color: "var(--brand)" }} aria-hidden />
                  <div className="min-w-0">
                    <div className="eyebrow">{t("bh.muallif")}</div>
                    <p className="mt-1 text-[15px] font-bold" style={{ color: "var(--ink)" }}>
                      {m.matnlar.muallif}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            {kirgan ? (
              <Link className="btn btn-primary btn-katta" href="/">
                <LayoutDashboard size={18} />
                {t("bh.panelga")}
              </Link>
            ) : (
              <>
                {m.demo && (
                  <button type="button" className="btn btn-primary btn-katta" onClick={demoniOchish} disabled={ochilmoqda}>
                    <Eye size={18} />
                    {ochilmoqda ? t("bh.demoOchilmoqda") : t("bh.demo")}
                  </button>
                )}
                <Link className={`btn btn-katta ${m.demo ? "" : "btn-primary"}`} href="/kirish">
                  <LogIn size={18} />
                  {t("au.kirish")}
                  <ArrowRight size={16} />
                </Link>
              </>
            )}
          </div>
          {!kirgan && m.demo && <p className="hint mt-2.5">{t("bh.demoIzoh")}</p>}
          {xato && (
            <p role="alert" className="mt-2.5 text-[13.5px] font-semibold" style={{ color: "var(--danger)" }}>
              {xato}
            </p>
          )}
        </div>

        {/* o‘rtacha LPSI — halqa ko‘rsatkich */}
        <div className="card bosh-halqa flex flex-col items-center !p-7 text-center">
          <div className="eyebrow">{t("bh.ortachaLpsi")}</div>
          <svg viewBox="0 0 140 140" className="mt-3 h-[168px] w-[168px]" role="img" aria-label={`${t("bh.ortachaLpsi")}: ${son(m.ortacha_lpsi)}`}>
            <circle cx="70" cy="70" r="56" fill="none" stroke="var(--line)" strokeWidth="12" />
            {m.ortacha_lpsi != null && (
              <circle
                className="bosh-halqa-yoy"
                cx="70"
                cy="70"
                r="56"
                fill="none"
                stroke={darajaIndeksi >= 0 ? `var(--lvl-${Math.min(darajaIndeksi, 3)})` : "var(--brand)"}
                strokeWidth="12"
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={`${Math.min(Math.max(m.ortacha_lpsi, 0), 100)} 100`}
                transform="rotate(-90 70 70)"
              />
            )}
            <text x="70" y="68" textAnchor="middle" dominantBaseline="middle" fontSize="30" fontWeight="800" fill="var(--ink)">
              {m.ortacha_lpsi == null ? "—" : son(m.ortacha_lpsi)}
            </text>
            <text x="70" y="94" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--muted)">
              / 100
            </text>
          </svg>
          <div className="mt-2 text-[15px] font-extrabold" style={{ color: darajaIndeksi >= 0 ? `var(--lvl-${Math.min(darajaIndeksi, 3)})` : "var(--muted)" }}>
            {m.ortacha_daraja ? atama.daraja(m.ortacha_daraja) : t("bh.haliYoq")}
          </div>
          <div className="hint mt-1">{t("bh.metodika", { v: m.metodika_versiya })}</div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- umumiy ko‘rsatkichlar */}
      <section className="sahifa-kirish" style={kechikish(2)}>
        <div className="mb-4">
          <h2 className="bosh-h2">{t("bh.korsatkichlar")}</h2>
          <p className="hint mt-1">{t("bh.korsatkichlarIzoh")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Kpi label={t("bh.materiallar")} belgi={FileText} aurora izoh={t("bh.tahlilQilingan", { n: m.tahlil_qilingan })}>
            {m.materiallar}
          </Kpi>
          <Kpi label={t("bh.nashrlar")} belgi={Newspaper} izoh={t("bh.nashrlarIzoh")}>
            {m.nashrlar}
          </Kpi>
          <Kpi
            label={t("bh.ortachaLpsi")}
            belgi={Sigma}
            izoh={m.ortacha_daraja ? atama.daraja(m.ortacha_daraja) : t("bh.haliYoq")}
          >
            {m.ortacha_lpsi == null ? "—" : son(m.ortacha_lpsi)}
          </Kpi>
        </div>
      </section>

      {/* ---------------------------------------------------------------- qanday ishlaydi */}
      <section className="sahifa-kirish" style={kechikish(3)}>
        <div className="mb-4">
          <h2 className="bosh-h2">{t("bh.qanday")}</h2>
          <p className="hint mt-1">{t("bh.qandayIzoh")}</p>
        </div>
        <ol className="bosh-qadamlar">
          {QADAMLAR.map(({ nomi, izoh, belgi: Belgi }, i) => (
            <li key={nomi} className="card bosh-qadam !p-5">
              <div className="bosh-qadam-bosh">
                <span className="kpi-belgi flex-none" aria-hidden>
                  <Belgi size={18} strokeWidth={2.2} />
                </span>
                <span className="bosh-qadam-raqam" aria-hidden>
                  {i + 1}
                </span>
              </div>
              <div className="min-w-0">
                <h3 className="text-[15px] font-extrabold" style={{ color: "var(--ink)" }}>
                  {t(nomi)}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
                  {t(izoh)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------------------------------------------------------- LPSI formulasi va shkala */}
      <section className="sahifa-kirish grid gap-4 lg:grid-cols-[1.25fr_1fr]" style={kechikish(4)}>
        <div className="card !p-6">
          <h2 className="bosh-h2">{t("bh.formula")}</h2>
          <p className="hint mt-1">{t("bh.formulaIzoh")}</p>
          <div className="bosh-formula mt-4" aria-label={t("bh.formula")}>
            <span className="font-extrabold">LPSI</span> ={" "}
            {m.mezonlar.map((x, i) => (
              <span key={x.kod} className="whitespace-nowrap">
                {i > 0 && " + "}
                <span className="bosh-formula-vazn">{son(x.vazn / jamiVazn, 2)}</span>·{x.kod}
              </span>
            ))}
          </div>
          <ul className="mt-5 flex flex-col gap-3">
            {m.mezonlar.map((x) => {
              const ulush = (x.vazn / jamiVazn) * 100;
              return (
                <li key={x.kod}>
                  <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                    <span className="min-w-0">
                      <span className="mono mr-2 font-bold" style={{ color: "var(--brand)" }}>
                        {x.kod}
                      </span>
                      <span className="font-semibold" style={{ color: "var(--ink)" }}>
                        {atama.mezon(x.kod, x.nomi)}
                      </span>
                    </span>
                    <span className="flex-none font-bold tabular-nums" style={{ color: "var(--ink-2)" }}>
                      {son(ulush, 0)}%
                    </span>
                  </div>
                  <div className="bosh-chiziq mt-1.5" aria-hidden>
                    <span style={{ width: `${ulush}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card !p-6">
          <h2 className="bosh-h2">{t("bh.shkala")}</h2>
          <p className="hint mt-1">{t("bh.shkalaIzoh")}</p>
          <div className="bosh-shkala mt-5" aria-hidden>
            {oraliqlar.map((o) => (
              <span key={o.nomi} style={{ flexGrow: o.kenglik / shkalaJami, background: `var(--lvl-${Math.min(o.i, 3)})` }} />
            ))}
          </div>
          <ul className="mt-5 flex flex-col gap-2.5">
            {oraliqlar.map((o) => (
              <li key={o.nomi} className="flex items-center gap-3 text-[14px]">
                <span className="h-3 w-3 flex-none rounded-full" style={{ background: `var(--lvl-${Math.min(o.i, 3)})` }} aria-hidden />
                <span className="mono w-[64px] flex-none font-bold" style={{ color: "var(--ink-2)" }}>
                  {`${son(o.boshi, 0)}–${son(o.gacha, 0)}`}
                </span>
                <span className="font-semibold" style={{ color: "var(--ink)" }}>
                  {atama.daraja(o.nomi)}
                </span>
                <span className="ml-auto font-bold tabular-nums" style={{ color: "var(--ink-2)" }}>
                  {t("bh.taSoni", { n: m.taqsimot[o.i] ?? 0 })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="sahifa-kirish flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-[12.5px]" style={{ ...kechikish(5), borderColor: "var(--line)", color: "var(--muted)" }}>
        <span>{t("bh.pastki")}</span>
        <span>{t("bh.metodika", { v: m.metodika_versiya })}</span>
      </footer>
    </div>
  );
}
