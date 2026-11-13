"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useTil } from "@/components/i18n/TilProvider";
import { Card, CardHead, Reveal, Stagger } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { fadeUp, pressable, spring } from "@/components/ui/motion";
import { api, xatoMatni } from "@/lib/client";
import { sanaVaqt } from "@/lib/format";
import type { MetodikaTarix, MetodikaTolik } from "@/lib/types";

const MEZONLAR = ["K1", "K2", "K3", "K4", "K5"];
/** Seed yozgan v1 izohi — tarjima qilib ko‘rsatiladi; tadqiqotchi izohlari o‘zgarishsiz. */
const BOSHLANGICH_IZOH = "Boshlang‘ich metodika (III bob)";

interface Forma {
  vaznlar: Record<string, number>;
  muvofiqlik: Record<string, number>;
  kompozitsiya: Record<string, number>;
  kategoriyalar: Record<string, { mezon: string | null; jarima: number }>;
  shkala: { gacha: number; nomi: string }[];
}

function formaDan(met: MetodikaTolik): Forma {
  return {
    vaznlar: Object.fromEntries(met.mezonlar.map((m) => [m.kod, m.vazn])),
    muvofiqlik: Object.fromEntries((met.lugat.muvofiqlik ?? []).map((o) => [o.kod, o.qiymat ?? 0])),
    kompozitsiya: Object.fromEntries((met.lugat.kompozitsiya ?? []).map((o) => [o.kod, o.qiymat ?? 0])),
    kategoriyalar: Object.fromEntries(met.kategoriyalar.map((k) => [k.kod, { mezon: k.mezon, jarima: k.jarima }])),
    shkala: met.shkala.map((s) => ({ ...s })),
  };
}

