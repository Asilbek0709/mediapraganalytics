"use client";

import { motion } from "framer-motion";
import { useState } from "react";

import { useTil } from "@/components/i18n/TilProvider";
import { Card, CardHead } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { fadeUp } from "@/components/ui/motion";
import type { Ahamiyat, KopGuruhBolimi, Korsatkich } from "@/lib/ahamiyat";
import type { Mezon } from "@/lib/types";

type Bolim = "media" | "nashr" | "janr" | "yil" | "muammo";

/** p < 0,001 → ***, < 0,01 → **, < 0,05 → * */
const yulduz = (p: number) => (p < 0.001 ? "***" : p < 0.01 ? "**" : p < 0.05 ? "*" : "");

function Xulosa({ ahamiyatli, qoshimcha }: { ahamiyatli: boolean; qoshimcha?: string }) {
  const { t } = useTil();
  if (!ahamiyatli) return <span className="hint">{t("ah.ahamiyatsiz")}</span>;
  return (
    <span className="badge whitespace-nowrap" style={{ borderColor: "var(--s1)" }}>
      <i style={{ background: "var(--s1)" }} />
      {t("ah.ahamiyatli")}
      {qoshimcha && <span className="font-semibold" style={{ color: "var(--ink-2)" }}> · {qoshimcha}</span>}
    </span>
  );
}

export function AhamiyatKarta({ a, mezonlar }: { a: Ahamiyat; mezonlar: Mezon[] }) {
  const { t, son, atama } = useTil();
  const [bolim, setBolim] = useState<Bolim>("media");

  const pMatn = (p: number) => (p < 0.001 ? `< ${son(0.001, 3)}` : son(p, 3));
  const korsatkichNomi = (k: Korsatkich) => {
    if (k === "lpsi") return "LPSI";
    const kod = k.toUpperCase();
    const m = mezonlar.find((x) => x.kod === kod);
    return `${kod}. ${atama.mezon(kod, m?.nomi)}`;
  };

  return (
    <Card variants={fadeUp} koarish={false}>
      <CardHead
        title={t("ah.sarlavha")}
        izoh={t("ah.izoh", { a: son(a.alfa, 2) })}
        ong={
          <Tabs
            value={bolim}
            onChange={setBolim}
            layoutId="ahamiyat-tab"
            items={(["media", "nashr", "janr", "yil", "muammo"] as Bolim[]).map((kalit) => ({ kalit, nomi: t(`ah.t.${kalit}`) }))}
          />
        }
      />
      {/* Bo‘lim almashganda yangi jadval yumshoq paydo bo‘ladi */}
      <motion.div key={bolim} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
        {bolim === "media" && <MediaBolimi a={a} pMatn={pMatn} korsatkichNomi={korsatkichNomi} />}
        {bolim === "muammo" && <MuammoBolimi a={a} pMatn={pMatn} />}
        {(bolim === "nashr" || bolim === "janr" || bolim === "yil") && (
          <KopGuruh
            b={a[bolim]}
            minGuruh={a.minGuruh}
            alfa={a.alfa}
            filtrMatni={t(bolim === "nashr" ? "ah.filtrNashr" : "ah.filtrJanr")}
            qoshimchaIzoh={bolim === "yil" ? t("ah.izohYil") : undefined}
            guruhNomi={(nomi) => (bolim === "janr" ? atama.janr(nomi) : nomi)}
            pMatn={pMatn}
            korsatkichNomi={korsatkichNomi}
          />
        )}
      </motion.div>
    </Card>
  );
}

