"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, KeyRound, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useState } from "react";

import { useTil } from "@/components/i18n/TilProvider";
import { Sozlamalar } from "@/components/ui/Sozlamalar";
import { Tabs } from "@/components/ui/Tabs";
import { MIN_PAROL_UZUNLIGI } from "@/lib/parolQoidasi";

type Rejim = "kirish" | "royxat" | "sozlash";

/**
 * Kirish, ochiq ro‘yxatdan o‘tish (oddiy foydalanuvchi — kuzatuvchi roli) yoki
 * (hali administrator bo‘lmasa) birinchi administratorni yaratish.
 */
export function KirishView({
  sozlash,
  kalitKerak,
  keyin,
  royxatOchiq = false,
}: {
  sozlash: boolean;
  kalitKerak: boolean;
  keyin: string | null;
  royxatOchiq?: boolean;
}) {
  const { t } = useTil();
  const [rejim, setRejim] = useState<Rejim>(sozlash ? "sozlash" : "kirish");
  const [email, setEmail] = useState("");
  const [parol, setParol] = useState("");
  const [takror, setTakror] = useState("");
  const [ism, setIsm] = useState("");
  const [kalit, setKalit] = useState("");
  // botlar uchun tuzoq: odam ko‘rmaydi va to‘ldirmaydi
  const [vebSayt, setVebSayt] = useState("");
  const [xato, setXato] = useState<string | null>(null);
  const [band, setBand] = useState(false);
  const yangiHisob = rejim !== "kirish";

  function almashtir(r: Rejim) {
    setRejim(r);
    setXato(null);
    setTakror("");
  }

  async function yuborish(e: React.FormEvent) {
    e.preventDefault();
    setXato(null);
    if (yangiHisob && parol !== takror) return setXato(t("au.parolMos"));
    setBand(true);
    const [manzil, body] =
      rejim === "sozlash"
        ? ["/api/sozlash", { email, parol, ism, kalit }]
        : rejim === "royxat"
          ? ["/api/royxat", { email, parol, takror, ism, veb_sayt: vebSayt }]
          : ["/api/kirish", { email, parol, keyin }];
    try {
      const res = await fetch(manzil, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = (await res.json().catch(() => ({}))) as { yonalish?: string; detail?: string };
      if (!res.ok) throw new Error(d.detail ?? t("u.xatolik", { s: res.status }));
      // To‘liq qayta yuklash — sarlavha va menyu yangi foydalanuvchi bilan chiziladi
      window.location.assign(d.yonalish ?? "/");
    } catch (er) {
      setXato(er instanceof Error ? er.message : t("u.kutilmaganXato"));
      setBand(false);
    }
  }

  const sarlavha = rejim === "sozlash" ? t("au.sozlash") : rejim === "royxat" ? t("au.royxat") : t("au.kirish");
  const izoh = rejim === "sozlash" ? t("au.sozlashIzoh") : rejim === "royxat" ? t("au.royxatIzoh") : t("au.kirishIzoh");
  const tugma = band
    ? rejim === "royxat"
      ? t("au.royxatTayyorlanmoqda")
      : t("au.kirilmoqda")
    : rejim === "sozlash"
      ? t("au.yaratishKirish")
      : rejim === "royxat"
        ? t("au.royxatTugma")
        : t("au.kirish");

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-[460px] flex-col justify-center py-6">
      <motion.div
        className="mb-6 flex flex-col items-center text-center"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
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
        <form onSubmit={yuborish} className="card flex flex-col gap-4 !p-6 sm:!p-7">
          {!sozlash && royxatOchiq && (
            <div className="flex justify-center">
              <Tabs
                value={rejim}
                onChange={(r) => almashtir(r)}
                layoutId="kirish-rejim"
                items={[
                  { kalit: "kirish" as Rejim, nomi: t("au.kirish") },
                  { kalit: "royxat" as Rejim, nomi: t("au.royxat") },
                ]}
              />
            </div>
          )}
          <div>
            <h1 className="!text-[24px]">{sarlavha}</h1>
            <p className="hint mt-2">{izoh}</p>
          </div>

          <AnimatePresence initial={false}>
            {yangiHisob && (
              <motion.label
                key="ism"
                className="field kirish-maydon"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <span>{t("au.ism")}</span>
                <UserRound size={16} className="kirish-belgi" aria-hidden />
                <input type="text" required value={ism} onChange={(e) => setIsm(e.target.value)} autoComplete="name" maxLength={200} />
              </motion.label>
            )}
          </AnimatePresence>
          <label className="field kirish-maydon">
            <span>{t("au.email")}</span>
            <Mail size={16} className="kirish-belgi" aria-hidden />
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete={yangiHisob ? "email" : "username"} autoFocus />
          </label>
          <label className="field kirish-maydon">
            <span>{t("au.parol")}</span>
            <LockKeyhole size={16} className="kirish-belgi" aria-hidden />
            <input
              type="password"
              required
              minLength={yangiHisob ? MIN_PAROL_UZUNLIGI : undefined}
              value={parol}
              onChange={(e) => setParol(e.target.value)}
              autoComplete={yangiHisob ? "new-password" : "current-password"}
            />
            {yangiHisob && <span className="hint !font-normal">{t("au.parolTalab", { n: MIN_PAROL_UZUNLIGI })}</span>}
          </label>
          <AnimatePresence initial={false}>
            {yangiHisob && (
              <motion.label
                key="takror"
                className="field kirish-maydon"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <span>{t("au.parolTakror")}</span>
                <LockKeyhole size={16} className="kirish-belgi" aria-hidden />
                <input type="password" required value={takror} onChange={(e) => setTakror(e.target.value)} autoComplete="new-password" />
              </motion.label>
            )}
          </AnimatePresence>
          {rejim === "sozlash" && kalitKerak && (
            <label className="field kirish-maydon">
              <span>{t("au.kalit")}</span>
              <KeyRound size={16} className="kirish-belgi" aria-hidden />
              <input type="password" required value={kalit} onChange={(e) => setKalit(e.target.value)} autoComplete="off" />
              <span className="hint !font-normal">{t("au.kalitIzoh")}</span>
            </label>
          )}
          {rejim === "royxat" && (
            <label className="tuzoq" aria-hidden>
              Website
              <input type="text" tabIndex={-1} autoComplete="off" value={vebSayt} onChange={(e) => setVebSayt(e.target.value)} />
            </label>
          )}
          {xato && (
            <p role="alert" className="text-[13.5px] font-semibold" style={{ color: "var(--danger)" }}>
              {xato}
            </p>
          )}
          <button className="btn btn-primary group mt-1 !py-3" type="submit" disabled={band}>
            {tugma}
            {!band && <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-1" />}
          </button>
          {!sozlash && royxatOchiq && (
            <p className="text-center text-[13px]" style={{ color: "var(--muted)" }}>
              {rejim === "kirish" ? t("au.hisobYoqmi") : t("au.hisobBormi")}{" "}
              <button type="button" className="font-bold underline-offset-2 hover:underline" style={{ color: "var(--accent)" }} onClick={() => almashtir(rejim === "kirish" ? "royxat" : "kirish")}>
                {rejim === "kirish" ? t("au.royxat") : t("au.kirish")}
              </button>
            </p>
          )}
        </form>
      </div>

      <div className="mx-auto mt-6 w-full max-w-[300px]">
        <Sozlamalar id="kirish" />
      </div>
    </div>
  );
}
