"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, LoaderCircle, PencilLine, Sparkles, Undo2, X } from "lucide-react";
import { useState } from "react";

import { useTil } from "@/components/i18n/TilProvider";
import type { AiNatija, AiTaklif, Ishonch, Qaror } from "@/lib/ai/taklif";
import type { Kategoriya } from "@/lib/types";

export type { AiNatija, AiTaklif, Qaror };

function IshonchBelgisi({ ishonch }: { ishonch: Ishonch }) {
  const { t } = useTil();
  const nuqtalar = ishonch === "yuqori" ? 3 : ishonch === "orta" ? 2 : 1;
  return (
    <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold" style={{ color: "var(--ai-ink)" }} title={t(`ai.ishonch.${ishonch}`)}>
      {[1, 2, 3].map((i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: i <= nuqtalar ? "var(--ai-line)" : "color-mix(in oklab, var(--ai-line) 25%, transparent)" }} />
      ))}
      <span className="sr-only">{t(`ai.ishonch.${ishonch}`)}</span>
    </span>
  );
}

function QarorHolati({ qaror, onQaytar }: { qaror: Qaror; onQaytar: () => void }) {
  const { t } = useTil();
  return (
    <span className="inline-flex items-center gap-2 text-[12px] font-bold" style={{ color: qaror === "rad" ? "var(--muted)" : "var(--ok)" }}>
      {qaror === "rad" ? <X size={13} /> : <Check size={13} />}
      {t(`ai.q.${qaror}`)}
      <button className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline" style={{ color: "var(--muted)" }} onClick={onQaytar}>
        <Undo2 size={12} /> {t("ai.bekorQaytar")}
      </button>
    </span>
  );
}

/** Formadagi maydon yonidagi sariq «AI taklifi» qatori */
export function AiMaydonTaklifi({
  taklif,
  qiymatNomi,
  qaror,
  onQaror,
}: {
  taklif: AiTaklif;
  qiymatNomi: string;
  qaror: Qaror | undefined;
  onQaror: (q: Qaror | null) => void;
}) {
  const { t } = useTil();
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: qaror === "rad" ? 0.6 : 1, y: 0, scale: 1 }}
      className="ai-taklif mt-2 px-3 py-2"
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[12.5px]">
        <span className="ai-belgi">
          <Sparkles size={11} /> {t("ai.taklif")}
        </span>
        <strong style={{ color: "var(--ink)" }}>{qiymatNomi}</strong>
        <IshonchBelgisi ishonch={taklif.ishonch} />
        <span className="ml-auto flex flex-wrap gap-1">
          {qaror ? (
            <QarorHolati qaror={qaror} onQaytar={() => onQaror(null)} />
          ) : (
            <>
              <button className="ai-tugma" onClick={() => onQaror("tasdiqlangan")}>
                <Check size={13} /> {t("ai.tasdiqlash")}
              </button>
              <button className="ai-tugma" onClick={() => onQaror("ozgartirilgan")}>
                <PencilLine size={13} /> {t("ai.ozgartirish")}
              </button>
              <button className="ai-tugma" onClick={() => onQaror("rad")}>
                <X size={13} /> {t("ai.radEtish")}
              </button>
            </>
          )}
        </span>
      </div>
      {taklif.asos && <p className="mt-1 text-[12px] leading-snug" style={{ color: "var(--ink-2)" }}>{taklif.asos}</p>}
    </motion.div>
  );
}

