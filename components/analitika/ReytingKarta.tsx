"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useTil } from "@/components/i18n/TilProvider";
import { RasmTugmasi } from "@/components/rasm/RasmTugmasi";
import { DarajaBadge } from "@/components/ui/Badge";
import { Card, CardHead } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { fadeUp } from "@/components/ui/motion";
import type { Analitika } from "@/lib/analitika";
import { KORSATKICHLAR, type Korsatkich } from "@/lib/davrlar";
import { sana } from "@/lib/format";
import type { RasmMalumot } from "@/lib/rasm";
import { materialReytingi, MIN_REYTING, nashrReytingi, type MaterialOrni } from "@/lib/reyting";

type Tur = "nashr" | "material";
const SONI = 10;
/** LPSI birinchi, keyin K1–K5 */
const TABLAR: Korsatkich[] = ["lpsi", ...KORSATKICHLAR.filter((x) => x !== "lpsi")];
const rangIndeksi = (turi?: string | null) => (turi === "raqamli" ? 1 : 0);

/** Reyting: nashrlar o‘rni tanlangan ko‘rsatkich bo‘yicha va eng yuqori / eng past materiallar. */
export function ReytingKarta({ a, korsatkichNomi }: { a: Analitika; korsatkichNomi: (k: Korsatkich) => string }) {
  const { t, son, media } = useTil();
  const [tur, setTur] = useState<Tur>("nashr");
  const [k, setK] = useState<Korsatkich>("lpsi");

  const nashrlar = useMemo(() => nashrReytingi(a.kesimlar.nashr, k), [a.kesimlar.nashr, k]);
  const materiallar = useMemo(() => materialReytingi(a.materiallar, k, SONI), [a.materiallar, k]);
  const qisqa = k === "lpsi" ? "LPSI" : k.toUpperCase();
  // Nashr hisoboti (PDF) sahifadagi davr filtri bilan
  const nashrIdlari = new Map(a.tanlovlar.nashrlar.map((n) => [n.nomi, n.id]));
  const davrQs = new URLSearchParams(Object.entries({ dan: a.filtr.dan, gacha: a.filtr.gacha }).filter((x): x is [string, string] => !!x[1])).toString();
  const hisobotHavolasi = (id: number) => `/api/nashrlar/${id}/hisobot${davrQs ? `?${davrQs}` : ""}`;

  const rasm = (): RasmMalumot => ({
    sarlavha: t("ry.rasm", { k: korsatkichNomi(k) }),
    rasm: {
      tur: "gorizontal",
      max: 100,
      qatorlar: nashrlar.map((r) => ({ nomi: `${r.orin}. ${r.nomi}`, qiymat: r.qiymat, rang: rangIndeksi(r.media_turi) })),
      legend: [...new Set(nashrlar.map((r) => r.media_turi ?? "bosma"))].map((turi) => ({ nomi: media(turi), rang: rangIndeksi(turi) })),
    },
  });

  return (
    <Card variants={fadeUp} koarish={false}>
      <CardHead
        title={t("ry.sarlavha")}
        izoh={t("ry.izoh")}
        ong={
          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              value={tur}
              onChange={setTur}
              layoutId="reyting-tur"
              items={[
                { kalit: "nashr", nomi: t("ry.t.nashr") },
                { kalit: "material", nomi: t("ry.t.material") },
              ]}
            />
            <Tabs
              value={k}
              onChange={setK}
              layoutId="reyting-k"
              items={TABLAR.map((x) => ({ kalit: x, nomi: x === "lpsi" ? "LPSI" : x.toUpperCase() }))}
            />
            {tur === "nashr" && nashrlar.length > 0 && <RasmTugmasi malumot={rasm} />}
          </div>
        }
      />

      <motion.div key={`${tur}-${k}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
        {tur === "nashr" ? (
          nashrlar.length === 0 ? (
            <p className="hint py-6 text-center">{t("u.malumotYoq")}</p>
          ) : (
            <>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th className="num">{t("ry.orin")}</th>
                      <th>{t("u.nashr")}</th>
                      <th className="num">{t("u.soni")}</th>
                      <th>{korsatkichNomi(k)}</th>
                      {k === "lpsi" && <th>{t("u.daraja")}</th>}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {nashrlar.map((r) => (
                      <tr key={r.nomi} style={r.kam ? { opacity: 0.62 } : undefined} title={r.kam ? t("ry.kam", { m: MIN_REYTING }) : undefined}>
                        <td className="num text-[15px] font-extrabold">
                          {r.teng ? "=" : ""}
                          {r.orin}
                        </td>
                        <td>
                          <span className="font-semibold">{r.nomi}</span>{" "}
                          <span className="tag ml-1">{media(r.media_turi)}</span>
                          {r.kam && <span className="hint ml-1">*</span>}
                        </td>
                        <td className="num">{r.soni}</td>
                        <td className="min-w-[200px]">
                          <div className="flex items-center gap-2.5">
                            <span className="w-12 text-right font-bold tabular-nums">{son(r.qiymat)}</span>
                            <div className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                              <motion.div
                                className="h-full rounded-full"
                                style={{ background: r.media_turi === "raqamli" ? "var(--s2)" : "var(--s1)" }}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.max(0, Math.min(100, r.qiymat))}%` }}
                                transition={{ type: "spring", stiffness: 120, damping: 22 }}
                              />
                            </div>
                          </div>
                        </td>
                        {k === "lpsi" && (
                          <td>
                            <DarajaBadge daraja={r.daraja} shkala={a.shkala} faqatDaraja />
                          </td>
                        )}
                        <td className="text-right">
                          {nashrIdlari.get(r.nomi) && (
                            <a
                              className="btn btn-ghost btn-sm"
                              href={hisobotHavolasi(nashrIdlari.get(r.nomi)!)}
                              target="_blank"
                              rel="noopener"
                              title={t("nh.pdfTitle")}
                            >
                              PDF
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {nashrlar.some((r) => r.kam) && <p className="hint mt-3">* {t("ry.kam", { m: MIN_REYTING })}</p>}
            </>
          )
        ) : materiallar.yuqori.length === 0 ? (
          <p className="hint py-6 text-center">{t("u.malumotYoq")}</p>
        ) : materiallar.toliq ? (
          <MaterialRoyxati sarlavha={t("ry.hammasi", { n: materiallar.yuqori.length })} royxat={materiallar.yuqori} qisqa={qisqa} lpsi={k === "lpsi"} a={a} />
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            <MaterialRoyxati sarlavha={t("ry.yuqori", { n: SONI })} royxat={materiallar.yuqori} qisqa={qisqa} lpsi={k === "lpsi"} a={a} />
            <MaterialRoyxati sarlavha={t("ry.past", { n: SONI })} royxat={materiallar.past} qisqa={qisqa} lpsi={k === "lpsi"} a={a} />
          </div>
        )}
      </motion.div>
    </Card>
  );
}

