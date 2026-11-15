"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useFoydalanuvchi } from "@/components/auth/FoydalanuvchiProvider";
import { useTil } from "@/components/i18n/TilProvider";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Card, CardHead, Reveal, Stagger } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { fadeUp, pressable, spring } from "@/components/ui/motion";
import { api, xatoMatni } from "@/lib/client";
import type { Ekspert, VaznTahlili } from "@/lib/ekspert";
import { idRaqami } from "@/lib/format";
import type { UmumiyKelishuv } from "@/lib/kelishuv";
import { guruhNomi, korsatkichNomi } from "@/lib/kelishuvNomlari";
import { wTalqini } from "@/lib/statistika";
import { AlphaBar } from "./AlphaBar";

const MEZONLAR = ["K1", "K2", "K3", "K4", "K5"];

// ------------------------------------------------------------------ vaznlar diapazoni

function VaznDiapazon({ v }: { v: VaznTahlili }) {
  const { t, son, atama } = useTil();
  const max = Math.max(40, ...v.mezonlar.map((m) => m.max ?? 0), ...v.mezonlar.map((m) => m.joriy)) * 1.1;
  const x = (val: number) => `${(val / max) * 100}%`;
  return (
    <div className="flex flex-col gap-4">
      {v.mezonlar.map((m, i) => (
        <div key={m.kod} className="grid items-center gap-3" style={{ gridTemplateColumns: "minmax(120px, 210px) 1fr 64px" }}>
          <span className="truncate text-[13px] font-semibold" title={atama.mezon(m.kod, m.nomi)}>
            {m.kod}. {atama.mezon(m.kod, m.nomi)}
          </span>
          <div className="relative h-7">
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2" style={{ background: "var(--grid)" }} />
            {m.min != null && m.max != null && (
              <motion.div
                className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
                style={{ left: x(m.min), background: "var(--s1)", opacity: 0.45 }}
                initial={{ width: 0 }}
                whileInView={{ width: `${((m.max - m.min) / max) * 100}%` }}
                viewport={{ once: true }}
                transition={{ ...spring, delay: 0.08 * i }}
                title={t("eks.oraliqTitle", { v: `${son(m.min)}–${son(m.max)}` })}
              />
            )}
            {m.ortacha != null && (
              <motion.div
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ background: "var(--s1)", border: "2px solid var(--surface)", left: x(m.ortacha) }}
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.25 + 0.08 * i }}
                title={t("eks.ortachaTitle", { v: son(m.ortacha) })}
              />
            )}
            <div
              className="absolute top-0 h-7 w-[3px] -translate-x-1/2 rounded"
              style={{ left: x(m.joriy), background: "var(--s2)" }}
              title={t("eks.joriyTitle", { v: son(m.joriy) })}
            />
          </div>
          <span className="text-right text-[13px] font-extrabold tabular-nums">{son(m.ortacha)}</span>
        </div>
      ))}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] font-semibold" style={{ color: "var(--ink-2)" }}>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: "var(--s1)" }} /> {t("eks.lgOrtacha")}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-1 w-5 rounded-full" style={{ background: "var(--s1)", opacity: 0.45 }} /> {t("eks.lgOraliq")}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3.5 w-[3px] rounded" style={{ background: "var(--s2)" }} /> {t("eks.lgJoriy")}
        </span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ asosiy

