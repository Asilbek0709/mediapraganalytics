"use client";

import { motion } from "framer-motion";
import { ArrowRight, KeyRound, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useState } from "react";

import { useTil } from "@/components/i18n/TilProvider";
import { Sozlamalar } from "@/components/ui/Sozlamalar";
import { fadeUp, stagger } from "@/components/ui/motion";
import { MIN_PAROL_UZUNLIGI } from "@/lib/parolQoidasi";

/** Kirish yoki (hali administrator bo‘lmasa) birinchi administratorni yaratish. */
export function KirishView({ sozlash, kalitKerak, keyin }: { sozlash: boolean; kalitKerak: boolean; keyin: string | null }) {
  const { t } = useTil();
  const [email, setEmail] = useState("");
  const [parol, setParol] = useState("");
  const [takror, setTakror] = useState("");
  const [ism, setIsm] = useState("");
  const [kalit, setKalit] = useState("");
  const [xato, setXato] = useState<string | null>(null);
  const [band, setBand] = useState(false);

  async function yuborish(e: React.FormEvent) {
    e.preventDefault();
    setXato(null);
    if (sozlash && parol !== takror) return setXato(t("au.parolMos"));
    setBand(true);
    try {
      const res = await fetch(sozlash ? "/api/sozlash" : "/api/kirish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sozlash ? { email, parol, ism, kalit } : { email, parol, keyin }),
      });
      const d = (await res.json().catch(() => ({}))) as { yonalish?: string; detail?: string };
      if (!res.ok) throw new Error(d.detail ?? t("u.xatolik", { s: res.status }));
      // To‘liq qayta yuklash — sarlavha va menyu yangi foydalanuvchi bilan chiziladi
      window.location.assign(d.yonalish ?? "/");
    } catch (e) {
      setXato(e instanceof Error ? e.message : t("u.kutilmaganXato"));
      setBand(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-[460px] flex-col justify-center py-6">
      <motion.div
        className="mb-7 flex flex-col items-center text-center"
        initial={{ opacity: 0, y: -10, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        <span className="logo-mark logo-mark-katta" aria-hidden>
          MP
        </span>
        <div className="mt-5 text-[26px] font-extrabold tracking-tight" style={{ color: "var(--ink)" }}>
          MediaPrag<span className="text-aurora">-Analytics</span>
        </div>
        <p className="hint mt-1.5 max-w-[36ch]">{t("nav.brendSub")}</p>
      </motion.div>

      <div className="kirish-halqa">
      <motion.form
        onSubmit={yuborish}
        className="card flex flex-col gap-4 !p-7"
        variants={stagger(0.05, 0.15)}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={fadeUp}>
          <h1 className="!text-[24px]">{sozlash ? t("au.sozlash") : t("au.kirish")}</h1>
          <p className="hint mt-2">{sozlash ? t("au.sozlashIzoh") : t("au.kirishIzoh")}</p>
        </motion.div>
        {sozlash && (
          <motion.label variants={fadeUp} className="field kirish-maydon">
            <span>{t("au.ism")}</span>
            <UserRound size={16} className="kirish-belgi" aria-hidden />
            <input type="text" required value={ism} onChange={(e) => setIsm(e.target.value)} autoComplete="name" maxLength={200} />
          </motion.label>
        )}
        <motion.label variants={fadeUp} className="field kirish-maydon">
          <span>{t("au.email")}</span>
          <Mail size={16} className="kirish-belgi" aria-hidden />
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus />
        </motion.label>
        <motion.label variants={fadeUp} className="field kirish-maydon">
          <span>{t("au.parol")}</span>
          <LockKeyhole size={16} className="kirish-belgi" aria-hidden />
          <input
            type="password"
            required
            minLength={sozlash ? MIN_PAROL_UZUNLIGI : undefined}
            value={parol}
            onChange={(e) => setParol(e.target.value)}
            autoComplete={sozlash ? "new-password" : "current-password"}
          />
          {sozlash && <span className="hint !font-normal">{t("au.parolTalab", { n: MIN_PAROL_UZUNLIGI })}</span>}
        </motion.label>
        {sozlash && (
          <motion.label variants={fadeUp} className="field kirish-maydon">
            <span>{t("au.parolTakror")}</span>
            <LockKeyhole size={16} className="kirish-belgi" aria-hidden />
            <input type="password" required value={takror} onChange={(e) => setTakror(e.target.value)} autoComplete="new-password" />
          </motion.label>
        )}
        {sozlash && kalitKerak && (
          <motion.label variants={fadeUp} className="field kirish-maydon">
            <span>{t("au.kalit")}</span>
            <KeyRound size={16} className="kirish-belgi" aria-hidden />
            <input type="password" required value={kalit} onChange={(e) => setKalit(e.target.value)} autoComplete="off" />
            <span className="hint !font-normal">{t("au.kalitIzoh")}</span>
          </motion.label>
        )}
        {xato && (
          <p role="alert" className="text-[13.5px] font-semibold" style={{ color: "var(--danger)" }}>
            {xato}
          </p>
        )}
        <motion.button variants={fadeUp} className="btn btn-primary group mt-1 !py-3" type="submit" disabled={band}>
          {band ? t("au.kirilmoqda") : sozlash ? t("au.yaratishKirish") : t("au.kirish")}
          {!band && <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-1" />}
        </motion.button>
      </motion.form>
      </div>

      <motion.div className="mx-auto mt-6 w-full max-w-[300px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        <Sozlamalar id="kirish" />
      </motion.div>
    </div>
  );
}
