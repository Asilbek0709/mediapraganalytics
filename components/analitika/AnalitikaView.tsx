"use client";

import { motion } from "framer-motion";
import { CircleCheckBig, Files, Gauge } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BarsH, Legend } from "@/components/charts/Bars";
import { HeatLegend, HeatTable } from "@/components/charts/HeatTable";
import { LineChart } from "@/components/charts/LineChart";
import { useTil } from "@/components/i18n/TilProvider";
import { RasmTugmasi } from "@/components/rasm/RasmTugmasi";
import { AhamiyatKarta } from "./AhamiyatKarta";
import { DavrlarKarta } from "./DavrlarKarta";
import { ReytingKarta } from "./ReytingKarta";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { DarajaBadge } from "@/components/ui/Badge";
import { Card, CardHead, Reveal, Stagger } from "@/components/ui/Card";
import { Kpi } from "@/components/ui/Kpi";
import { Tabs } from "@/components/ui/Tabs";
import { fadeUp } from "@/components/ui/motion";
import type { Analitika, AnalitikaFiltr, Granulyatsiya } from "@/lib/analitika";
import { JANR_YOQ } from "@/lib/format";
import type { Kalit } from "@/lib/i18n";
import { misolFiltriQatori, type MisolFiltr } from "@/lib/misollar";
import type { RasmMalumot } from "@/lib/rasm";
import type { Kesim, MediaTuri } from "@/lib/types";

type Olcham = "nashr" | "media_turi" | "janr";
type Korsatkich = "lpsi" | "k1" | "k2" | "k3" | "k4" | "k5";

const OLCHAM_NOMI: Record<Olcham, Kalit> = { nashr: "an.o.nashr", media_turi: "an.o.media", janr: "an.o.janr" };
const OLCHAM_USTUNI: Record<Olcham, Kalit> = { nashr: "u.nashr", media_turi: "u.mediaTuri", janr: "u.janr" };
const SERIYA_RANGI: Record<string, string> = { hammasi: "var(--ink-2)", bosma: "var(--s1)", raqamli: "var(--s2)" };
/** Rasm palitrasidagi o‘rin — ilovadagi ranglar bilan bir xil ma’noda */
const SERIYA_INDEKSI: Record<string, number> = { bosma: 0, raqamli: 1, hammasi: 2 };

