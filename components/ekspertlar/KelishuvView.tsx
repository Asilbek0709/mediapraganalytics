"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import { BarsH } from "@/components/charts/Bars";
import { useTil } from "@/components/i18n/TilProvider";
import { RasmTugmasi } from "@/components/rasm/RasmTugmasi";
import { DarajaBadge } from "@/components/ui/Badge";
import { Card, CardHead, Reveal } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { fadeUp } from "@/components/ui/motion";
import { idRaqami } from "@/lib/format";
import type { MaterialKelishuvi, QatorHolati } from "@/lib/kelishuv";
import { baholovchiNomi, guruhNomi, korsatkichNomi, qiymatKorinishi } from "@/lib/kelishuvNomlari";
import type { ShkalaOraliq } from "@/lib/types";

const HOLAT: Record<QatorHolati, { belgi: string; rang: string }> = {
  toliq: { belgi: "✓", rang: "var(--lvl-2)" },
  kopchilik: { belgi: "◐", rang: "var(--lvl-1)" },
  yaqin: { belgi: "≈", rang: "var(--s1)" },
  farq: { belgi: "✗", rang: "var(--lvl-0)" },
  kam: { belgi: "—", rang: "var(--line-strong)" },
};

type Qiymat = string | number | null;

/** Qatordagi eng ko‘p uchragan qiymat (farq qiluvchi kataklarni ajratish uchun). */
function moda(qiymatlar: Qiymat[]): Qiymat {
  const sanoq = new Map<string | number, number>();
  for (const v of qiymatlar) if (v != null) sanoq.set(v, (sanoq.get(v) ?? 0) + 1);
  let eng: Qiymat = null;
  let max = 0;
  for (const [v, n] of sanoq) if (n > max) [eng, max] = [v, n];
  return max > 1 ? eng : null;
}

