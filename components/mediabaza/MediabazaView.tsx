"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useFoydalanuvchi } from "@/components/auth/FoydalanuvchiProvider";
import { useTil } from "@/components/i18n/TilProvider";
import { DarajaBadge, HolatTag } from "@/components/ui/Badge";
import { Card, CardHead } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { pressable, rowIn } from "@/components/ui/motion";
import { api, xatoMatni } from "@/lib/client";
import { idRaqami, sana } from "@/lib/format";
import type { Material, MediaTuri, Nashr, ShkalaOraliq } from "@/lib/types";

interface Props {
  boshlangich: Material[];
  nashrlar: Nashr[];
  janrlar: string[];
  shkala: ShkalaOraliq[];
  yangiOchiq?: boolean;
  boshlangichHolat?: string;
}

const BOSH_FILTR = { q: "", nashr_id: "", turi: "", janr: "", holat: "", dan: "", gacha: "" };
type Filtr = typeof BOSH_FILTR;

const BOSH_FORMA = {
  nashr_id: "",
  sana: "",
  janr: "",
  mavzu: "",
  havola: "",
  sarlavha: "",
  lid: "",
  matn: "",
};
type Forma = typeof BOSH_FORMA;

export function MediabazaView({
  boshlangich,
  nashrlar: dastlabkiNashrlar,
  janrlar,
  shkala,
  yangiOchiq = false,
  boshlangichHolat = "",
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const { t, atama, media, mediaQ } = useTil();
  // ekspert — faqat ko‘radi va o‘z tahliliga o‘tadi (asosiy tahlil PDF’i va tahrirlash — administratorga)
  const { admin } = useFoydalanuvchi();

  const [nashrlar, setNashrlar] = useState(dastlabkiNashrlar);
  const [rows, setRows] = useState(boshlangich);
  const [filtr, setFiltr] = useState<Filtr>({ ...BOSH_FILTR, holat: boshlangichHolat });
  const [yuklanmoqda, setYuklanmoqda] = useState(false);

  const [formaOchiq, setFormaOchiq] = useState(yangiOchiq);
  const [tahrirId, setTahrirId] = useState<number | null>(null);
  const [forma, setForma] = useState<Forma>(BOSH_FORMA);
  const [formaXato, setFormaXato] = useState("");
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);

  const [nashrOchiq, setNashrOchiq] = useState(false);
  const [nashrXato, setNashrXato] = useState("");
  const [yangiNashr, setYangiNashr] = useState<{ nomi: string; turi: MediaTuri }>({ nomi: "", turi: "bosma" });

  const sorovNo = useRef(0);

  const royxatniYuklash = useCallback(async (f: Filtr) => {
    const no = ++sorovNo.current;
    setYuklanmoqda(true);
    try {
      const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]);
      const natija = await api.get<Material[]>(`/api/materiallar?${qs}`);
      if (no === sorovNo.current) setRows(natija);
    } catch (e) {
      toast(xatoMatni(e), "error");
    } finally {
      if (no === sorovNo.current) setYuklanmoqda(false);
    }
  }, [toast]);

  useEffect(() => {
    const t = setTimeout(() => royxatniYuklash(filtr), filtr.q ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtr]);

  const nashrlarniYangilash = useCallback(async () => {
    setNashrlar(await api.get<Nashr[]>("/api/nashrlar"));
  }, []);

  function formaniOchish(m?: Material) {
    setFormaXato("");
    setTahrirId(m?.id ?? null);
    setForma(
      m
        ? {
            nashr_id: String(m.nashr_id),
            sana: m.sana ?? "",
            janr: m.janr ?? "",
            mavzu: m.mavzu ?? "",
            havola: m.havola ?? "",
            sarlavha: m.sarlavha,
            lid: m.lid ?? "",
            matn: m.matn ?? "",
          }
        : BOSH_FORMA,
    );
    setFormaOchiq(true);
  }

  async function tahrirlash(id: number) {
    try {
      formaniOchish(await api.get<Material>(`/api/materiallar/${id}`));
    } catch (e) {
      toast(xatoMatni(e), "error");
    }
  }

  async function saqlash(tahlilgaOtish: boolean) {
    setSaqlanmoqda(true);
    setFormaXato("");
    try {
      const body = { ...forma, nashr_id: Number(forma.nashr_id) };
      const javob = tahrirId
        ? await api.put<{ id: number }>(`/api/materiallar/${tahrirId}`, body)
        : await api.post<{ id: number }>("/api/materiallar", body);
      setFormaOchiq(false);
      if (tahlilgaOtish) {
        router.push(`/tahlil/${javob.id}`);
        return;
      }
      toast(tahrirId ? t("mb.yangilandi") : t("mb.qoshildi", { id: idRaqami(javob.id) }));
      await Promise.all([royxatniYuklash(filtr), nashrlarniYangilash()]);
      router.refresh();
    } catch (e) {
      setFormaXato(xatoMatni(e));
    } finally {
      setSaqlanmoqda(false);
    }
  }

  async function ochirish(m: Material) {
    if (!confirm(t("mb.ochirishTasdiq", { v: m.sarlavha }))) return;
    try {
      await api.del(`/api/materiallar/${m.id}`);
      setRows((r) => r.filter((x) => x.id !== m.id));
      toast(t("mb.ochirildi"));
      nashrlarniYangilash();
      router.refresh();
    } catch (e) {
      toast(xatoMatni(e), "error");
    }
  }

  async function nashrAmali(fn: () => Promise<unknown>, xabar: string) {
    setNashrXato("");
    try {
      await fn();
      await nashrlarniYangilash();
      await royxatniYuklash(filtr);
      toast(xabar);
      router.refresh();
    } catch (e) {
      setNashrXato(xatoMatni(e));
    }
  }

  const maydon = (k: keyof Filtr) => ({
    value: filtr[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFiltr((f) => ({ ...f, [k]: e.target.value })),
  });

  const formaMaydon = (k: keyof Forma) => ({
    value: forma[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForma((f) => ({ ...f, [k]: e.target.value })),
  });

  return (
    <div className="flex flex-col gap-5">
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <div className="eyebrow">{t("mb.eyebrow")}</div>
          <h1 className="mt-1.5 flex flex-wrap items-center gap-3">
            {t("nav.mediabaza")}
            {!admin && <span className="tag">{t("nav.faqatKorish")}</span>}
          </h1>
          <p className="hint mt-2">{t("mb.izoh")}</p>
        </div>
        {admin && (
        <div className="flex flex-wrap gap-2.5">
          <motion.div {...pressable}>
            <Link className="btn" href="/mediabaza/import">
              {t("mb.import")}
            </Link>
          </motion.div>
          <motion.button className="btn" onClick={() => setNashrOchiq(true)} {...pressable}>
            {t("mb.nashrlar")}
          </motion.button>
          <motion.button className="btn btn-primary" onClick={() => formaniOchish()} {...pressable}>
            {t("mb.yangi")}
          </motion.button>
        </div>
        )}
      </motion.header>

      <Card koarish={false} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[2fr_repeat(4,1fr)_repeat(2,0.9fr)]">
          <label className="field">
            <span>{t("mb.qidiruv")}</span>
            <input type="search" placeholder={t("mb.qidiruvPh")} {...maydon("q")} />
          </label>
          <label className="field">
            <span>{t("u.nashr")}</span>
            <select {...maydon("nashr_id")}>
              <option value="">{t("u.barchaNashrlar")}</option>
              {nashrlar.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nomi}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t("u.mediaTuri")}</span>
            <select {...maydon("turi")}>
              <option value="">{t("u.barchasi")}</option>
              <option value="bosma">{t("u.bosma")}</option>
              <option value="raqamli">{t("u.raqamli")}</option>
            </select>
          </label>
          <label className="field">
            <span>{t("u.janr")}</span>
            <select {...maydon("janr")}>
              <option value="">{t("u.barchaJanrlar")}</option>
              {janrlar.map((j) => (
                <option key={j} value={j}>
                  {atama.janr(j)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t("mb.holat")}</span>
            <select {...maydon("holat")}>
              <option value="">{t("u.barchasi")}</option>
              <option value="tahlil_qilingan">{t("mb.h.qilingan")}</option>
              <option value="toliq_emas">{t("mb.h.toliqEmas")}</option>
              <option value="tahlil_qilinmagan">{t("mb.h.qilinmagan")}</option>
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
        </div>
      </Card>

      <Card koarish={false} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <CardHead
          title={t("u.nMaterial", { n: rows.length })}
          ong={
            <button className="btn btn-ghost btn-sm" onClick={() => setFiltr(BOSH_FILTR)}>
              {t("mb.filtrTozalash")}
            </button>
          }
        />
        <motion.div animate={{ opacity: yuklanmoqda ? 0.55 : 1 }} transition={{ duration: 0.2 }} className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>{t("u.nashr")}</th>
                <th className="num">{t("u.sana")}</th>
                <th>{t("u.janr")}</th>
                <th>{t("u.mavzu")}</th>
                <th>{t("u.sarlavha")}</th>
                <th>{t("mb.holatLpsi")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {rows.map((m) => (
                  <motion.tr key={m.id} variants={rowIn} initial="hidden" animate="show" exit="exit" layout>
                    <td className="id">{idRaqami(m.id)}</td>
                    <td>
                      <div className="font-semibold">{m.nashr}</div>
                      <div className="hint">{media(m.turi)}</div>
                    </td>
                    <td className="num">{sana(m.sana)}</td>
                    <td>{m.janr ? atama.janr(m.janr) : "—"}</td>
                    <td>{m.mavzu || "—"}</td>
                    <td className="min-w-[260px]">
                      <Link href={`/tahlil/${m.id}`}>{m.sarlavha}</Link>
                    </td>
                    <td>
                      <DarajaBadge daraja={m.daraja} lpsi={m.lpsi} shkala={shkala} />
                      <HolatTag tahlilBor={m.tahlil_bor} lpsi={m.lpsi} />
                    </td>
                    <td>
                      <div className="flex justify-end gap-1.5 whitespace-nowrap">
                        <Link className="btn btn-sm btn-primary" href={`/tahlil/${m.id}`}>
                          {t("mb.tahlil")}
                        </Link>
                        {admin && m.tahlil_bor ? (
                          <a className="btn btn-sm" href={`/api/materiallar/${m.id}/pdf`} target="_blank" rel="noopener">
                            PDF
                          </a>
                        ) : null}
                        {admin && (
                          <>
                            <button className="btn btn-sm" onClick={() => tahrirlash(m.id)}>
                              {t("u.tahrirlash")}
                            </button>
                            <button className="btn btn-sm btn-danger" onClick={() => ochirish(m)}>
                              {t("u.ochirish")}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {!rows.length && (
                <tr>
                  <td colSpan={8} className="py-10 text-center" style={{ color: "var(--muted)" }}>
                    {Object.values(filtr).some(Boolean) ? t("mb.topilmadi") : t("mb.bosh")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </motion.div>
      </Card>

      <Dialog
        open={formaOchiq}
        onClose={() => setFormaOchiq(false)}
        title={tahrirId ? t("mb.tahrirSarlavha", { id: idRaqami(tahrirId) }) : t("mb.yangiSarlavha")}
        keng
        footer={
          <>
            <button className="btn" onClick={() => setFormaOchiq(false)}>
              {t("u.bekor")}
            </button>
            <button className="btn" disabled={saqlanmoqda} onClick={() => saqlash(true)}>
              {t("mb.saqlashTahlil")}
            </button>
            <button className="btn btn-primary" disabled={saqlanmoqda} onClick={() => saqlash(false)}>
              {saqlanmoqda ? t("u.saqlanmoqda") : t("u.saqlash")}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <label className="field">
            <span>{t("u.nashr")} *</span>
            <select {...formaMaydon("nashr_id")}>
              <option value="">{t("u.tanlang")}</option>
              {nashrlar.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nomi} — {mediaQ(n.turi)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t("u.sana")}</span>
            <input type="date" {...formaMaydon("sana")} />
          </label>
          <label className="field">
            <span>{t("u.janr")}</span>
            <input type="text" list="janrlar" placeholder={t("mb.janrPh")} {...formaMaydon("janr")} />
            <datalist id="janrlar">
              {janrlar.map((j) => (
                <option key={j} value={j} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span>{t("u.mavzu")}</span>
            <input type="text" placeholder={t("mb.mavzuPh")} {...formaMaydon("mavzu")} />
          </label>
          <label className="field sm:col-span-2">
            <span>{t("u.havola")}</span>
            <input type="url" placeholder="https://…" {...formaMaydon("havola")} />
          </label>
          <label className="field sm:col-span-3">
            <span>{t("u.sarlavha")} *</span>
            <textarea rows={2} className="!min-h-[54px]" {...formaMaydon("sarlavha")} />
          </label>
          <label className="field sm:col-span-3">
            <span>{t("u.lid")}</span>
            <textarea rows={3} {...formaMaydon("lid")} />
          </label>
          <label className="field sm:col-span-3">
            <span>{t("u.matn")}</span>
            <textarea rows={10} {...formaMaydon("matn")} />
          </label>
        </div>
        <AnimatePresence>
          {formaXato && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 rounded-xl border-2 px-4 py-3 text-[13px] font-semibold"
              style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
            >
              {formaXato}
            </motion.p>
          )}
        </AnimatePresence>
      </Dialog>

      <Dialog open={nashrOchiq} onClose={() => setNashrOchiq(false)} title={t("mb.nashrlar")}>
        <p className="hint mb-3">{t("mb.nashrTuriIzoh")}</p>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{t("mb.nomi")}</th>
                <th>{t("u.mediaTuri")}</th>
                <th className="num">{t("u.materiallarSoni")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {nashrlar.map((n) => (
                <tr key={n.id}>
                  <td>
                    <input
                      type="text"
                      defaultValue={n.nomi}
                      onChange={(e) => (n.nomi = e.target.value)}
                      id={`nashr-nomi-${n.id}`}
                    />
                  </td>
                  <td>
                    <select defaultValue={n.turi} id={`nashr-turi-${n.id}`}>
                      <option value="bosma">{t("u.bosma")}</option>
                      <option value="raqamli">{t("u.raqamli")}</option>
                    </select>
                  </td>
                  <td className="num">{n.materiallar_soni}</td>
                  <td>
                    <div className="flex justify-end gap-1.5">
                      <button
                        className="btn btn-sm"
                        onClick={() =>
                          nashrAmali(
                            () =>
                              api.put(`/api/nashrlar/${n.id}`, {
                                nomi: (document.getElementById(`nashr-nomi-${n.id}`) as HTMLInputElement).value,
                                turi: (document.getElementById(`nashr-turi-${n.id}`) as HTMLSelectElement).value,
                              }),
                            t("mb.nashrSaqlandi"),
                          )
                        }
                      >
                        {t("u.saqlash")}
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        disabled={!!n.materiallar_soni}
                        title={n.materiallar_soni ? t("mb.nashrOchirilmaydi") : undefined}
                        onClick={() => {
                          if (confirm(t("mb.nashrOchirishTasdiq", { v: n.nomi }))) {
                            nashrAmali(() => api.del(`/api/nashrlar/${n.id}`), t("mb.nashrOchirildi"));
                          }
                        }}
                      >
                        {t("u.ochirish")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="field flex-1">
            <span>{t("mb.yangiNashrNomi")}</span>
            <input
              type="text"
              value={yangiNashr.nomi}
              onChange={(e) => setYangiNashr((v) => ({ ...v, nomi: e.target.value }))}
            />
          </label>
          <label className="field w-40">
            <span>{t("u.mediaTuri")}</span>
            <select
              value={yangiNashr.turi}
              onChange={(e) => setYangiNashr((v) => ({ ...v, turi: e.target.value as MediaTuri }))}
            >
              <option value="bosma">{t("u.bosma")}</option>
              <option value="raqamli">{t("u.raqamli")}</option>
            </select>
          </label>
          <button
            className="btn btn-primary"
            onClick={() =>
              nashrAmali(async () => {
                await api.post("/api/nashrlar", yangiNashr);
                setYangiNashr({ nomi: "", turi: "bosma" });
              }, t("mb.nashrQoshildi"))
            }
          >
            {t("u.qoshish")}
          </button>
        </div>
        {nashrXato && (
          <p className="mt-3 text-[13px] font-semibold" style={{ color: "var(--danger)" }}>
            {nashrXato}
          </p>
        )}
      </Dialog>
    </div>
  );
}
