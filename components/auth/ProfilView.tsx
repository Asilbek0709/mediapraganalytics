"use client";

import { motion } from "framer-motion";
import { useState } from "react";

import { useTil } from "@/components/i18n/TilProvider";
import { Card, CardHead } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { api, xatoMatni } from "@/lib/client";
import { MIN_PAROL_UZUNLIGI } from "@/lib/parolQoidasi";
import type { Rol } from "@/lib/ruxsat";

export interface ProfilMalumoti {
  ism: string;
  email: string;
  rol: Rol;
  ekspert: string | null;
  majburiy: boolean;
  bosh: string;
  /** umumiy demo hisobi: parol yo‘q, almashtirish formasi ko‘rsatilmaydi */
  demo?: boolean;
}

/** Sessiyani tugatib, berilgan sahifaga to‘liq yuklash bilan o‘tadi (menyu va foydalanuvchi yangilanadi). */
export async function chiqibOtish(manzil: string) {
  await fetch("/api/chiqish", { method: "POST" }).catch(() => {});
  window.location.assign(manzil);
}

export const chiqish = () => chiqibOtish("/kirish");

export function ProfilView({ p }: { p: ProfilMalumoti }) {
  const { t } = useTil();
  const toast = useToast();
  const [eski, setEski] = useState("");
  const [yangi, setYangi] = useState("");
  const [takror, setTakror] = useState("");
  const [band, setBand] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function almashtirish(e: React.FormEvent) {
    e.preventDefault();
    setXato(null);
    if (yangi !== takror) return setXato(t("au.parolMos"));
    setBand(true);
    try {
      await api.post("/api/parol", { eski, yangi });
      toast(t("au.parolAlmashtirildi"));
      setEski("");
      setYangi("");
      setTakror("");
      // Majburiy almashtirishdan keyin — o‘z bosh sahifasiga (to‘liq yuklash: menyu yangilanadi)
      if (p.majburiy) window.location.assign(p.bosh);
    } catch (err) {
      setXato(xatoMatni(err));
    } finally {
      setBand(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1>{t("au.profil")}</h1>
      </motion.header>

      {p.majburiy && (
        <div className="card !p-4" role="alert" style={{ borderColor: "var(--lvl-1)" }}>
          <p className="font-semibold" style={{ color: "var(--lvl-1)" }}>
            {t("au.majburiy")}
          </p>
        </div>
      )}

      <Card koarish={false} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <span className="hint">{t("au.ism")}</span>
          <span className="font-semibold">{p.ism}</span>
          {!p.demo && (
            <>
              <span className="hint">{t("au.email")}</span>
              <span className="font-semibold">{p.email}</span>
            </>
          )}
          <span className="hint">{t("au.rol")}</span>
          <span className="font-semibold">
            {p.demo ? t("bh.demoRol") : t(`au.rol.${p.rol}`)}{" "}
            <span className="hint !font-normal">— {t(`au.rolIzoh.${p.rol}`)}</span>
          </span>
          {p.rol === "ekspert" && (
            <>
              <span className="hint">{t("au.ekspertYozuvi")}</span>
              <span className="font-semibold">{p.ekspert ?? t("au.bogLanmagan")}</span>
            </>
          )}
        </div>
        {p.demo && <p className="hint mt-3 max-w-[70ch]">{t("bh.profilDemo")}</p>}
        {!p.majburiy && (
          <button type="button" className="btn mt-4" onClick={() => void (p.demo ? chiqibOtish("/") : chiqish())}>
            {p.demo ? t("bh.demoChiqish") : t("au.chiqish")}
          </button>
        )}
      </Card>

      {!p.demo && (
      <Card koarish={false} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <CardHead title={t("au.parolAlmashtirish")} izoh={t("au.parolTalab", { n: MIN_PAROL_UZUNLIGI })} />
        <form onSubmit={almashtirish} className="grid max-w-[420px] gap-3">
          <label className="field">
            <span>{t("au.joriyParol")}</span>
            <input type="password" required value={eski} onChange={(e) => setEski(e.target.value)} autoComplete="current-password" />
          </label>
          <label className="field">
            <span>{t("au.yangiParol")}</span>
            <input
              type="password"
              required
              minLength={MIN_PAROL_UZUNLIGI}
              value={yangi}
              onChange={(e) => setYangi(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="field">
            <span>{t("au.parolTakror")}</span>
            <input type="password" required value={takror} onChange={(e) => setTakror(e.target.value)} autoComplete="new-password" />
          </label>
          {xato && (
            <p role="alert" className="text-[13.5px] font-semibold" style={{ color: "var(--danger)" }}>
              {xato}
            </p>
          )}
          <div className="flex gap-2">
            <button className="btn btn-primary" type="submit" disabled={band}>
              {t("au.parolAlmashtirish")}
            </button>
            {p.majburiy && (
              <button className="btn" type="button" onClick={chiqish}>
                {t("au.chiqish")}
              </button>
            )}
          </div>
        </form>
      </Card>
      )}
    </div>
  );
}