export function KelishuvView({ k, shkala }: { k: MaterialKelishuvi; shkala: ShkalaOraliq[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const tr = useTil();
  const { t, son } = tr;
  const baholovchilar = k.baholovchilar.map((b) => ({ ...b, nomi: baholovchiNomi(b.kalit, b.nomi, tr) }));
  const statistika = (["toliq", "kopchilik", "yaqin", "farq"] as QatorHolati[]).map((h) => ({
    h,
    soni: k.qatorlar.filter((q) => q.holat === h).length,
  }));

  return (
    <div className="flex flex-col gap-5">
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Link href={`/ekspertlar${k.asosiy ? "" : "?asosiy=0"}`} className="text-[12.5px] font-semibold">
            ← {t("nav.ekspertlar")}
          </Link>
          <h1 className="mt-1.5">
            {t("kel.sarlavha")}{" "}
            <span className="tabular-nums" style={{ color: "var(--muted)" }}>
              № {idRaqami(k.material.id)}
            </span>
          </h1>
          <p className="mt-2 max-w-[80ch] font-semibold">{k.material.sarlavha}</p>
          <p className="hint mt-1">{k.material.nashr}</p>
        </div>
        <Tabs
          value={k.asosiy ? "ha" : "yoq"}
          layoutId="kelishuv-asosiy"
          items={[
            { kalit: "ha", nomi: t("eks.tadqiqotchiBilan") },
            { kalit: "yoq", nomi: t("eks.faqatEkspertlar") },
          ]}
          onChange={(v) => startTransition(() => router.replace(v === "ha" ? pathname : `${pathname}?asosiy=0`, { scroll: false }))}
        />
      </motion.header>

      <motion.div animate={{ opacity: pending ? 0.55 : 1 }} className="flex flex-col gap-5">
        {k.baholovchilar.length < 2 ? (
          <Card>
            <p className="py-10 text-center font-semibold">{t("kel.kamBaholovchi")}</p>
          </Card>
        ) : (
          <>
            <Reveal className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <Card variants={fadeUp} koarish={false}>
                <CardHead
                  title={t("kel.lpsiBoyicha")}
                  izoh={t("kel.lpsiBoyichaIzoh")}
                  ong={
                    <RasmTugmasi
                      malumot={() => ({
                        sarlavha: `${t("kel.lpsiBoyicha")} · № ${idRaqami(k.material.id)}`,
                        rasm: { tur: "gorizontal", max: 100, qatorlar: baholovchilar.map((b) => ({ nomi: b.nomi, qiymat: b.lpsi })) },
                      })}
                    />
                  }
                />
                <BarsH
                  items={baholovchilar.map((b) => ({ nomi: b.nomi, qiymat: b.lpsi, rang: "var(--s1)", izoh: `${b.nomi}: ${son(b.lpsi)}` }))}
                  nomKengligi={220}
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  {baholovchilar.map((b) => (
                    <Link key={b.kalit} className="btn btn-sm" href={b.havola}>
                      {b.nomi} <DarajaBadge daraja={b.daraja} lpsi={b.lpsi} shkala={shkala} />
                    </Link>
                  ))}
                </div>
              </Card>
              <Card variants={fadeUp} koarish={false}>
                <CardHead title={t("kel.xulosa")} izoh={t("kel.nKorsatkich", { n: k.qatorlar.length })} />
                <div className="flex flex-col gap-3">
                  {statistika.map(({ h, soni }, i) => (
                    <div key={h} className="grid items-center gap-3" style={{ gridTemplateColumns: "150px 1fr 36px" }}>
                      <span className="inline-flex items-center gap-2 text-[13px] font-semibold">
                        <span className="grid h-6 w-6 place-items-center rounded-md text-[13px] font-extrabold" style={{ background: HOLAT[h].rang, color: "#fff" }}>
                          {HOLAT[h].belgi}
                        </span>
                        {t(`kel.h.${h}`)}
                      </span>
                      <div className="h-2.5 overflow-hidden rounded-full" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: HOLAT[h].rang }}
                          initial={{ width: 0 }}
                          whileInView={{ width: `${(soni / Math.max(1, k.qatorlar.length)) * 100}%` }}
                          viewport={{ once: true }}
                          transition={{ type: "spring", stiffness: 150, damping: 22, delay: 0.06 * i }}
                        />
                      </div>
                      <span className="text-right font-extrabold tabular-nums">{soni}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </Reveal>

            <Reveal>
              <Card variants={fadeUp} koarish={false}>
                <CardHead title={t("kel.jadval")} izoh={t("kel.jadvalIzoh")} />
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{t("eks.korsatkich")}</th>
                        {baholovchilar.map((b) => (
                          <th key={b.kalit} className="text-center">
                            {b.nomi}
                          </th>
                        ))}
                        <th>{t("kel.holat")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {k.qatorlar.map((q, i) => {
                        const yangiGuruh = i === 0 || k.qatorlar[i - 1].guruh !== q.guruh;
                        const m = moda(q.qiymatlar);
                        const h = HOLAT[q.holat];
                        return [
                          yangiGuruh ? (
                            <tr key={`g-${q.guruh}`}>
                              <td colSpan={k.baholovchilar.length + 2} className="!pt-4 text-[11.5px] font-extrabold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                                {guruhNomi(q.guruh, tr)}
                              </td>
                            </tr>
                          ) : null,
                          <tr key={q.kalit}>
                            <td className="font-semibold">{korsatkichNomi(q.kalit, tr)}</td>
                            {q.qiymatlar.map((v, j) => {
                              const farqli = m != null && v != null && v !== m && q.holat !== "toliq";
                              return (
                                <td
                                  key={j}
                                  className="text-center tabular-nums"
                                  style={{
                                    background: farqli ? "color-mix(in oklab, var(--lvl-0) 14%, var(--surface))" : undefined,
                                    fontWeight: farqli ? 700 : undefined,
                                    color: v == null ? "var(--muted)" : undefined,
                                  }}
                                >
                                  {qiymatKorinishi(v, q.format, tr) ?? "—"}
                                </td>
                              );
                            })}
                            <td className="whitespace-nowrap">
                              <span className="badge">
                                <i style={{ background: h.rang }} />
                                {h.belgi} {t(`kel.h.${q.holat}`)}
                              </span>
                              {q.tarqoqlik && (
                                <span className="hint ml-2">
                                  {t("kel.tarqoqlik", { o: son(q.tarqoqlik.oraliq), s: son(q.tarqoqlik.sd) })}
                                </span>
                              )}
                            </td>
                          </tr>,
                        ];
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </Reveal>
          </>
        )}
      </motion.div>
    </div>
  );
}
