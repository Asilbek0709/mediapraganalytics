"use client";

import { motion } from "framer-motion";
import { Award, CircleCheckBig, Files, Gauge } from "lucide-react";
import Link from "next/link";

import { BarsH, ColumnBars, GroupedBars, Legend } from "@/components/charts/Bars";
import { useFoydalanuvchi } from "@/components/auth/FoydalanuvchiProvider";
import { useTil } from "@/components/i18n/TilProvider";
import { RasmTugmasi } from "@/components/rasm/RasmTugmasi";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { DarajaBadge } from "@/components/ui/Badge";
import { Card, CardHead, Reveal, Stagger } from "@/components/ui/Card";
import { Kpi } from "@/components/ui/Kpi";
import { fadeUp, pressable } from "@/components/ui/motion";
import { idRaqami, sana } from "@/lib/format";
import type { Dashboard } from "@/lib/types";

const seriyaRangi = (turi?: string) => (turi === "raqamli" ? "var(--s2)" : "var(--s1)");
/** Rasm palitrasidagi o‘rin: 0 — bosma, 1 — raqamli */
const seriyaIndeksi = (turi?: string | null) => (turi === "raqamli" ? 1 : 0);

export function DashboardView({ d }: { d: Dashboard }) {
  const { t, son, atama, media } = useTil();
  const { admin } = useFoydalanuvchi();
  const eng = d.nashrlar[0];
  const muammolar = d.muammolar.filter((q) => q.guruh === "muammo").sort((a, b) => b.ulush - a.ulush);
  const kLabels = ["K1", "K2", "K3", "K4", "K5", "LPSI"];
  const mediaTurlari = [...d.media_turlari].sort((a) => (a.nomi === "bosma" ? -1 : 1));

  return (
    <div className="flex flex-col gap-5">
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <div className="eyebrow">{t("d.eyebrow")}</div>
          <h1 className="mt-1.5">{t("nav.bosh")}</h1>
          <p className="hint mt-2 max-w-[62ch]">{t("d.izoh", { v: d.metodika_versiya })}</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {admin && (
            <motion.div {...pressable}>
              <Link className="btn" href="/mediabaza?yangi=1">
                {t("d.materialQoshish")}
              </Link>
            </motion.div>
          )}
          <motion.div {...pressable}>
            <a className="btn btn-primary" href="/api/export/excel">
              {t("d.excel")}
            </a>
          </motion.div>
        </div>
      </motion.header>

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label={t("u.materiallar")}
          belgi={Files}
          izoh={
            <>
              {t("d.nashrlarBazada", { n: d.nashrlar_soni })}
              {d.chetda > 0 && <span className="mt-1 block">{t("d.chetda", { n: d.chetda })}</span>}
            </>
          }
        >
          <AnimatedNumber value={d.jami} kasr={0} />
        </Kpi>
        <Kpi
          label={t("d.toliqTahlil")}
          belgi={CircleCheckBig}
          izoh={t("d.toliqEmasKutmoqda", { a: d.toliq_emas, b: d.tahlil_kutmoqda })}
        >
          <AnimatedNumber value={d.tahlil_qilingan} kasr={0} />
        </Kpi>
        <Kpi
          label={t("d.ortachaLpsi")}
          belgi={Gauge}
          aurora
          izoh={d.ortacha_daraja ? <DarajaBadge daraja={d.ortacha_daraja} shkala={d.shkala} faqatDaraja /> : t("d.haliHisoblanmagan")}
        >
          <AnimatedNumber value={d.ortacha_lpsi} kasr={1} />
        </Kpi>
        <Kpi
          label={t("d.engYuqori")}
          belgi={Award}
          izoh={eng ? t("d.lpsiVaSoni", { v: son(eng.lpsi), n: eng.soni }) : t("d.yetarliEmas")}
        >
          <span className="truncate">{eng ? eng.nomi : "—"}</span>
        </Kpi>
      </Stagger>

      {d.tahlil_qilingan === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <p className="text-[15px] font-semibold">{d.jami ? t("d.boshTahlilYoq") : t("d.boshBazaBosh")}</p>
            <p className="hint mt-2">{d.jami ? t("d.boshTahlilYoqIzoh") : t("d.boshBazaBoshIzoh")}</p>
            {admin && (
              <Link className="btn btn-primary mt-5 inline-flex" href={d.jami ? "/mediabaza" : "/mediabaza?yangi=1"}>
                {d.jami ? t("d.mediabazagaOtish") : t("d.materialQoshishOddiy")}
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <>
          <Reveal className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHead
                title={t("d.nashrlarLpsi")}
                izoh={t("d.nashrlarLpsiIzoh")}
                ong={
                  <RasmTugmasi
                    malumot={() => ({
                      sarlavha: t("d.nashrlarLpsi"),
                      rasm: {
                        tur: "gorizontal",
                        max: 100,
                        qatorlar: d.nashrlar.map((n) => ({ nomi: n.nomi, qiymat: n.lpsi, rang: seriyaIndeksi(n.media_turi) })),
                        legend: [...new Set(d.nashrlar.map((n) => n.media_turi ?? "bosma"))].map((tur) => ({
                          nomi: media(tur),
                          rang: seriyaIndeksi(tur),
                        })),
                      },
                    })}
                  />
                }
              />
              <Legend
                items={[...new Set(d.nashrlar.map((n) => n.media_turi ?? "bosma"))].map((tur) => ({
                  nomi: media(tur),
                  rang: seriyaRangi(tur),
                }))}
              />
              <BarsH
                items={d.nashrlar.map((n) => ({
                  nomi: n.nomi,
                  qiymat: n.lpsi,
                  rang: seriyaRangi(n.media_turi),
                  izoh: t("d.nashrTooltip", { nomi: n.nomi, v: son(n.lpsi), n: n.soni }),
                }))}
              />
            </Card>

            <Card>
              <CardHead
                title={t("d.bosmaRaqamli")}
                izoh={t("d.bosmaRaqamliIzoh")}
                ong={
                  <RasmTugmasi
                    malumot={() => ({
                      sarlavha: t("d.bosmaRaqamli"),
                      rasm: {
                        tur: "guruhli",
                        max: 100,
                        toifalar: kLabels,
                        seriyalar: mediaTurlari.map((m) => ({
                          nomi: `${media(m.nomi)} (${m.soni})`,
                          rang: seriyaIndeksi(m.nomi),
                          qiymatlar: [m.k1, m.k2, m.k3, m.k4, m.k5, m.lpsi],
                        })),
                      },
                    })}
                  />
                }
              />
              <Legend items={mediaTurlari.map((m) => ({ nomi: `${media(m.nomi)} (${m.soni})`, rang: seriyaRangi(m.nomi) }))} />
              <GroupedBars
                belgilar={kLabels}
                seriyalar={mediaTurlari.map((m) => ({
                  nomi: media(m.nomi),
                  rang: seriyaRangi(m.nomi),
                  qiymatlar: [m.k1, m.k2, m.k3, m.k4, m.k5, m.lpsi],
                }))}
              />
            </Card>

            <Card>
              <CardHead
                title={t("d.taqsimot")}
                izoh={t("d.taqsimotIzoh")}
                ong={
                  <RasmTugmasi
                    malumot={() => ({
                      sarlavha: t("d.taqsimot"),
                      rasm: {
                        tur: "ustun",
                        darajalar: d.taqsimot.length,
                        ustunlar: d.taqsimot.map((q, i) => ({
                          nomi: `${atama.daraja(q.nomi)} (${son(q.quyi)}–${son(q.gacha)})`,
                          qiymat: q.soni,
                          rang: i,
                        })),
                      },
                    })}
                  />
                }
              />
              <ColumnBars
                items={d.taqsimot.map((q, i) => ({
                  nomi: `${atama.daraja(q.nomi)} (${son(q.quyi)}–${son(q.gacha)})`,
                  qiymat: q.soni,
                  rang: `var(--lvl-${i})`,
                  izoh: t("d.taqsimotTooltip", { n: q.soni, p: son((q.soni / d.tahlil_qilingan) * 100) }),
                }))}
              />
            </Card>

            <Card>
              <CardHead
                title={t("d.muammolar")}
                izoh={t("d.muammolarIzoh")}
                ong={
                  <RasmTugmasi
                    malumot={() => ({
                      sarlavha: t("d.muammolar"),
                      rasm: {
                        tur: "gorizontal",
                        max: 100,
                        suffix: "%",
                        qatorlar: muammolar.map((q) => ({ nomi: atama.kategoriya(q.kod, q.nomi), qiymat: q.ulush })),
                      },
                    })}
                  />
                }
              />
              <BarsH
                items={muammolar.map((q) => ({
                  nomi: atama.kategoriya(q.kod, q.nomi),
                  qiymat: q.ulush,
                  rang: "var(--s3)",
                  izoh: t("d.muammoTooltip", { p: son(q.ulush), n: q.birliklar }),
                }))}
                suffix="%"
                nomKengligi={200}
              />
            </Card>
          </Reveal>

          <Reveal className="flex flex-col gap-4">
            <Card variants={fadeUp}>
              <CardHead title={t("d.nashrJadval")} izoh={t("d.nashrJadvalIzoh")} />
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t("u.nashr")}</th>
                      <th>{t("u.mediaTuri")}</th>
                      <th className="num">{t("u.materiallarSoni")}</th>
                      {d.mezonlar.map((m) => (
                        <th key={m.kod} className="num" title={atama.mezon(m.kod, m.nomi)}>
                          {m.kod}
                        </th>
                      ))}
                      <th>LPSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.nashrlar.map((n) => (
                      <tr key={n.nomi}>
                        <td className="font-semibold">{n.nomi}</td>
                        <td>{media(n.media_turi)}</td>
                        <td className="num">{n.soni}</td>
                        <td className="num">{son(n.k1)}</td>
                        <td className="num">{son(n.k2)}</td>
                        <td className="num">{son(n.k3)}</td>
                        <td className="num">{son(n.k4)}</td>
                        <td className="num">{son(n.k5)}</td>
                        <td>
                          <DarajaBadge daraja={n.daraja} lpsi={n.lpsi} shkala={d.shkala} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card variants={fadeUp}>
              <CardHead title={t("d.belgilar")} izoh={t("d.belgilarIzoh")} />
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t("u.kategoriya")}</th>
                      <th>{t("u.guruh")}</th>
                      <th className="num">{t("d.jamiBirliklar")}</th>
                      <th className="num">{t("d.sarlavhada")}</th>
                      <th className="num">{t("d.lidda")}</th>
                      <th className="num">{t("d.matnda")}</th>
                      <th className="num">{t("u.materiallarSoni")}</th>
                      <th className="num">{t("u.foizMateriallar")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.muammolar.map((q) => (
                      <tr key={q.kod}>
                        <td className="font-semibold">{atama.kategoriya(q.kod, q.nomi)}</td>
                        <td>
                          <span className="tag">
                            {q.guruh === "muammo" ? `${t("u.muammo")}${q.mezon ? ` · ${q.mezon}` : ""}` : t("u.vosita")}
                          </span>
                        </td>
                        <td className="num">{q.birliklar}</td>
                        <td className="num">{q.qismlar.sarlavha}</td>
                        <td className="num">{q.qismlar.lid}</td>
                        <td className="num">{q.qismlar.matn}</td>
                        <td className="num">{q.materiallar}</td>
                        <td className="num font-semibold">{son(q.ulush)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card variants={fadeUp}>
              <CardHead title={t("d.oxirgi")} />
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>{t("u.nashr")}</th>
                      <th>{t("u.sarlavha")}</th>
                      <th>LPSI</th>
                      <th className="num">{t("u.tahlilSanasi")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.oxirgi.map((r) => (
                      <tr key={r.id}>
                        <td className="id">{idRaqami(r.id)}</td>
                        <td>{r.nashr}</td>
                        <td className="min-w-[240px]">
                          {admin ? <Link href={`/tahlil/${r.id}`}>{r.sarlavha}</Link> : r.sarlavha}
                        </td>
                        <td>
                          <DarajaBadge daraja={r.daraja} lpsi={r.lpsi} shkala={d.shkala} />
                        </td>
                        <td className="num">{sana(r.tahlil_sanasi)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </Reveal>
        </>
      )}
    </div>
  );
}