function MediaBolimi({
  a,
  pMatn,
  korsatkichNomi,
}: {
  a: Ahamiyat;
  pMatn: (p: number) => string;
  korsatkichNomi: (k: Korsatkich) => string;
}) {
  const { t, son } = useTil();
  const { holat, qatorlar } = a.media;
  if (holat !== "ok") return <p className="hint py-6 text-center">{t(holat === "filtr" ? "ah.filtrMedia" : "ah.kamMedia")}</p>;
  const minN = Math.min(...qatorlar.map((q) => Math.min(q.bosma.n, q.raqamli.n)));
  return (
    <>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>{t("ah.korsatkich")}</th>
              <th className="num">{t("ah.meN", { g: t("u.bosma") })}</th>
              <th className="num">{t("ah.meN", { g: t("u.raqamli") })}</th>
              <th className="num">U</th>
              <th className="num">z</th>
              <th className="num">p</th>
              <th className="num">r</th>
              <th>{t("ah.xulosa")}</th>
            </tr>
          </thead>
          <tbody>
            {qatorlar.map((q) => {
              const x = q.test;
              const ahamiyatli = !!x && x.p < a.alfa;
              return (
                <tr key={q.korsatkich}>
                  <td className="font-semibold">{korsatkichNomi(q.korsatkich)}</td>
                  <td className="num">
                    {son(q.bosma.mediana)} <span className="hint">({q.bosma.n})</span>
                  </td>
                  <td className="num">
                    {son(q.raqamli.mediana)} <span className="hint">({q.raqamli.n})</span>
                  </td>
                  <td className="num">{x ? son(x.U, 1) : "—"}</td>
                  <td className="num">
                    {x?.z != null ? son(x.z, 2) : x?.aniq ? <span className="hint" title={t("ah.aniqTitle")}>{t("ah.aniq")}</span> : "—"}
                  </td>
                  <td className="num font-bold">
                    {x ? pMatn(x.p) : "—"}
                    <sup>{x ? yulduz(x.p) : ""}</sup>
                  </td>
                  <td className="num">
                    {x ? son(x.r, 2) : "—"}
                    {q.effekt && <div className="hint">{t(`ah.e.${q.effekt}`)}</div>}
                  </td>
                  <td>
                    <Xulosa
                      ahamiyatli={ahamiyatli}
                      qoshimcha={ahamiyatli && x ? t("ah.yuqori", { g: t(x.r > 0 ? "u.bosma" : "u.raqamli") }) : undefined}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {minN < 5 && <p className="mt-3 text-[13px] font-semibold" style={{ color: "var(--danger)" }}>{t("ah.kichikGuruh", { n: minN })}</p>}
      <p className="hint mt-3">{t("ah.izohMedia")}</p>
    </>
  );
}

function MuammoBolimi({ a, pMatn }: { a: Ahamiyat; pMatn: (p: number) => string }) {
  const { t, son, atama } = useTil();
  const { holat, muammolar } = a.media;
  if (holat !== "ok") return <p className="hint py-6 text-center">{t(holat === "filtr" ? "ah.filtrMedia" : "ah.kamMedia")}</p>;
  return (
    <>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>{t("u.kategoriya")}</th>
              <th className="num">{t("ah.bor", { g: t("u.bosma") })}</th>
              <th className="num">{t("ah.bor", { g: t("u.raqamli") })}</th>
              <th className="num">p</th>
              <th className="num">{t("ah.pHolm")}</th>
              <th>{t("ah.xulosa")}</th>
            </tr>
          </thead>
          <tbody>
            {muammolar.map((q) => {
              const ahamiyatli = q.pHolm < a.alfa;
              return (
                <tr key={q.kod}>
                  <td className="font-semibold">{atama.kategoriya(q.kod, q.nomi)}</td>
                  <td className="num">
                    {son(q.bosma.ulush)} <span className="hint">({q.bosma.bor}/{q.bosma.n})</span>
                  </td>
                  <td className="num">
                    {son(q.raqamli.ulush)} <span className="hint">({q.raqamli.bor}/{q.raqamli.n})</span>
                  </td>
                  <td className="num">{pMatn(q.p)}</td>
                  <td className="num font-bold">
                    {pMatn(q.pHolm)}
                    <sup>{yulduz(q.pHolm)}</sup>
                  </td>
                  <td>
                    <Xulosa
                      ahamiyatli={ahamiyatli}
                      qoshimcha={
                        ahamiyatli
                          ? t("ah.yuqori", { g: t(q.bosma.ulush > q.raqamli.ulush ? "u.bosma" : "u.raqamli") })
                          : undefined
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="hint mt-3">{t("ah.izohMuammo")}</p>
    </>
  );
}

function KopGuruh({
  b,
  minGuruh,
  alfa,
  filtrMatni,
  qoshimchaIzoh,
  guruhNomi,
  pMatn,
  korsatkichNomi,
}: {
  b: KopGuruhBolimi;
  qoshimchaIzoh?: string;
  minGuruh: number;
  alfa: number;
  filtrMatni: string;
  guruhNomi: (nomi: string) => string;
  pMatn: (p: number) => string;
  korsatkichNomi: (k: Korsatkich) => string;
}) {
  const { t, son } = useTil();
  if (b.holat === "filtr") return <p className="hint py-6 text-center">{filtrMatni}</p>;
  const royxat = (gs: { nomi: string; n: number }[]) => gs.map((g) => `${guruhNomi(g.nomi)} (${g.n})`).join(", ");
  const sharh = (
    <div className="hint mb-3 flex flex-col gap-1">
      {qoshimchaIzoh && <span>{qoshimchaIzoh}</span>}
      {b.guruhlar.length > 0 && <span>{t("ah.taqqoslangan", { v: royxat(b.guruhlar) })}</span>}
      {b.chiqarilgan.length > 0 && <span>{t("ah.chiqarilgan", { m: minGuruh, v: royxat(b.chiqarilgan) })}</span>}
    </div>
  );
  if (b.holat === "kam")
    return (
      <>
        <p className="hint py-4 text-center">{t("ah.kamGuruh", { m: minGuruh })}</p>
        {sharh}
      </>
    );
  const minN = Math.min(...b.guruhlar.map((g) => g.n));
  return (
    <>
      {sharh}
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>{t("ah.korsatkich")}</th>
              <th className="num">H</th>
              <th className="num">df</th>
              <th className="num">p</th>
              <th className="num">ε²</th>
              <th>{t("ah.xulosa")}</th>
              <th>{t("ah.juftlar")}</th>
            </tr>
          </thead>
          <tbody>
            {b.qatorlar.map((q) => {
              const x = q.test;
              const ahamiyatli = !!x && x.p < alfa;
              return (
                <tr key={q.korsatkich}>
                  <td className="font-semibold">{korsatkichNomi(q.korsatkich)}</td>
                  <td className="num">{x ? son(x.H, 2) : "—"}</td>
                  <td className="num">{x?.df ?? "—"}</td>
                  <td className="num font-bold">
                    {x ? pMatn(x.p) : "—"}
                    <sup>{x ? yulduz(x.p) : ""}</sup>
                  </td>
                  <td className="num">
                    {x ? son(x.epsilon2, 3) : "—"}
                    {q.effekt && <div className="hint">{t(`ah.e.${q.effekt}`)}</div>}
                  </td>
                  <td>
                    <Xulosa ahamiyatli={ahamiyatli} />
                  </td>
                  <td className="min-w-[220px] text-[12.5px]">
                    {!ahamiyatli ? (
                      <span className="hint">—</span>
                    ) : q.juftlar.length === 0 ? (
                      <span className="hint">{t("ah.juftYoq")}</span>
                    ) : (
                      <ul className="flex flex-col gap-0.5">
                        {q.juftlar.map((j) => (
                          <li key={`${j.yuqori}-${j.past}`}>
                            <span className="font-semibold">{guruhNomi(j.yuqori)}</span> &gt; {guruhNomi(j.past)}{" "}
                            <span className="hint tabular-nums">
                              (p {j.pHolm < 0.001 ? "" : "= "}
                              {pMatn(j.pHolm)})
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {minN < 5 && <p className="mt-3 text-[13px] font-semibold" style={{ color: "var(--danger)" }}>{t("ah.kichikGuruh", { n: minN })}</p>}
      <p className="hint mt-3">{t("ah.izohKop")}</p>
    </>
  );
}