function MaterialRoyxati({
  sarlavha,
  royxat,
  qisqa,
  lpsi,
  a,
}: {
  sarlavha: string;
  royxat: MaterialOrni[];
  qisqa: string;
  lpsi: boolean;
  a: Analitika;
}) {
  const { son, media } = useTil();
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-[14px] font-bold">{sarlavha}</h3>
      <ol className="flex flex-col">
        {royxat.map((x) => (
          <li key={x.m.id} className="flex items-start gap-3 border-b py-2" style={{ borderColor: "var(--line)" }}>
            <span className="w-8 shrink-0 pt-0.5 text-right text-[14px] font-extrabold tabular-nums" style={{ color: "var(--muted)" }}>
              {x.orin}
            </span>
            <div className="min-w-0 flex-1">
              <Link href={`/tahlil/${x.m.id}`} className="line-clamp-2 font-semibold no-underline hover:underline" style={{ color: "var(--ink)" }}>
                {x.m.sarlavha}
              </Link>
              <div className="text-[12.5px]" style={{ color: "var(--muted)" }}>
                {x.m.nashr} · {media(x.m.media_turi)}
                {x.m.sana ? ` · ${sana(x.m.sana)}` : ""}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-[15px] font-extrabold tabular-nums" title={qisqa}>
                {son(x.qiymat)}
              </span>
              {lpsi && <DarajaBadge daraja={x.m.daraja} shkala={a.shkala} faqatDaraja />}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
