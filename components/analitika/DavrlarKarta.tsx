"use client";

import { useMemo, useState } from "react";

import { useTil } from "@/components/i18n/TilProvider";
import { RasmTugmasi } from "@/components/rasm/RasmTugmasi";
import { Card, CardHead } from "@/components/ui/Card";
import { fadeUp } from "@/components/ui/motion";
import type { Analitika } from "@/lib/analitika";
import { davrNomi, davrTakliflari, davrTaqqoslash, oraliqmi, type Korsatkich, type Oraliq } from "@/lib/davrlar";
import type { RasmMalumot } from "@/lib/rasm";

const ALFA = 0.05;
const yulduz = (p: number) => (p < 0.001 ? "***" : p < 0.01 ? "**" : p < 0.05 ? "*" : "");

/**
 * Ikki davrni taqqoslash: davrlar tanlanadi (yoki tayyor juftlardan), natija mijozda darhol hisoblanadi.
 * Ko‘rsatkichlar — Mann–Whitney U, muammolar ulushi — Fisher + Holm.
 */
export function DavrlarKarta({ a, korsatkichNomi }: { a: Analitika; korsatkichNomi: (k: Korsatkich) => string }) {
  const { t, son, atama, davr } = useTil();
  const takliflar = useMemo(() => davrTakliflari(a.materiallar.map((m) => m.sana)), [a.materiallar]);
  const [A, setA] = useState<Partial<Oraliq>>(takliflar[0]?.a ?? {});
  const [B, setB] = useState<Partial<Oraliq>>(takliflar[0]?.b ?? {});

  const togri = oraliqmi(A) && oraliqmi(B);
  const d = useMemo(
    () => (oraliqmi(A) && oraliqmi(B) ? davrTaqqoslash(a.materiallar, A, B, a.muammolar) : null),
    [a.materiallar, a.muammolar, A, B],
  );
  const nomA = oraliqmi(A) ? davrNomi(A, davr) : "A";
  const nomB = oraliqmi(B) ? davrNomi(B, davr) : "B";
  const testlar = !!d && !d.kesishadi && d.a.n >= 2 && d.b.n >= 2;
  const pMatn = (p: number) => (p < 0.001 ? `< ${son(0.001, 3)}` : son(p, 3));
  const tanlangan = (x: { a: Oraliq; b: Oraliq }) => x.a.dan === A.dan && x.a.gacha === A.gacha && x.b.dan === B.dan && x.b.gacha === B.gacha;

  const excelQs = new URLSearchParams(
    Object.entries({ ...a.filtr, a_dan: A.dan, a_gacha: A.gacha, b_dan: B.dan, b_gacha: B.gacha })
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => [k, String(v)]),
  ).toString();

  const rasm = (): RasmMalumot => ({
    sarlavha: `${t("dv.sarlavha")}: ${nomA} — ${nomB}`,
    rasm: {
      tur: "guruhli",
      max: 100,
      toifalar: d!.qatorlar.map((q) => (q.korsatkich === "lpsi" ? "LPSI" : q.korsatkich.toUpperCase())),
      seriyalar: [
        { nomi: `${nomA} (n = ${d!.a.n})`, rang: 0, qiymatlar: d!.qatorlar.map((q) => q.a.ortacha) },
        { nomi: `${nomB} (n = ${d!.b.n})`, rang: 1, qiymatlar: d!.qatorlar.map((q) => q.b.ortacha) },
      ],
    },
  });

  // Farq rangi: faqat ahamiyatli bo‘lsa; ko‘rsatkichda o‘sish — yaxshi, muammoda o‘sish — yomon
  const farqRangi = (farq: number | null, ahamiyatli: boolean, osishYaxshi: boolean) =>
    !ahamiyatli || !farq ? undefined : (farq > 0) === osishYaxshi ? "var(--ok)" : "var(--danger)";
  const ishorali = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${son(v)}`);

  const oraliqMaydoni = (nom: string, o: Partial<Oraliq>, set: (o: Partial<Oraliq>) => void) => (
    <fieldset className="min-w-0 rounded-xl border px-3 pb-3 pt-1" style={{ borderColor: "var(--line)" }}>
      <legend className="px-1 text-[12px] font-bold" style={{ color: "var(--ink-2)" }}>
        {nom}
      </legend>
      <div className="grid grid-cols-2 gap-2">
        <label className="field">
          <span>{t("dv.dan")}</span>
          <input type="date" value={o.dan ?? ""} onChange={(e) => set({ ...o, dan: e.target.value || undefined })} />
        </label>
        <label className="field">
          <span>{t("dv.gacha")}</span>
          <input type="date" value={o.gacha ?? ""} onChange={(e) => set({ ...o, gacha: e.target.value || undefined })} />
        </label>
      </div>
    </fieldset>
  );

  return (
    <Card variants={fadeUp} koarish={false}>
      <CardHead
        title={t("dv.sarlavha")}
        izoh={t("dv.izoh")}
        ong={
          d && d.a.n > 0 && d.b.n > 0 ? (
            <div className="flex flex-wrap gap-2">
              <RasmTugmasi malumot={rasm} />
              <a className="btn btn-sm" href={`/api/davrlar/excel?${excelQs}`}>
                {t("ms.excel")}
              </a>
            </div>
          ) : undefined
        }
      />

      {takliflar.length === 0 ? (
        <p className="hint py-6 text-center">{t("dv.yetarliEmas")}</p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {oraliqMaydoni(t("dv.a"), A, setA)}
            {oraliqMaydoni(t("dv.b"), B, setB)}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[12.5px] font-semibold" style={{ color: "var(--muted)" }}>
              {t("dv.tayyor")}
            </span>
            {takliflar.map((x) => (
              <button
                key={`${x.a.dan}-${x.b.gacha}-${x.tur}`}
                className="chip !py-1 !text-[12.5px]"
                data-on={tanlangan(x)}
                title={x.tur === "teng" ? `${t("dv.tengTitle")}: ${davrNomi(x.a, davr)} / ${davrNomi(x.b, davr)}` : undefined}
                onClick={() => {
                  setA(x.a);
                  setB(x.b);
                }}
              >
                {x.tur === "teng" ? t("dv.teng") : `${davrNomi(x.a, davr)} ↔ ${davrNomi(x.b, davr)}`}
              </button>
            ))}
          </div>

          {!togri ? (
            <p className="hint mt-4">{t("dv.notogri")}</p>
          ) : d ? (
            <>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] font-semibold">
                <span>
                  A · {nomA}: <span className="tabular-nums">{t("u.nMaterial", { n: d.a.n })}</span>
                </span>
                <span>
                  B · {nomB}: <span className="tabular-nums">{t("u.nMaterial", { n: d.b.n })}</span>
                </span>
              </div>
              {d.kesishadi && (
                <p className="mt-2 text-[13px] font-semibold" style={{ color: "var(--danger)" }}>
                  {t("dv.kesishadi")}
                </p>
              )}
              {!d.kesishadi && (d.a.n < 2 || d.b.n < 2) && (
                <p className="mt-2 text-[13px] font-semibold" style={{ color: "var(--danger)" }}>
                  {t("dv.kam")}
                </p>
              )}

              <h3 className="mt-4 text-[14px] font-bold">{t("dv.korsatkichlar")}</h3>
              <div className="table-wrap mt-1">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t("ah.korsatkich")}</th>
                      <th className="num">{t("dv.ortachaMe", { g: "A" })}</th>
                      <th className="num">{t("dv.ortachaMe", { g: "B" })}</th>
                      <th className="num">{t("dv.farq")}</th>
                      <th className="num">p</th>
                      <th className="num">r</th>
                      <th>{t("ah.xulosa")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.qatorlar.map((q) => {
                      const x = q.test;
                      const ahamiyatli = !!x && x.p < ALFA;
                      return (
                        <tr key={q.korsatkich}>
                          <td className="font-semibold">{korsatkichNomi(q.korsatkich)}</td>
                          <td className="num">
                            {son(q.a.ortacha)} <span className="hint">({son(q.a.mediana)})</span>
                          </td>
                          <td className="num">
                            {son(q.b.ortacha)} <span className="hint">({son(q.b.mediana)})</span>
                          </td>
                          <td className="num font-bold" style={{ color: farqRangi(q.farq, ahamiyatli, true) }}>
                            {ishorali(q.farq)}
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
                            {!x ? (
                              <span className="hint">—</span>
                            ) : ahamiyatli ? (
                              <span className="badge whitespace-nowrap" style={{ borderColor: "var(--s1)" }}>
                                <i style={{ background: "var(--s1)" }} />
                                {t("ah.ahamiyatli")} · {t("ah.yuqori", { g: x.r > 0 ? "B" : "A" })}
                              </span>
                            ) : (
                              <span className="hint">{t("ah.ahamiyatsiz")}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <h3 className="mt-5 text-[14px] font-bold">{t("dv.muammolar")}</h3>
              <div className="table-wrap mt-1">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t("u.kategoriya")}</th>
                      <th className="num">{t("ah.bor", { g: "A" })}</th>
                      <th className="num">{t("ah.bor", { g: "B" })}</th>
                      <th className="num">{t("dv.farqPp")}</th>
                      <th className="num">{t("ah.pHolm")}</th>
                      <th>{t("ah.xulosa")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.muammolar.map((q) => {
                      const ahamiyatli = testlar && q.pHolm < ALFA;
                      return (
                        <tr key={q.kod}>
                          <td className="font-semibold">{atama.kategoriya(q.kod, q.nomi)}</td>
                          <td className="num">
                            {son(q.a.ulush)} <span className="hint">({q.a.bor}/{q.a.n})</span>
                          </td>
                          <td className="num">
                            {son(q.b.ulush)} <span className="hint">({q.b.bor}/{q.b.n})</span>
                          </td>
                          <td className="num font-bold" style={{ color: farqRangi(q.farq, ahamiyatli, false) }}>
                            {ishorali(q.farq)}
                          </td>
                          <td className="num font-bold">
                            {testlar ? pMatn(q.pHolm) : "—"}
                            <sup>{testlar ? yulduz(q.pHolm) : ""}</sup>
                          </td>
                          <td>
                            {!testlar ? (
                              <span className="hint">—</span>
                            ) : ahamiyatli ? (
                              <span className="badge whitespace-nowrap" style={{ borderColor: "var(--s1)" }}>
                                <i style={{ background: "var(--s1)" }} />
                                {t("ah.ahamiyatli")} · {t("ah.yuqori", { g: q.b.ulush > q.a.ulush ? "B" : "A" })}
                              </span>
                            ) : (
                              <span className="hint">{t("ah.ahamiyatsiz")}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {testlar && Math.min(d.a.n, d.b.n) < 5 && (
                <p className="mt-3 text-[13px] font-semibold" style={{ color: "var(--danger)" }}>
                  {t("ah.kichikGuruh", { n: Math.min(d.a.n, d.b.n) })}
                </p>
              )}
              {d.sanasiz > 0 && <p className="hint mt-3">{t("dv.sanasiz", { n: d.sanasiz })}</p>}
              <p className="hint mt-2">{t("dv.izohUsul")}</p>
            </>
          ) : null}
        </>
      )}
    </Card>
  );
}