export function AnalitikaView({ a }: { a: Analitika }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, son, atama, media, davr } = useTil();
  const [pending, startTransition] = useTransition();
  const [filtr, setFiltr] = useState<AnalitikaFiltr>(a.filtr);

  const [taqqosOlchami, setTaqqosOlchami] = useState<Olcham>("nashr");
  const [xaritaOlchami, setXaritaOlchami] = useState<Olcham>("nashr");
  const [granulyatsiya, setGranulyatsiya] = useState<Granulyatsiya>("oy");
  const [korsatkich, setKorsatkich] = useState<Korsatkich>("lpsi");

  const olchamlar = (["nashr", "media_turi", "janr"] as Olcham[]).map((kalit) => ({ kalit, nomi: t(OLCHAM_NOMI[kalit]) }));
  const kesimNomi = (k: Kesim, olcham: Olcham) =>
    olcham === "media_turi" ? media(k.nomi) : olcham === "janr" ? (k.nomi === JANR_YOQ ? t("u.janrYoq") : atama.janr(k.nomi)) : k.nomi;

  function filtrniQollash(yangi: AnalitikaFiltr) {
    setFiltr(yangi);
    const qs = new URLSearchParams(
      Object.entries(yangi)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  const maydon = (k: keyof AnalitikaFiltr) => ({
    value: filtr[k] == null ? "" : String(filtr[k]),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      filtrniQollash({ ...filtr, [k]: e.target.value === "" ? undefined : k === "nashr_id" ? Number(e.target.value) : e.target.value }),
  });

  const mezonNomi = Object.fromEntries(a.mezonlar.map((m) => [m.kod, atama.mezon(m.kod, m.nomi)]));
  const dinamika = a.dinamika[granulyatsiya];
  const faolFiltr = Object.values(filtr).some((v) => v !== undefined && v !== "");
  const qismlarMax = Math.max(1, ...a.qismlar.flatMap((q) => [q.sarlavha, q.lid, q.matn]));
  const qismQatorlari = a.qismlar.filter((q) => q.jami > 0);

  // Katakdan misollar korpusiga: shu filtr + shu kesim + shu kategoriya (faqat to‘liq tahlillar — jadval asosi bilan bir xil)
  const misolHavolasi = (q: MisolFiltr) => `/misollar?${misolFiltriQatori({ ...a.filtr, toliq: true, ...q })}`;
  const kesimFiltri = (k: Kesim, olcham: Olcham): MisolFiltr | null => {
    if (olcham === "media_turi") return { turi: k.nomi as MediaTuri };
    if (olcham === "janr") return { janr: k.nomi };
    const id = a.tanlovlar.nashrlar.find((n) => n.nomi === k.nomi)?.id;
    return id ? { nashr_id: id } : null;
  };
  const xaritaHavolasi = (r: number, c: number) => {
    const k = a.kesimlar[xaritaOlchami][r];
    const kf = k && kesimFiltri(k, xaritaOlchami);
    return kf && a.muammolar[c] ? misolHavolasi({ ...kf, kategoriya: a.muammolar[c].kod }) : null;
  };
  const qismHavolasi = (r: number, c: number) =>
    qismQatorlari[r] ? misolHavolasi({ kategoriya: qismQatorlari[r].kod, qism: (["sarlavha", "lid", "matn"] as const)[c] }) : null;
  const kNomi = (k: Korsatkich) => (k === "lpsi" ? "LPSI" : `${k.toUpperCase()}. ${mezonNomi[k.toUpperCase()]}`);
  const korsatkichNomi = kNomi(korsatkich);

  // Dissertatsiya rasmlari: ekrandagi grafik bilan bir xil ma’lumot (tanlangan kesim, filtr, ko‘rsatkich)
  const taqqosRasmi = (): RasmMalumot => ({
    sarlavha: `${t("an.taqqos")}: ${t(OLCHAM_NOMI[taqqosOlchami]).toLowerCase()}`,
    rasm: {
      tur: "issiqlik",
      birinchiUstun: t(OLCHAM_USTUNI[taqqosOlchami]),
      soniUstuni: t("u.soni"),
      ustunlar: [...a.mezonlar.map((m) => m.kod), "LPSI"],
      qatorlar: a.kesimlar[taqqosOlchami].map((k) => ({
        nomi: kesimNomi(k, taqqosOlchami),
        soni: k.soni,
        qiymatlar: [k.k1, k.k2, k.k3, k.k4, k.k5, k.lpsi],
      })),
      max: 100,
      ton: "kok",
      shkala: { past: t("an.pastBall"), yuqori: t("an.yuqoriBall") },
    },
  });
  const xaritaRasmi = (): RasmMalumot => ({
    sarlavha: `${t("an.xarita")}: ${t(OLCHAM_NOMI[xaritaOlchami]).toLowerCase()}`,
    rasm: {
      tur: "issiqlik",
      birinchiUstun: t(OLCHAM_USTUNI[xaritaOlchami]),
      soniUstuni: t("u.soni"),
      ustunlar: a.muammolar.map((k) => atama.kategoriya(k.kod, k.nomi)),
      qatorlar: a.kesimlar[xaritaOlchami].map((k) => ({
        nomi: kesimNomi(k, xaritaOlchami),
        soni: k.soni,
        qiymatlar: a.muammolar.map((m) => k.ulushlar[m.kod] ?? 0),
      })),
      max: 100,
      suffix: "%",
      ton: "qizil",
      shkala: { past: t("an.kam"), yuqori: t("an.kop") },
    },
  });
  const qismlarRasmi = (): RasmMalumot => ({
    sarlavha: t("an.qismlar"),
    rasm: {
      tur: "issiqlik",
      birinchiUstun: t("u.kategoriya"),
      ustunlar: [t("u.sarlavha"), t("u.lid"), t("an.matnQisqa")],
      // Har qatorga izoh yozish o‘rniga — «Muammolar» / «Pragmatik vositalar» guruh sarlavhalari (rasm ixchamroq)
      qatorlar: a.qismlar
        .filter((q) => q.jami > 0)
        .sort((x, y) => Number(x.guruh !== "muammo") - Number(y.guruh !== "muammo"))
        .map((q) => ({
          nomi: atama.kategoriya(q.kod, q.nomi),
          guruh: t(q.guruh === "muammo" ? "kel.g.muammo" : "kel.g.vosita"),
          qiymatlar: [q.sarlavha, q.lid, q.matn],
        })),
      max: qismlarMax,
      ton: "qizil",
      shkala: { past: t("an.kam"), yuqori: t("an.kop") },
    },
  });
  const turlarRasmi = (): RasmMalumot => ({
    sarlavha: t("an.turlar"),
    rasm: {
      tur: "gorizontal",
      max: 100,
      suffix: "%",
      qatorlar: a.sarlavhaTurlari.map((s) => ({ nomi: atama.lugat("sarlavha_turi", s.kod, s.nomi), qiymat: s.ulush })),
    },
  });
  const turlarMediaRasmi = (): RasmMalumot => ({
    sarlavha: t("an.turlarMedia"),
    rasm: {
      tur: "guruhli",
      suffix: "%",
      toifalar: a.sarlavhaTurlari.map((s) => atama.lugat("sarlavha_turi", s.kod, s.nomi)),
      seriyalar: [
        { nomi: t("u.bosma"), rang: 0, qiymatlar: a.sarlavhaTurlari.map((s) => s.bosma) },
        { nomi: t("u.raqamli"), rang: 1, qiymatlar: a.sarlavhaTurlari.map((s) => s.raqamli) },
      ].filter((x) => x.qiymatlar.some((v) => v != null)),
    },
  });
  const dinamikaRasmi = (): RasmMalumot => ({
    sarlavha: `${t("an.dinamika")}: ${korsatkichNomi} (${t(`an.${granulyatsiya}`).toLowerCase()})`,
    rasm: {
      tur: "chiziq",
      max: 100,
      davrlar: dinamika.davrlar.map((d) => davr(d.kalit)),
      seriyalar: dinamika.seriyalar.map((s) => ({
        nomi: t(`an.seriya.${s.kalit}`),
        rang: SERIYA_INDEKSI[s.kalit],
        qiymatlar: s.nuqtalar.map((p) => p?.[korsatkich] ?? null),
      })),
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="eyebrow">{t("an.eyebrow")}</div>
        <h1 className="mt-1.5">{t("nav.analitika")}</h1>
        <p className="hint mt-2 max-w-[74ch]">{t("an.izoh")}</p>
      </motion.header>

      <Card koarish={false} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
          <label className="field">
            <span>{t("u.mediaTuri")}</span>
            <select {...maydon("turi")}>
              <option value="">{t("u.barchasi")}</option>
              <option value="bosma">{t("u.bosma")}</option>
              <option value="raqamli">{t("u.raqamli")}</option>
            </select>
          </label>
          <label className="field">
            <span>{t("u.nashr")}</span>
            <select {...maydon("nashr_id")}>
              <option value="">{t("u.barchaNashrlar")}</option>
              {a.tanlovlar.nashrlar.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nomi}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t("u.janr")}</span>
            <select {...maydon("janr")}>
              <option value="">{t("u.barchaJanrlar")}</option>
              {a.tanlovlar.janrlar.map((j) => (
                <option key={j} value={j}>
                  {j === JANR_YOQ ? t("u.janrYoq") : atama.janr(j)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t("u.sanaDan")}</span>
            <input type="date" {...maydon("dan")} />
          </label>
          <label className="field">
            <span>{t("u.sanaGacha")}</span>
            <input type="date" {...maydon("gacha")} />
          </label>
          <button className="btn" disabled={!faolFiltr} onClick={() => filtrniQollash({})}>
            {t("u.tozalash")}
          </button>
        </div>
      </Card>

      <motion.div animate={{ opacity: pending ? 0.5 : 1 }} transition={{ duration: 0.2 }} className="flex flex-col gap-5">
        <Stagger className="grid gap-4 sm:grid-cols-3">
          <Kpi label={t("an.tanlovda")} belgi={Files}>
            <AnimatedNumber value={a.jami} kasr={0} />
          </Kpi>
          <Kpi label={t("d.toliqTahlil")} belgi={CircleCheckBig}>
            <AnimatedNumber value={a.tahlil_qilingan} kasr={0} />
          </Kpi>
          <Kpi
            label={t("d.ortachaLpsi")}
            belgi={Gauge}
            izoh={
              a.ortacha_lpsi != null ? (
                <DarajaBadge
                  daraja={(a.shkala.find((s) => (a.ortacha_lpsi ?? 0) <= s.gacha) ?? a.shkala[a.shkala.length - 1]).nomi}
                  shkala={a.shkala}
                  faqatDaraja
                />
              ) : undefined
            }
          >
            <span className="text-aurora">
              <AnimatedNumber value={a.ortacha_lpsi} />
            </span>
          </Kpi>
        </Stagger>

        {a.tahlil_qilingan === 0 ? (
          <Card>
            <p className="py-10 text-center font-semibold">{faolFiltr ? t("an.boshFiltr") : t("an.boshUmumiy")}</p>
          </Card>
        ) : (
          <>
            <Reveal>
              <Card variants={fadeUp} koarish={false}>
                <CardHead
                  title={t("an.taqqos")}
                  izoh={t("an.taqqosIzoh")}
                  ong={
                    <div className="flex flex-wrap items-center gap-2">
                      <Tabs value={taqqosOlchami} onChange={setTaqqosOlchami} items={olchamlar} layoutId="taqqos-tab" />
                      <RasmTugmasi malumot={taqqosRasmi} />
                    </div>
                  }
                />
                <HeatTable
                  key={taqqosOlchami}
                  birinchiUstun={t(OLCHAM_USTUNI[taqqosOlchami])}
                  soniUstuni
                  rang="var(--s1)"
                  ustunlar={[
                    ...a.mezonlar.map((m) => ({ kalit: m.kod, nomi: m.kod, title: `${m.kod}. ${mezonNomi[m.kod]}` })),
                    { kalit: "lpsi", nomi: "LPSI", title: t("iz.lpsiNomi") },
                  ]}
                  qatorlar={a.kesimlar[taqqosOlchami].map((k) => ({
                    nomi: kesimNomi(k, taqqosOlchami),
                    soni: k.soni,
                    qiymatlar: [k.k1, k.k2, k.k3, k.k4, k.k5, k.lpsi],
                  }))}
                />
                <HeatLegend rang="var(--s1)" pastki={t("an.pastBall")} yuqori={t("an.yuqoriBall")} />
              </Card>
            </Reveal>

            <Reveal>
              <ReytingKarta a={a} korsatkichNomi={kNomi} />
            </Reveal>

            <Reveal>
              <AhamiyatKarta a={a.ahamiyat} mezonlar={a.mezonlar} />
            </Reveal>

            <Reveal className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <Card variants={fadeUp} koarish={false}>
                <CardHead
                  title={t("an.xarita")}
                  izoh={t("an.xaritaIzoh")}
                  ong={
                    <div className="flex flex-wrap items-center gap-2">
                      <Tabs value={xaritaOlchami} onChange={setXaritaOlchami} items={olchamlar} layoutId="xarita-tab" />
                      <RasmTugmasi malumot={xaritaRasmi} />
                    </div>
                  }
                />
                <HeatTable
                  key={xaritaOlchami}
                  birinchiUstun={t(OLCHAM_USTUNI[xaritaOlchami])}
                  soniUstuni
                  rang="var(--s3)"
                  suffix="%"
                  havola={xaritaHavolasi}
                  ustunlar={a.muammolar.map((k) => ({
                    kalit: k.kod,
                    nomi: atama.kategoriya(k.kod, k.nomi),
                    title: `${atama.kategoriya(k.kod, k.nomi)} (${k.mezon ?? "—"})`,
                  }))}
                  qatorlar={a.kesimlar[xaritaOlchami].map((k) => ({
                    nomi: kesimNomi(k, xaritaOlchami),
                    soni: k.soni,
                    qiymatlar: a.muammolar.map((m) => k.ulushlar[m.kod] ?? 0),
                  }))}
                />
                <HeatLegend rang="var(--s3)" pastki={t("an.kam")} yuqori={t("an.kop")} />
                <p className="hint mt-2">{t("an.katakMisol")}</p>
              </Card>

              <Card variants={fadeUp} koarish={false}>
                <CardHead title={t("an.qismlar")} izoh={t("an.qismlarIzoh")} ong={<RasmTugmasi malumot={qismlarRasmi} />} />
                <HeatTable
                  birinchiUstun={t("u.kategoriya")}
                  rang="var(--s3)"
                  max={qismlarMax}
                  havola={qismHavolasi}
                  ustunlar={[
                    { kalit: "sarlavha", nomi: t("u.sarlavha") },
                    { kalit: "lid", nomi: t("u.lid") },
                    { kalit: "matn", nomi: t("an.matnQisqa") },
                  ]}
                  qatorlar={qismQatorlari.map((q) => ({
                    nomi: atama.kategoriya(q.kod, q.nomi),
                    izoh: q.guruh === "muammo" ? t("u.muammo") : t("u.vosita"),
                    qiymatlar: [q.sarlavha, q.lid, q.matn],
                  }))}
                />
                <p className="hint mt-2">{t("an.katakMisol")}</p>
              </Card>
            </Reveal>

            <Reveal className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <Card variants={fadeUp} koarish={false}>
                <CardHead title={t("an.turlar")} izoh={t("an.turlarIzoh")} ong={<RasmTugmasi malumot={turlarRasmi} />} />
                <BarsH
                  items={a.sarlavhaTurlari.map((s) => {
                    const nomi = atama.lugat("sarlavha_turi", s.kod, s.nomi);
                    return { nomi, qiymat: s.ulush, rang: "var(--s1)", izoh: t("an.turTooltip", { nomi, n: s.soni }) };
                  })}
                  suffix="%"
                  nomKengligi={200}
                />
              </Card>

              <Card variants={fadeUp} koarish={false}>
                <CardHead title={t("an.turlarMedia")} izoh={t("an.turlarMediaIzoh")} ong={<RasmTugmasi malumot={turlarMediaRasmi} />} />
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{t("th.sarlavhaTuri")}</th>
                        <th className="num">{t("u.bosma")}</th>
                        <th className="num">{t("u.raqamli")}</th>
                        <th className="num">{t("an.farq")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.sarlavhaTurlari.map((s) => {
                        const farq = s.bosma != null && s.raqamli != null ? s.raqamli - s.bosma : null;
                        return (
                          <tr key={s.kod}>
                            <td className="font-semibold">{atama.lugat("sarlavha_turi", s.kod, s.nomi)}</td>
                            <td className="num">{son(s.bosma)}</td>
                            <td className="num">{son(s.raqamli)}</td>
                            <td className="num font-bold">{farq == null ? "—" : `${farq > 0 ? "+" : ""}${son(farq)}`}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </Reveal>

            <Reveal>
              <Card variants={fadeUp} koarish={false}>
                <CardHead
                  title={t("an.dinamika")}
                  izoh={t("an.dinamikaIzoh", { k: korsatkichNomi })}
                  ong={
                    <div className="flex flex-wrap gap-2">
                      <Tabs
                        value={korsatkich}
                        onChange={setKorsatkich}
                        layoutId="korsatkich-tab"
                        items={[
                          { kalit: "lpsi", nomi: "LPSI" },
                          ...(["k1", "k2", "k3", "k4", "k5"] as const).map((k) => ({ kalit: k, nomi: k.toUpperCase() })),
                        ]}
                      />
                      <Tabs
                        value={granulyatsiya}
                        onChange={setGranulyatsiya}
                        layoutId="davr-tab"
                        items={[
                          { kalit: "oy", nomi: t("an.oy") },
                          { kalit: "chorak", nomi: t("an.chorak") },
                          { kalit: "yil", nomi: t("an.yil") },
                        ]}
                      />
                      {dinamika.davrlar.length > 0 && <RasmTugmasi malumot={dinamikaRasmi} />}
                    </div>
                  }
                />
                {dinamika.davrlar.length === 0 ? (
                  <p className="hint py-8 text-center">{t("an.sanaliYoq")}</p>
                ) : (
                  <>
                    <Legend items={dinamika.seriyalar.map((s) => ({ nomi: t(`an.seriya.${s.kalit}`), rang: SERIYA_RANGI[s.kalit] }))} />
                    <LineChart
                      key={`${granulyatsiya}-${korsatkich}`}
                      davrlar={dinamika.davrlar.map((d) => ({ kalit: d.kalit, nomi: davr(d.kalit) }))}
                      seriyalar={dinamika.seriyalar.map((s) => ({
                        kalit: s.kalit,
                        nomi: t(`an.seriya.${s.kalit}`),
                        rang: SERIYA_RANGI[s.kalit],
                        qiymatlar: s.nuqtalar.map((p) => p?.[korsatkich] ?? null),
                        sonlar: s.nuqtalar.map((p) => p?.soni ?? null),
                      }))}
                    />
                    <details className="mt-3">
                      <summary className="cursor-pointer text-[13px] font-bold" style={{ color: "var(--accent)" }}>
                        {t("u.jadvalKorinishi")}
                      </summary>
                      <div className="table-wrap mt-2">
                        <table className="data">
                          <thead>
                            <tr>
                              <th>{t("an.davr")}</th>
                              {dinamika.seriyalar.map((s) => (
                                <th key={s.kalit} className="num">
                                  {t(`an.seriya.${s.kalit}`)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {dinamika.davrlar.map((d, i) => (
                              <tr key={d.kalit}>
                                <td className="font-semibold">{davr(d.kalit)}</td>
                                {dinamika.seriyalar.map((s) => {
                                  const p = s.nuqtalar[i];
                                  return (
                                    <td key={s.kalit} className="num">
                                      {p ? `${son(p[korsatkich])} (n=${p.soni})` : "—"}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </>
                )}
                {a.sanasiz > 0 && <p className="hint mt-3">{t("an.sanasiz", { n: a.sanasiz })}</p>}
              </Card>
            </Reveal>

            <Reveal>
              <DavrlarKarta a={a} korsatkichNomi={kNomi} />
            </Reveal>
          </>
        )}
      </motion.div>
    </div>
  );
}
