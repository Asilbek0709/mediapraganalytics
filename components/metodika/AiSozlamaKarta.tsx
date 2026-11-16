"use client";

import { motion } from "framer-motion";
import { KeyRound, Sparkles } from "lucide-react";
import { useState } from "react";

import { useTil } from "@/components/i18n/TilProvider";
import { Card, CardHead } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import type { AiHolati } from "@/lib/ai/taklif";
import { api, xatoMatni } from "@/lib/client";

/** «Metodika» sahifasidagi AI yordamchi sozlamalari (faqat administrator) */
export function AiSozlamaKarta({ boshHolat, standartTariflar }: { boshHolat: AiHolati; standartTariflar: string }) {
  const { t } = useTil();
  const toast = useToast();
  const [h, setH] = useState(boshHolat);
  const [yoqilgan, setYoqilgan] = useState(boshHolat.yoqilgan);
  const [kunlik, setKunlik] = useState(String(boshHolat.kunlikChegara));
  const [tariflar, setTariflar] = useState(boshHolat.tariflar);
  const [band, setBand] = useState(false);

  async function saqlash() {
    setBand(true);
    try {
      const yangi = await api.put<AiHolati>("/api/ai/sozlamalar", { yoqilgan, kunlikChegara: Number(kunlik), tariflar });
      setH(yangi);
      setTariflar(yangi.tariflar);
      toast(t("ai.saqlandi"));
    } catch (e) {
      toast(xatoMatni(e), "error");
    } finally {
      setBand(false);
    }
  }

  return (
    <Card koarish={false}>
      <CardHead
        title={t("ai.sozlama")}
        izoh={t("ai.sozlamaIzoh")}
        chap={
          <span className="grid h-9 w-9 flex-none place-items-center rounded-xl" style={{ background: "var(--ai-grad)", color: "#3b2a00" }}>
            <Sparkles size={18} />
          </span>
        }
      />
      <div
        className="mb-4 flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold"
        style={{ background: h.kalitBor ? "var(--accent-soft)" : "color-mix(in oklab, var(--lvl-1) 14%, transparent)" }}
      >
        <KeyRound size={16} className="mt-0.5 flex-none" />
        {h.kalitBor ? t("ai.kalitBor", { m: h.model }) : t("ai.kalitYoq")}
      </div>
      <div className="grid gap-4 sm:grid-cols-[auto_200px_1fr] sm:items-end">
        <label className="flex cursor-pointer items-center gap-2.5 text-[13.5px] font-bold">
          <input type="checkbox" className="h-4 w-4" checked={yoqilgan} onChange={(e) => setYoqilgan(e.target.checked)} />
          {t("ai.yoqilgan")}
        </label>
        <label className="field">
          <span>{t("ai.kunlik")}</span>
          <input type="number" min={1} max={10000} value={kunlik} onChange={(e) => setKunlik(e.target.value)} />
        </label>
        <p className="hint sm:pb-2.5">{t("ai.bugun", { n: h.bugun, m: h.kunlikChegara })}</p>
      </div>
      <label className="field mt-4">
        <span className="flex flex-wrap items-center gap-2">
          {t("ai.tariflar")}
          {tariflar === standartTariflar && <span className="tag !text-[11px]">{t("ai.standart")}</span>}
        </span>
        <textarea rows={14} className="mono !text-[12.5px]" value={tariflar} onChange={(e) => setTariflar(e.target.value)} />
        <span className="hint !font-normal">{t("ai.tariflarIzoh")}</span>
      </label>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {tariflar !== standartTariflar && (
          <button className="btn" onClick={() => setTariflar(standartTariflar)}>
            {t("ai.standartgaQaytar")}
          </button>
        )}
        <motion.button className="btn btn-primary" onClick={saqlash} disabled={band} whileTap={{ scale: 0.97 }}>
          {band ? t("u.saqlanmoqda") : t("u.saqlash")}
        </motion.button>
      </div>
    </Card>
  );
}