export function EkspertlarView({
  ekspertlar,
  vazn,
  kelishuv,
}: {
  ekspertlar: Ekspert[];
  vazn: VaznTahlili;
  kelishuv: UmumiyKelishuv;
}) {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const tr = useTil();
  const { t, son, atama } = tr;
  // ekspert: ro‘yxat va umumiy natijalarni ko‘radi; boshqa ekspertlarning vaznlari va
  // material bo‘yicha taqqoslash — mustaqillik uchun yashirin, tahrirlash — faqat administratorga
  const { admin } = useFoydalanuvchi();
  const [pending, startTransition] = useTransition();
  const pQiymat = (p: number) => (p < 0.001 ? `< ${son(0.001, 3)}` : son(p, 3));

  const [yangi, setYangi] = useState({ ism: "", izoh: "" });
  const [tahrir, setTahrir] = useState<Record<number, { ism: string; izoh: string }>>({});
  const [vaznForma, setVaznForma] = useState<Record<number, Record<string, string>>>(() =>
    Object.fromEntries(
      ekspertlar.map((e) => {
        const bor = vazn.vaznlar.find((v) => v.ekspert_id === e.id);
        return [e.id, Object.fromEntries(MEZONLAR.map((k) => [k, bor ? String(bor.vaznlar[k]) : ""]))];
      }),
    ),
  );

  const yangilash = () => startTransition(() => router.refresh());

  async function amal(fn: () => Promise<unknown>, xabar: string) {
    try {
      await fn();
      toast(xabar);
      yangilash();
    } catch (e) {
      toast(xatoMatni(e), "error");
    }
  }

  const jami = (id: number) => MEZONLAR.reduce((s, k) => s + (Number(vaznForma[id]?.[k]) || 0), 0);
  const k = vazn.kendall;

  return (
    <div className="flex flex-col gap-5">
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="eyebrow">{t("eks.eyebrow")}</div>
        <h1 className="mt-1.5 flex flex-wrap items-center gap-3">
          {t("nav.ekspertlar")}
          {!admin && <span className="tag">{t("nav.faqatKorish")}</span>}
        </h1>
        <p className="hint mt-2 max-w-[80ch]">{t("eks.izoh")}</p>
      </motion.header>

      <motion.div animate={{ opacity: pending ? 0.55 : 1 }} className="flex flex-col gap-5">
        {/* ------------------------------------------------ ekspertlar ro‘yxati */}
        <Stagger>
          <Card koarish={false}>
            <CardHead title={t("nav.ekspertlar")} izoh={t("eks.royxatIzoh")} />
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t("eks.ism")}</th>
                    <th>{t("eks.izohUstun")}</th>
                    <th className="num">{t("eks.tahlillar")}</th>
                    <th>{t("eks.vaznlar")}</th>
                    {admin && <th />}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {ekspertlar.map((e) => {
                      const ta = tahrir[e.id];
                      return (
                        <motion.tr key={e.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                          <td>
                            {ta ? (
                              <input type="text" value={ta.ism} onChange={(ev) => setTahrir((x) => ({ ...x, [e.id]: { ...ta, ism: ev.target.value } }))} />
                            ) : (
                              <span className="font-semibold">{e.ism}</span>
                            )}
                          </td>
                          <td>
                            {ta ? (
                              <input type="text" value={ta.izoh} onChange={(ev) => setTahrir((x) => ({ ...x, [e.id]: { ...ta, izoh: ev.target.value } }))} />
                            ) : (
                              e.izoh || "—"
                            )}
                          </td>
                          <td className="num">{e.tahlillar_soni}</td>
                          <td>{e.vazn_bor ? <span className="tag">{t("eks.toldirilgan")}</span> : <span className="hint">{t("eks.yoq")}</span>}</td>
                          {admin && (
                          <td>
                            <div className="flex justify-end gap-1.5">
                              {ta ? (
                                <>
                                  <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() =>
                                      amal(async () => {
                                        await api.put(`/api/ekspertlar/${e.id}`, ta);
                                        setTahrir(({ [e.id]: _, ...qolgan }) => qolgan);
                                      }, t("eks.saqlandi"))
                                    }
                                  >
                                    {t("u.saqlash")}
                                  </button>
                                  <button className="btn btn-sm" onClick={() => setTahrir(({ [e.id]: _, ...qolgan }) => qolgan)}>
                                    {t("u.bekor")}
                                  </button>
                                </>
                              ) : (
                                <button className="btn btn-sm" onClick={() => setTahrir((x) => ({ ...x, [e.id]: { ism: e.ism, izoh: e.izoh ?? "" } }))}>
                                  {t("u.tahrirlash")}
                                </button>
                              )}
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => {
                                  if (
                                    confirm(t("eks.ochirishTasdiq", { ism: e.ism, n: e.tahlillar_soni }))
                                  ) {
                                    amal(() => api.del(`/api/ekspertlar/${e.id}`), t("eks.ochirildi"));
                                  }
                                }}
                              >
                                {t("u.ochirish")}
                              </button>
                            </div>
                          </td>
                          )}
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                  {!ekspertlar.length && (
                    <tr>
                      <td colSpan={admin ? 5 : 4} className="py-8 text-center" style={{ color: "var(--muted)" }}>
                        {t("eks.haliYoq")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {admin && (
            <>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="field min-w-[200px] flex-1">
                <span>{t("eks.ism")}</span>
                <input type="text" value={yangi.ism} maxLength={200} onChange={(e) => setYangi((v) => ({ ...v, ism: e.target.value }))} />
              </label>
              <label className="field min-w-[220px] flex-[1.4]">
                <span>{t("eks.izohMaydon")}</span>
                <input type="text" value={yangi.izoh} onChange={(e) => setYangi((v) => ({ ...v, izoh: e.target.value }))} />
              </label>
              <motion.button
                className="btn btn-primary"
                {...pressable}
                onClick={() =>
                  amal(async () => {
                    await api.post("/api/ekspertlar", yangi);
                    setYangi({ ism: "", izoh: "" });
                  }, t("eks.qoshildi"))
                }
              >
                {t("eks.qoshish")}
              </motion.button>
            </div>
            <p className="hint mt-3">{t("eks.qandayKodlaydi")}</p>
            </>
            )}
          </Card>
        </Stagger>

        {/* ------------------------------------------------ vaznlar so‘rovi */}
        <Reveal className="flex flex-col gap-4">
          {admin && (
          <Card variants={fadeUp} koarish={false}>
            <CardHead
              title={t("eks.sorov")}
              izoh={t("eks.sorovIzoh")}
            />
            {ekspertlar.length === 0 ? (
              <p className="hint py-6 text-center">{t("eks.avvalQoshing")}</p>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t("eks.ekspert")}</th>
                      {vazn.mezonlar.map((m) => (
                        <th key={m.kod} className="num" title={atama.mezon(m.kod, m.nomi)}>
                          {m.kod}
                        </th>
                      ))}
                      <th className="num">{t("eks.jami")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {ekspertlar.map((e) => {
                      const j = jami(e.id);
                      const togri = Math.abs(j - 100) < 0.01;
                      return (
                        <tr key={e.id}>
                          <td className="font-semibold">{e.ism}</td>
                          {MEZONLAR.map((kod) => (
                            <td key={kod} className="num">
                              <input
                                type="number"
                                className="!w-20"
                                min={0}
                                max={100}
                                step={0.5}
                                value={vaznForma[e.id]?.[kod] ?? ""}
                                onChange={(ev) =>
                                  setVaznForma((f) => ({ ...f, [e.id]: { ...f[e.id], [kod]: ev.target.value } }))
                                }
                              />
                            </td>
                          ))}
                          <td className="num font-extrabold" style={{ color: togri ? "var(--ok)" : "var(--danger)" }}>
                            {son(j)}
                            {togri ? " ✓" : ""}
                          </td>
                          <td>
                            <div className="flex justify-end gap-1.5">
                              <button
                                className="btn btn-sm btn-primary"
                                disabled={!togri}
                                title={togri ? undefined : t("eks.yigindi100")}
                                onClick={() =>
                                  amal(
                                    () =>
                                      api.put(`/api/ekspertlar/${e.id}/vazn`, {
                                        vaznlar: Object.fromEntries(MEZONLAR.map((kod) => [kod, Number(vaznForma[e.id][kod])])),
                                      }),
                                    t("eks.vaznSaqlandi", { ism: e.ism }),
                                  )
                                }
                              >
                                {t("u.saqlash")}
                              </button>
                              {e.vazn_bor ? (
                                <button
                                  className="btn btn-sm btn-ghost btn-danger"
                                  aria-label={t("eks.vaznOchirish")}
                                  onClick={() =>
                                    amal(async () => {
                                      await api.del(`/api/ekspertlar/${e.id}/vazn`);
                                      setVaznForma((f) => ({ ...f, [e.id]: Object.fromEntries(MEZONLAR.map((kod) => [kod, ""])) }));
                                    }, t("eks.vaznOchirildi"))
                                  }
                                >
                                  ✕
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          )}

          {vazn.vaznlar.length > 0 && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <Card variants={fadeUp} koarish={false}>
                <CardHead title={t("eks.natija")} izoh={t("eks.natijaIzoh", { n: vazn.vaznlar.length })} />
                <VaznDiapazon v={vazn} />
                <div className="table-wrap mt-5">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{t("u.mezon")}</th>
                        <th className="num">{t("eks.joriy")}</th>
                        <th className="num">{t("eks.ortacha")}</th>
                        <th className="num">{t("eks.mediana")}</th>
                        <th className="num">SD</th>
                        <th className="num" title={t("eks.cvTitle")}>CV, %</th>
                        <th className="num">{t("eks.ortRang")}</th>
                        <th className="num">{t("eks.taklif")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vazn.mezonlar.map((m) => (
                        <tr key={m.kod}>
                          <td className="font-semibold">
                            {m.kod}. {atama.mezon(m.kod, m.nomi)}
                          </td>
                          <td className="num">{son(m.joriy)}</td>
                          <td className="num">{son(m.ortacha)}</td>
                          <td className="num">{son(m.mediana)}</td>
                          <td className="num">{son(m.sd)}</td>
                          <td className="num font-bold" style={{ color: m.cv != null && m.cv > 33 ? "var(--danger)" : undefined }}>
                            {son(m.cv)}
                          </td>
                          <td className="num">{son(m.ortacha_rang, 2)}</td>
                          <td className="num font-extrabold">{son(m.taklif)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="hint mt-2">{t("eks.taklifIzoh")}</p>
              </Card>

              <Card variants={fadeUp} koarish={false}>
                <CardHead title={t("eks.kendall")} izoh={t("eks.kendallIzoh")} />
                {k ? (
                  <>
                    <div className="flex items-end gap-3">
                      <div className="text-[48px] font-extrabold leading-none">
                        W = <AnimatedNumber value={k.W} kasr={3} />
                      </div>
                    </div>
                    <div className="mt-3 h-3 overflow-hidden rounded-full" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: k.p < 0.05 ? "var(--lvl-2)" : "var(--lvl-1)" }}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${k.W * 100}%` }}
                        viewport={{ once: true }}
                        transition={{ type: "spring", stiffness: 120, damping: 22 }}
                      />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                      <span style={{ color: "var(--muted)" }}>{t("eks.kuchi")}</span>
                      <strong>{t(`eks.w.${wTalqini(k.W)}`)}</strong>
                      <span style={{ color: "var(--muted)" }}>χ² (df = {k.df})</span>
                      <strong className="tabular-nums">{son(k.chi2, 2)}</strong>
                      <span style={{ color: "var(--muted)" }}>p</span>
                      <strong className="tabular-nums">{pQiymat(k.p)}</strong>
                      <span style={{ color: "var(--muted)" }}>{t("eks.mn")}</span>
                      <strong>
                        {k.m} × {k.n}
                      </strong>
                    </div>
                    <p
                      className="mt-4 rounded-xl border-2 px-3.5 py-2.5 text-[13px] font-semibold"
                      style={{ borderColor: k.p < 0.05 ? "var(--lvl-2)" : "var(--lvl-1)" }}
                    >
                      {k.p < 0.05 ? t("eks.ahamiyatli") : t("eks.ahamiyatsiz")}
                    </p>
                    {k.m < 3 && <p className="hint mt-2">{t("eks.kamida3")}</p>}
                    {admin && (
                    <motion.button
                      className="btn btn-primary mt-4 w-full"
                      {...pressable}
                      onClick={() => {
                        const taklif = vazn.mezonlar.map((m) => `${m.kod} = ${son(m.taklif)}`).join(", ");
                        if (!confirm(t("eks.qollashTasdiq", { v: taklif }))) return;
                        amal(async () => {
                          const r = await api.post<{ versiya: number }>("/api/vaznlar/qollash");
                          toast(t("eks.qollandi", { v: r.versiya }));
                        }, t("eks.qaytaHisoblandi"));
                      }}
                    >
                      {t("eks.qollash")}
                    </motion.button>
                    )}
                  </>
                ) : (
                  <p className="hint py-6 text-center">{t("eks.kendallKam")}</p>
                )}
              </Card>
            </div>
          )}
        </Reveal>

        {/* ------------------------------------------------ kodlash kelishuvi */}
        <Reveal className="flex flex-col gap-4">
          <Card variants={fadeUp} koarish={false}>
            <CardHead
              title={t("eks.alphaSarlavha")}
              izoh={t("eks.alphaIzoh", { m: kelishuv.materiallar, n: kelishuv.materiallar, b: kelishuv.baholovchilar })}
              ong={
                <Tabs
                  value={kelishuv.asosiy ? "ha" : "yoq"}
                  layoutId="asosiy-tab"
                  items={[
                    { kalit: "ha", nomi: t("eks.tadqiqotchiBilan") },
                    { kalit: "yoq", nomi: t("eks.faqatEkspertlar") },
                  ]}
                  onChange={(v) =>
                    startTransition(() => router.replace(v === "ha" ? pathname : `${pathname}?asosiy=0`, { scroll: false }))
                  }
                />
              }
            />
            {kelishuv.materiallar === 0 ? (
              <p className="hint py-8 text-center">{t("eks.materialYoq")}</p>
            ) : (
              <>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{t("eks.korsatkich")}</th>
                        <th>{t("eks.olchov")}</th>
                        <th>Krippendorff α</th>
                        <th className="num" title={t("eks.mosTitle")}>
                          {t("eks.mos")}
                        </th>
                        <th className="num">{t("u.materiallar")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kelishuv.qatorlar.map((q, i) => {
                        const yangiGuruh = i === 0 || kelishuv.qatorlar[i - 1].guruh !== q.guruh;
                        return [
                          yangiGuruh ? (
                            <tr key={`g-${q.guruh}`}>
                              <td colSpan={5} className="!pt-4 text-[11.5px] font-extrabold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                                {guruhNomi(q.guruh, tr)}
                              </td>
                            </tr>
                          ) : null,
                          <tr key={q.kalit}>
                            <td className="font-semibold">{korsatkichNomi(q.kalit, tr)}</td>
                            <td>
                              <span className="tag">{t(`eks.d.${q.daraja}`)}</span>
                            </td>
                            <td>
                              <AlphaBar alpha={q.alpha} talqin={q.talqin} kechikish={0.04 * i} />
                            </td>
                            <td className="num">
                              {q.kelishuv != null ? `${son(q.kelishuv)}%` : q.farq != null ? `±${son(q.farq)}` : "—"}
                            </td>
                            <td className="num">{q.birliklar}</td>
                          </tr>,
                        ];
                      })}
                    </tbody>
                  </table>
                </div>
                <details className="mt-4">
                  <summary className="cursor-pointer text-[13px] font-bold" style={{ color: "var(--accent)" }}>
                    {t("eks.kategoriyalarBoyicha")}
                  </summary>
                  <div className="table-wrap mt-2">
                    <table className="data">
                      <thead>
                        <tr>
                          <th>{t("u.kategoriya")}</th>
                          <th>{t("u.guruh")}</th>
                          <th>{t("eks.alphaInterval")}</th>
                          <th className="num">{t("eks.ortFarq")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kelishuv.kategoriyalar.map((q) => (
                          <tr key={q.kalit}>
                            <td className="font-semibold">{korsatkichNomi(q.kalit, tr)}</td>
                            <td>
                              <span className="tag">{q.guruh === "muammo" ? t("u.muammo") : t("u.vosita")}</span>
                            </td>
                            <td>
                              <AlphaBar alpha={q.alpha} talqin={q.talqin} />
                            </td>
                            <td className="num">{q.farq != null ? `±${son(q.farq)}` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
                <p className="hint mt-4">{t("eks.talqin")}</p>
              </>
            )}
          </Card>

          {admin && kelishuv.royxat.length > 0 && (
            <Card variants={fadeUp} koarish={false}>
              <CardHead title={t("eks.kopBaholovchi")} />
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>{t("u.sarlavha")}</th>
                      <th>{t("u.nashr")}</th>
                      <th className="num">{t("eks.baholovchilar")}</th>
                      <th className="num">{t("eks.lpsiOraligi")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {kelishuv.royxat.map((r) => (
                      <tr key={r.id}>
                        <td className="id">{idRaqami(r.id)}</td>
                        <td className="min-w-[240px]">{r.sarlavha}</td>
                        <td>{r.nashr}</td>
                        <td className="num">{r.baholovchilar}</td>
                        <td className="num">
                          {r.lpsi_min == null ? "—" : r.lpsi_min === r.lpsi_max ? son(r.lpsi_min) : `${son(r.lpsi_min)}–${son(r.lpsi_max)}`}
                        </td>
                        <td>
                          <div className="flex justify-end">
                            <Link className="btn btn-sm" href={`/kelishuv/${r.id}${kelishuv.asosiy ? "" : "?asosiy=0"}`}>
                              {t("eks.solishtirish")}
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </Reveal>
      </motion.div>
    </div>
  );
}