export function MetodikaView({ met, tarix }: { met: MetodikaTolik; tarix: MetodikaTarix[] }) {
  const toast = useToast();
  const router = useRouter();
  const { t, son, atama, til } = useTil();
  const [forma, setForma] = useState<Forma>(() => formaDan(met));
  const [izoh, setIzoh] = useState("");
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);

  const jami = useMemo(
    () => Object.values(forma.vaznlar).reduce((a, b) => a + (Number(b) || 0), 0),
    [forma.vaznlar],
  );
  const jamiTogri = Math.abs(jami - 100) < 0.01;

  const raqam = (v: string) => (v === "" ? 0 : Number(v));

  async function saqlash() {
    const xabar = t("mt.saqlashTasdiq", { v: met.versiya + 1, n: met.tahlillar_soni });
    if (!confirm(xabar)) return;
    setSaqlanmoqda(true);
    try {
      const r = await api.put<{ versiya: number; qayta_hisoblangan: number }>("/api/metodika", {
        ...forma,
        izoh: izoh || null,
      });
      setIzoh("");
      toast(t("mt.saqlandi", { v: r.versiya, n: r.qayta_hisoblangan }));
      router.refresh();
    } catch (e) {
      toast(xatoMatni(e), "error");
    } finally {
      setSaqlanmoqda(false);
    }
  }

  function tarixdanYuklash(v: MetodikaTarix) {
    const s = v.snapshot;
    setForma((f) => ({
      vaznlar: { ...f.vaznlar, ...(s.vaznlar ?? {}) },
      muvofiqlik: { ...f.muvofiqlik, ...(s.muvofiqlik ?? {}) },
      kompozitsiya: { ...f.kompozitsiya, ...(s.kompozitsiya ?? {}) },
      kategoriyalar: s.kategoriyalar
        ? Object.fromEntries(
            Object.entries(f.kategoriyalar).map(([kod, joriy]) => {
              const eski = s.kategoriyalar?.[kod];
              return [kod, eski ? { mezon: eski.mezon, jarima: eski.jarima } : joriy];
            }),
          )
        : f.kategoriyalar,
      shkala: s.shkala?.length === f.shkala.length ? s.shkala.map((o) => ({ ...o })) : f.shkala,
    }));
    setIzoh(t("mt.tiklandiIzoh", { v: v.versiya }));
    toast(t("mt.yuklandi", { v: v.versiya }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="flex flex-col gap-5">
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="eyebrow">{t("mt.eyebrow")}</div>
        <h1 className="mt-1.5 flex flex-wrap items-center gap-3">
          {t("nav.metodika")} <span className="tag">{t("mt.joriyVersiya", { v: met.versiya })}</span>
        </h1>
        <p className="hint mt-2 max-w-[74ch]">{t("mt.izoh")}</p>
      </motion.header>

      <Stagger className="flex flex-col gap-4">
        <Card variants={fadeUp} koarish={false}>
          <CardHead
            title={t("mt.formula")}
            ong={
              <motion.span
                key={jamiTogri ? "ok" : "xato"}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-[13px] font-bold"
                style={{ color: jamiTogri ? "var(--ok)" : "var(--danger)" }}
              >
                {t("mt.yigindi", { v: son(jami, 2) })}
                {jamiTogri ? " ✓" : t("mt.yuzBolsin")}
              </motion.span>
            }
          />
          <div
            className="mono overflow-x-auto whitespace-nowrap rounded-xl px-4 py-3 !text-[14px]"
            style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
          >
            LPSI ={" "}
            {MEZONLAR.map((k, i) => (
              <motion.span key={k} layout transition={spring}>
                {i > 0 ? " + " : ""}
                {son((forma.vaznlar[k] ?? 0) / 100, 3)}·{k}
              </motion.span>
            ))}
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card variants={fadeUp} koarish={false}>
            <CardHead title={t("mt.mezonlar")} izoh={t("mt.mezonlarIzoh")} />
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t("mt.kod")}</th>
                    <th>{t("u.mezon")}</th>
                    <th className="num">{t("mt.vaznFoiz")}</th>
                  </tr>
                </thead>
                <tbody>
                  {met.mezonlar.map((m) => (
                    <tr key={m.kod}>
                      <td className="font-extrabold">{m.kod}</td>
                      <td>
                        <div className="font-semibold">{atama.mezon(m.kod, m.nomi)}</div>
                        <div className="hint">{atama.mezonTavsif(m.kod, m.tavsif)}</div>
                      </td>
                      <td className="num">
                        <input
                          type="number"
                          className="!w-24"
                          min={0}
                          max={100}
                          step={0.5}
                          value={forma.vaznlar[m.kod] ?? 0}
                          onChange={(e) =>
                            setForma((f) => ({ ...f, vaznlar: { ...f.vaznlar, [m.kod]: raqam(e.target.value) } }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card variants={fadeUp} koarish={false}>
            <CardHead title={t("mt.shkala")} izoh={t("mt.shkalaIzoh")} />
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th className="num">{t("mt.dan")}</th>
                    <th>{t("mt.gacha")}</th>
                    <th>{t("mt.darajaNomi")}</th>
                  </tr>
                </thead>
                <tbody>
                  {forma.shkala.map((o, i) => (
                    <tr key={i}>
                      <td className="num">{son(i === 0 ? 0 : forma.shkala[i - 1].gacha)}</td>
                      <td>
                        <input
                          type="number"
                          className="!w-24"
                          min={0}
                          max={100}
                          step={0.5}
                          readOnly={i === forma.shkala.length - 1}
                          title={i === forma.shkala.length - 1 ? t("mt.oxirgiChegara") : undefined}
                          value={o.gacha}
                          onChange={(e) =>
                            setForma((f) => ({
                              ...f,
                              shkala: f.shkala.map((s, j) => (j === i ? { ...s, gacha: raqam(e.target.value) } : s)),
                            }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          maxLength={50}
                          value={o.nomi}
                          onChange={(e) =>
                            setForma((f) => ({
                              ...f,
                              shkala: f.shkala.map((s, j) => (j === i ? { ...s, nomi: e.target.value } : s)),
                            }))
                          }
                        />
                        {til !== "uz" && atama.daraja(o.nomi) !== o.nomi && (
                          <div className="hint mt-1">{t("mt.tarjimasi", { v: atama.daraja(o.nomi) })}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card variants={fadeUp} koarish={false}>
            <CardHead title={t("mt.muvofiqlik")} izoh={t("mt.noldanBir")} />
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t("mt.holat")}</th>
                    <th className="num">{t("mt.qiymat")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(met.lugat.muvofiqlik ?? []).map((o) => (
                    <tr key={o.kod}>
                      <td className="font-semibold">{atama.lugat("muvofiqlik", o.kod, o.nomi)}</td>
                      <td className="num">
                        <input
                          type="number"
                          className="!w-24"
                          min={0}
                          max={1}
                          step={0.05}
                          value={forma.muvofiqlik[o.kod] ?? 0}
                          onChange={(e) =>
                            setForma((f) => ({
                              ...f,
                              muvofiqlik: { ...f.muvofiqlik, [o.kod]: raqam(e.target.value) },
                            }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card variants={fadeUp} koarish={false}>
            <CardHead title={t("mt.kompozitsiya")} izoh={t("mt.noldanYuz")} />
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t("mt.kompozitsiyaUstun")}</th>
                    <th className="num">{t("mt.ball")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(met.lugat.kompozitsiya ?? []).map((o) => (
                    <tr key={o.kod}>
                      <td className="font-semibold">{atama.lugat("kompozitsiya", o.kod, o.nomi)}</td>
                      <td className="num">
                        <input
                          type="number"
                          className="!w-24"
                          min={0}
                          max={100}
                          step={1}
                          value={forma.kompozitsiya[o.kod] ?? 0}
                          onChange={(e) =>
                            setForma((f) => ({
                              ...f,
                              kompozitsiya: { ...f.kompozitsiya, [o.kod]: raqam(e.target.value) },
                            }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <Card variants={fadeUp} koarish={false}>
          <CardHead
            title={t("mt.kategoriyalar")}
            izoh={t("mt.kategoriyalarIzoh")}
          />
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t("u.kategoriya")}</th>
                  <th>{t("u.guruh")}</th>
                  <th>{t("u.mezon")}</th>
                  <th className="num">{t("mt.jarima")}</th>
                </tr>
              </thead>
              <tbody>
                {met.kategoriyalar.map((k) => (
                  <tr key={k.kod}>
                    <td className="font-semibold">{atama.kategoriya(k.kod, k.nomi)}</td>
                    <td>
                      <span className="tag">{k.guruh === "muammo" ? t("u.muammo") : t("u.vosita")}</span>
                    </td>
                    <td>
                      <select
                        className="!w-44"
                        value={forma.kategoriyalar[k.kod]?.mezon ?? ""}
                        onChange={(e) =>
                          setForma((f) => ({
                            ...f,
                            kategoriyalar: {
                              ...f.kategoriyalar,
                              [k.kod]: { ...f.kategoriyalar[k.kod], mezon: e.target.value || null },
                            },
                          }))
                        }
                      >
                        <option value="">{t("mt.tasirsiz")}</option>
                        {MEZONLAR.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="num">
                      <input
                        type="number"
                        className="!w-24"
                        min={0}
                        max={100}
                        step={0.5}
                        value={forma.kategoriyalar[k.kod]?.jarima ?? 0}
                        onChange={(e) =>
                          setForma((f) => ({
                            ...f,
                            kategoriyalar: {
                              ...f.kategoriyalar,
                              [k.kod]: { ...f.kategoriyalar[k.kod], jarima: raqam(e.target.value) },
                            },
                          }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card variants={fadeUp} koarish={false}>
          <CardHead title={t("mt.yangiVersiya")} />
          <div className="flex flex-wrap items-end gap-3">
            <label className="field min-w-[260px] flex-1">
              <span>{t("mt.ozgarishIzohi")}</span>
              <input type="text" maxLength={500} value={izoh} onChange={(e) => setIzoh(e.target.value)} />
            </label>
            <motion.button className="btn btn-primary" onClick={saqlash} disabled={saqlanmoqda} {...pressable}>
              {saqlanmoqda ? t("u.saqlanmoqda") : t("mt.saqlashTugma")}
            </motion.button>
          </div>
          <AnimatePresence>
            {!jamiTogri && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 text-[13px] font-semibold"
                style={{ color: "var(--danger)" }}
              >
                {t("mt.saqlanmaydi")}
              </motion.p>
            )}
          </AnimatePresence>
        </Card>
      </Stagger>

      <Reveal>
        <Card variants={fadeUp} koarish={false}>
          <CardHead title={t("mt.tarix")} izoh={t("mt.tarixIzoh")} />
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t("mt.versiya")}</th>
                  <th className="num">{t("u.sana")}</th>
                  <th>{t("u.izoh")}</th>
                  <th>{t("mt.vaznlar")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tarix.map((v) => (
                  <tr key={v.versiya}>
                    <td className="font-extrabold">
                      v{v.versiya}
                      {v.versiya === met.versiya && <span className="tag ml-2">{t("mt.joriy")}</span>}
                    </td>
                    <td className="num">{sanaVaqt(v.sana)}</td>
                    <td>{v.izoh === BOSHLANGICH_IZOH ? t("mt.boshlangich") : (v.izoh ?? "—")}</td>
                    <td className="hint">
                      {v.snapshot.vaznlar
                        ? MEZONLAR.map((k) => `${k} ${son(v.snapshot.vaznlar?.[k])}`).join(" · ")
                        : "—"}
                    </td>
                    <td>
                      <div className="flex justify-end">
                        {v.versiya !== met.versiya && v.snapshot.vaznlar && (
                          <button className="btn btn-sm" onClick={() => tarixdanYuklash(v)}>
                            {t("mt.formagaYuklash")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