/** AI taklif qilgan belgi: fragment, kategoriya, asos; «o‘zgartirish» — boshqa kategoriya tanlanadi */
export function AiBelgiTaklifi({
  taklif,
  kategoriyalar,
  kategoriyaNomi,
  qismNomi,
  qaror,
  onQaror,
}: {
  taklif: AiTaklif;
  kategoriyalar: Kategoriya[];
  kategoriyaNomi: (kod: string) => string;
  qismNomi: string;
  qaror: Qaror | undefined;
  onQaror: (q: Qaror | null, kategoriya?: string) => void;
}) {
  const { t } = useTil();
  const [tanlash, setTanlash] = useState(false);
  const b = taklif.qiymat as { kategoriya: string; qism: string; fragment: string };
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: qaror === "rad" ? 0.55 : 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      className="ai-taklif px-3 py-2.5"
    >
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="ai-belgi">
          <Sparkles size={11} /> {t("ai.taklif")}
        </span>
        <strong>{kategoriyaNomi(b.kategoriya)}</strong>
        <span className="tag">{qismNomi}</span>
        <IshonchBelgisi ishonch={taklif.ishonch} />
      </div>
      <p className="mt-1.5 text-[13px]" style={{ color: "var(--ink)" }}>«{b.fragment}»</p>
      {taklif.asos && <p className="mt-1 text-[12px]" style={{ color: "var(--ink-2)" }}>{taklif.asos}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {qaror ? (
          <QarorHolati
            qaror={qaror}
            onQaytar={() => {
              setTanlash(false);
              onQaror(null);
            }}
          />
        ) : tanlash ? (
          <select
            autoFocus
            className="!w-auto !py-1 text-[12.5px]"
            defaultValue=""
            onChange={(e) => e.target.value && onQaror("ozgartirilgan", e.target.value)}
            onBlur={() => setTanlash(false)}
          >
            <option value="" disabled>
              {t("ai.boshqaKategoriya")}
            </option>
            {kategoriyalar
              .filter((k) => k.kod !== b.kategoriya)
              .map((k) => (
                <option key={k.kod} value={k.kod}>
                  {kategoriyaNomi(k.kod)}
                </option>
              ))}
          </select>
        ) : (
          <>
            <button className="ai-tugma" onClick={() => onQaror("tasdiqlangan")}>
              <Check size={13} /> {t("ai.tasdiqlash")}
            </button>
            <button className="ai-tugma" onClick={() => setTanlash(true)}>
              <PencilLine size={13} /> {t("ai.ozgartirish")}
            </button>
            <button className="ai-tugma" onClick={() => onQaror("rad")}>
              <X size={13} /> {t("ai.radEtish")}
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

/** Tahlil kartasidagi AI paneli: so‘rash tugmasi, holat, model va prompt versiyasi */
export function AiPanel({
  natija,
  yuklanmoqda,
  onOlish,
  kutilmoqda,
}: {
  natija: AiNatija | null;
  yuklanmoqda: boolean;
  onOlish: () => void;
  kutilmoqda: number;
}) {
  const { t } = useTil();
  return (
    <div className="ai-panel px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-xl" style={{ background: "var(--ai-grad)", color: "#3b2a00" }}>
          <Sparkles size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-bold" style={{ color: "var(--ink)" }}>
            {yuklanmoqda ? t("ai.olinmoqda") : t("ai.taklif")}
          </div>
          <p className="hint">{t("ai.izoh")}</p>
        </div>
        <button className="btn btn-sm" onClick={onOlish} disabled={yuklanmoqda}>
          {yuklanmoqda ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {natija ? t("ai.qayta") : t("ai.olish")}
        </button>
      </div>
      <AnimatePresence>
        {yuklanmoqda && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3">
            <div className="skeleton h-2" />
          </motion.div>
        )}
      </AnimatePresence>
      {natija && !yuklanmoqda && (
        <div className="mt-2.5 flex flex-col gap-1 text-[12px]" style={{ color: "var(--muted)" }}>
          <span>{t("ai.model", { m: natija.model, v: natija.prompt_versiya })}</span>
          {natija.tashlandi > 0 && <span>{t("ai.tashlandi", { n: natija.tashlandi })}</span>}
          {kutilmoqda > 0 && <span>{t("ai.qarorlarEslatma")}</span>}
        </div>
      )}
    </div>
  );
}
